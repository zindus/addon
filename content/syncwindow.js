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

include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmobserver.js");

function SyncWindow()
{
	this.m_syncfsm   = null;
	this.m_timeoutID = null; // timoutID for the next schedule of the fsm
	this.m_payload   = null; // we keep it around so that we can pass the results back
	this.m_sfo       = new SyncFsmObserver();
	this.m_logger    = newZinLogger("SyncWindow");
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

	if (!this.m_has_observer_been_called)
	{
		// fsmstate should be null on first call to observer because the 'sync now' button should be disabled if the fsm is running
		//
		zinAssert(fsmstate == null);

		this.m_has_observer_been_called = true;

		this.m_logger.debug("functor: starting fsm: " + this.m_syncfsm.state.id_fsm + "\n");

		newZinLogger().info("sync start:  " + getDateUTCString());
		this.m_syncfsm.start();
	}
	else 
	{
		this.m_timeoutID = fsmstate.timeoutID;

		this.m_logger.debug("functor: timeoutID: " + this.m_timeoutID);

		var is_window_update_required = this.m_sfo.update(fsmstate);

		if (is_window_update_required)
		{
			document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value',
			                                        this.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );
			document.getElementById('zindus-syncwindow-progress-description').setAttribute('value',
			                                        stringBundleString("zfomPrefix") + " " + this.m_sfo.progressToString());
		}

		if (fsmstate.isFinal())
		{
			this.m_payload.m_result = this.m_sfo.exitStatus();

			newZinLogger().info("sync finish: " + getDateUTCString());

			document.getElementById('zindus-syncwindow').acceptDialog();
		}
	}

	if (typeof(Log) == 'function')  // the scope into which the source file was included is out of scope after acceptDialog()
		this.m_logger.debug("functor: exiting");
}
