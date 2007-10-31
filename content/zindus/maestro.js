/* ***** BEGIN LICENSE BLOCK *****
 * 
 * "The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Zindus Sync.
 * 
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// A few places in this class there are properties and methods that are both static and per-object.
// The static ones are a nicer idiom for users of the notify* methods.
// Instead of creating a ZinMaestro object, the call is just ZinMaestro.notifyFunctorRegister().
// But, when "this" is called back by the observer service, the file of source code is no longer loaded into javascript scope,
// so the static methods are gone.  So anything that's required by .observe() must be a per-object method.  Hence the duplication.
//
include("chrome://zindus/content/observerservice.js");

function ZinMaestro()
{
	this.initialise();

	this.TOPIC                 = ZinMaestro.TOPIC;
	this.DO_FUNCTOR_REGISTER   = ZinMaestro.DO_FUNCTOR_REGISTER;
	this.DO_FUNCTOR_UNREGISTER = ZinMaestro.DO_FUNCTOR_UNREGISTER;
	this.DO_FSM_STATE_UPDATE   = ZinMaestro.DO_FSM_STATE_UPDATE;
}

ZinMaestro.prototype.initialise = function()
{
	this.m_a_functor  = new Object();  // an associative array where key is of ID_FUNCTOR_* and value == functor
	this.m_a_fsmstate = new Object();
	this.m_logger     = newZinLogger("ZinMaestro");

	// this.m_logger.level(ZinLogger_NONE);
}

ZinMaestro.TOPIC = "ZindusMaestroObserver";

ZinMaestro.DO_FUNCTOR_REGISTER   = "do_register";
ZinMaestro.DO_FUNCTOR_UNREGISTER = "do_unregister";
ZinMaestro.DO_FSM_STATE_UPDATE   = "do_state_update";

ZinMaestro.logger = newZinLogger("ZinMaestro");

// Each fsm has a unique FSM_ID_* so that functors can register to be notified of state change in specific fsm's
//
ZinMaestro.FSM_ID_TWOWAY   = "syncfsm-twoway";
ZinMaestro.FSM_ID_AUTHONLY = "syncfsm-authonly";
ZinMaestro.FSM_GROUP_SYNC  = newObject(ZinMaestro.FSM_ID_TWOWAY, 0, ZinMaestro.FSM_ID_AUTHONLY, 0);

// ID_FUNCTOR_* uniquely identifies each functor
//
ZinMaestro.ID_FUNCTOR_SYNCWINDOW         = "syncwindow";
ZinMaestro.ID_FUNCTOR_PREFSDIALOG        = "prefsdialog";
ZinMaestro.ID_FUNCTOR_TIMER_PREFSDIALOG  = "timer-prefsdialog";
ZinMaestro.ID_FUNCTOR_TIMER_OVERLAY      = "timer-overlay";
ZinMaestro.ID_FUNCTOR_STATUS_PANELY      = "status-panel";

ZinMaestro.prototype.toString = function()
{
	var msg = "";
	var fsmstate = "";
	var functors = "";
	var id;

	for (id in this.m_a_fsmstate)
		fsmstate += this.m_a_fsmstate[id].toString() + " ";
		// fsmstate += " " + id + " == " + (this.m_a_fsmstate[id] ? this.m_a_fsmstate[id].toString() : "null");
		// fsmstate += " " + id + " == " + (this.m_a_fsmstate[id] ? this.m_a_fsmstate[id].toString() : "null");

	msg += "\n                       ";
	msg += " fsmstate(s):" + (fsmstate == "" ? " none" : fsmstate);

	for (id in this.m_a_functor)
		functors += id + " ";

	msg += "\n                       ";
	msg += " functor(s): " + (functors == "" ? "none" : functors);

	return msg;
}

// the nsIObserverService calls this method after a notification
//
ZinMaestro.prototype.observe = function(nsSubject, topic, data)
{
	var subject = nsSubject.wrappedJSObject;

	if (topic == this.TOPIC)
	{
		this.m_logger.debug("observe: " + " do: " + data + " maestro: " + this.toString());

		switch (data)
		{
			case this.DO_FUNCTOR_REGISTER:
				zinAssert(isPropertyPresent(subject, 'id_functor'));
				zinAssert(isPropertyPresent(subject, 'a_id_fsm'));
				zinAssert(isPropertyPresent(subject, 'functor'));
				zinAssert(isPropertyPresent(subject, 'context'));

				var id_functor = subject['id_functor'];

				this.m_logger.debug("observe: register: " + id_functor);

				zinAssert(!isPropertyPresent(this.m_a_functor, id_functor));

				this.m_a_functor[id_functor] = newObject('a_id_fsm', zinCloneObject(subject['a_id_fsm']),
				                                         'functor',  subject['functor'],
				                                         'context',  subject['context']);

				this.functorNotifyOnRegister(id_functor);
				break;

			case this.DO_FUNCTOR_UNREGISTER:
				zinAssert(isPropertyPresent(subject, 'id_functor'));
				var id_functor = subject['id_functor'];
				delete this.m_a_functor[id_functor]; // clients register and unregister functors with unique ids
				this.m_logger.debug("observe: after unregister: " + id_functor + " maestro: " + this.toString() );
				break;

			case this.DO_FSM_STATE_UPDATE:
				zinAssert(isPropertyPresent(subject, 'fsmstate'));
				var id_fsm = subject.fsmstate.id_fsm;

				if (!isPropertyPresent(this.m_a_fsmstate, id_fsm) && !subject.fsmstate.isFinal())
					this.m_logger.debug("observe: adding to m_a_fsmstate: " + id_fsm);
					
				this.m_a_fsmstate[id_fsm] = subject.fsmstate;

				// this.m_logger.debug("DO_FSM_STATE_UPDATE: m_a_fsmstate[" + id_fsm + "]: " + this.m_a_fsmstate[id_fsm].toString());

				this.functorNotifyAll(id_fsm);

				if (this.m_a_fsmstate[id_fsm].isFinal())
				{
					delete this.m_a_fsmstate[id_fsm];
					this.m_logger.debug("observe: removing from m_a_fsmstate: " + id_fsm + " mastro is now: " + this.toString() );
					// this.initialise();
				}

				break;

			default:
				zinAssert(false);
		}
	}
}

ZinMaestro.prototype.functorNotifyAll = function(id_fsm)
{
	var functor;

	// this.m_logger.debug("functorNotifyAll: id_fsm: " + id_fsm);

	for (var id_functor in this.m_a_functor)
	{
		var a_id_fsm = this.m_a_functor[id_functor]['a_id_fsm'];

		// var msg = "functorNotifyAll: " + " id_functor: " + id_functor + " a_id_fsm: " + aToString(a_id_fsm);

		if (isPropertyPresent(a_id_fsm, id_fsm))
		{
			var functor = this.m_a_functor[id_functor]['functor'];
			var context = this.m_a_functor[id_functor]['context'];
			var args    = isPropertyPresent(this.m_a_fsmstate, id_fsm) ? this.m_a_fsmstate[id_fsm] : null;

			this.m_logger.debug("functorNotifyAll: status of: " + id_fsm + " has changed - about to notify: " + id_functor + " passing arg: " + (args ? "fsmstate" : "null"));

			functor.call(context, args);
		}
		else
			this.m_logger.debug("functorNotifyAll: " + id_functor + ": not interested in change to this fsm");
	}
}

// call the given functor passing either:
// - null if non of the fsm's that the functor is interested in is running
// - fsmstate of the running fsm if there is one that the functor is interested in
//
ZinMaestro.prototype.functorNotifyOnRegister = function(id_functor)
{
	var a_id_fsm = this.m_a_functor[id_functor]['a_id_fsm'];
	var id_fsm_match = null;

	for (var id_fsm in a_id_fsm)
		if (this.m_a_fsmstate[id_fsm])
		{
			id_fsm_match = id_fsm;
			break;
		}

	var functor  = this.m_a_functor[id_functor]['functor'];
	var context  = this.m_a_functor[id_functor]['context'];

	functor.call(context, id_fsm_match ? this.m_a_fsmstate[id_fsm_match] : null);
}

ZinMaestro.wrapForJS = function(obj)
{
	obj.wrappedJSObject = obj;

	return obj;
}

ZinMaestro.notifyFunctorRegister = function(context, functor, id_functor, a_id_fsm)
{
	// ZinMaestro.logger.debug("notifyFunctorRegister: id_functor == " + id_functor + " a_id_fsm: " + aToString(a_id_fsm));

	ObserverService.notify(ZinMaestro.TOPIC,
	            ZinMaestro.wrapForJS(newObject('id_functor', id_functor, 'a_id_fsm', a_id_fsm, 'functor', functor, 'context', context)),
				ZinMaestro.DO_FUNCTOR_REGISTER);
}

ZinMaestro.notifyFunctorUnregister = function(id_functor)
{
	// ZinMaestro.logger.debug("notifyFunctorUnregister: id_functor == " + id_functor);

	ObserverService.notify(ZinMaestro.TOPIC, ZinMaestro.wrapForJS(newObject('id_functor', id_functor)), this.DO_FUNCTOR_UNREGISTER);
}

ZinMaestro.notifyFsmState = function(fsmstate)
{
	// ZinMaestro.logger.debug("notifyFsmState: fsmstate: " + fsmstate.toString());

	ObserverService.notify(ZinMaestro.TOPIC, ZinMaestro.wrapForJS(newObject('fsmstate', fsmstate)), this.DO_FSM_STATE_UPDATE);
}
