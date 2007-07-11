include("chrome://zindus/content/utils.js");

function ZinMaestro()
{
	this.m_a_functor = new Object();  // an associative array where key = a-unique-id and value == functor
	this.m_fsmstate  = null;

	this.TOPIC = "ZindusMaestroObserver";
	this.CMD_FUNCTOR_REGISTER     = "notifyFunctorRegister";
	this.CMD_FUNCTOR_UNREGISTER   = "notifyFunctorUnregister";
	this.CMD_SYNCFSM_STATE_UPDATE = "notifySyncFsmStatusUpdate";
}

// There is a unique FSM_ID_* for each fsm so that functors can register to be notified about the state of specific fsm's
//
ZinMaestro.FSM_ID_TWOWAY   = "syncfsm-twoway";
ZinMaestro.FSM_ID_AUTHONLY = "syncfsm-authonly";
ZinMaestro.FSM_ID_SOAP     = "soapfsm";
ZinMaestro.FSM_GROUP_SYNC  = newObject(ZinMaestro.FSM_ID_TWOWAY, 0, ZinMaestro.FSM_ID_AUTHONLY, 0);

ZinMaestro.ID_FUNCTOR_1 = "zindus-id-functor-1"; // ID_FUNCTOR_* uniquely identify functors
ZinMaestro.ID_FUNCTOR_2 = "zindus-id-functor-2";

ZinMaestro.prototype.toString = function()
{
	var msg = "";

	msg += "ZinMaestro: " +
	          " m_fsmstate: " + (this.m_fsmstate ? this.m_fsmstate.toString() : "null") +
	          " m_a_functor: ";

	for (var id in this.m_a_functor)
		msg += " id: " + id;

	return msg;
}

// subject    data
//
// fsm        DO_SYNCFSM_START       ==> is_fsm_running = true,  calls fsmFireTransition() with 'evStart'
//            DO_SYNCFSM_CANCEL      ==> is_fsm_running = false, calls fsmFireTransition() with 'evCancel'
//                                       question: we should only set is_fsm_running == false when we know that the fsm is finished
//										 registerFunctor to listen for EVENT_FSM_STATECHANGE == finished?
//            DO_TIMER               ==> if is_fsm_running == true  ==> reset the timer for sometime soon
//                                   ==> if is_fsm_running == false ==> 
//                                       set a new timer
//                                       call the DO_SYNCFSM_START disatcher
//
// ZinMaestro.registerFunctor(id, event, functor) method does a notifyObserver with data REGISTER_FUNCTOR and subject is the method args
//
//            EVENT_SYNCFSM_STATUS   ==> sent by the DO_SYNCFSM_RUN, DO_SYNCFSM_CANCEL and the REGISTER_SYNCFSM_STATUS dispatchers
//                                   ==> the prefsdialog registers a functor that listens for this event
//                                       the functor en/disables the command that drives the "Sync now" and "Test Auth" buttons
//                                   ==> the "test connection" command registers a functor that listens for this event and
//                                       splashes a window on the fsm finishing
//                                   ==> supports closing the progress dialog, either when the syncfsm is finished normally or canceleed
//            EVENT_FSM_STATECHANGE  ==> sent by fsmFireTransition and fsmDoTransition when there !nextState (ie final is finished)
//                                   ==> supports the progress dialog
// 

// the nsIObserverService calls this method after a notification
//
ZinMaestro.prototype.observe = function(nsSubject, topic, data)
{
	var subject = nsSubject.wrappedJSObject;

	if (topic == this.TOPIC)
	{
		if (0)
		dump("ZinMaestro.observe(): " +
	                         // " subject: " + (isPropertyPresent(subject, 'id') ? subject.id : aToString(subject)) +
		                        " data: "    + data +
		                     " maestro: "    + this.toString() +
								"\n");

		switch (data)
		{
			case this.CMD_FUNCTOR_REGISTER:
				cnsAssert(isPropertyPresent(subject, 'id_functor'));
				cnsAssert(isPropertyPresent(subject, 'a_id_fsm'));
				cnsAssert(isPropertyPresent(subject, 'functor'));
				this.m_a_functor[subject['id_functor']] = newObject('a_id_fsm', cnsCloneObject(subject['a_id_fsm']), 'functor', subject['functor']);
				// dump("blah 98723811: a_id_fsm: " + subject['a_id_fsm'] + "\n");
				// dump("blah 98723812: a_id_fsm: " + this.m_a_functor[subject['id_functor']]['a_id_fsm'] + "\n");

				this.functorNotifyOne(subject['id_functor']);
				break;
			case this.CMD_FUNCTOR_UNREGISTER:
				cnsAssert(isPropertyPresent(subject, 'id_functor'));
				delete this.m_a_functor[subject['id_functor']]; // clients register and unregister functors with unique ids
				break;
			case this.CMD_SYNCFSM_STATE_UPDATE:
				cnsAssert(isPropertyPresent(subject, 'fsmstate'));
				this.m_fsmstate = subject.fsmstate;

				// dump("CMD_SYNCFSM_STATE_UPDATE: m_fsmstate: " + this.m_fsmstate.toString() + "\n");

				this.functorNotifyAll();

				if (this.m_fsmstate.state.oldstate == 'final')
					this.m_fsmstate = null;

				break;
			default:
				cnsAssert(false);
		}
	}
}

ZinMaestro.prototype.functorNotifyAll = function()
{
	var functor;

	dump("ZinMaestro.functorNotifyAll: " +
                                      " m_fsmstate: " + (this.m_fsmstate ? this.m_fsmstate.toString() : "null") +
                         " m_fsmstate.state.id_fsm: " + (this.m_fsmstate ? this.m_fsmstate.state.id_fsm : "fsmstate is null") +
							   "\n");

	for (var id_functor in this.m_a_functor)
	{
		var a_id_fsm = this.m_a_functor[id_functor]['a_id_fsm'];

		var msg = "ZinMaestro.functorNotifyAll: " + " id_functor: " + id_functor + " a_id_fsm: " + aToString(a_id_fsm);

		if (this.m_fsmstate == null || isPropertyPresent(a_id_fsm, this.m_fsmstate.state.id_fsm))
		{
			dump(msg + " - calling functor" + "\n");

			var functor = this.m_a_functor[id_functor]['functor'];
			functor(this.m_fsmstate);
		}
		else
			dump(msg + " - not interested in change to this fsm" + "\n");
	}
}

ZinMaestro.prototype.functorNotifyOne = function(id_functor)
{
	var functor = this.m_a_functor[id_functor]['functor'];

	dump("ZinMaestro.functorNotifyOne:" + " id_functor: " + id_functor +
	                                      " m_fsmstate: " + (this.m_fsmstate ? this.m_fsmstate.toString() : "null") +
	                         " m_fsmstate.state.id_fsm: " + (this.m_fsmstate ? this.m_fsmstate.state.id_fsm : "fsmstate is null") +
								   "\n");

	functor(this.m_fsmstate);
}

ZinMaestro.prototype.osRegister = function()
{
	dump("ZinMaestro.osRegister(): " + "\n");

	this.observerService().addObserver(this, this.TOPIC, false);
}

ZinMaestro.prototype.osUnregister = function()
{
	dump("ZinMaestro.osUnregister(): " + "\n");

	this.observerService().removeObserver(this, this.name);
}

ZinMaestro.prototype.observerService = function()
{
	return Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
}

ZinMaestro.prototype.osIsRegistered = function()
{
	var enumerator = this.observerService().enumerateObservers(this.TOPIC);
	var count = 0;

	while (enumerator.hasMoreElements())
	{
		try
		{
			var o = enumerator.getNext().QueryInterface(Components.interfaces.nsIObserver);

			dump("ZinMaestro.isMyTopicRegistered: o: " + aToString(o) + "\n");

			count++;
		}
		catch (e)
		{
			dump("exception while enumerating: e: " + e + "\n"); // TODO - need logging inside this class
		}
	}

	dump("ZinMaestro.osIsRegistered: returns: " + (count > 0) + "\n");

	return count > 0;
}

ZinMaestro.prototype.osNotify = function(subject, data)
{
	this.observerService().notifyObservers(subject, this.TOPIC, data);
}

ZinMaestro.prototype.wrapForJS = function(obj)
{
	obj.wrappedJSObject = obj;

	return obj;
}

ZinMaestro.prototype.notifyFunctorRegister = function(functor, id_functor, a_id_fsm)
{
	dump("ZinMaestro.notifyFunctorRegister(): id_functor == " + id_functor + " a_id_fsm: " + aToString(a_id_fsm) + "\n");

	this.osNotify(this.wrapForJS(newObject('id_functor', id_functor, 'a_id_fsm', a_id_fsm, 'functor', functor)), this.CMD_FUNCTOR_REGISTER);
}

ZinMaestro.prototype.notifyFunctorUnregister = function(id_functor)
{
	dump("ZinMaestro.notifyFunctorUnregister(): id_functor == " + id_functor + "\n");

	this.osNotify(this.wrapForJS(newObject('id_functor', id_functor)), this.CMD_FUNCTOR_UNREGISTER);
}

ZinMaestro.prototype.notifySyncFsmStatusUpdate = function(fsmstate)
{
	dump("ZinMaestro.notifySyncFsmStatusUpdate(): fsmstate: " + fsmstate.toString() + "\n");

	this.osNotify(this.wrapForJS(newObject('fsmstate', fsmstate)), this.CMD_SYNCFSM_STATE_UPDATE);
}
