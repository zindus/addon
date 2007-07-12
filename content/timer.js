include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/logger.js");

function ZinTimer(delay)
{
	this.m_timer  = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	this.m_delay  = delay;
	this.m_logger = new Log(Log.DEBUG, Log.dumpAndFileLogger);
}

ZinTimer.prototype.observe = function(nsSubject, topic, data)
{
	this.m_logger.debug("ZinTimer.observe(): " + " data: " + data);

	// var maestro = new ZinMaestro();
	// maestro.notifyFunctorRegister(onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_1, ZinMaestro.FSM_GROUP_SYNC);

	this.start();
}

ZinTimer.prototype.QueryInterface = function(iid)
{
	this.m_logger.debug("ZinTimer.QueryInterface(): " + " iid: " + iid);

	if (iid.equals(Components.interfaces.nsIObserver) ||
	    iid.equals(Components.interfaces.nsISupportsWeakReference) ||
	    iid.equals(Components.interfaces.nsISupports))
		{
			// this.m_logger.debug("ZinTimer.QueryInterface(): returns this");
			return this;
		}

	throw Components.results.NS_NOINTERFACE;
}

// delay is in milliseconds

ZinTimer.prototype.start = function()
{
	this.m_logger.debug("ZinTimer.start(): " + " delay: " + this.m_delay);

	this.m_timer.init(this, this.m_delay, this.m_timer.TYPE_ONE_SHOT);
}
