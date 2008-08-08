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

function TimerFunctor(id_fsm_functor, on_finish_function, on_finish_function_arg)
{
	zinAssert(arguments.length == 3);

	this.m_logger                 = newLogger("TimerFunctor");
	this.m_es                     = new SyncFsmExitStatus();
	this.m_sfo                    = new SyncFsmObserver(this.m_es);
	this.m_zwc                    = new WindowCollection(SHOW_STATUS_PANEL_IN);
	this.m_id_fsm_functor         = id_fsm_functor;
	this.m_syncfsm                = null;
	this.m_timeoutID              = null;
	this.is_running               = false;
	this.m_on_finish_function     = on_finish_function;
	this.m_on_finish_function_arg = on_finish_function_arg;
	this.m_is_fsm_functor_first_entry = true;
}

TimerFunctor.prototype.cancel = function()
{
	if (this.is_running)
	{
		this.m_logger.debug("cancelling fsm with m_timeoutID: " + this.m_timeoutID);

		this.m_syncfsm.cancel(this.m_timeoutID);
	}
}

TimerFunctor.prototype.run = function()
{
	this.m_logger.debug("run: m_id_fsm_functor: " + this.m_id_fsm_functor);

	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, this.m_id_fsm_functor, Maestro.FSM_GROUP_SYNC);
}

TimerFunctor.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("onFsmStateChangeFunctor: entering: m_id_fsm_functor: " + this.m_id_fsm_functor + " fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	if (this.m_is_fsm_functor_first_entry)
	{
		if (fsmstate)
		{
			this.m_logger.debug("onFsmStateChangeFunctor: fsm is running - backing off");
			this.finish(true);
		}
		else
		{
			this.m_is_fsm_functor_first_entry = false;
			this.m_logger.debug("onFsmStateChangeFunctor: fsm is not running - starting... ");
		
			this.m_zwc.populate();

			var functor_unhide_progresspanel = {
				run: function(win) {
					win.document.getElementById('zindus-progresspanel').setAttribute('hidden', false);
				}
			};

			this.m_zwc.forEach(functor_unhide_progresspanel);

			newLogger().info("sync start:  " + getFriendlyTimeString() + " version: " + APP_VERSION_NUMBER);

			var accounts = AccountFactory.accountsLoadFromPrefset();
			var account;

			if (accounts.length > 0)
				account = accounts[0];
			else
			{
				// we're faking a sync to a zimbra account where the url/username/password are unspecified.
				// Naturally this will fail (which is what we want).
				//
				account = new Account();
				account.set('sourceid', Number(SOURCEID_TB) + 1);
				account.set('format', Account.Zimbra );
			}

			var prefset_general = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);
			prefset_general.load();

			var syncfsm_details = newObject('accounts', [ account ], 'type', "twoway", 'prefset_general', prefset_general);

			this.m_logger.debug("onFsmStateChangeFunctor: account: " + account.toString());

			this.m_syncfsm = SyncFsm.newSyncFsm(syncfsm_details, 0);

			this.m_syncfsm.start(window);
			this.is_running = true;
		}
	}
	else
	{
		this.m_timeoutID = fsmstate.timeoutID;

		var is_window_update_required = this.m_sfo.update(fsmstate);

		if (is_window_update_required)
		{
			var functor_update_progresspanel = {
				context: this,
				run: function(win) {
					// the window might have disappeared between when we iterated all open windows and now - so we test that
					// the element exists just before setting it's attribute...
					//
					if (win.document && win.document.getElementById("zindus-progresspanel"))
					{
						var el_statuspanel_progress_meter  = win.document.getElementById("zindus-progresspanel-progress-meter");
						var el_statuspanel_progress_label  = win.document.getElementById("zindus-progresspanel-progress-label");
						var el_statuspanel_logo            = win.document.getElementById("zindus-statuspanel-logo");
						var el_statuspanel_logo_processing = win.document.getElementById("zindus-statuspanel-logo-processing");

						el_statuspanel_progress_meter.setAttribute('value', this.context.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );
						el_statuspanel_progress_label.setAttribute('value', this.context.m_sfo.progressToString());
						el_statuspanel_logo.setAttribute('hidden', true);
						el_statuspanel_logo_processing.setAttribute('hidden', false);
					}
				}
			};

			this.m_zwc.forEach(functor_update_progresspanel);
		}

		if (fsmstate.isFinal())
		{
			StatusPanel.save(this.m_es);

			var functor_hide_progresspanel = {
				run: function(win) {
					if (win.document && win.document.getElementById("zindus-progresspanel"))
					{
						win.document.getElementById("zindus-progresspanel-progress-label").setAttribute('value', "");
						win.document.getElementById('zindus-progresspanel').setAttribute('hidden', true);
						win.document.getElementById('zindus-statuspanel-logo').setAttribute('hidden', false);
						win.document.getElementById('zindus-statuspanel-logo-processing').setAttribute('hidden', true);
					}
				}
			};

			this.m_zwc.forEach(functor_hide_progresspanel);
			
			StatusPanel.update(this.m_zwc);

			this.finish(false);
		}
	}
}

TimerFunctor.prototype.finish = function(is_back_off)
{
	this.m_logger.debug("finish: is_back_off: " + is_back_off);

	if (is_back_off)
		newLogger().info("sync backing off: " + getFriendlyTimeString());
	else
		newLogger().info("sync finish: " + getFriendlyTimeString());

	Maestro.notifyFunctorUnregister(this.m_id_fsm_functor);

	this.is_running = false;

	if (this.m_on_finish_function)
	{
		if (is_back_off)
		{
			var now            = new Date();
			var next_sync_date = new Date();
			next_sync_date.setUTCMilliseconds(now.getUTCMilliseconds() + 1000 * 3600); // reschedule for an hour ahead - ie, back off...
			var x = newObject("now", now, "next_sync_date", next_sync_date, "last_sync_date", null);
			this.m_on_finish_function(this.m_on_finish_function_arg, x);
		}
		else
			this.m_on_finish_function(this.m_on_finish_function_arg);
	}
}
