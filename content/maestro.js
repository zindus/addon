include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/filesystem.js");
include("chrome://zindus/content/logger.js");

// A few places in this class there are properties and methods that are both static and per-object.
// The static ones are a nicer idiom for users of the notify* methods.
// Instead of creating a ZinMaestro object, the call is just ZinMaestro.notifyFunctorRegister().
// But, when "this" is called back by the observer service, the file of source code is no longer loaded into javascript scope,
// so the static methods are gone.  So anything that's required by .observe() must be a per-object method.  Hence the duplication.
//

function ZinMaestro()
{
	this.m_a_functor  = new Object();  // an associative array where key is of ID_FUNCTOR_* and value == functor
	this.m_a_fsmstate = new Object();
	this.m_logger     = new Log(Log.DEBUG, Log.dumpAndFileLogger);

	this.TOPIC                 = ZinMaestro.TOPIC;
	this.DO_FUNCTOR_REGISTER   = ZinMaestro.DO_FUNCTOR_REGISTER;
	this.DO_FUNCTOR_UNREGISTER = ZinMaestro.DO_FUNCTOR_UNREGISTER;
	this.DO_FSM_STATE_UPDATE   = ZinMaestro.DO_FSM_STATE_UPDATE;
}

ZinMaestro.TOPIC = "ZindusMaestroObserver";

ZinMaestro.DO_FUNCTOR_REGISTER   = "do_register";
ZinMaestro.DO_FUNCTOR_UNREGISTER = "do_unregister";
ZinMaestro.DO_FSM_STATE_UPDATE   = "do_state_update";

// There is a unique FSM_ID_* for each fsm so that functors can register to be notified about the state of specific fsm's
//
ZinMaestro.FSM_ID_TWOWAY   = "syncfsm-twoway";
ZinMaestro.FSM_ID_AUTHONLY = "syncfsm-authonly";
ZinMaestro.FSM_ID_SOAP     = "soapfsm";
ZinMaestro.FSM_GROUP_SYNC  = newObject(ZinMaestro.FSM_ID_TWOWAY, 0, ZinMaestro.FSM_ID_AUTHONLY, 0);

// ID_FUNCTOR_* uniquely identifies each functor
//
ZinMaestro.ID_FUNCTOR_SYNCWINDOW         = "syncwindow";
ZinMaestro.ID_FUNCTOR_PREFSDIALOG        = "prefsdialog";
ZinMaestro.ID_FUNCTOR_TIMER              = "timer";
ZinMaestro.ID_FUNCTOR_SYNCWINDOW_SOAPFSM = "syncwindow-soapfsm";

ZinMaestro.prototype.toString = function()
{
	var msg = "";
	var id;

	msg += "ZinMaestro: ";

	for (id in this.m_a_fsmstate)
		msg += " m_a_fsmstate[" + id + "] == " + (this.m_a_fsmstate[id] ? this.m_a_fsmstate[id].toString() : "null");

	for (id in this.m_a_functor)
		msg += " m_a_functor[" + id + "] is set";

	return msg;
}

// the nsIObserverService calls this method after a notification
//
ZinMaestro.prototype.observe = function(nsSubject, topic, data)
{
	var subject = nsSubject.wrappedJSObject;

	if (topic == this.TOPIC)
	{
		this.m_logger.debug("ZinMaestro.observe(): " + " data: " + data + " maestro: " + this.toString());

		switch (data)
		{
			case this.DO_FUNCTOR_REGISTER:
				cnsAssert(isPropertyPresent(subject, 'id_functor'));
				cnsAssert(isPropertyPresent(subject, 'a_id_fsm'));
				cnsAssert(isPropertyPresent(subject, 'functor'));
				cnsAssert(isPropertyPresent(subject, 'context'));

				this.m_a_functor[subject['id_functor']] = newObject('a_id_fsm', cnsCloneObject(subject['a_id_fsm']),
				                                                    'functor',  subject['functor'],
				                                                    'context',  subject['context']);

				this.functorNotifyOne(subject['id_functor']);
				break;

			case this.DO_FUNCTOR_UNREGISTER:
				cnsAssert(isPropertyPresent(subject, 'id_functor'));
				delete this.m_a_functor[subject['id_functor']]; // clients register and unregister functors with unique ids
				break;

			case this.DO_FSM_STATE_UPDATE:
				cnsAssert(isPropertyPresent(subject, 'fsmstate'));
				var id_fsm = subject.fsmstate.id_fsm;

				this.m_a_fsmstate[id_fsm] = subject.fsmstate;

				// this.m_logger.debug("DO_FSM_STATE_UPDATE: m_a_fsmstate[" + id_fsm + "]: " + this.m_a_fsmstate[id_fsm].toString());

				this.functorNotifyAll(id_fsm);

				if (this.m_a_fsmstate[id_fsm].oldstate == 'final')
					delete this.m_a_fsmstate[id_fsm];

				break;

			default:
				cnsAssert(false);
		}
	}
}

ZinMaestro.prototype.functorNotifyAll = function(id_fsm)
{
	var functor;

	this.m_logger.debug("ZinMaestro.functorNotifyAll: " + " m_a_fsmstate[" + id_fsm + "]: " +
	                             (this.m_a_fsmstate[id_fsm] ? this.m_a_fsmstate[id_fsm].toString() : "null"));

	for (var id_functor in this.m_a_functor)
	{
		var a_id_fsm = this.m_a_functor[id_functor]['a_id_fsm'];

		var msg = "ZinMaestro.functorNotifyAll: " + " id_functor: " + id_functor + " a_id_fsm: " + aToString(a_id_fsm);

		// if (this.m_fsmstate == null || isPropertyPresent(a_id_fsm, id_fsm))
		if (isPropertyPresent(a_id_fsm, id_fsm))
			this.functorNotifyOne(id_functor, id_fsm);
		else
			this.m_logger.debug(msg + " - not interested in change to this fsm");
	}
}

ZinMaestro.prototype.functorNotifyOne = function(id_functor, id_fsm)
{
	var functor = this.m_a_functor[id_functor]['functor'];
	var context = this.m_a_functor[id_functor]['context'];

	functor.call(context, isPropertyPresent(this.m_a_fsmstate, id_fsm) ? this.m_a_fsmstate[id_fsm] : null);
}

ZinMaestro.prototype.osRegister = function()
{
	this.m_logger.debug("ZinMaestro.osRegister(): ");

	this.observerService().addObserver(this, this.TOPIC, false);
}

ZinMaestro.prototype.osUnregister = function()
{
	this.m_logger.debug("ZinMaestro.osUnregister(): ");

	this.observerService().removeObserver(this, this.name);
}

ZinMaestro.observerService = function()
{
	return Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
}

ZinMaestro.prototype.observerService = ZinMaestro.observerService;

ZinMaestro.prototype.osIsRegistered = function()
{
	var enumerator = this.observerService().enumerateObservers(this.TOPIC);
	var count = 0;

	while (enumerator.hasMoreElements())
	{
		try
		{
			var o = enumerator.getNext().QueryInterface(Components.interfaces.nsIObserver);

			this.m_logger.debug("ZinMaestro.isMyTopicRegistered: o: " + aToString(o));

			count++;
		}
		catch (e)
		{
			this.m_logger.error("exception while enumerating: e: " + e);
		}
	}

	this.m_logger.debug("ZinMaestro.osIsRegistered: returns: " + (count > 0));

	return count > 0;
}

ZinMaestro.osNotify = function(subject, data)
{
	if (gLogger)
		gLogger.debug("ZinMaestro.osNotify(): data == " + data);

	ZinMaestro.observerService().notifyObservers(subject, ZinMaestro.TOPIC, data);
}

ZinMaestro.wrapForJS = function(obj)
{
	obj.wrappedJSObject = obj;

	return obj;
}

ZinMaestro.notifyFunctorRegister = function(context, functor, id_functor, a_id_fsm)
{
	if (gLogger)
		gLogger.debug("ZinMaestro.notifyFunctorRegister(): id_functor == " + id_functor + " a_id_fsm: " + aToString(a_id_fsm));

	ZinMaestro.osNotify(ZinMaestro.wrapForJS(newObject('id_functor', id_functor, 'a_id_fsm', a_id_fsm, 'functor', functor, 'context', context)), this.DO_FUNCTOR_REGISTER);
}

ZinMaestro.notifyFunctorUnregister = function(id_functor)
{
	if (gLogger)
		gLogger.debug("ZinMaestro.notifyFunctorUnregister(): id_functor == " + id_functor);

	ZinMaestro.osNotify(ZinMaestro.wrapForJS(newObject('id_functor', id_functor)), this.DO_FUNCTOR_UNREGISTER);
}

ZinMaestro.notifyFsmState = function(fsmstate)
{
	if (gLogger)
		gLogger.debug("ZinMaestro.notifyFsmStatusUpdate(): fsmstate: " + fsmstate.toString());

	ZinMaestro.osNotify(ZinMaestro.wrapForJS(newObject('fsmstate', fsmstate)), this.DO_FSM_STATE_UPDATE);
}
