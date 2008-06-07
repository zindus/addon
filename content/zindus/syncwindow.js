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

include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmobserver.js");
include("chrome://zindus/content/windowcollection.js");
include("chrome://zindus/content/statuspanel.js");

function SyncWindow()
{
	// logging enabled for issue #50
	//
	this.m_logger    = ZinLoggerFactory.instance().newZinLogger("SyncWindow"); // this.m_logger.level(ZinLogger.NONE);

	this.m_logger.debug("constructor starts");

	this.m_syncfsm   = null;
	this.m_timeoutID = null; // timoutID for the next schedule of the fsm
	this.m_payload   = null; // we keep it around so that we can pass the results back
	this.m_zwc       = new ZinWindowCollection(SHOW_STATUS_PANEL_IN);

	this.m_has_observer_been_called = false;

	this.m_logger.debug("constructor ends");
}

SyncWindow.prototype.onLoad = function()
{
	this.m_logger.debug("onLoad: enters");

	this.m_payload = window.arguments[0];

	this.m_logger.debug("is_cancelled " + this.m_payload.m_is_cancelled);

	if (this.m_payload.m_is_cancelled)
		window.close();
	else
	{
		this.m_sfo     = new SyncFsmObserver(this.m_payload.m_es);
		this.m_syncfsm = this.m_payload.m_syncfsm;

		var listen_to = ZinUtil.cloneObject(ZinMaestro.FSM_GROUP_SYNC);
		ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_SYNCWINDOW, listen_to);
	}

	this.m_logger.debug("onLoad: exits");
}

SyncWindow.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	if (!this.m_payload.m_is_cancelled)
		ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_SYNCWINDOW);

	this.m_logger.debug("onAccept: exits");

	return true;
}

SyncWindow.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel: enters");
			
	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified and closes the window.
	//
	this.m_syncfsm.cancel(this.m_timeoutID);

	// don't reference logger because logger.js is out of scope after the fsm has cancelled...
	// this.m_logger.debug("onCancel: exits");

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

	// Strictly speaking, fsmstate should be null on first call to observer because the 'sync now' button is disabled when the fsm
	// is running.  But there is a race condition because the timer can fire and start in between 'sync now' and here.
	// especially because the addressbooks gets iterated through in the SyncFsmState constructor (which takes a bunch of time).
	// Fixing the race condition would require reworking the notification mechanism via the fsm+maestro
	// So here, if the timer got in first, we just abort the 'Sync Now'.
	// Do we want to create a specific error condition for this?  Perhaps it'd be better to fix the condition
	// eg by altering the notification framework so that PrefsDialog can forestall the Timer immediately (while processing the click).
	//
	if (!this.m_has_observer_been_called && fsmstate != null)
	{
		this.m_logger.debug("functor: timer got in between 'Sync Now' and this window - aborting");

		document.getElementById('zindus-syncwindow').acceptDialog();
	}
	else if (!this.m_has_observer_been_called)
	{
		// zinAssert(fsmstate == null);

		this.m_has_observer_been_called = true;

		this.m_logger.debug("functor: starting fsm: " + this.m_syncfsm.state.id_fsm);

		this.m_zwc.populate();

		ZinLoggerFactory.instance().newZinLogger().info("sync start:  " + getFriendlyTimeString() + " version: " + APP_VERSION_NUMBER);
		this.m_syncfsm.start(window);
	}
	else 
	{
		this.m_timeoutID = fsmstate.timeoutID;

		var is_window_update_required = this.m_sfo.update(fsmstate);

		if (is_window_update_required)
		{
			document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value',
			                                        this.m_sfo.get(SyncFsmObserver.PERCENTAGE_COMPLETE) );

			var elDescription = document.getElementById('zindus-syncwindow-progress-description');
			var elHtml        = document.createElementNS("http://www.w3.org/1999/xhtml", "p");

			elHtml.innerHTML = stringBundleString("zfomPrefix") + " " + this.m_sfo.progressToString();

			if (!elDescription.hasChildNodes())
				elDescription.appendChild(elHtml);
			else
				elDescription.replaceChild(elHtml, elDescription.firstChild);

			this.m_logger.debug("ui: " + elHtml.innerHTML);

			functor.m_showlogo = false;
			this.m_zwc.forEach(functor);
		}

		if (fsmstate.isFinal())
		{
			functor.m_showlogo = true;
			this.m_zwc.forEach(functor);

			if (isPropertyPresent(ZinMaestro.FSM_GROUP_TWOWAY, fsmstate.context.state.id_fsm))
			{
				StatusPanel.save(this.m_payload.m_es);
				StatusPanel.update();
			}

			ZinLoggerFactory.instance().newZinLogger().info("sync finish: " + getFriendlyTimeString());

			document.getElementById('zindus-syncwindow').acceptDialog();
		}
	}

	if (typeof(Log) == 'function')  // the scope into which the source file was included is out of scope after acceptDialog()
		this.m_logger.debug("functor: exiting");
}
