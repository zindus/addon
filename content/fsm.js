include("chrome://zindus/content/maestro.js");

// Notes:
// - only entry actions should call continuation() - not sure what happens
//   if continuation() is called from a transition or exit action.
// - states are final when their entryAction()'s don't call continuation()
//
// $Id: fsm.js,v 1.4 2007-07-21 04:22:14 cvsuser Exp $

function FsmSanityCheck(context)
{
	var states = new Object();

	cnsAssert(typeof context == 'object');

	for (stateFrom in context.fsm.transitions)
	{
		// print("FsmSanityCheck: stateFrom is " + stateFrom);

		states[stateFrom] = true;

		// there has to be an entry action corresponding to the 'from' state in a transition
		// otherwise the continuation wouldn't get called to execute the transition
		//
		// gLogger.debug("FsmSanityCheck: stateFrom: " + stateFrom);

		cnsAssert(typeof context.fsm.aActionEntry[stateFrom] == 'function');

		for (event in context.fsm.transitions[stateFrom])
		{
			var stateTo = context.fsm.transitions[stateFrom][event];

			states[stateTo] = true;

			// print("stateFrom is " + stateFrom);
			// print("stateTo   is " + stateTo);
			// print("event     is " + event);

		}
	}

	for each (table in [context.fsm.aActionTransition, context.fsm.aActionEntry, context.fsm.aActionExit])
		for (mapping in table)
		{
			// dump("FsmSanityCheck: mapping is " + mapping + "\n");

			// if this assert fails, it means that there's an action for a state that's not
			// in the transitions table.
			//
			cnsAssert(typeof states[mapping] != 'undefined');

			// if this assert fails, it means that the action function doesn't exist!
			//
			cnsAssert(typeof table[mapping] == 'function');
		}
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

function fsmDoTransition(fsmstate)
{
	var fsmstate;

	var id_fsm   = fsmstate.id_fsm;
	var oldstate = fsmstate.oldstate;
	var newstate = fsmstate.newstate;
	var event    = fsmstate.event;
	var context  = fsmstate.context;

	gLogger.debug("722. fsmDoTransition: fsmstate: " + fsmstate.toString() );

	context.countTransitions++;

	gLogger.debug("fsm: transitioned to state " + newstate + " on event " + event);

	if (typeof context.fsm.transitions.isSeenOnce == 'undefined' || !context.fsm.transitions.isSeenOnce)
	{
		// no arguments when we are windowing... cnsAssert(arguments.length == 4);

		FsmSanityCheck(context);

		context.fsm.transitions.isSeenOnce = true;
	}

	if (context.fsm.aActionTransition && context.fsm.aActionTransition[newstate])
	{
		// gLogger.debug("fsm: calling transition action (from: " + oldstate + ", to: " + newstate + ", event: " + event + ")");

		context.fsm.aActionTransition[newstate].call(context, oldstate, newstate, event);
	}

	if (context.fsm.onTransition)
	{
		// gLogger.debug("fsm: calling onTransition observer (from: " + oldstate + ", to: " + newstate + ", event: " + event + ")");

		context.fsm.onTransition.call(context);
	}
	else
	{
		// gLogger.debug("fsm: onTransition observer not set");
	}

	if (context.fsm.aActionEntry[newstate])
	{
		gLogger.debug("fsm: calling entry      action (to: " + newstate + ", event: " + event + ")");

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
					gLogger.debug("84578: blah: newstate: " + newstate + " nextEvent: " + nextEvent + " context.fsm.transitions: " + aToString(context.fsm.transitions));
					cnsAssert(false);
				}
			}

		// we add the continuation as a property of the fsm object to support ZimbraFsm.prototype.cancel()
		context.fsm.continuation = continuation;
		// gLogger.debug("724. fsmDoTransition: context.fsm.continuation has been set - about to call the entry action");

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
	gLogger.debug("711. fsmFireTransition: entered: id_fsm: " + id_fsm + " oldstate: " + oldstate + " newstate: " + newstate + " event: " + event);

	// var label = "transition from " + oldstate + " to " + newstate + " event: " + event;
	// var newlabel = document.getElementById(fsmcontroller.id.observer).getAttribute('label', label);
	// if (label == newlabel)
	// 	label += "1";  // leni TODO - ok in practice but in theory this function recurses - choose a different attribute eg. value

	// gLogger.debug("714.  about to change label on: " + fsmcontroller.id.observer);
	// document.getElementById(fsmcontroller.id.observer).fsmstate = fsmstate;
	// document.getElementById(fsmcontroller.id.observer).setAttribute('label', label);   // observers get a look-in...

	// release control in order to flip to the next transition - but the maestro holds a reference to fsmstate
	//
	var fsmstate = new FsmState('id_fsm',    id_fsm,
	                            'oldstate',  oldstate,
	                            'newstate',  newstate,
	                            'event',     event,
	                            'context',   context);

	var timeoutID = window.setTimeout(fsmDoTransition, 0, fsmstate);

	fsmstate.timeoutID = timeoutID;

	gLogger.debug("711. fsmFireTransition: fsmstate.timeoutID: " + fsmstate.timeoutID);

	ZinMaestro.notifyFsmState(fsmstate);

	if (gLogger)  // gLogger == null once the dialog goes away after the very last transition
		gLogger.debug("716. fsmFireTransition exiting ");
}
