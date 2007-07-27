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

// An object of this class is updated as a SyncFsm progresses from start to finish.
// It supports both percentage complete and per-state text detail.
//
function SyncFsmProgressObserver()
{
	this.state = null; // SyncFsm.state, used on a read-only basis, set before any update

	// this.m_logger = newLogger("SyncFsmProgressObserver");

	this.m_exit_status = null;

	this.m_properties = new Object();

	this.set(SyncFsmProgressObserver.OP,       "");
	this.set(SyncFsmProgressObserver.PROG_MAX, 0);
	this.set(SyncFsmProgressObserver.PROG_CNT, 0);
}

SyncFsmProgressObserver.OP                  = 'op'; // eg: server put
SyncFsmProgressObserver.PROG_CNT            = 'pc'; // eg: 3 of
SyncFsmProgressObserver.PROG_MAX            = 'pm'; // eg: 6    (counts progress through an iteration of one or two states)
SyncFsmProgressObserver.PERCENTAGE_COMPLETE = 'pp'; // eg: 70%  (counts how far we are through all observed states)

SyncFsmProgressObserver.prototype.exitStatus = function()
{
	if (arguments.length > 0)
		this.m_exit_status = arguments[0];

	return this.m_exit_status;
}

SyncFsmProgressObserver.prototype.set = function(key, value)
{
	this.m_properties[key] = value;
}

SyncFsmProgressObserver.prototype.get = function(key, value)
{
	return this.m_properties[key];
}

SyncFsmProgressObserver.prototype.progressReportOn = function(stringid)
{
	this.set(SyncFsmProgressObserver.OP, stringBundleString(this.tweakStringId(stringid)) );

	this.set(SyncFsmProgressObserver.PROG_MAX, 0);
}

SyncFsmProgressObserver.prototype.progressReportOnSource = function()
{
	this.set(SyncFsmProgressObserver.OP, this.buildOp(arguments[0], arguments[1]));

	this.set(SyncFsmProgressObserver.PROG_MAX, (arguments.length == 3) ? arguments[2] : 0);
}

SyncFsmProgressObserver.prototype.buildOp = function(sourceid, stringid)
{
	return this.state.sources[sourceid]['name'] + " " + stringBundleString(this.tweakStringId(stringid));
}

SyncFsmProgressObserver.prototype.tweakStringId = function(stringid)
{
	return "zfomProgress" + stringid;
}

SyncFsmProgressObserver.prototype.progressToString = function()
{
	var ret = "";
	
	ret += this.get(SyncFsmProgressObserver.OP);

	if (this.get(SyncFsmProgressObserver.PROG_MAX) > 0)
		ret += " " + this.get(SyncFsmProgressObserver.PROG_CNT) +
		       " " + stringBundleString(this.tweakStringId("Of")) +
		       " " + this.get(SyncFsmProgressObserver.PROG_MAX);

	return ret;
}

SyncFsmProgressObserver.prototype.update = function(fsmstate)
{
	var ret = false;
	var a_states_of_interest = { stAuth : 0,       stLoad: 1,     stSync: 2,     stGetContact: 3,    stSyncGal: 4, stLoadTb : 5, 
	                             stSyncPrepare: 6, stUpdateTb: 7, stUpdateZm: 8, stUpdateCleanup: 9, final: 10 };

	if (isPropertyPresent(a_states_of_interest, fsmstate.newstate))
	{
		var context = fsmstate.context; // SyncFsm
		this.state = context.state;
		ret = true;

		switch(fsmstate.newstate)
		{
			case 'stAuth':          this.progressReportOnSource(context.state.sourceid_zm, "RemoteAuth"); break;
			case 'stLoad':          this.progressReportOn("Load");                                        break;
			case 'stSync':          this.progressReportOnSource(context.state.sourceid_zm, "RemoteSync"); break;
			case 'stSyncGal':       this.progressReportOnSource(context.state.sourceid_zm, "GetGAL");     break;
			case 'stLoadTb':        this.progressReportOnSource(context.state.sourceid_zm, "GetItem");    break;
			case 'stSyncPrepare':   this.progressReportOn("Converge");                                    break;
			case 'stUpdateTb':      this.progressReportOnSource(context.state.sourceid_tb, "Put");        break;
			case 'stUpdateCleanup': this.progressReportOn("Saving");                                      break;

			case 'stGetContact':
				var id;
				for (id in context.state.aQueue)
					break;

				if (typeof(id) != 'undefined')
				{
					var op = this.buildOp(context.state.sourceid_zm, "GetItem");

					if (this.get(SyncFsmProgressObserver.OP) != op)
					{
						// this.m_logger.debug("4401: op: " + op + " this.get(SyncFsmProgressObserver.OP): " + this.get(SyncFsmProgressObserver.OP));
						this.progressReportOnSource(context.state.sourceid_zm, "GetItem", aToLength(context.state.aQueue));
					}

					this.set(SyncFsmProgressObserver.PROG_CNT, this.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'stUpdateZm':
				if (context.state.updateZmPackage)
				{
					var sourceid = context.state.updateZmPackage['sourceid'];
					var op = this.buildOp(context.state.sourceid_zm, "Put");

					if (this.get(SyncFsmProgressObserver.OP) != op)
					{
						var cTotal = 0; // aSuo definitely needs an iterator!
						for (var x in context.state.sources)
							if (context.state.sources[x]['format'] == FORMAT_ZM)
								for (var y = 0; y < SORT_ORDER.length; i++)
									if (isPropertyPresent(context.state.aSuo[x], SORT_ORDER[y]))
										for (var z in context.state.aSuo[x][SORT_ORDER[y]])
											cTotal++;

						this.progressReportOnSource(sourceid, "Put", cTotal);
					}

					this.set(SyncFsmProgressObserver.PROG_CNT, this.get(SyncFsmProgressObserver.PROG_CNT) + 1);
				}
				break;

			case 'final':
				if (fsmstate.event == 'evCancel')
					this.progressReportOn("Cancelled");
				else
					this.progressReportOn("Done");

				var es = new SyncFsmExitStatus();

				if (context.state.id_fsm == ZinMaestro.FSM_ID_AUTHONLY && context.state.authToken)
					es.m_exit_status = 0;
				else if (context.state.id_fsm == ZinMaestro.FSM_ID_TWOWAY && fsmstate.event == 'evNext')
					es.m_exit_status = 0;
				else
				{
					es.m_exit_status = 1;

					switch (context.soapfsm.state.summaryCode())
					{
						case SoapFsmState.POST_RESPONSE_FAIL_ON_SERVICE: es.m_fail_code = SyncFsmExitStatus.FailOnService; break;
						case SoapFsmState.POST_RESPONSE_FAIL_ON_FAULT:   es.m_fail_code = SyncFsmExitStatus.FailOnFault;   break;
						case SoapFsmState.CANCELLED:                     es.m_fail_code = SyncFsmExitStatus.FailOnCancel;  break;
						default:                                         es.m_fail_code = SyncFsmExitStatus.FailOnUnknown; break;
					}
				}

				this.exitStatus(es);

				// there are three bits of "exit status" that the outside world might be interested in
				// ZinMaestro.FSM_ID_TWOWAY:
				// - last sync success: (time, maybe other stuff like conflicts...)
				// - last sync:         (time, success/fail and optional failure reason)
				// - an idea: next sync: when scheduled?
				//
				// ZinMaestro.FSM_ID_AUTHONLY:
				// - last auth: (time, success/fail and optional failure reason)
				//

				break;
		}

		var percentage_complete = 0;
		percentage_complete += a_states_of_interest[fsmstate.newstate] / a_states_of_interest['final'];

		if (this.get(SyncFsmProgressObserver.PROG_MAX) > 0)
			percentage_complete += (1 / a_states_of_interest['final']) * (this.get(SyncFsmProgressObserver.PROG_CNT) / this.get(SyncFsmProgressObserver.PROG_MAX));

		percentage_complete = percentage_complete * 100 + "%";

		// this.m_logger.debug("4401: percentage_complete: " + percentage_complete);

		this.set(SyncFsmProgressObserver.PERCENTAGE_COMPLETE, percentage_complete);
	}

	return ret;
}

