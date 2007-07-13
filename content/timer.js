include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/payload.js");

function ZinTimer(delay)
{
	this.m_timer  = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.m_delay  = delay; // seconds
	this.m_logger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
}

ZinTimer.prototype.observe = function(nsSubject, topic, data)
{
	this.m_logger.debug("ZinTimer.observe(): topic: " + topic + " data: " + data);

	var maestro = new ZinMaestro();
	maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_3, ZinMaestro.FSM_GROUP_SYNC);
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

	cnsAssert(delay > 0);

	this.m_timer.init(this, 1000 * delay, this.m_timer.TYPE_ONE_SHOT);
}

ZinTimer.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor 741: entering: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));
	var delay;

	if (fsmstate)
	{
		delay = 10;

		this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: fsm is running - retry (seconds): " + delay);
	}
	else
	{
		this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: fsm is not running - starting... ");
		this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: window: " + (window ? "defined" : "undefined") );

		var x = document.getElementById('zindus-statuspanel');

		this.m_logger.debug("ZinTimer.onFsmStateChangeFunctor: statuspanel: " + (x ? "defined" : "undefined") );

		var payload = new Payload(ZinMaestro.FSM_ID_TWOWAY);
		window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);

		delay = this.m_delay;
	}

	var maestro = new ZinMaestro();
	maestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_3);

	this.start(delay);
}
