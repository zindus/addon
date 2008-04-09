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
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// An object of this class is updated as a SyncFsm progresses from start to finish.
// It's state includes both percentage complete and per-fsm-state text detail.
//
function SyncFsmObserver(es)
{
	this.state = null; // SyncFsm.state, used on a read-only basis, set before any update

	this.m_logger = newZinLogger("SyncFsmObserver");

	this.m_es = es;

	this.m_properties = new Object();

	this.m_high_water_percentage_complete = 0;

	this.set(SyncFsmObserver.OP,       "");
	this.set(SyncFsmObserver.PROG_MAX, 0);
	this.set(SyncFsmObserver.PROG_CNT, 0);
}

SyncFsmObserver.OP                  = 'op'; // eg: server put
SyncFsmObserver.PROG_CNT            = 'pc'; // eg: 3 of
SyncFsmObserver.PROG_MAX            = 'pm'; // eg: 6    (counts progress through an iteration of one or two states)
SyncFsmObserver.PERCENTAGE_COMPLETE = 'pp'; // eg: 70%  (counts how far we are through all observed states)

SyncFsmObserver.prototype.set = function(key, value)
{
	this.m_properties[key] = value;
}

SyncFsmObserver.prototype.get = function(key, value)
{
	return this.m_properties[key];
}

SyncFsmObserver.prototype.progressReportOn = function(stringid)
{
	this.set(SyncFsmObserver.OP, stringBundleString(this.tweakStringId(stringid)) );

	this.set(SyncFsmObserver.PROG_MAX, 0);
}

SyncFsmObserver.prototype.progressReportOnSource = function()
{
	zinAssert((arguments.length == 2) || (typeof(arguments[2]) == 'number'));

	this.set(SyncFsmObserver.OP, this.buildOp(arguments[0], arguments[1]));

	this.set(SyncFsmObserver.PROG_MAX, (arguments.length == 3) ? arguments[2] : 0);
}

SyncFsmObserver.prototype.buildOp = function(sourceid, stringid)
{
	return this.state.sources[sourceid]['name'] + " " + stringBundleString(this.tweakStringId(stringid));
}

SyncFsmObserver.prototype.tweakStringId = function(stringid)
{
	return "zfomProgress" + stringid;
}

SyncFsmObserver.prototype.progressToString = function()
{
	var ret = "";
	
	ret += this.get(SyncFsmObserver.OP);

	if (this.get(SyncFsmObserver.PROG_MAX) > 0)
		ret += " " + this.get(SyncFsmObserver.PROG_CNT) +
		       " " + stringBundleString(this.tweakStringId("Of")) +
		       " " + this.get(SyncFsmObserver.PROG_MAX);

	return ret;
}

SyncFsmObserver.prototype.update = function(fsmstate)
{
	var ret;

	var a_states_zm = {
		start:            { },
		stAuth:           { count: 1 },
		stLoad:           { count: 1 },
		stLoadTb:         { count: 1 },
		stGetAccountInfo: { count: 1 },
		stSelectSoapUrl:  { count: 1 },
		stGetInfo:        { count: 1 },
		stCheckLicense:   { },
		stSync:           { },
		stSyncResult:     { },
		stGetContact:     { count: 1 },
		stGalConsider:    { },
		stGalSync:        { count: 1 },
		stGalCommit:      { },
		stConverge1:      { count: 1 },
		stConverge2:      { count: 1 },
		stConverge3:      { count: 1 },
		stConverge5:      {            },
		stConverge6:      { count: 1 },
		stConverge7:      { count: 1 },
		stConverge8:      { count: 1 },
		stGetContactsDel: { count: 1 },
		stUpdateTb:       { count: 1 },
		stUpdateZm:       { count: 1 },
		stUpdateCleanup:  { count: 1 },
		stSoapRequest:    { },
		stSoapResponse:   { },
		stCommit:         { },
		final:            { count: 1 }
	};

	var a_states_gd = {
		start:            { },
		stAuth:           { count: 1 },
		stLoad:           { count: 1 },
		stLoadTb:         { count: 1 },
		stGetContacts:    { }, // gd
		stConverge1:      { count: 1 },
		stConverge2:      { count: 1 },
		stConverge3:      { count: 1 },
		stConverge5:      {            },
		stConverge6:      { count: 1 },
		stConverge7:      { count: 1 },
		stConverge8:      { count: 1 },
		stUpdateTb:       { count: 1 },
		stUpdateGd:       { count: 1 },
		stUpdateCleanup:  { count: 1 },
		stSoapRequest:    { },
		stSoapResponse:   { },
		stCommit:         { },
		final:            { count: 1 }
	};

	switch (fsmstate.context.state.id_fsm)
	{
		case ZinMaestro.FSM_ID_ZM_AUTHONLY:
		case ZinMaestro.FSM_ID_ZM_TWOWAY:
			ret = this.updateState(fsmstate, a_states_zm);
			break;
		case ZinMaestro.FSM_ID_GD_AUTHONLY:
		case ZinMaestro.FSM_ID_GD_TWOWAY:
			ret = this.updateState(fsmstate, a_states_gd);
			break;
		default:
			zinAssertAndLog(false, "unmatched case: id_fsm: " + fsmstate.context.state.id_fsm);
	};

	return ret;
}

SyncFsmObserver.prototype.updateState = function(fsmstate, a_states)
{
	var ret = false;
	this.m_logger.debug("update: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	var context = fsmstate.context; // SyncFsm
	this.state = context.state;

	zinAssert(isMatchObjectKeys(a_states, context.fsm.m_transitions));

	var c = 0;

	for (var key in a_states)
		if (isPropertyPresent(a_states[key], 'count'))
			a_states[key]['count'] = c++;

	if (fsmstate.newstate && isPropertyPresent(a_states[fsmstate.newstate], 'count')) // fsmstate.newstate == null when oldstate == 'final'
	{
		ret = true;

		switch(fsmstate.newstate)
		{
			case 'stAuth':           this.progressReportOnSource(context.state.sourceid_pr, "RemoteAuth");  break;
			case 'stLoad':           this.progressReportOn("Load");                                         break;
			case 'stGetAccountInfo': this.progressReportOnSource(context.state.sourceid_pr, "AccountInfo"); break;
			case 'stGetInfo':          
			case 'stCheckLicense':          
			case 'stSync':          
			case 'stSyncResult':     this.progressReportOnSource(context.state.sourceid_pr, "RemoteSync");  break;
			case 'stGetContacts':    this.progressReportOnSource(context.state.sourceid_pr, "RemoteSync");  break; // gd
			case 'stGalSync':        
			case 'stGalCommit':      this.progressReportOnSource(context.state.sourceid_pr, "GetGAL");      break;
			case 'stLoadTb':         this.progressReportOnSource(context.state.sourceid_tb, "Load");        break;
			case 'stConverge1':     
			case 'stConverge2':     
			case 'stConverge3':     
			case 'stConverge5':     
			case 'stConverge6':     
			case 'stConverge7':     
			case 'stConverge8':      this.progressReportOn("Converge");                                     break;
			case 'stUpdateTb':       this.progressReportOnSource(context.state.sourceid_tb, "PutOne");      break;
			case 'stUpdateCleanup':  this.progressReportOn("Saving");                                       break;

			case 'stSelectSoapUrl':
				if (context.state.suggestedSoapURL)
				{
					this.progressReportOnSource(context.state.sourceid_pr, "SelectSoapUrl");
					this.set(SyncFsmObserver.OP, this.get(SyncFsmObserver.OP)
					                                   + " " + context.state.suggestedSoapURL
					                                   + "<br/>"
					                                   + stringBundleString(this.tweakStringId("SelectSoapUrl2"))
														);
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContact':
			case 'stGetContactsDel':
				if (context.state.aContact.length > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "GetMany");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						// this.m_logger.debug("4401: op: " + op + " this.get(SyncFsmObserver.OP): " + this.get(SyncFsmObserver.OP));
						this.progressReportOnSource(context.state.sourceid_pr, "GetMany", context.state.aContact.length);
						this.set(SyncFsmObserver.PROG_CNT, 0);
					}

					this.set(SyncFsmObserver.PROG_CNT, this.get(SyncFsmObserver.PROG_CNT) + 1);
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stUpdateZm':
			case 'stUpdateGd':
				var sourceid = null;

				bigloop:
					for (y in context.state.aSuo[this.state.sourceid_pr])
						for (var z in context.state.aSuo[this.state.sourceid_pr][y])
						{
							sourceid = this.state.sourceid_pr;
							break bigloop;
						}

				if (sourceid)
				{
					var op = this.buildOp(sourceid, "PutMany");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						var cTotal = 0; // aSuo definitely needs an iterator!
						for (y in context.state.aSuo[sourceid])
							for (var z in context.state.aSuo[sourceid][y])
								cTotal++;

						this.progressReportOnSource(sourceid, "PutMany", cTotal);
						this.set(SyncFsmObserver.PROG_CNT, 0);

						// this.m_logger.debug("update: stUpdateZm: this.get(SyncFsmObserver.OP): " + this.get(SyncFsmObserver.OP)
						//                                                                          + " cTotal: " + cTotal);
					}

					this.set(SyncFsmObserver.PROG_CNT, this.get(SyncFsmObserver.PROG_CNT) + 1);
					this.m_logger.debug("4402: PROG_CNT: " + this.get(SyncFsmObserver.PROG_CNT));
				}
				else
					this.progressReportOnSource(context.state.sourceid_pr, "PutOne");
				break;

			case 'final':
				if (fsmstate.event == 'evCancel')
					this.progressReportOn("Cancelled");
				else
					this.progressReportOn("Done");

				es = this.m_es;

				if (fsmstate.event == 'evCancel')
				{
					es.m_exit_status = 1;

					if (context.state.m_http.isFailed())
					{
						es.failcode(context.state.m_http.failCode());

						if (context.state.m_http instanceof HttpStateZm)
						{
							if (context.state.m_http.m_faultstring)
								es.m_fail_detail = context.state.m_http.m_faultstring;
							else if (context.state.m_http.m_faultcode)
								es.m_fail_detail = context.state.m_http.m_faultcode;

							es.m_fail_soapmethod = context.state.m_http.m_method;
						}
					}
					else
						es.failcode('FailOnCancel');
				}
				else if (fsmstate.event == 'evLackIntegrity')
				{
					es.m_exit_status = 1;

					if (isInArray(fsmstate.oldstate, [ 'start', 'stAuth', 'stLoad' ]))
						es.failcode(context.state.stopFailCode);
					else if (isInArray(fsmstate.oldstate, [ 'stLoadTb', 'stConverge1', 'stConverge6', 'stConverge8', 'stUpdateCleanup' ]))
					{
						es.failcode(context.state.stopFailCode);
						es.m_fail_detail = context.state.stopFailDetail;
					}
					else
						es.failcode('FailOnUnknown');
				}
				else if (context.state.authToken && (context.state.id_fsm == ZinMaestro.FSM_ID_ZM_AUTHONLY ||
				                                     context.state.id_fsm == ZinMaestro.FSM_ID_GD_AUTHONLY))
					es.m_exit_status = 0;
				else if (fsmstate.event == 'evNext' && (context.state.id_fsm == ZinMaestro.FSM_ID_ZM_TWOWAY ||
				                                        context.state.id_fsm == ZinMaestro.FSM_ID_GD_TWOWAY))
					es.m_exit_status = 0;
				else
					zinAssert(false); // ensure that all cases are covered above

				if (es.m_exit_status != 0)
					es.m_fail_fsmoldstate = fsmstate.oldstate;

				zinAssert(es.failcode() != 'FailOnUnknown');

				for (var i = 0; i < context.state.aConflicts.length; i++)
					this.m_logger.info("conflict: " + context.state.aConflicts[i]);

				es.m_count_conflicts = context.state.aConflicts.length;

				this.m_logger.debug("exit status: " + es.toString());

				break;

			default:
				zinAssertAndLog(false, "missing case statement for: " + fsmstate.newstate);
		}

		var percentage_complete = a_states[fsmstate.newstate]['count'] / a_states['final']['count'];

		if (this.get(SyncFsmObserver.PROG_MAX) > 0)
			percentage_complete += this.get(SyncFsmObserver.PROG_CNT) / (this.get(SyncFsmObserver.PROG_MAX) * a_states['final']['count']);

		// With shared addressbooks, we jump from Sync back to GetAccountInfo
		// The progress indicator jumping backwards isn't a good look - this holds it steady.
		// It'd be better to show incremental progress but we don't know at the outset
		// how many contacts there are going to be in each of the shared addressbooks so it'd be tricky.
		//
		if (percentage_complete < this.m_high_water_percentage_complete)
			percentage_complete = this.m_high_water_percentage_complete;
		else
			this.m_high_water_percentage_complete = percentage_complete;

		this.set(SyncFsmObserver.PERCENTAGE_COMPLETE, percentage_complete * 100 + "%");
	}

	return ret;
}
