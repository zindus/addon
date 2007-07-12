include("chrome://zindus/content/const.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/maestro.js");

var gLogger      = null;
var gPreferences = null;
var gBiMap       = null;

var sw = null;

// TODO - return authstatus back to caller - maybe this should be a dialog after all?

function SyncWindowState()
{
	this.m_id_fsm  = null;
	this.m_syncfsm = null;
	this.m_timeoutID = null; // need to remember this in case the user cancels
	this.m_newstate = null;  // the cancel method needs to know whether to expect a continuation or not - there will be one if the fsm has had a transition.  It wont have had a transition if newstate == 'start'
	this.m_payload = null;
	this.m_has_observer_been_called = false;
	this.m_sfpo = new SyncFsmProgressObserver();
}

function onLoad()
{
	initialiseGlobals();

	gLogger.debug("=========================================== start: " + getTime() + "\n");

	sw = new SyncWindowState();

	sw.m_payload = window.arguments[0];
	
	gLogger.debug("syncwindow onLoad() entering: arguments[0] " + window.arguments[0] + " and payload = " + sw.m_payload.toString());

	switch(sw.m_payload.opcode())
	{
		case Payload.SYNC:
			sw.m_id_fsm = ZinMaestro.FSM_ID_TWOWAY;
			var maestro = new ZinMaestro();
			gLogger.debug("syncwindow: onLoad(): sw.m_id_fsm: " + sw.m_id_fsm);
			maestro.notifyFunctorRegister(onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_1, ZinMaestro.FSM_GROUP_SYNC);
			break;

		case Payload.AUTHONLY:
			sw.m_id_fsm = ZinMaestro.FSM_ID_AUTHONLY;
			var maestro = new ZinMaestro();
			gLogger.debug("syncwindow onLoad(), sw.m_id_fsm: " + sw.m_id_fsm);
			maestro.notifyFunctorRegister(onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_1, ZinMaestro.FSM_GROUP_SYNC);
			break;

		case Payload.TESTHARNESS:
			var testharness = new ZinTestHarness();
			testharness.run();
			document.getElementById('zindus-syncwindow').acceptDialog();
			break;
		case Payload.RESET:
			resetAll();
			document.getElementById('zindus-syncwindow').acceptDialog();
			break;
		default:
			cnsAssert(false);
	}

	if (gLogger)
		gLogger.debug("syncwindow onLoad() exiting");
}

function onAccept()
{
	var maestro = new ZinMaestro();
	maestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_1);

	gLogger.debug("syncwindow onAccept:");

	gLogger.loggingFileClose();
	gLogger = null;

	return true;
}

function onCancel()
{
	gLogger.debug("syncwindow onCancel: entered");
			
	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified and closes the window.
	//
	// window.clearTimeout(sw.m_timeoutID);
	// gLogger.debug("syncwindow onCancel: cleared timeoutID: " + sw.m_timeoutID);

	sw.m_syncfsm.cancel(sw.m_timeoutID, sw.m_newstate);
	sw.m_syncfsm.fsm.is_cancelled = true;

	gLogger.debug("syncwindow onCancel: exited");

	return false;
}

function resetAll()
{
	gLogger.debug("syncwindow resetAll()");

	var file;
	var directory = Filesystem.getDirectory(DIRECTORY_MAPPING);

	// zap everything in the mapping directory
	//
	if (directory.exists() && directory.isDirectory())
	{
		var iter = directory.directoryEntries;
 
		while (iter.hasMoreElements())
		{
			file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);

			file.remove(false);
		}
	}

	var aAddressBook = ZimbraFsm.getTbAddressbooks();

	for each (abName in aAddressBook)
		ZimbraAddressBook.deleteAddressBook(ZimbraAddressBook.getAddressBookUri(abName));

	// zap the logfile
	//
	file = Filesystem.getDirectory(DIRECTORY_LOG);
	file.append(LOGFILENAME);

	if (file.exists() || !file.isDirectory())
	{
		gLogger.loggingFileClose();
		file.remove(false);
		gLogger.loggingFileOpen();
	}
}

function initialiseGlobals()
{
	gPreferences = new MozillaPreferences();

	gLogger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
	gLogger.loggingFileOpen();

	gBiMap = new Object();

	gBiMap.FORMAT = new BiMap(
		[FORMAT_TB, FORMAT_ZM],
		['tb',      'zm'     ]);
}

function onFsmStateChangeFunctor(fsmstate)
{
	gLogger.debug("syncwindow onFsmStateChangeFunctor 741: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") +
	                                                                                " sw.m_id_fsm: " + sw.m_id_fsm);

	if (!sw.m_has_observer_been_called)
	{
		sw.m_has_observer_been_called = true;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 742: starting fsm: " + sw.m_id_fsm + "\n");

		sw.m_syncfsm = new ZimbraFsm(sw.m_id_fsm, sw.m_payload.m_args);
		sw.m_syncfsm.start();
	}
	else if (fsmstate.state.oldstate == "final")
	{
		gLogger.debug("syncwindow 743: fsmstate.state.context: " + (isPropertyPresent(fsmstate.state, "context") ? "present" : "absent"));
		gLogger.debug("syncwindow 743: fsmstate.state.context.state: " + (isPropertyPresent(fsmstate.state.context, "state") ? "present" : "absent"));
		gLogger.debug("syncwindow 743: fsmstate.state.context.state.observer: " + (isPropertyPresent(fsmstate.state.context.state, "observer") ? "present" : "absent"));

		sw.m_payload.m_result = sw.m_sfpo.exitStatus();

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 743: about to call acceptDialog: exitStatus: " + sw.m_sfpo.exitStatus().toString());

		updateProgress(fsmstate);

		document.getElementById('zindus-syncwindow').acceptDialog();
	}
	else if (fsmstate.state.newstate == "start")  // fsm is about to have it's first transition - nothing to report to the UI
	{
		sw.m_timeoutID = fsmstate.state.timeoutID;
		sw.m_newstate  = fsmstate.state.newstate;
		gLogger.debug("syncwindow onFsmStateChangeFunctor: 744: " + " timeoutID: " + sw.m_timeoutID);

		updateProgress(fsmstate);
	}
	else if (fsmstate.state.newstate != "start")
	{
		sw.m_timeoutID = fsmstate.state.timeoutID;
		sw.m_newstate  = fsmstate.state.newstate;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 745: " +
		                             " timeoutID: " + sw.m_timeoutID );

		updateProgress(fsmstate);
	}

	if (gLogger) // gLogger will be null after acceptDialog()
		gLogger.debug("syncwindow onFsmStateChangeFunctor 746: exiting");
}

function updateProgress(fsmstate)
{
	var a_states_of_interest = { stAuth : 0,       stLoad: 1,     stSync: 2,     stGetContact: 3,    stSyncGal: 4, stLoadTb : 5, 
	                             stSyncPrepare: 6, stUpdateTb: 7, stUpdateZm: 8, stUpdateCleanup: 9, final: 10 };

	if (isPropertyPresent(a_states_of_interest, fsmstate.state.newstate))
	{
		var context = fsmstate.state.context; // ZimbraFsmState
		sw.m_sfpo.state = context.state;

		switch(fsmstate.state.newstate)
		{
			case 'stAuth':          sw.m_sfpo.progressReportOnSource(context.state.sourceid_zm, "RemoteAuth"); break;
			case 'stLoad':          sw.m_sfpo.progressReportOn("Load");                                        break;
			case 'stSync':          sw.m_sfpo.progressReportOnSource(context.state.sourceid_zm, "RemoteSync"); break;
			case 'stSyncGal':       sw.m_sfpo.progressReportOnSource(context.state.sourceid_zm, "GetGAL");     break;
			case 'stLoadTb':        sw.m_sfpo.progressReportOnSource(context.state.sourceid_zm, "GetItem");    break;
			case 'stSyncPrepare':   sw.m_sfpo.progressReportOn("Converge");                                    break;
			case 'stUpdateTb':      sw.m_sfpo.progressReportOnSource(context.state.sourceid_tb, "Put");        break;
			case 'stUpdateCleanup': sw.m_sfpo.progressReportOn("Saving");                                      break;

			case 'stGetContact':
				var id;
				for (id in context.state.aQueue)
					break;

				if (typeof(id) != 'undefined')
				{
					var op = sw.m_sfpo.buildOp(context.state.sourceid_zm, "GetItem");

					if (sw.m_sfpo.get(SyncFsmProgressObserver.OP) != op)
					{
						gLogger.debug("4401: op: " + op + " sw.m_sfpo.get(SyncFsmProgressObserver.OP): " + sw.m_sfpo.get(SyncFsmProgressObserver.OP));
						sw.m_sfpo.progressReportOnSource(context.state.sourceid_zm, "GetItem", aToLength(context.state.aQueue));
					}

					sw.m_sfpo.set(SyncFsmProgressObserver.PROG_CNT, sw.m_sfpo.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'stUpdateZm':
				if (context.state.updateZmPackage)
				{
					var sourceid = context.state.updateZmPackage['sourceid'];
					var op = context.state.sources[sourceid]['name'] + " " + stringBundleString("Put");

					if (sw.m_sfpo.get(SyncFsmProgressObserver.OP) != op)
					{
						var cTotal = 0; // aSuo definitely needs an iterator!
						for (var x in context.state.sources)
							if (context.state.sources[x]['format'] == FORMAT_ZM)
								for (var y = 0; y < SORT_ORDER.length; i++)
									if (isPropertyPresent(context.state.aSuo[x], SORT_ORDER[y]))
										for (var z in context.state.aSuo[x][SORT_ORDER[y]])
											cTotal++;

						sw.m_sfpo.progressReportOnSource(sourceid, "Put", cTotal);
					}

					sw.m_sfpo.set(SyncFsmProgressObserver.PROG_CNT, sw.m_sfpo.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'final':
				if (fsmstate.state.event == 'evCancel')
					sw.m_sfpo.progressReportOn("Cancelled");

				var es = new SyncFsmExitStatus();

				if (context.state.id_fsm == ZinMaestro.FSM_ID_AUTHONLY && context.state.authToken)
					es.m_exit_status = 0;
				else if (context.state.id_fsm == ZinMaestro.FSM_ID_TWOWAY && fsmstate.state.event == 'evNext')
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

				sw.m_sfpo.exitStatus(es);

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
		percentage_complete += a_states_of_interest[fsmstate.state.newstate] / a_states_of_interest['final'];

		if (sw.m_sfpo.get(SyncFsmProgressObserver.PROG_MAX) > 0)
			percentage_complete += (1 / a_states_of_interest['final']) * (sw.m_sfpo.get(SyncFsmProgressObserver.PROG_CNT) / sw.m_sfpo.get(SyncFsmProgressObserver.PROG_MAX));

		percentage_complete = percentage_complete * 100 + "%";

		gLogger.debug("4401: percentage_complete: " + percentage_complete);

		document.getElementById('zindus-syncwindow-progress-meter').setAttribute('value', percentage_complete );
		document.getElementById('zindus-syncwindow-progress-description').setAttribute('value', sw.m_sfpo.progressToString());
	}
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

SyncFsmProgressObserver.OP       = 'op';
SyncFsmProgressObserver.PROG_MAX = 'pm';
SyncFsmProgressObserver.PROG_CNT = 'pc';

SyncFsmProgressObserver.LAST_STATUS             = 'as';
SyncFsmProgressObserver.LAST_FAIL_REASON_CODE   = 'ac';
SyncFsmProgressObserver.LAST_FAIL_REASON_DETAIL = 'ad';

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
	
	ret += stringBundleString("zfomPrefix");
	ret += " " + this.get(SyncFsmProgressObserver.OP);

	if (this.get(SyncFsmProgressObserver.PROG_MAX) > 0)
		ret += " " + this.get(SyncFsmProgressObserver.PROG_CNT) +
		       " " + stringBundleString(this.tweakStringId("Of")) +
		       " " + this.get(SyncFsmProgressObserver.PROG_MAX);

	// time = getTime();
	// ret += " " + parseInt(time/1000) + "." + time % 1000;

	return ret;
}
