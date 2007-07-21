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

// this object contains the state information that the observers get access to
//
function SyncFsmProgressObserver()
{
	this.state = null; // ZimbraFsm.state, used on a read-only basis, set before any update

	this.m_exit_status = null;

	this.zfi = new ZinFeedItem();

	this.zfi.set(SyncFsmProgressObserver.OP,       "");
	this.zfi.set(SyncFsmProgressObserver.PROG_MAX, 0);
	this.zfi.set(SyncFsmProgressObserver.PROG_CNT, 0);
}

SyncFsmProgressObserver.OP                  = 'op'; // eg: server put
SyncFsmProgressObserver.PROG_CNT            = 'pc'; // eg: 3 of
SyncFsmProgressObserver.PROG_MAX            = 'pm'; // eg: 6    (counts progress through an iteration of one or two states)
SyncFsmProgressObserver.PERCENTAGE_COMPLETE = 'pp'; // eg: 70%  (counts how far we are through all observed states)

SyncFsmProgressObserver.prototype.exitStatus = function()
{
	if (arguments.length > 0)
		this.m_exit_status = arguments[0];

	return this.m_exit_status;
}

SyncFsmProgressObserver.prototype.set = function(key, value)
{
	this.zfi.set(key, value);
}

SyncFsmProgressObserver.prototype.get = function(key, value)
{
	return this.zfi.get(key);
}

SyncFsmProgressObserver.prototype.progressReportOn = function(stringid)
{
	this.set(SyncFsmProgressObserver.OP, stringBundleString(this.tweakStringId(stringid)) );

	this.set(SyncFsmProgressObserver.PROG_MAX, 0);
}

SyncFsmProgressObserver.prototype.progressReportOnSource = function()
{
	this.set(SyncFsmProgressObserver.OP, this.buildOp(arguments[0], arguments[1]));

	this.set(SyncFsmProgressObserver.PROG_MAX, (arguments.length == 3) ? arguments[2] : 0);
}

SyncFsmProgressObserver.prototype.buildOp = function(sourceid, stringid)
{
	return this.state.sources[sourceid]['name'] + " " + stringBundleString(this.tweakStringId(stringid));
}

SyncFsmProgressObserver.prototype.tweakStringId = function(stringid)
{
	return "zfomProgress" + stringid;
}

SyncFsmProgressObserver.prototype.progressToString = function()
{
	var ret = "";
	
	ret += this.get(SyncFsmProgressObserver.OP);

	if (this.get(SyncFsmProgressObserver.PROG_MAX) > 0)
		ret += " " + this.get(SyncFsmProgressObserver.PROG_CNT) +
		       " " + stringBundleString(this.tweakStringId("Of")) +
		       " " + this.get(SyncFsmProgressObserver.PROG_MAX);

	// time = getTime();
	// ret += " " + parseInt(time/1000) + "." + time % 1000;

	return ret;
}

SyncFsmProgressObserver.prototype.update = function(fsmstate)
{
	var ret = false;
	var a_states_of_interest = { stAuth : 0,       stLoad: 1,     stSync: 2,     stGetContact: 3,    stSyncGal: 4, stLoadTb : 5, 
	                             stSyncPrepare: 6, stUpdateTb: 7, stUpdateZm: 8, stUpdateCleanup: 9, final: 10 };

	if (isPropertyPresent(a_states_of_interest, fsmstate.newstate))
	{
		var context = fsmstate.context; // ZimbraFsm
		this.state = context.state;
		ret = true;

		switch(fsmstate.newstate)
		{
			case 'stAuth':          this.progressReportOnSource(context.state.sourceid_zm, "RemoteAuth"); break;
			case 'stLoad':          this.progressReportOn("Load");                                        break;
			case 'stSync':          this.progressReportOnSource(context.state.sourceid_zm, "RemoteSync"); break;
			case 'stSyncGal':       this.progressReportOnSource(context.state.sourceid_zm, "GetGAL");     break;
			case 'stLoadTb':        this.progressReportOnSource(context.state.sourceid_zm, "GetItem");    break;
			case 'stSyncPrepare':   this.progressReportOn("Converge");                                    break;
			case 'stUpdateTb':      this.progressReportOnSource(context.state.sourceid_tb, "Put");        break;
			case 'stUpdateCleanup': this.progressReportOn("Saving");                                      break;

			case 'stGetContact':
				var id;
				for (id in context.state.aQueue)
					break;

				if (typeof(id) != 'undefined')
				{
					var op = this.buildOp(context.state.sourceid_zm, "GetItem");

					if (this.get(SyncFsmProgressObserver.OP) != op)
					{
						gLogger.debug("4401: op: " + op + " this.get(SyncFsmProgressObserver.OP): " + this.get(SyncFsmProgressObserver.OP));
						this.progressReportOnSource(context.state.sourceid_zm, "GetItem", aToLength(context.state.aQueue));
					}

					this.set(SyncFsmProgressObserver.PROG_CNT, this.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'stUpdateZm':
				if (context.state.updateZmPackage)
				{
					var sourceid = context.state.updateZmPackage['sourceid'];
					var op = context.state.sources[sourceid]['name'] + " " + stringBundleString("Put");

					if (this.get(SyncFsmProgressObserver.OP) != op)
					{
						var cTotal = 0; // aSuo definitely needs an iterator!
						for (var x in context.state.sources)
							if (context.state.sources[x]['format'] == FORMAT_ZM)
								for (var y = 0; y < SORT_ORDER.length; i++)
									if (isPropertyPresent(context.state.aSuo[x], SORT_ORDER[y]))
										for (var z in context.state.aSuo[x][SORT_ORDER[y]])
											cTotal++;

						this.progressReportOnSource(sourceid, "Put", cTotal);
					}

					this.set(SyncFsmProgressObserver.PROG_CNT, this.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'final':
				if (fsmstate.event == 'evCancel')
					this.progressReportOn("Cancelled");

				var es = new SyncFsmExitStatus();

				if (context.state.id_fsm == ZinMaestro.FSM_ID_AUTHONLY && context.state.authToken)
					es.m_exit_status = 0;
				else if (context.state.id_fsm == ZinMaestro.FSM_ID_TWOWAY && fsmstate.event == 'evNext')
					es.m_exit_status = 0;
				else
				{
					es.m_exit_status = 1;

					switch (context.soapfsm.state.summaryCode())
					{
						case SoapFsmState.POST_RESPONSE_FAIL_ON_SERVICE: es.m_fail_code = SyncFsmExitStatus.FailOnService; break;
						case SoapFsmState.POST_RESPONSE_FAIL_ON_FAULT:   es.m_fail_code = SyncFsmExitStatus.FailOnFault;   break;
						case SoapFsmState.CANCELLED:                     es.m_fail_code = SyncFsmExitStatus.FailOnCancel;  break;
						default:                                         es.m_fail_code = SyncFsmExitStatus.FailOnUnknown; break;
					}
				}

				this.exitStatus(es);

				// there are three bits of "exit status" that the outside world might be interested in
				// ZinMaestro.FSM_ID_TWOWAY:
				// - last sync success: (time, maybe other stuff like conflicts...)
				// - last sync:         (time, success/fail and optional failure reason)
				// - an idea: next sync: when scheduled?
				//
				// ZinMaestro.FSM_ID_AUTHONLY:
				// - last auth: (time, success/fail and optional failure reason)
				//

				break;
		}

		var percentage_complete = 0;
		percentage_complete += a_states_of_interest[fsmstate.newstate] / a_states_of_interest['final'];

		if (this.get(SyncFsmProgressObserver.PROG_MAX) > 0)
			percentage_complete += (1 / a_states_of_interest['final']) * (this.get(SyncFsmProgressObserver.PROG_CNT) / this.get(SyncFsmProgressObserver.PROG_MAX));

		percentage_complete = percentage_complete * 100 + "%";

		gLogger.debug("4401: percentage_complete: " + percentage_complete);

		this.set(SyncFsmProgressObserver.PERCENTAGE_COMPLETE, percentage_complete);

		document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value', this.get(SyncFsmProgressObserver.PERCENTAGE_COMPLETE) );
		document.getElementById('zindus-syncwindow-progress-description').setAttribute('value', stringBundleString("zfomPrefix") + " " + this.progressToString());
	}

	return ret;
}

