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
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/timer.js");

window.addEventListener("load", onLoad, false);
window.addEventListener("unload", onUnLoad, false);

function onLoad()
{ 
	window.zindus = new ZinMailWindowOverlay();
	window.zindus.onLoad();
}

function onUnLoad()
{
	window.zindus.onUnLoad();
}

function ZinMailWindowOverlay()
{
	this.m_logger          = newZinLogger("MailWindowOverlay");
	this.m_delay_on_repeat = null;
	this.m_last_sync_date  = null;
	this.m_timeoutID       = null;
	this.m_maestro         = null;
	this.m_timer_functor   = null;
}

ZinMailWindowOverlay.prototype.onLoad = function()
{
	try
	{
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			this.m_logger.info("startup:  " + APP_NAME + " " + APP_VERSION_NUMBER + " " + getUTCAndLocalTime());

			Filesystem.createDirectoriesIfRequired();

			var prefs = new MozillaPreferences();

			if (prefs.getCharPrefOrNull(prefs.branch(), "general.manualsynconly") != "true")
			{
				var delay_on_start     = parseInt(prefs.getIntPref(prefs.branch(), "system.timerDelayOnStart"));
				this.m_delay_on_repeat = parseInt(prefs.getIntPref(prefs.branch(), "system.timerDelayOnRepeat"));

				var x = this.statusSummary();

				this.m_last_sync_date = x['last_sync_date'];

				var delay = x['next_sync_date'] - x['now'];
				var min_delay = 1000 * randomPlusOrMinus(delay_on_start, (1/2 * delay_on_start).toFixed(0));

				// this.m_logger.debug("onLoad: delay: " + delay + " min_delay: " + min_delay);

				if (delay < min_delay)  // don't start any sooner than min_delay on startup - give the user a chance to get some work done
					delay = min_delay;

				this.m_timeoutID = window.setTimeout(this.onTimerFire, delay, this);

				newZinLogger().info("sync next:   " + getUTCAndLocalTime(delay));
			}
			else
				this.m_logger.debug("manual sync only - not starting timer.");

			StatusPanel.update();
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " ZinMailWindowOverlay onLoad() : " + ex);
	}
}

ZinMailWindowOverlay.prototype.onUnLoad = function()
{
	try
	{
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			if (ObserverService.isRegistered(ZinMaestro.TOPIC) && this.m_maestro)
			{
				this.m_logger.debug("unregistering observer");
				ObserverService.unregister(this.m_maestro, ZinMaestro.TOPIC);
			}
			else
				this.m_logger.debug("ObserverService isn't registered so don't unregister.");

			if (this.m_timeoutID)
			{
				this.m_logger.debug("cancelling sync and timer...");
				window.clearTimeout(this.m_timeoutID);
			}

			if (this.m_timer_functor)
				this.m_timer_functor.cancel();

			this.m_logger.info("shutdown: " + APP_NAME + " " + APP_VERSION_NUMBER + " " + getUTCAndLocalTime());
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " ZinMailWindowOverlay onUnLoad() : " + ex);
	}
}

ZinMailWindowOverlay.prototype.onTimerFire = function(context)
{
	context.m_logger.debug("entering onTimerFire...");
	context.m_timeoutID = null; // allows us to do sanity checking

	var x = context.statusSummary();

	if (context.m_last_sync_date == null || x['last_sync_date'] == null
	                                     || context.m_last_sync_date.toString() == x['last_sync_date'].toString())
	{
		if (!ObserverService.isRegistered(ZinMaestro.TOPIC))
		{
			context.m_maestro = new ZinMaestro();

			ObserverService.register(context.m_maestro, ZinMaestro.TOPIC);
		}
		else
			context.m_logger.debug("ObserverService is already registered so don't reregister.");

		var timer_id = hyphenate('-', ZinMaestro.ID_FUNCTOR_MAILWINDOW_TIMER, Date.parse(new Date(Date.now())));

		context.m_timer_functor = new ZinTimerFunctorSync(timer_id, context.scheduleTimer, context);

		context.m_timer_functor.run();
	}
	else
		context.scheduleTimer(context, x);
}

ZinMailWindowOverlay.prototype.scheduleTimer = function(context, x)
{
	context.m_logger.debug("entering scheduleTimer...");

	zinAssert(arguments.length == 1 || arguments.length == 2);
	zinAssert(context.m_timeoutID == null); // ensures that we never have > 1 oustanding timer

	if (arguments.length == 1)
		x = context.statusSummary();

	var delay = x['next_sync_date'] - x['now'];

	context.m_last_sync_date = x['last_sync_date'];

	context.m_timeoutID = window.setTimeout(context.onTimerFire, delay, context);

	newZinLogger().info("sync next:   " + getUTCAndLocalTime(delay));
}

ZinMailWindowOverlay.prototype.statusSummary = function()
{
	var last_sync_date = null;
	var zfiStatus      = StatusPanel.getZfi();
	var now            = new Date(Date.now());
	var next_sync_date = now;

	if (zfiStatus)
		last_sync_date = new Date(zfiStatus.getOrNull('date'));

	if (last_sync_date)
	{
		if (Date.parse(last_sync_date) > Date.parse(now)) // something wierd happened with time - last_sync_date is in the future!
		{
			next_sync_date = new Date(Date.parse(now) + 1000 * 3600); // schedule for an hour ahead - effectively, we're backing off 

			this.m_logger.warn("Something wierd happened - time seems to have gone backwards! " +
			                   "\n" + " current time:   " + now +
			                   "\n" + " last_sync_date: " + last_sync_date + 
							   "\n" + " next_sync_date: " + next_sync_date);
		}
		else 
		{
			next_sync_date = new Date(Date.parse(last_sync_date) +
			                   1000 * randomPlusOrMinus(this.m_delay_on_repeat, (1/6 * this.m_delay_on_repeat).toFixed(0)));

			if (Date.parse(now) > Date.parse(next_sync_date))
			{
				next_sync_date = now;
				this.m_logger.debug("next sync is overdue, using now: " + next_sync_date);
			}
			else
				this.m_logger.debug("next sync is last sync plus delay: " + next_sync_date);
		}
	}
	else
	{
		next_sync_date = now;
		this.m_logger.debug("last sync date unavailable, next sync is now: " + next_sync_date);
	}

	var ret = newObject("now", now, "next_sync_date", next_sync_date, "last_sync_date", last_sync_date);

	// this.m_logger.debug("statusSummary returns: " + "\n" +
	//                      " now:            " + ret['now'] + "\n" +
	// 					 " last_sync_date: " + last_sync_date + "\n" +
	// 					 " next_sync_date: " + next_sync_date );

	return ret;
}

function zindusPrefsDialog()
{
	window.openDialog("chrome://zindus/content/prefsdialog.xul", "_blank", "chrome,modal,centerscreen");

	return true;
}
