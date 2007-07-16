include("chrome://zindus/content/const.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/maestro.js");

var gLogger      = null;

function SyncWindow()
{
	this.m_syncfsm   = null;
	this.m_timeoutID = null; // need to remember this in case the user cancels
	this.m_newstate  = null; // the cancel method needs to know whether to expect a continuation or not
	                         // there will be one if the fsm has had a transition.  It wont have had a transition if newstate == 'start'
	this.m_payload  = null;  // we keep it around so that we can pass the results back

	this.m_has_observer_been_called = false;
	this.m_sfpo = new SyncFsmProgressObserver();
}

SyncWindow.prototype.onLoad = function()
{
	// window.height = 100;
	// window.hidden = true;
	// window.collapsed = true;
	// this doesn't work document.getElementById('zindus-syncwindow').setAttribute('hidden', true);
	// these work but part of the parent window underneath is invisble
	// document.getElementById('zindus-syncwindow').setAttribute('collapsed', true);
	// document.getElementById('zindus-syncwindow').setAttribute('hidechrome', true);

	gLogger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
	gLogger.debug("=========================================== SyncWindow.onLoad: " + getTime() + "\n");

	this.m_payload = window.arguments[0];
	this.m_syncfsm = this.m_payload.m_syncfsm;

	this.setStatusPanelIds();

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_1, ZinMaestro.FSM_GROUP_SYNC);

	if (gLogger)
		gLogger.debug("syncwindow onLoad() exiting");
}

SyncWindow.prototype.onAccept = function()
{
	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_1);

	gLogger.debug("syncwindow onAccept:");

	gLogger = null;

	return true;
}

SyncWindow.prototype.onCancel = function()
{
	gLogger.debug("syncwindow onCancel: entered");
			
	// this fires an evCancel event into the fsm, which subsequently transitions into the 'final' state.
	// The observer is then notified and closes the window.
	//
	this.m_syncfsm.cancel(this.m_timeoutID, this.m_newstate);

	gLogger.debug("syncwindow onCancel: exited");

	return false;
}

SyncWindow.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	gLogger.debug("syncwindow onFsmStateChangeFunctor 741: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	if (!this.m_has_observer_been_called)
	{
		this.m_has_observer_been_called = true;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 742: starting fsm: " + this.m_syncfsm.state.id_fsm + "\n");

		// TODO - extension point - onFsmAboutToStart  - unhide the statuspanel before starting the fsm 

		// document.getElementById('zindus-statuspanel').hidden = false;

		this.m_syncfsm.start();
	}
	else 
	{
		this.m_timeoutID = fsmstate.state.timeoutID;
		this.m_newstate  = fsmstate.state.newstate;

		gLogger.debug("syncwindow onFsmStateChangeFunctor: 744: " + " timeoutID: " + this.m_timeoutID);

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

		if (fsmstate.state.oldstate == "final")
		{
			this.m_payload.m_result = this.m_sfpo.exitStatus();

			document.getElementById('zindus-syncwindow').acceptDialog();
		}
	}

	if (typeof gLogger != 'undefined' && gLogger) // gLogger will be null after acceptDialog()
		gLogger.debug("syncwindow onFsmStateChangeFunctor 746: exiting");
}


SyncWindow.prototype.getWindowsContainingElementIds = function(a_id_orig)
{
	var a_id = cnsCloneObject(a_id_orig);

	// Good background reading:
	//   http://developer.mozilla.org/en/docs/Working_with_windows_in_chrome_code
	// which links to this page, which offers the code snippet below:
	//   http://developer.mozilla.org/en/docs/nsIWindowMediator
	//
	// perhaps someone one day will tell me how to find messengerWindow more efficiently vs the current approach of iterating through
	// all open windows
	//
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);

	var windowtype = "";
	var enumerator = wm.getEnumerator(windowtype);

	while(enumerator.hasMoreElements() && aToLength(a_id) > 0)
	{
		var win = enumerator.getNext(); // win is [Object ChromeWindow] (just like window)

		for (var id in a_id)
			if (win.document.getElementById(id))
			{
				gLogger.debug("blah 23432: getWindowsContainingElementIds sets id: " + id);

				a_id_orig[id] = win;
				delete a_id[id]; // remove it - once an id is found in one window, we assume it's unique and stop looking for it
				break;
			}
	}
}

SyncWindow.prototype.setStatusPanelIds = function()
{
	this.m_el_statuspanel_progress_meter = null;
	this.m_el_statuspanel_progress_label = null;

	var a_id = { 'zindus-statuspanel' : null };

	this.getWindowsContainingElementIds(a_id);

	if (a_id['zindus-statuspanel'])
	{
		// TODO - this isn't right because the window might disappear between now and when you write to it - better to test that
		// the element exists just before setting it's attribute...
		//
		win = a_id['zindus-statuspanel'];

		gLogger.debug("blah 23433: title attribute of the winning win: " + win.title);

		this.m_el_statuspanel_progress_meter = win.document.getElementById("zindus-statuspanel-progress-meter");
		this.m_el_statuspanel_progress_label = win.document.getElementById("zindus-statuspanel-progress-label");
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

	if (isPropertyPresent(a_states_of_interest, fsmstate.state.newstate))
	{
		var context = fsmstate.state.context; // ZimbraFsm
		this.state = context.state;
		ret = true;

		switch(fsmstate.state.newstate)
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
				if (fsmstate.state.event == 'evCancel')
					this.progressReportOn("Cancelled");

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
		percentage_complete += a_states_of_interest[fsmstate.state.newstate] / a_states_of_interest['final'];

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

