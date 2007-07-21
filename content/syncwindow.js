include("chrome://zindus/content/const.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmprogressobserver.js");

var gLogger      = null;

function SyncWindow()
{
	this.m_syncfsm         = null;
	this.timeoutID_syncfsm = null; // need to remember this in case the user cancels
	this.timeoutID_soapfsm = null; // likewise
	this.m_newstate        = null; // the cancel method needs to know whether to expect a continuation or not.
								   // if newstate == 'start', there would have been a transition, otherwise not.
	this.m_payload         = null; // we keep it around so that we can pass the results back
	this.m_sfpo            = new SyncFsmProgressObserver();
	this.m_has_observer_been_called = false;
}

SyncWindow.prototype.onLoad = function()
{
	// this doesn't work document.getElementById('zindus-syncwindow').setAttribute('hidden', true);
	// these work but part of the parent window underneath is invisble
	// document.getElementById('zindus-syncwindow').setAttribute('collapsed', true);
	// document.getElementById('zindus-syncwindow').setAttribute('hidechrome', true);

	gLogger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
	gLogger.debug("=========================================== SyncWindow.onLoad: " + getTime() + "\n");

	this.m_payload = window.arguments[0];
	this.m_syncfsm = this.m_payload.m_syncfsm;

	var listen_to = cnsCloneObject(ZinMaestro.FSM_GROUP_SYNC);
	listen_to[ZinMaestro.FSM_ID_SOAP] = 0;
	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_SYNCWINDOW, listen_to);

	if (gLogger)
		gLogger.debug("syncwindow onLoad() exiting");
}

SyncWindow.prototype.onAccept = function()
{
	gLogger.debug("syncwindow onAccept: before unregister...");

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_SYNCWINDOW);

	gLogger.debug("syncwindow onAccept: after unregister...");

	gLogger = null;

	return true;
}

SyncWindow.prototype.onCancel = function()
{
	gLogger.debug("syncwindow onCancel: entered");
			
	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified and closes the window.
	//
	this.m_syncfsm.cancel(this.m_newstate, this.timeoutID_syncfsm, this.timeoutID_soapfsm);

	gLogger.debug("syncwindow onCancel: exited");

	return false;
}

SyncWindow.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	gLogger.debug("syncwindow onFsmStateChangeFunctor 741: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	if (fsmstate && fsmstate.id_fsm == ZinMaestro.FSM_ID_SOAP)
		this.timeoutID_soapfsm = fsmstate.timeoutID;
	else if (!this.m_has_observer_been_called)
	{
		// fsmstate should be null on first call to observer because the 'sync now' button should be disabled if the fsm is running
		//
		cnsAssert(fsmstate == null);

		this.m_has_observer_been_called = true;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 742: starting fsm: " + this.m_syncfsm.state.id_fsm + "\n");

		// TODO - extension point - onFsmAboutToStart  - unhide the statuspanel before starting the fsm 

		// document.getElementById('zindus-statuspanel').hidden = false;

		this.m_syncfsm.start();
	}
	else 
	{
		this.timeoutID_syncfsm = fsmstate.timeoutID;
		this.m_newstate  = fsmstate.newstate;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 744: " + " timeoutID: " + this.timeoutID_syncfsm);

		var is_window_update_required = this.m_sfpo.update(fsmstate);

		if (is_window_update_required)
		{
			document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value',
			                                        this.m_sfpo.get(SyncFsmProgressObserver.PERCENTAGE_COMPLETE) );
			document.getElementById('zindus-syncwindow-progress-description').setAttribute('value',
			                                        stringBundleString("zfomPrefix") + " " + this.m_sfpo.progressToString());

			// TODO - extension point - report the contents of this.m_sfpo to the UI

			if (this.m_el_statuspanel_progress_meter)
			{
				this.m_el_statuspanel_progress_meter.setAttribute('value', this.m_sfpo.get(SyncFsmProgressObserver.PERCENTAGE_COMPLETE) );
				this.m_el_statuspanel_progress_label.setAttribute('value', this.m_sfpo.progressToString());
			}
		}

		if (fsmstate.oldstate == "final")
		{
			this.m_payload.m_result = this.m_sfpo.exitStatus();

			document.getElementById('zindus-syncwindow').acceptDialog();
		}
	}

	if (typeof gLogger != 'undefined' && gLogger) // gLogger will be null after acceptDialog()
		gLogger.debug("syncwindow onFsmStateChangeFunctor 746: exiting");
}
