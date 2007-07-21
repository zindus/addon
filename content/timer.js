include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/syncfsmprogressobserver.js");

ZinTimer.ONE_SHOT  = 0;
ZinTimer.REPEATING = 1;

function ZinTimer(type, delay)
{
	this.ONE_SHOT  = ZinTimer.ONE_SHOT;
	this.REPEATING = ZinTimer.REPEATING;

	this.m_type   = type;
	this.m_timer  = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.m_delay  = delay; // seconds
	this.m_logger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
}

// initialised at the start of each timer
//
ZinTimer.prototype.initOnStart = function()
{
	this.m_has_functor_been_called_after_timer_fired = false;
	this.m_messengerWindow   = null;
	this.m_addressbookWindow = null;
	this.m_sfpo = new SyncFsmProgressObserver();
}

ZinTimer.prototype.observe = function(nsSubject, topic, data)
{
	this.m_logger.debug("ZinTimer.observe(): topic: " + topic + " data: " + data);

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_TIMER, ZinMaestro.FSM_GROUP_SYNC);
}

ZinTimer.prototype.QueryInterface = function(iid)
{
	if (iid.equals(Components.interfaces.nsIObserver) ||
	    iid.equals(Components.interfaces.nsISupportsWeakReference) ||
	    iid.equals(Components.interfaces.nsISupports))
			return this;

	throw Components.results.NS_NOINTERFACE;
}

ZinTimer.prototype.start = function()
{
	var delay = (arguments.length == 1) ? arguments[0] : this.m_delay;

	this.m_logger.debug("ZinTimer.start: delay: " + delay);

	cnsAssert(typeof delay == 'number');

	this.initOnStart();

	this.m_timer.init(this, 1000 * delay, this.m_timer.TYPE_ONE_SHOT);
}

ZinTimer.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor 741: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));
	var delay;

	if (!this.m_has_functor_been_called_after_timer_fired)
	{
		if (fsmstate)
		{
			delay = 10;

			this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: fsm is running");

			if (this.m_type == this.REPEATING)
			{
				this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: retry: " + delay);

				this.start(delay);
			}
		}
		else
		{
			this.m_has_functor_been_called_after_timer_fired = true;
			this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: fsm is not running - starting... ");
		
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
		gLogger.debug("syncwindow onFsmStateChangeFunctor: 744: " + " timeoutID: " + this.m_timeoutID);

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
			// set a timer that eventually hides the status panel
			// set the next timer

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

			ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_TIMER);
		}
	}
}

ZinTimer.prototype.getWindowsContainingElementIds = function(a_id_orig)
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
