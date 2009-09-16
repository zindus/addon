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
// $Id: timer.js,v 1.46 2009-09-16 22:28:51 cvsuser Exp $

function TimerFunctor(id_fsm_functor, on_finish_function, on_finish_function_arg)
{
	zinAssert(arguments.length == 3);

	this.m_logger                 = newLogger("TimerFunctor"); // this.m_logger.level(Logger.NONE);
	this.m_zwc                    = new WindowCollection(show_status_panel_in());
	this.m_a_zwc_functor          = new Object();
	this.m_id_fsm_functor         = id_fsm_functor;
	this.m_on_finish_function     = on_finish_function;
	this.m_on_finish_function_arg = on_finish_function_arg;
	this.m_sfcd                   = null;
	this.m_grr                    = new GoogleRuleRepeater();

	this.initialise_per_fsm_members();
}

TimerFunctor.prototype.initialise_per_fsm_members = function()
{
	this.m_es        = new SyncFsmExitStatus();
	this.m_sfo       = new SyncFsmObserver(this.m_es);
	this.m_syncfsm   = null;
	this.m_timeoutID = null;
	this.is_running  = false;
	this.m_has_fsm_state_changed = false;
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

	var accounts = AccountStatic.arrayLoadFromPrefset();

	if (accounts.length > 0)
	{
		this.m_sfcd = new SyncFsmChainData(accounts);

		logger('info').info(getInfoMessage('start', this.m_sfcd.signature()));

		window.setTimeout(this.onTimerFire, 0, this);
	}
	else
	{
		logger('info').info(getInfoMessage('start', "no accounts configured"));
		StatusBarState.save(this.m_es, true);
		this.m_zwc.populate();
		StatusBarState.update(this.m_zwc);
		zinAssert(!this.m_has_fsm_state_changed); // don't want finish() to unregister the fsm observer
		this.finish();
	}
}

TimerFunctor.prototype.onTimerFire = function(self)
{
	if (self.m_has_fsm_state_changed)
	{
		Maestro.notifyFunctorUnregister(self.m_id_fsm_functor);
		self.initialise_per_fsm_members();
	}

	Maestro.notifyFunctorRegister(self, self.onFsmStateChangeFunctor, self.m_id_fsm_functor, Maestro.FSM_GROUP_SYNC);
}

TimerFunctor.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("onFsmStateChangeFunctor: entering: m_id_fsm_functor: " + this.m_id_fsm_functor +
	                       " fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	if (!this.m_has_fsm_state_changed)
	{
		this.m_has_fsm_state_changed = true;

		if (fsmstate)
		{
			this.m_logger.debug("onFsmStateChangeFunctor: fsm is running - backing off");
			this.finish(true);
		}
		else
		{
			this.m_logger.debug("onFsmStateChangeFunctor: fsm is not running - starting... ");
		
			this.m_zwc.populate();
			this.m_zwc.forEach(this.zwc_functor('unhide'));

			this.m_syncfsm = SyncFsm.newSyncFsm({type: "twoway"}, this.m_sfcd);

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
			this.m_zwc.forEach(this.zwc_functor('update'));
			this.m_logger.debug("ui: " + this.m_sfcd.account().username + ": " + this.m_sfo.progressToString());
		}

		if (fsmstate.isFinal())
		{
			var is_repeat = false;
			
			if (this.m_sfcd.account().format_xx() == FORMAT_GD)
				is_repeat = this.m_grr.resolve_if_appropriate(this.m_logger, this.m_es, this.m_sfcd) ||
				            (this.m_es.m_exit_status == 0 && this.m_es.m_is_gd_group_mod);

			if (is_repeat)
			{
				// don't bother putting anything in the UI here - it flies by too fast for the user to see it
				logger('info').info(getInfoMessage('repeat', this.m_sfcd.account().username));
			}

			if (!is_repeat)
			{
				StatusBarState.save(this.m_es);

				this.m_sfcd.m_account_index++;
			}

			if (is_repeat || (this.m_es.m_exit_status == 0 && this.m_sfcd.m_account_index < this.m_sfcd.length()))
				window.setTimeout(this.onTimerFire, 0, this);
			else
			{
				this.m_zwc.forEach(this.zwc_functor('hide'));
			
				StatusBarState.update(this.m_zwc);

				this.finish(false);
			}
		}
	}
}

TimerFunctor.prototype.finish = function(is_back_off)
{
	this.m_logger.debug("finish: is_back_off: " + is_back_off);

	logger('info').info(getInfoMessage(is_back_off ? 'backoff' : 'finish'));

	if (this.m_has_fsm_state_changed)
		Maestro.notifyFunctorUnregister(this.m_id_fsm_functor);

	this.is_running = false;

	// This next line is needed!  My guess is that it affects reference-counted xpcom objects held by the fsm.
	// If it isn't present, everything seemingly works fine under windows.
	// But under Linux, the behaviour is exceedingly wierd: when a sync is started from the preferences window,
	// this.nsIAddressBook().getAbDatabaseFromURI(uri) in AddressBookTb2:lookupCard() throws an NS_ERROR_FILE_ACCESS_DENIED
	// exception and subsequently either crashes tb or display an alert: unable to load addressbook file abook.mab.
	// blech! leni - Wed Oct  1 15:20:31 AUSEST 2008
	//
	this.initialise_per_fsm_members();

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

TimerFunctor.prototype.zwc_functor = function(name)
{
	var self = this;

	if (!(name in this.m_a_zwc_functor))
		switch(name) {
			case 'hide':
				this.m_a_zwc_functor[name] = {
					run: function(win) {
						dId(win, "zindus-statusbar-progress-text").setAttribute('value', "");
						dId(win, 'zindus-statusbar-progress').setAttribute('hidden', true);
						dId(win, 'zindus-statusbar-logo-processing').setAttribute('hidden', true);
						dId(win, 'zindus-statusbar-logo').setAttribute('hidden', false);
					}
				};
				break;

			case 'unhide':
				this.m_a_zwc_functor[name] = {
					run: function(win) {
						dId(win, 'zindus-statusbar-progress').setAttribute('hidden', false);
						dId(win, 'zindus-statusbar-progress-leftmost').value = 
							stringBundleString("brand.zindus") + ": " + self.m_sfcd.account().username;
					}
				};
				break;

			case 'update':
				this.m_a_zwc_functor[name] = {
					run: function(win) {
						dId(win, "zindus-statusbar-progress-meter").setAttribute('value',
						                                             self.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );
						dId(win, "zindus-statusbar-progress-text").setAttribute('value', self.m_sfo.progressToString());
						dId(win, "zindus-statusbar-logo").setAttribute('hidden', true);
						dId(win, "zindus-statusbar-logo-processing").setAttribute('hidden', false);
					}
				};
				break;

			default:
				zinAssert(false, name);
		}

	return this.m_a_zwc_functor[name];
}
