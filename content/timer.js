include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/syncfsmprogressobserver.js");

function ZinTimer(functor)
{
	cnsAssert(arguments.length == 1);

	this.m_timer   = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.m_functor = functor;
	this.m_logger  = new Log(Log.DEBUG, Log.dumpAndFileLogger);
}

ZinTimer.prototype.start = function(delay)
{
	cnsAssert(arguments.length == 1);

	this.m_logger.debug("ZinTimer.start: delay: " + delay);

	cnsAssert(typeof delay == 'number');

	this.m_timer.initWithCallback(this, 1000 * delay, this.m_timer.TYPE_ONE_SHOT);
}

// This method allows us to pass "this" into initWithCallback - it is called when the timer expires.
// This method gives the class an interface of nsITimerCallback, see:
// http://www.xulplanet.com/references/xpcomref/ifaces/nsITimerCallback.html
//
ZinTimer.prototype.notify = function(timer)
{
	this.m_logger.debug("ZinTimerFunctor.notify: about to run callback: ");

	cnsAssert(typeof this.m_functor.run == 'function');

    this.m_functor.run();
}

function ZinTimerFunctorSync(id_fsm_functor, delay_on_repeat)
{
	cnsAssert(arguments.length == 2 && (typeof(delay_on_repeat) == 'number' || delay_on_repeat == null));

	this.m_logger            = new Log(Log.DEBUG, Log.dumpAndFileLogger);
	this.m_sfpo              = new SyncFsmProgressObserver();
	this.m_messengerWindow   = null;
	this.m_addressbookWindow = null;
	this.m_is_fsm_functor_first_entry = true;
	this.m_id_fsm_functor    = id_fsm_functor;
	this.m_delay_on_repeat   = delay_on_repeat; // null implies ONE_SHOT, non-null implies REPEAT frequency in seconds
}

ZinTimerFunctorSync.prototype.run = function()
{
	this.m_logger.debug("ZinTimerFunctorSync.run: m_id_fsm_functor: " + this.m_id_fsm_functor);

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, this.m_id_fsm_functor, ZinMaestro.FSM_GROUP_SYNC);
}

ZinTimerFunctorSync.prototype.copy = function()
{
	return new ZinTimerFunctorSync(this.m_id_fsm_functor, this.m_delay_on_repeat);
}
	
ZinTimerFunctorSync.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("ZinTimerFunctorSync.onFsmStateChangeFunctor 741: entering: m_id_fsm_functor: " + this.m_id_fsm_functor + " fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	if (this.m_is_fsm_functor_first_entry)
	{
		if (fsmstate)
		{
			this.m_logger.debug("ZinTimerFunctorSync.onFsmStateChangeFunctor: fsm is running: " +
			                      (this.m_delay_on_repeat ? "about to retry" : "single-shot - no retry"));

			if (this.m_delay_on_repeat)
				this.setNextTimer(10);  // retry in 10 seconds
		}
		else
		{
			this.m_is_fsm_functor_first_entry = false;
			this.m_logger.debug("ZinTimerFunctorSync.onFsmStateChangeFunctor: fsm is not running - starting... ");
		
			// set m_messengerWindow and m_addressbookWindow...
			// TODO: m_addressbookWindow
			//
			var a_id = { 'zindus-statuspanel' : null };

			this.getWindowsContainingElementIds(a_id);

			if (a_id['zindus-statuspanel'])
				this.m_messengerWindow = a_id['zindus-statuspanel'];

			this.m_messengerWindow.document.getElementById('zindus-statuspanel').setAttribute('hidden', false);

			var state = new TwoWayFsmState();
			state.setCredentials();

			var syncfsm = new TwoWayFsm(state);
			syncfsm.start();
		}
	}
	else
	{
		gLogger.debug("ZinTimerFunctorSync.onFsmStateChangeFunctor: 744: ");

		var is_window_update_required = this.m_sfpo.update(fsmstate);

		if (is_window_update_required)
		{
			if (this.m_messengerWindow.document && this.m_messengerWindow.document.getElementById("zindus-statuspanel"))
			{
				// the window might have disappeared between when we iterated all open windows and now - so we test that
				// the element exists just before setting it's attribute...
				//
				var el_statuspanel_progress_meter = this.m_messengerWindow.document.getElementById("zindus-statuspanel-progress-meter");
				var el_statuspanel_progress_label = this.m_messengerWindow.document.getElementById("zindus-statuspanel-progress-label");

				el_statuspanel_progress_meter.setAttribute('value', this.m_sfpo.get(SyncFsmProgressObserver.PERCENTAGE_COMPLETE) );
				el_statuspanel_progress_label.setAttribute('value', this.m_sfpo.progressToString());
			}
		}

		if (fsmstate.oldstate == "final")
		{
			// TODO - display the exit status 
			// one option: put something in the status panel and set a timer that eventually hides the status panel

			// if messengerWindow disappeared while we were syncing, string bundles wont be available, so we try/catch...
			//
			if (0)
			try {
				var exitStatus = this.m_sfpo.exitStatus();
				var msg = "";

				if (exitStatus.m_exit_status == 0)
					msg += stringBundleString("statusLastSync") + ": " + new Date().toLocaleString();
				else
					msg += stringBundleString("statusLastSyncFailed");
			} catch (ex)
			{
				// do nothing
			}

			if (this.m_messengerWindow.document && this.m_messengerWindow.document.getElementById("zindus-statuspanel"))
			{
				this.m_messengerWindow.document.getElementById("zindus-statuspanel-progress-label").setAttribute('value', msg);
				this.m_messengerWindow.document.getElementById('zindus-statuspanel').setAttribute('hidden', true);
			}

			if (this.m_delay_on_repeat)
				this.setNextTimer(this.m_delay_on_repeat);
		}
	}
}

ZinTimerFunctorSync.prototype.setNextTimer = function(delay)
{
	ZinMaestro.notifyFunctorUnregister(this.m_id_fsm_functor);

	this.m_logger.debug("ZinTimerFunctorSync.onFsmStateChangeFunctor: rescheduling timer (seconds): " + delay);

	var functor = this.copy();
	var timer = new ZinTimer(functor);
	timer.start(delay);
}

ZinTimerFunctorSync.prototype.getWindowsContainingElementIds = function(a_id_orig)
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
				// gLogger.debug("blah 23432: getWindowsContainingElementIds sets id: " + id);

				a_id_orig[id] = win;
				delete a_id[id]; // remove it - once an id is found in one window, we assume it's unique and stop looking for it
				break;
			}
	}
}
