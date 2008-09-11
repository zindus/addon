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

includejs("payload.js");
includejs("syncfsmchaindata.js");

function SyncWindow()
{
	// logging enabled for issue #50
	//
	this.m_logger    = newLogger("SyncWindow"); // this.m_logger.level(Logger.NONE);

	this.m_logger.debug("constructor starts");

	this.m_payload   = null; // we keep it around so that we can pass the results back
	this.m_zwc       = new WindowCollection(SHOW_STATUS_PANEL_IN);
	this.m_sfcd      = null;

	this.initialise_per_fsm_members();

	this.m_logger.debug("constructor ends");
}

SyncWindow.prototype.initialise_per_fsm_members = function()
{
	this.m_sfo       = null;
	this.m_syncfsm   = null;
	this.m_timeoutID = null;
	this.m_has_fsm_state_changed = false;
}

SyncWindow.prototype.onLoad = function()
{
	this.m_logger.debug("onLoad: enters: is_cancelled: " + window.arguments[0].m_is_cancelled);

	this.m_payload = window.arguments[0];

	if (this.m_payload.m_is_cancelled)
		window.close();
	else
	{
		this.m_sfcd = new SyncFsmChainData(this.m_payload.m_a_accounts);

		this.m_logger.debug("onLoad: blah: sfcd: " + this.m_sfcd.toString());

		newLogger().info(getInfoMessage('start', this.m_sfcd.account_names_as_string()));

		window.setTimeout(this.onTimerFire, 0, this);
	}

	this.m_logger.debug("onLoad: exits");
}

SyncWindow.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	newLogger().info(getInfoMessage('finish'));
			
	if (!this.m_payload.m_is_cancelled)
		Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_SYNCWINDOW);

	this.m_logger.debug("onAccept: exits");

	return true;
}

SyncWindow.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel: enters");

	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified (below), which calls acceptDialog() to close the window, which means we end up exiting via onAccept()
	//
	if (this.m_syncfsm)
		this.m_syncfsm.cancel(this.m_timeoutID);

	// don't reference logger here because logger.js is out of scope after the window is closed...
	// this.m_logger.debug("onCancel: exits");

	return false;
}

SyncWindow.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("functor: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	// Strictly speaking, fsmstate should be null on first call to observer because the 'sync now' button is disabled when the fsm
	// is running.  But there is a race condition because the timer can fire and start in between 'sync now' and here.
	// especially when the addressbooks used to be iterated through in the SyncFsmState constructor (which takes a bunch of time).
	// Fixing the race condition would require reworking the notification mechanism via the fsm+maestro
	// So here, if the timer got in first, we just abort the 'Sync Now'.
	// We could create a specific error condition for this - but it'd be better to fix the condition
	// eg by altering the notification framework so that ConfigSettings can forestall the Timer immediately (while processing the click).
	//
	if (!this.m_has_fsm_state_changed && (fsmstate != null || this.m_payload.m_is_cancelled))
	{
		// if fsmstate != null              it means that the timer snuck in between 'Sync Now' and this window
		// if this.m_payload.m_is_cancelled it means that the preferences window was cancelled in between 'Sync Now' and this window
		//
		this.m_logger.debug("onFsmStateChangeFunctor: aborting - closing the window - fsm not started: " +
		                      " fsmstate: " + (fsmstate ? "set" : "not set") + " payload.m_is_cancelled: " + this.m_payload.m_is_cancelled);

		dId('zindus-sw').acceptDialog();
	}
	else if (!this.m_has_fsm_state_changed)
	{
		this.m_has_fsm_state_changed = true;

		this.m_zwc.populate();

		this.m_sfo     = new SyncFsmObserver(this.m_payload.m_es);
		this.m_syncfsm = SyncFsm.newSyncFsm(this.m_payload.m_syncfsm_details, this.m_sfcd);

		this.m_logger.debug("functor: starting fsm: " + this.m_syncfsm.state.id_fsm);

		this.m_syncfsm.start(window);
	}
	else 
	{
		this.m_timeoutID = fsmstate.timeoutID;

		var is_window_update_required = this.m_sfo.update(fsmstate);

		if (is_window_update_required)
		{
			dId('zindus-sw-progress-meter').setAttribute('value', this.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );

			var elDescription = dId('zindus-sw-progress-description');
			var elHtml        = document.createElementNS(Xpath.NS_XHTML, "p");
			elHtml.innerHTML  = this.m_sfcd.account().get(Account.username) + "<br/><br/>" + this.m_sfo.progressToString();
			// stringBundleString("progress.prefix") 

			if (!elDescription.hasChildNodes())
				elDescription.appendChild(elHtml);
			else
				elDescription.replaceChild(elHtml, elDescription.firstChild);

			this.m_logger.debug("ui: " + elHtml.innerHTML);

			this.m_zwc.forEach(this.zwc_functor(false));
		}

		if (fsmstate.isFinal())
		{
			this.m_zwc.forEach(this.zwc_functor(true));

			if (isPropertyPresent(Maestro.FSM_GROUP_TWOWAY, fsmstate.context.state.id_fsm))
			{
				StatusBar.saveState(this.m_payload.m_es);
				StatusBar.update();
			}

			this.m_sfcd.m_account_index++;

			if (this.m_payload.m_es.m_exit_status == 0 && this.m_sfcd.m_account_index < this.m_sfcd.length())
				window.setTimeout(this.onTimerFire, 0, this);
			else
				dId('zindus-sw').acceptDialog();
		}
	}
}

// this stuff used to be called from onLoad, but wierd things happen on Linux when the cancel button is pressed
// In using window.setTimeout() this way, the window is guaranteed to be fully loaded before the fsm is started.
//
SyncWindow.prototype.onTimerFire = function(context)
{
	// context.m_logger.debug("onTimerFire: enters");

	if (context.m_payload.m_is_cancelled)
	{
		window.close();
	}
	else
	{
		if (context.m_has_fsm_state_changed)
		{
			Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_SYNCWINDOW);
			context.initialise_per_fsm_members();
		}

		var listen_to = cloneObject(Maestro.FSM_GROUP_SYNC);
		Maestro.notifyFunctorRegister(context, context.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_SYNCWINDOW, listen_to);
	}

	// context.m_logger.debug("onTimerFire: exits");
}

SyncWindow.prototype.zwc_functor = function(is_showlogo)
{
	var functor = {
		m_is_showlogo: is_showlogo,

		run: function(win) {
			win.document.getElementById('zindus-statusbar-logo').setAttribute('hidden', !this.m_is_showlogo);
			win.document.getElementById('zindus-statusbar-logo-processing').setAttribute('hidden', this.m_is_showlogo);
		}
	};

	return functor;
}
