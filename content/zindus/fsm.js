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

// Notes:
// - only entry actions should call continuation() - not sure what happens
//   if continuation() is called from a transition or exit action.
// - states are final when their entryAction()'s don't call continuation()
//   observers rely on the convention that there's only one such state and it's called 'final'
//
// $Id: fsm.js,v 1.14 2008-06-15 19:38:22 cvsuser Exp $

function fsmTransitionDo(fsmstate)
{
	var fsmstate;

	var id_fsm   = fsmstate.id_fsm;
	var oldstate = fsmstate.oldstate;
	var newstate = fsmstate.newstate;
	var event    = fsmstate.event;
	var context  = fsmstate.context;
	var fsm      = context.fsm;

	fsm.m_logger.debug("TransitionDo: fsmstate: " + fsmstate.toString() );

	fsm.sanityCheck();

	if (fsm.m_a_entry[newstate])
	{
		// fsm.m_logger.debug("TransitionDo: calling entry action (to: " + newstate + ", event: " + event + ")");

		var continuation = function(nextEvent) {
				// See:  http://en.wikipedia.org/wiki/Closure_%28computer_science%29
				//
				zinAssert(nextEvent);

				if (fsm.m_a_exit[newstate])
					fsm.m_a_exit[newstate].call(context, newstate, nextEvent);
            
				zinAssert(isPropertyPresent(context.fsm.m_transitions, newstate));

				var nextState = context.fsm.m_transitions[newstate][nextEvent];

				if (nextState)
					fsmTransitionSchedule(id_fsm, newstate, nextState, nextEvent, context);
				else
				{
					// Even though Finite State Machines in UML are supposed to silently ignore events that they don't know about,
					// here we assert failure - because it's probably a programming error.
					//
					zinAssertAndLog(false, " newstate: " + newstate + " nextEvent: " + nextEvent + " context.fsm.m_transitions: " + aToString(context.fsm.m_transitions));
				}
			}

		context.fsm.m_continuation = continuation; // the continuation is made a property of the fsm object to support context.cancel()

		fsm.m_logger.debug("TransitionDo: context.fsm.m_continuation set - about to call the entry action, newstate: " + newstate);

		fsm.m_a_entry[newstate].call(context, newstate, event, continuation);

		// m_a_entry for the final state won't have a continuation so it doesn't lead to a transition
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

			Maestro.notifyFsmState(fsmstate);
		}
	}

	return true;
}

function fsmTransitionSchedule(id_fsm, oldstate, newstate, event, context)
{
	context.fsm.m_logger.debug("TransitionSchedule: entered: id_fsm: " + id_fsm + " oldstate: " + oldstate +
	                                                                              " newstate: " + newstate + " event: " + event);

	// release control in order to flip to the next transition - but the maestro holds a reference to fsmstate
	//
	var fsmstate = new FsmState('id_fsm',    id_fsm,
	                            'oldstate',  oldstate,
	                            'newstate',  newstate,
	                            'event',     event,
	                            'context',   context);

	fsmstate.timeoutID = context.fsm.m_window.setTimeout(fsmTransitionDo, 0, fsmstate);


	context.fsm.m_logger.debug("TransitionSchedule: fsmstate: " + fsmstate.toString());

	Maestro.notifyFsmState(fsmstate);

	context.fsm.m_logger.debug("TransitionSchedule: exiting ");
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
	return typeof(this["oldstate"]) == 'string' &&
	       (this.oldstate == "final" || (this.event == "evCancel" && this.newstate == "final"));
}

FsmState.prototype.isStart = function()
{
	return typeof(this["newstate"]) == 'string' && this.newstate == "start";
}

function Fsm(transitions, a_entry, a_exit)
{
	zinAssert(arguments.length == 3);

	this.m_transitions = transitions;
	this.m_a_entry     = a_entry;
	this.m_a_exit      = a_exit;

	zinAssert(typeof(this.m_transitions) == 'object' && typeof(this.m_a_entry) == 'object' && typeof(this.m_a_exit) == 'object');

	this.m_logger            = newLogger("fsm");  this.m_logger.level(Logger.NONE);
	this.m_continuation      = null;
	this.m_is_sanity_checked = false;
	this.m_window            = null;
}

Fsm.prototype.sanityCheck = function()
{
	var states = new Object();
	var state;

	if (this.m_is_sanity_checked)
		return;
	
	this.m_is_sanity_checked = true;

	for (var stateFrom in this.m_transitions)
	{
		states[stateFrom] = true;

		// there has to be an entry action corresponding to the 'from' state in a transition
		// otherwise the continuation wouldn't get called to execute the transition
		//
		this.m_logger.debug("sanityCheck: stateFrom: " + stateFrom);

		zinAssertAndLog(typeof this.m_a_entry[stateFrom] == 'function', "stateFrom: " + stateFrom);

		for (var event in this.m_transitions[stateFrom])
		{
			var stateTo = this.m_transitions[stateFrom][event];

			states[stateTo] = true;

			this.m_logger.debug("sanityCheck: stateTo: " + stateTo + " event: " + event);
		}
	}

	for (state in states)
		zinAssertAndLog(typeof this.m_a_entry[state] != 'undefined', "state doesn't have an entry action: " + state);

	for each (var table in [this.m_a_entry, this.m_a_exit])
		for (state in table)
		{
			zinAssertAndLog(typeof states[state] != 'undefined', "state not referenced in transitions table: " + state);

			zinAssertAndLog(typeof table[state] == 'function', "missing entry/exit action function for state: " + state);
		}
}

