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
 * The Initial Developer of the Original Code is Toolware Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007-2008
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// A few places in this class there are properties and methods that are both static and per-object.
// The static ones are a nicer idiom for users of the notify* methods.
// Instead of creating a Maestro object, the call is just Maestro.notifyFunctorRegister().
// But, when "this" is called back by the observer service, the file of source code is no longer loaded into javascript scope,
// so the static methods are gone.  So anything that's required by .observe() must be a per-object method.  Hence the duplication.
//

function Maestro()
{
	this.initialise();

	this.TOPIC                 = Maestro.TOPIC;
	this.DO_FUNCTOR_REGISTER   = Maestro.DO_FUNCTOR_REGISTER;
	this.DO_FUNCTOR_UNREGISTER = Maestro.DO_FUNCTOR_UNREGISTER;
	this.DO_FSM_STATE_UPDATE   = Maestro.DO_FSM_STATE_UPDATE;
}

Maestro.prototype.initialise = function()
{
	this.m_a_functor  = new Object();  // an associative array where key is of ID_FUNCTOR_* and value == functor
	this.m_a_fsmstate = new Object();
}

Maestro.TOPIC = "ZindusMaestroObserver";

Maestro.DO_FUNCTOR_REGISTER   = "do_register";
Maestro.DO_FUNCTOR_UNREGISTER = "do_unregister";
Maestro.DO_FSM_STATE_UPDATE   = "do_state_update";

// Each fsm has a unique FSM_ID_* so that functors can register to be notified of state change in specific fsm's
//
Maestro.FSM_ID_ZM_TWOWAY   = "fsm-zm-twoway";
Maestro.FSM_ID_ZM_AUTHONLY = "fsm-zm-authonly";
Maestro.FSM_ID_GD_TWOWAY   = "fsm-gd-twoway";
Maestro.FSM_ID_GD_AUTHONLY = "fsm-gd-authonly";
Maestro.FSM_GROUP_TWOWAY   = newObjectWithKeys(Maestro.FSM_ID_ZM_TWOWAY, Maestro.FSM_ID_GD_TWOWAY);
Maestro.FSM_GROUP_AUTHONLY = newObjectWithKeys(Maestro.FSM_ID_ZM_AUTHONLY, Maestro.FSM_ID_GD_AUTHONLY);
Maestro.FSM_GROUP_SYNC     = newObjectWithKeys(Maestro.FSM_ID_ZM_TWOWAY, Maestro.FSM_ID_ZM_AUTHONLY, 
                                               Maestro.FSM_ID_GD_TWOWAY, Maestro.FSM_ID_GD_AUTHONLY);

// ID_FUNCTOR_* uniquely identifies each functor
//
Maestro.ID_FUNCTOR_SYNCWINDOW            = "syncwindow";
Maestro.ID_FUNCTOR_CONFIGSETTINGS        = "configsettings";
Maestro.ID_FUNCTOR_CONFIGSETTINGS_TIMER  = "configsettings-timer";
Maestro.ID_FUNCTOR_CONFIGACCOUNT         = "configaccount";
Maestro.ID_FUNCTOR_MAILWINDOW_TIMER      = "mailwindow-timer";
Maestro.ID_FUNCTOR_STATUSBAR_TIMER       = "statusbar-timer";

Maestro.prototype.toString = function()
{
	var msg = "";
	var fsmstate = "";
	var functors = "";
	var id;

	for (id in this.m_a_fsmstate)
		fsmstate += this.m_a_fsmstate[id].toString() + " ";

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
Maestro.prototype.observe = function(nsSubject, topic, data)
{
	var subject = nsSubject.wrappedJSObject;

	if (topic == this.TOPIC)
	{
		// logger().debug("Maestro: observe: " + " do: " + data + " maestro: " + this.toString());

		switch (data)
		{
			case this.DO_FUNCTOR_REGISTER:
				zinAssert(isPropertyPresent(subject, 'id_functor'));
				zinAssert(isPropertyPresent(subject, 'a_id_fsm'));
				zinAssert(isPropertyPresent(subject, 'functor'));
				zinAssert(isPropertyPresent(subject, 'context'));

				var id_functor = subject['id_functor'];

				// logger().debug("Maestro: observe: register: " + id_functor);

				zinAssert(!isPropertyPresent(this.m_a_functor, id_functor));

				this.m_a_functor[id_functor] = newObject('a_id_fsm', cloneObject(subject['a_id_fsm']),
				                                         'functor',  subject['functor'],
				                                         'context',  subject['context']);

				this.functorNotifyOnRegister(id_functor);
				break;

			case this.DO_FUNCTOR_UNREGISTER:
				zinAssert(isPropertyPresent(subject, 'id_functor'));
				var id_functor = subject['id_functor'];
				delete this.m_a_functor[id_functor]; // clients register and unregister functors with unique ids
				// logger().debug("Maestro: observe: after unregister: " + id_functor + " maestro: " + this.toString() );
				break;

			case this.DO_FSM_STATE_UPDATE:
				zinAssert(isPropertyPresent(subject, 'fsmstate'));
				var id_fsm = subject.fsmstate.id_fsm;

				// if (!isPropertyPresent(this.m_a_fsmstate, id_fsm) && !subject.fsmstate.isFinal())
				//	logger().debug("Maestro: observe: adding to m_a_fsmstate: " + id_fsm);
					
				this.m_a_fsmstate[id_fsm] = subject.fsmstate;

				// logger().debug("Maestro: DO_FSM_STATE_UPDATE: m_a_fsmstate[" + id_fsm + "]: " + this.m_a_fsmstate[id_fsm].toString());

				this.functorNotifyAll(id_fsm);

				zinAssertAndLog(isPropertyPresent(this.m_a_fsmstate, id_fsm), id_fsm);

				if (this.m_a_fsmstate[id_fsm].isFinal())
				{
					delete this.m_a_fsmstate[id_fsm];
					// logger().debug("Maestro: observe: removing from m_a_fsmstate: " + id_fsm + " mastro is now: " + this.toString() );
				}

				break;

			default:
				zinAssert(false);
		}
	}
}

Maestro.prototype.functorNotifyAll = function(id_fsm)
{
	var functor;

	// logger().debug("Maestro: functorNotifyAll: id_fsm: " + id_fsm);

	for (var id_functor in this.m_a_functor)
	{
		var a_id_fsm = this.m_a_functor[id_functor]['a_id_fsm'];

		// var msg = "functorNotifyAll: " + " id_functor: " + id_functor + " a_id_fsm: " + aToString(a_id_fsm);

		if (isPropertyPresent(a_id_fsm, id_fsm))
		{
			var functor = this.m_a_functor[id_functor]['functor'];
			var context = this.m_a_functor[id_functor]['context'];
			var args    = isPropertyPresent(this.m_a_fsmstate, id_fsm) ? this.m_a_fsmstate[id_fsm] : null;

			// logger().debug("Maestro: functorNotifyAll: status of: " + id_fsm + " has changed - about to notify: " + id_functor + " passing arg: " + (args ? "fsmstate" : "null"));

			functor.call(context, args);
		}
		else
			; // logger().debug("Maestro: functorNotifyAll: " + id_functor + ": not interested in change to this fsm");
	}
}

// call the given functor passing either:
// - null if non of the fsm's that the functor is interested in is running
// - fsmstate of the running fsm if there is one that the functor is interested in
//
Maestro.prototype.functorNotifyOnRegister = function(id_functor)
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

Maestro.wrapForJS = function(obj)
{
	obj.wrappedJSObject = obj;

	return obj;
}

Maestro.notifyFunctorRegister = function(context, functor, id_functor, a_id_fsm)
{
	ObserverService.notify(Maestro.TOPIC,
	            Maestro.wrapForJS(newObject('id_functor', id_functor, 'a_id_fsm', a_id_fsm, 'functor', functor, 'context', context)),
	            Maestro.DO_FUNCTOR_REGISTER);
}

Maestro.notifyFunctorUnregister = function(id_functor)
{
	ObserverService.notify(Maestro.TOPIC, Maestro.wrapForJS(newObject('id_functor', id_functor)), this.DO_FUNCTOR_UNREGISTER);
}

Maestro.notifyFsmState = function(fsmstate)
{
	ObserverService.notify(Maestro.TOPIC, Maestro.wrapForJS(newObject('fsmstate', fsmstate)), this.DO_FSM_STATE_UPDATE);
}
