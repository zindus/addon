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

// Notes:
// - only entry actions should call continuation() - not sure what happens
//   if continuation() is called from a transition or exit action.
// - states are final when their entryAction()'s don't call continuation()
//   observers rely on the convention there's only one such state and it's called 'final'
//
// $Id: fsm.js,v 1.1 2007-10-29 23:50:24 cvsuser Exp $

if (typeof fsmlogger != 'object' || !fsmlogger)
{
    fsmlogger = newZinLogger("fsm");
	fsmlogger.level(ZinLogger.NONE);
}

function FsmSanityCheck(context)
{
	var states = new Object();

	zinAssert(typeof context == 'object' && typeof context.fsm.transitions == 'object');

	for (stateFrom in context.fsm.transitions)
	{
		states[stateFrom] = true;

		// there has to be an entry action corresponding to the 'from' state in a transition
		// otherwise the continuation wouldn't get called to execute the transition
		//
		// fsmlogger.debug("FsmSanityCheck: stateFrom: " + stateFrom);

		zinAssert(typeof context.fsm.aActionEntry[stateFrom] == 'function');

		for (event in context.fsm.transitions[stateFrom])
		{
			var stateTo = context.fsm.transitions[stateFrom][event];

			states[stateTo] = true;

			// fsmlogger.debug("stateTo: " + stateTo + " event: " + event);
		}
	}

	for each (table in [context.fsm.aActionEntry, context.fsm.aActionExit])
		for (mapping in table)
		{
			// fsmlogger.debug("FsmSanityCheck: mapping is " + mapping + "\n");

			// if this assert fails, it means that there's an action for a state that's not in the transitions table.
			//
			zinAssert(typeof states[mapping] != 'undefined');

			// if this assert fails, it means that the action function doesn't exist!
			//
			zinAssert(typeof table[mapping] == 'function');
		}
}

function fsmTransitionDo(fsmstate)
{
	var fsmstate;

	var id_fsm   = fsmstate.id_fsm;
	var oldstate = fsmstate.oldstate;
	var newstate = fsmstate.newstate;
	var event    = fsmstate.event;
	var context  = fsmstate.context;

	fsmlogger.debug("TransitionDo: fsmstate: " + fsmstate.toString() );

	if (typeof context.fsm.transitions.isSeenOnce == 'undefined' || !context.fsm.transitions.isSeenOnce)
	{
		FsmSanityCheck(context);

		context.fsm.transitions.isSeenOnce = true;
	}

	if (context.fsm.aActionEntry[newstate])
	{
		// fsmlogger.debug("TransitionDo: calling entry action (to: " + newstate + ", event: " + event + ")");

		var continuation = function(nextEvent) {
				// See:  http://en.wikipedia.org/wiki/Closure_%28computer_science%29
				// Closures are commonly used in functional programming to defer calculation, to hide state,
				// and as arguments to higher-order functions
				//
				// newZinLogger("fsm").debug("blah1: newstate: " + newstate + " nextEvent: " + nextEvent);
				// newZinLogger("fsm").debug("blah2: context.fsm.transitions: " + aToString(context.fsm.transitions));
				zinAssert(nextEvent);

				if (context.fsm.aActionExit && context.fsm.aActionExit[newstate])
					context.fsm.aActionExit[newstate].call(context, newstate, nextEvent);
            
				zinAssert(isPropertyPresent(context.fsm.transitions, newstate));

				var nextState = context.fsm.transitions[newstate][nextEvent];

				// newZinLogger("fsm").debug("blah3: nextState: " + nextState);

				if (nextState)
				{
					fsmTransitionSchedule(id_fsm, newstate, nextState, nextEvent, context);
				}
				else
				{
					// Even though Finite State Machines in UML are supposed to silently ignore events that they don't know about,
					// here we assert failure - because it's probably a programming error.
					//
					var logger = newZinLogger("fsm");
					logger.debug("TransititionDo: about to assert: newstate: " + newstate + " nextEvent: " + nextEvent + " context.fsm.transitions: " + aToString(context.fsm.transitions));
					zinAssert(false);
				}
			}

		// we add the continuation as a property of the fsm object to support context.cancel()
		context.fsm.continuation = continuation;
		fsmlogger.debug("TransitionDo: context.fsm.continuation set - about to call the entry action, newstate: " + newstate);
		// fsmlogger.debug("TransitionDo: entryAction: " + context.fsm.aActionEntry[newstate].toString());

    	context.fsm.aActionEntry[newstate].call(context, newstate, event, continuation);

		// aActionEntry for the final state won't have a continuation so it doesn't lead to a transition
		// so here we tell the maestro that the fsm is finished...
		//
		if (newstate == 'final')
		{
			var fsmstate = new FsmState('id_fsm',    id_fsm,
			                            'timeoutID', null,
			                            'oldstate',  newstate,
			                            'newstate',  null,
			                            'event',     null,
			                            'context',   context);

			ZinMaestro.notifyFsmState(fsmstate);
		}
	}

	return true;
}

function fsmTransitionSchedule(id_fsm, oldstate, newstate, event, context)
{
	fsmlogger.debug("TransitionSchedule: entered: id_fsm: " + id_fsm + " oldstate: " + oldstate + " newstate: " + newstate + " event: " + event);

	// release control in order to flip to the next transition - but the maestro holds a reference to fsmstate
	//
	var fsmstate = new FsmState('id_fsm',    id_fsm,
	                            'oldstate',  oldstate,
	                            'newstate',  newstate,
	                            'event',     event,
	                            'context',   context);

	if (fsmstate.isStart())
		context.fsm.continuation = null;
		
	var timeoutID = window.setTimeout(fsmTransitionDo, 0, fsmstate);

	fsmstate.timeoutID = timeoutID;

	fsmlogger.debug("TransitionSchedule: fsmstate.timeoutID: " + fsmstate.timeoutID);

	ZinMaestro.notifyFsmState(fsmstate);

	logger = fsmlogger;

	if (typeof logger != 'object' || !logger) // logger == null once the dialog goes away after the very last transition
		logger = newZinLogger("fsm");

	logger.debug("TransitionSchedule: exiting ");
}

function FsmState()
{
	zinAssert(arguments.length % 2 == 0);

	for (var i = 0; i < arguments.length; i+=2)
		this[arguments[i]] = arguments[i+1];
}

FsmState.prototype.toString = function()
{
	return "id_fsm: "     + this.id_fsm +
	       " timeoutID: " + this.timeoutID +
	       " oldstate: "  + this.oldstate +
	       " newstate: "  + this.newstate +
	       " event: "     + this.event;
}

FsmState.prototype.isFinal = function()
{
	return typeof(this["oldstate"]) == 'string' && this.oldstate == "final";
}

FsmState.prototype.isStart = function()
{
	return typeof(this["newstate"]) == 'string' && this.newstate == "start";
}
