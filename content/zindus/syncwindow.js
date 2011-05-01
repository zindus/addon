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
 * Portions created by Initial Developer are Copyright (C) 2007-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/
// $Id: syncwindow.js,v 1.53 2011-05-01 02:36:30 cvsuser Exp $

function SyncWindow()
{
	// logging enabled for issue #50
	//
	this.m_logger    = newLogger("SyncWindow"); // this.m_logger.level(Logger.NONE);

	this.m_logger.debug("constructor starts");

	this.m_payload   = null; // we keep it around so that we can pass the results back
	this.m_zwc       = new WindowCollection(show_status_panel_in());
	this.m_sfcd      = null;
	this.m_grr       = new GoogleRuleRepeater();

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

		this.m_logger.debug("onLoad: sfcd: " + this.m_sfcd.toString());

		logger('info').info(getInfoMessage('start', this.m_sfcd.signature()));

		window.setTimeout(this.onTimerFire, 0, this);
	}

	this.m_logger.debug("onLoad: exits");
}

SyncWindow.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	logger('info').info(getInfoMessage('finish'));

	if (!this.m_payload.m_is_cancelled)
		Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_SYNCWINDOW);

	// ensure that if get into onCancel after onAccept that we don't call syncfsm.cancel();
	// because that fires an evCancel event into an fsm that's in the 'final' state.
	//
	this.m_syncfsm = null;

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

			this.updateProgressUi(this.m_sfcd.account().username + "<br/><br/>" + this.m_sfo.progressToString());

			this.m_zwc.forEach(this.zwc_functor(false));
		}

		if (fsmstate.isFinal())
		{
			let sfcd     = this.m_sfcd;
			let es       = this.m_payload.m_es;
			let sourceid = AccountStatic.indexToSourceId(sfcd.m_account_index);
			let is_repeat_current = false;
			let is_repeat_all     = false;

			if (sfcd.account().format_xx() == FORMAT_GD)
				is_repeat_current =
					(sfcd.sourceid(sourceid, 'c_start') < MAX_SYNC_START) &&
					(this.m_grr.resolve_if_appropriate(this.m_logger, es, sfcd)
					  || (es.m_exit_status == 0 && sfcd.sourceid(sourceid, 'is_gd_group_mod')
					  || (es.m_exit_status == 1 && sfcd.sourceid(sourceid, 'is_gd_token_invalid'))));

			sfcd.sourceid(sourceid, 'is_gd_group_mod',     false)
			sfcd.sourceid(sourceid, 'is_gd_token_invalid', false)

			if (!is_repeat_current && sfcd.is_last_in_chain() && (sfcd.account(0).format_xx() == FORMAT_ZM) && (es.m_exit_status == 0)) {
				let i;
				let sourceid_for_account;
				for (i = 1; i < sfcd.m_a_item.length; i++) { // start at 1 so as to exclude the zimbra account
					sourceid_for_account = AccountStatic.indexToSourceId(i);
					if (sfcd.sourceid(sourceid_for_account, 'is_tb_changed') &&
					    (sfcd.sourceid(sourceid_for_account, 'c_start') < MAX_SYNC_START))
						is_repeat_all = true;
					sfcd.sourceid(sourceid_for_account, 'is_tb_changed', false)
				}
			}

			if (is_repeat_current || is_repeat_all)
			{
				logger('info').info(getInfoMessage('repeat', sfcd.account().username));

				if (is_repeat_all)
					this.m_sfcd.m_account_index = 0;
			}
			else
			{
				this.m_zwc.forEach(this.zwc_functor(true));

				if (fsmstate.context.state.id_fsm in Maestro.FSM_GROUP_TWOWAY)
				{
					StatusBarState.save(this.m_payload.m_es);
					StatusBarState.update();
				}

				this.m_sfcd.m_account_index++;
			}

			if (is_repeat_current || is_repeat_all || (es.m_exit_status == 0 && sfcd.m_account_index < sfcd.length()))
				window.setTimeout(this.onTimerFire, 0, this);
			else
				dId('zindus-sw').acceptDialog();
		}
	}
}

SyncWindow.prototype.updateProgressUi = function(html)
{
	xulSetHtml('zindus-sw-progress-description', html);

	this.m_logger.debug("ui: " + html.replace(/\<.*\>/, " "));
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
				dId(win, 'zindus-statusbar-logo').setAttribute('hidden', !this.m_is_showlogo);
				dId(win, 'zindus-statusbar-logo-processing').setAttribute('hidden', this.m_is_showlogo);
		}
	};

	return functor;
}
