include("chrome://zindus/content/maestro.js");

// Notes:
// - only entry actions should call continuation() - not sure what happens
//   if continuation() is called from a transition or exit action.
// - states are final when their entryAction()'s don't call continuation()
//   observers rely on the convention there's only one such state and it's called 'final'
//
// $Id: fsm.js,v 1.8 2007-07-23 21:55:47 cvsuser Exp $

// create a gLogger if there isn't one (which there isn't when fsm is run by the scheduled background timer)
//
if (typeof gLogger != 'object' || !gLogger)
	gLogger = newLogger();

function FsmSanityCheck(context)
{
	var states = new Object();

	cnsAssert(typeof context == 'object' && typeof context.fsm.transitions == 'object');

	for (stateFrom in context.fsm.transitions)
	{
		states[stateFrom] = true;

		// there has to be an entry action corresponding to the 'from' state in a transition
		// otherwise the continuation wouldn't get called to execute the transition
		//
		// gLogger.debug("fsm: FsmSanityCheck: stateFrom: " + stateFrom);

		cnsAssert(typeof context.fsm.aActionEntry[stateFrom] == 'function');

		for (event in context.fsm.transitions[stateFrom])
		{
			var stateTo = context.fsm.transitions[stateFrom][event];

			states[stateTo] = true;

			// gLogger.debug("fsm: stateTo: " + stateTo);
			// gLogger.debug("fsm: event: "   + event);
		}
	}

	for each (table in [context.fsm.aActionEntry, context.fsm.aActionExit])
		for (mapping in table)
		{
			// gLogger.debug("fsm: FsmSanityCheck: mapping is " + mapping + "\n");

			// if this assert fails, it means that there's an action for a state that's not in the transitions table.
			//
			cnsAssert(typeof states[mapping] != 'undefined');

			// if this assert fails, it means that the action function doesn't exist!
			//
			cnsAssert(typeof table[mapping] == 'function');
		}
}

function fsmDoTransition(fsmstate)
{
	var fsmstate;

	var id_fsm   = fsmstate.id_fsm;
	var oldstate = fsmstate.oldstate;
	var newstate = fsmstate.newstate;
	var event    = fsmstate.event;
	var context  = fsmstate.context;

	gLogger.debug("fsm: 722. fsmDoTransition: fsmstate: " + fsmstate.toString() );

	if (typeof context.fsm.transitions.isSeenOnce == 'undefined' || !context.fsm.transitions.isSeenOnce)
	{
		FsmSanityCheck(context);

		context.fsm.transitions.isSeenOnce = true;
	}

	if (context.fsm.aActionEntry[newstate])
	{
		gLogger.debug("fsm: calling entry action (to: " + newstate + ", event: " + event + ")");

		var continuation = function(nextEvent) {
				// See:  http://en.wikipedia.org/wiki/Closure_%28computer_science%29
				// Closures are commonly used in functional programming to defer calculation, to hide state,
				// and as arguments to higher-order functions
				//
				if (context.fsm.aActionExit && context.fsm.aActionExit[newstate])
				{
					// gLogger.debug("fsm: calling exit       action (to: " + newstate + ", event: " + nextEvent + ")");

					context.fsm.aActionExit[newstate].call(context, newstate, nextEvent);
				}
            
				cnsAssert(isPropertyPresent(context.fsm.transitions, newstate));

				var nextState = context.fsm.transitions[newstate][nextEvent];

				if (nextState)
				{
					fsmFireTransition(id_fsm, newstate, nextState, nextEvent, context);
				}
				else
				{
					// Even though Finite State Machines in UML are supposed to silently ignore events that they don't know about,
					// here we assert failure - because it's probably a programming error.
					//
					gLogger.debug("fsm: about to assert: newstate: " + newstate + " nextEvent: " + nextEvent + " context.fsm.transitions: " + aToString(context.fsm.transitions));
					cnsAssert(false);
				}
			}

		// we add the continuation as a property of the fsm object to support ZimbraFsm.prototype.cancel()
		context.fsm.continuation = continuation;
		// gLogger.debug("fsm: 724. fsmDoTransition: context.fsm.continuation has been set - about to call the entry action");

    	context.fsm.aActionEntry[newstate].call(context, newstate, event, continuation);

		// aActionEntry for the final state won't have a continuation so it doesn't lead to a transition
		// so here we tell the maestro that the fsm is finished...
		//
		if (newstate == 'final')
		{
			var fsmstate = new FsmState('id_fsm',   id_fsm,
			                            'timeoutID', null,
			                            'oldstate', newstate,
			                            'newstate', null,
			                            'event',    null,
			                            'context',  context);

			ZinMaestro.notifyFsmState(fsmstate);
		}
	}

	return true;
}

function fsmFireTransition(id_fsm, oldstate, newstate, event, context)
{
	gLogger.debug("fsm: 711. fsmFireTransition: entered: id_fsm: " + id_fsm + " oldstate: " + oldstate + " newstate: " + newstate + " event: " + event);

	// release control in order to flip to the next transition - but the maestro holds a reference to fsmstate
	//
	var fsmstate = new FsmState('id_fsm',    id_fsm,
	                            'oldstate',  oldstate,
	                            'newstate',  newstate,
	                            'event',     event,
	                            'context',   context);

	var timeoutID = window.setTimeout(fsmDoTransition, 0, fsmstate);

	fsmstate.timeoutID = timeoutID;

	gLogger.debug("fsm: 712. fsmFireTransition: fsmstate.timeoutID: " + fsmstate.timeoutID);

	ZinMaestro.notifyFsmState(fsmstate);

	if (gLogger)  // gLogger == null once the dialog goes away after the very last transition
		gLogger.debug("fsm: 713. fsmFireTransition exiting ");
}

function FsmState()
{
	cnsAssert(arguments.length % 2 == 0);

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
