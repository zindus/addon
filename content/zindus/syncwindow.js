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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmobserver.js");
include("chrome://zindus/content/windowcollection.js");
include("chrome://zindus/content/statuspanel.js");

function SyncWindow()
{
	this.m_syncfsm   = null;
	this.m_timeoutID = null; // timoutID for the next schedule of the fsm
	this.m_payload   = null; // we keep it around so that we can pass the results back
	this.m_zwc       = null; // the collection of windows that have status+progress panels
	this.m_sfo       = new SyncFsmObserver();
	this.m_logger    = newZinLogger("SyncWindow");
	this.m_logger.level(ZinLogger.NONE);

	this.m_has_observer_been_called = false;
}

SyncWindow.prototype.onLoad = function()
{
	this.m_logger.debug("onLoad: starts: " + getTime() + "\n");

	this.m_payload = window.arguments[0];
	this.m_syncfsm = this.m_payload.m_syncfsm;

	var listen_to = zinCloneObject(ZinMaestro.FSM_GROUP_SYNC);
	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_SYNCWINDOW, listen_to);

	this.m_logger.debug("onLoad: exiting");
}

SyncWindow.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: before unregister...");

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_SYNCWINDOW);

	this.m_logger.debug("onAccept: after unregister...");

	return true;
}

SyncWindow.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel: entered");
			
	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified and closes the window.
	//
	this.m_syncfsm.cancel(this.m_timeoutID);

	this.m_logger.debug("onCancel: exited");

	return false;
}

SyncWindow.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("functor: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	var functor = {
		m_showlogo: false,

		run: function(win) {
			win.document.getElementById('zindus-statuspanel-logo').setAttribute('hidden', !this.m_showlogo);
			win.document.getElementById('zindus-statuspanel-logo-processing').setAttribute('hidden', this.m_showlogo);
		}
	};

	if (!this.m_has_observer_been_called)
	{
		// fsmstate should be null on first call to observer because the 'sync now' button should be disabled if the fsm is running
		//
		zinAssert(fsmstate == null);

		this.m_has_observer_been_called = true;

		this.m_logger.debug("functor: starting fsm: " + this.m_syncfsm.state.id_fsm + "\n");

		newZinLogger().info("sync start:  " + getUTCAndLocalTime());
		this.m_syncfsm.start();
	}
	else 
	{
		this.m_timeoutID = fsmstate.timeoutID;

		var is_window_update_required = this.m_sfo.update(fsmstate);

		if (is_window_update_required)
		{
			if (!this.m_zwc)
			{
				this.m_zwc = new ZinWindowCollection('folderPaneBox'); // this used to say 'zindus-progresspanel'
				this.m_zwc.populate();
			}

			document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value',
			                                        this.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );
			document.getElementById('zindus-syncwindow-progress-description').setAttribute('value',
			                                        stringBundleString("zfomPrefix") + " " + this.m_sfo.progressToString());


			functor.m_showlogo = false;
			this.m_zwc.forEach(functor);
		}

		if (fsmstate.isFinal())
		{
			var es = this.m_sfo.exitStatus();
			this.m_payload.m_result = es;

			functor.m_showlogo = true;
			this.m_zwc.forEach(functor);

			if (fsmstate.context.state.id_fsm == ZinMaestro.FSM_ID_TWOWAY)
			{
				StatusPanel.save(es);
				StatusPanel.update();
			}

			newZinLogger().info("sync finish: " + getUTCAndLocalTime());

			document.getElementById('zindus-syncwindow').acceptDialog();
		}
	}

	if (typeof(Log) == 'function')  // the scope into which the source file was included is out of scope after acceptDialog()
		this.m_logger.debug("functor: exiting");
}
