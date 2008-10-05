/* ***** BEGIN LICENSE BLOCK *****
 * 
 * "The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Zindus Sync.
 * 
 * The Initial Developer of the Original Code is Toolware Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007-2008
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// Bits of "exit status" reported to the outside world:
// - last sync success: (time, maybe other stuff like conflicts...)
// - last sync:         (time, success/fail and optional failure reason)
//
// Other thoughts (not implemented)
// - TWOWAY:   next sync: when scheduled - currently you have to grep the logfile to find out
// - AUTHONLY: last auth: (time, success/fail and optional failure reason)
//
// known bugs:
// - deslecting the "verbose logging" preference in configsettings window doesn't affect this scope.
//   That's easily fixed - by duplicating the preference-listening code that's in mailwindowoverlay.js here...
//   But the underlying approach is wrong - logging should run in one shared scope - just like this:
//   http://wiki.mozilla.org/Labs/JS_Modules#Logging  (Gecko 1.9).
//   That module would hold the loglevel - currently we have to share loglevel state changes between scopes.
//   Ideally the fix here would be delayed until Tb2 is no longer supported, which
//   would mean that entire logging framework could be refactored to use the "Javascript module" approach.
//   Then the verbose-logging-state-change-notification code could be removed altogether.
//   Otherwise, we could bite the bullet, create a service and put logging in that.
//   
function StatusBar()
{
	this.m_logger         = newLogger("StatusBar");
	this.m_timer_id       = null;
	this.m_timer_functor  = null;
	this.m_is_fsm_running = false;
	this.m_maestro        = null;
}

StatusBar.prototype.onLoad = function()
{
	this.m_logger.debug("onLoad: enters and exits");

	if (!ObserverService.isRegistered(Maestro.TOPIC))
	{
		this.m_maestro = new Maestro();

		ObserverService.register(this.m_maestro, Maestro.TOPIC);
	}

	this.m_timer_id = hyphenate('-', Maestro.ID_FUNCTOR_STATUSBAR_TIMER, Date.now());

	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, this.m_timer_id, Maestro.FSM_GROUP_SYNC);
}

StatusBar.prototype.onUnLoad = function()
{
	this.m_logger.debug("onUnLoad: enters");

	if (this.m_timer_functor != null && this.m_is_fsm_running)
	{
		this.m_logger.debug("onUnLoad: cancelling sync...");
		this.m_timer_functor.cancel();
		this.m_timer_functor = null;
	}

	Maestro.notifyFunctorUnregister(this.m_timer_id);
}

StatusBar.prototype.onDblClick = function(event)
{
	this.m_logger.debug("onDblClick: event: button: " + event.button);
}

StatusBar.prototype.timerStart = function()
{
	var msg = "timerStart: ";

	if (!this.m_is_fsm_running)
	{
		window.setTimeout(this.onTimerFire, 0, this);
		msg += "fired";
	}
	else
		msg += "fsm is running - do nothing";

	this.m_logger.debug(msg);
}

StatusBar.prototype.onTimerFire = function(context)
{
	context.m_logger.debug("onTimerFire: about to run timer");
	context.m_timer_functor = new TimerFunctor(Maestro.ID_FUNCTOR_STATUSBAR_TIMER, null, null);
	context.m_timer_functor.run();
}

StatusBar.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_is_fsm_running = Boolean(fsmstate && ! fsmstate.isFinal());

	if (!this.m_is_fsm_running)
		this.m_timer_functor = null; // don't hold a reference to the functor if the fsm is finished

	// for a reason that I don't understand, the dId of the menuitem returns null at onLoad() time on OSX
	// so we test for it...
	//
	var sync_now = dId("zindus-statusbar-sync-now");

	if (sync_now)
		sync_now.setAttribute('disabled', this.m_is_fsm_running);
}

// Static methods that interact with status.txt
//
StatusBar.saveState = function(es, is_never_synced)
{
	var zfc = StatusBar.stateAsZfc();
	var now = new Date();
	var zfi = new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_STATUSBAR,
	                             'date', now.getTime(), // used to use stringified dates here but it turns out they're not portable
	                             'exitstatus', es.m_exit_status,
	                             'conflicts', es.m_count_conflicts,
	                             'is_never_synced', (is_never_synced ? "true" : "false"),
	                             'appversion', APP_VERSION_NUMBER );

	zfc.set(zfi);
	zfc.save();
}

StatusBar.stateAsZfc = function()
{
	var ret = new FeedCollection();
	ret.filename(Filesystem.FILENAME_STATUS);

	return ret;
}

StatusBar.stateAsZfi = function()
{
	var zfc = StatusBar.stateAsZfc();
	var ret = null;

	zfc.load();

	if (zfc.isPresent(FeedItem.KEY_STATUSBAR))
		ret = zfc.get(FeedItem.KEY_STATUSBAR);

	return ret;
}

StatusBar.update = function(zwc)
{
	var zfiStatus = StatusBar.stateAsZfi();

	if (zfiStatus)
	{
		var exitstatus      = zfiStatus.getOrNull('exitstatus');
		var conflicts       = zfiStatus.getOrNull('conflicts');
		var is_never_synced = zfiStatus.getOrNull('is_never_synced');
		var status          = null;
		var tooltip, tooltip_prefix;

		var last_sync_date = new Date();
		last_sync_date.setTime(zfiStatus.getOrNull('date'));
		tooltip = last_sync_date.toLocaleString();

		if (is_never_synced && is_never_synced == "true")
		{
			status = "alert";
			tooltip = stringBundleString("sp.last.sync.never");
		}
		else if (exitstatus != 0)
		{
			status = "error"
			tooltip_prefix = stringBundleString("sp.last.sync.failed");
		}
		else if (conflicts > 0)
		{
			status = "alert";
			tooltip_prefix = stringBundleString("sp.last.sync") + ": " + conflicts + " " +
			                 stringBundleString("sp.last.sync.conflicts");
		}
		else
		{
			status = "insync";
			tooltip_prefix = stringBundleString("sp.last.sync");
		}

		tooltip = tooltip_prefix + ": " + tooltip;
	}
	else
	{
		status = "alert";
		tooltip = stringBundleString("sp.last.sync.never");
	}

	var obj = { alert : '!', error : 'X', insync : 'Y' };

	logger().debug("StatusBar: update: status: " + obj[status] + " (" + status + ") tooltip: " + tooltip);

	if (arguments.length == 0)
	{
		zwc = new WindowCollection(SHOW_STATUS_PANEL_IN);
		zwc.populate();
	}

	var functor = {
		run: function(win) {
			for (var x in obj)
			{
				dId(win, "zindus-statusbar-" + x).hidden = (status != x);
				dId(win, "zindus-statusbar-" + x).value  = obj[x];
			}

			dId(win, "zindus-statusbar-state").tooltipText = tooltip;
			dId(win, "zindus-statusbar-state").hidden = false;
		}
	};

	zwc.forEach(functor);
}
