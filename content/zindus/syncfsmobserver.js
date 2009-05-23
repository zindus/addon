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
 * Portions created by Initial Developer are Copyright (C) 2007-2009
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

	this.m_logger = newLogger("SyncFsmObserver");

	this.m_es = es;

	this.m_properties = new Object();

	this.m_high_water_percentage_complete = 0;
	this.m_a_states_seen = new Object();

	this.set(SyncFsmObserver.OP,       "");
	this.set(SyncFsmObserver.PROG_MAX, 0);
	this.set(SyncFsmObserver.PROG_CNT, 0);

	this.m_perf = newObject(
		'm_last_state',    null,
		'm_stopwatch',     new StopWatch("SyncFsmObserver"),
		'm_a_per_state',   new Array());  // of { name, elapsed_time }
}

SyncFsmObserver.OP                  = 'op'; // eg: server put
SyncFsmObserver.PROG_CNT            = 'pc'; // eg: 3 of
SyncFsmObserver.PROG_MAX            = 'pm'; // eg: 6    (counts progress through an iteration of one or two states)
SyncFsmObserver.PROG_AS_PERCENT     = 'pt'; // eg: false ==> show 3 of 6, true ==> show 50%
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
	return this.sourceName(sourceid) + " " + stringBundleString(this.tweakStringId(stringid));
}

SyncFsmObserver.prototype.sourceName = function(sourceid)
{
	zinAssertAndLog(sourceid in this.state.sources, sourceid);

	return this.state.sources[sourceid]['format'] == FORMAT_TB ? stringBundleString("brand.thunderbird").toLowerCase() :
	                                                             stringBundleString("brand.server").toLowerCase();
}

SyncFsmObserver.prototype.tweakStringId = function(stringid)
{
	return "progress." + stringid;
}

SyncFsmObserver.prototype.progressToString = function()
{
	var ret = "";
	
	ret += this.get(SyncFsmObserver.OP);

	if (this.get(SyncFsmObserver.PROG_MAX) > 0)
		if (this.get(SyncFsmObserver.PROG_AS_PERCENT))
			ret += " " + parseInt(this.get(SyncFsmObserver.PROG_CNT) / this.get(SyncFsmObserver.PROG_MAX) * 100) + " %";
		else
			ret += " " + this.get(SyncFsmObserver.PROG_CNT) +
			       " " + stringBundleString(this.tweakStringId("of")) +
			       " " + this.get(SyncFsmObserver.PROG_MAX);

	return ret;
}

SyncFsmObserver.prototype.update = function(fsmstate)
{
	var ret;

	var a_states_zm = {
		stAuthSelect:     { count: 1 },
		stAuthLogin:      { count: 1 },
		stAuthPreAuth:    { count: 1 },
		stAuthCheck:      { },
		stGetInfo:        { count: 1 },
		stGetAccountInfo: { count: 1 },
		stSelectSoapUrl:  { count: 1 },
		stSync:           { },
		stSyncResponse:   { },
		stGetContactZm:   { count: 1 },
		stGalConsider:    { },
		stGalSync:        { count: 1 },
		stGalCommit:      { },
		stGetContactPuZm: { count: 1 },
		stUpdateZm:       { count: 1 }
	};

	var a_states_gd = {
		stAuth:           { count: 1 },
		stAuthCheck:      { },
		stGetContactGd1:  { count: 1 },
		stGetContactGd2:  { count: 1 },
		stGetContactGd3:  { count: 1 },
		stDeXmlifyAddrGd: { },
		stGetContactPuGd: { count: 1 },
		stGetGroupGd:     { }, // no need to show progress for this, because UI will still reflect stGetContactPuGd
		stUpdateGd:       { count: 1 }
	};

	var a_states_common = {
		start:            { count: 1 },
		stLoad:           { count: 1 },
		stLoadTb:         { count: 1 },
		stConverge:       { count: 5 },
		stUpdateTb:       { count: 1 },
		stUpdateCleanup:  { count: 1 },
		stHttpRequest:    { },
		stHttpResponse:   { },
		stCommit:         { },
		final:            { count: 1 }
	};

	for (var state in a_states_common)
	{
		zinAssertAndLog(!isPropertyPresent(a_states_zm, state), "state: " + state);
		zinAssertAndLog(!isPropertyPresent(a_states_gd, state), "state: " + state);
		a_states_zm[state] = a_states_common[state];
		a_states_gd[state] = a_states_common[state];
	}

	switch (fsmstate.context.state.id_fsm)
	{
		case Maestro.FSM_ID_ZM_AUTHONLY:
		case Maestro.FSM_ID_ZM_TWOWAY:
			ret = this.updateState(fsmstate, a_states_zm);
			break;
		case Maestro.FSM_ID_GD_AUTHONLY:
		case Maestro.FSM_ID_GD_TWOWAY:
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
	var progress_count;
	var percentage_progress_big_hand = 0;
	var key;

	this.m_logger.debug("update: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	var context = fsmstate.context; // SyncFsm

	this.state = context.state;
	this.set(SyncFsmObserver.PROG_AS_PERCENT, false);

	// this.m_logger.debug("updateState: blah: a_states: " +      aToString(a_states));
	// this.m_logger.debug("updateState: blah: m_transitions: " + aToString(context.fsm.m_transitions));

	zinAssert(isMatchObjectKeys(a_states, context.fsm.m_transitions));

	this.m_a_states_seen[fsmstate.newstate] = true;
	var count_states_seen = 0;
	var count_states_all = 0;

	for (key in a_states)
		if (isPropertyPresent(a_states[key], 'count'))
		{
			if (isPropertyPresent(this.m_a_states_seen, key))
				count_states_seen += a_states[key]['count'];

			count_states_all += a_states[key]['count'];
		}

	if (false)
	this.m_logger.debug("a_states: "      + aToString(a_states) + "\n" +
	                    "a_states_seen: " + aToString(this.m_a_states_seen) + "\n" +
	                    " count_states_seen: " + count_states_seen + " count_states_all: " + count_states_all );

	if (fsmstate.newstate && isPropertyPresent(a_states[fsmstate.newstate], 'count')) // fsmstate.newstate == null when oldstate == 'final'
	{
		ret = true;
		
		key = context.state.m_progress_yield_text && this.m_perf.m_last_state == fsmstate.newstate ?
		          hyphenate('-', fsmstate.newstate, fsmstate.event, context.state.m_progress_yield_text) :
		          hyphenate('-', fsmstate.newstate, fsmstate.event);

		this.m_perf.m_a_per_state.push(newObject(key, this.m_perf.m_stopwatch.elapsed()));
		this.m_perf.m_last_state = fsmstate.newstate;

		switch(fsmstate.newstate)
		{
			case 'start':            this.progressReportOn("load.thunderbird");                              break;
			case 'stAuthSelect':
			case 'stAuthLogin':
			case 'stAuthPreAuth':
			case 'stAuth':           this.progressReportOnSource(context.state.sourceid_pr, "remote.auth");  break;
			case 'stLoad':           this.progressReportOn("load");                                          break;
			case 'stGetInfo':        this.progressReportOnSource(context.state.sourceid_pr, "account.info"); break;
			case 'stGetAccountInfo': this.progressReportOnSource(context.state.sourceid_pr, "account.info"); break;
			case 'stSync':          
			case 'stSyncResponse':
			case 'stGetContactGd1':
			case 'stGetContactGd2': this.progressReportOnSource(context.state.sourceid_pr, "remote.sync");  break;
			case 'stGalSync':        
			case 'stGalCommit':      this.progressReportOnSource(context.state.sourceid_pr, "get.gal");      break;
			case 'stLoadTb':         this.progressReportOnSource(context.state.sourceid_tb, "load");         break;
			case 'stUpdateTb':       this.progressReportOnSource(context.state.sourceid_tb, "put.one");      break;
			case 'stUpdateCleanup':  this.progressReportOn("saving");                                        break;

			case 'stConverge':
			{
				let progress_max = 12;

				if (fsmstate.event != 'evRepeat')
				{
					this.set(SyncFsmObserver.OP, stringBundleString(this.tweakStringId("converge")) );
					this.set(SyncFsmObserver.PROG_MAX, progress_max);
				}

				this.set(SyncFsmObserver.PROG_CNT, context.state.m_progress_count);
				this.set(SyncFsmObserver.PROG_AS_PERCENT, true);
				percentage_progress_big_hand = context.state.m_progress_count / progress_max;
				break;
			}

			case 'stSelectSoapUrl':
				if (context.state.suggestedSoapURL && !context.is_a_zm_tested_soapurl(context.state.suggestedSoapURL))
				{
					this.progressReportOnSource(context.state.sourceid_pr, "soapurl");
					this.set(SyncFsmObserver.OP, this.get(SyncFsmObserver.OP) + " " + context.state.suggestedSoapURL + "<br/>" +
					                             stringBundleString(this.tweakStringId("soapurl2"), [ url('what-is-soapURL') ] ));
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContactZm':
			case 'stGetContactPuZm':
				if (context.state.aContact.length > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "get.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						this.progressReportOnSource(context.state.sourceid_pr, "get.many", context.state.aContact.length);
						this.m_zm_get_contact_count = 1;
						this.m_zm_get_contact_max   = context.state.aContact.length;
					}

					var aGetContactRequest = SyncFsm.GetContactZmNextBatch(context.state.aContact);

					var lo = this.m_zm_get_contact_count;
					var hi = ZinMin(this.m_zm_get_contact_count + aGetContactRequest.length - 1, this.m_zm_get_contact_max);

					if (lo == hi)
						this.set(SyncFsmObserver.PROG_CNT, lo);
					else
						this.set(SyncFsmObserver.PROG_CNT, hyphenate('-', lo, hi));

					percentage_progress_big_hand = lo / this.m_zm_get_contact_max;
					this.m_zm_get_contact_count += aGetContactRequest.length;
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContactGd3':
				if (context.state.m_gd_contact_length > 0)
				{
					if (fsmstate.event != 'evRepeat')
					{
						this.set(SyncFsmObserver.OP, stringBundleString(this.tweakStringId("get.many")) );
						this.set(SyncFsmObserver.PROG_MAX, context.state.m_gd_contact_length);
					}

					progress_count = context.state.m_gd_contact_count;

					this.set(SyncFsmObserver.PROG_CNT, progress_count);
					this.set(SyncFsmObserver.PROG_AS_PERCENT, true);
					percentage_progress_big_hand = progress_count / context.state.m_gd_contact_length;
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContactPuGd':
				if (context.state.a_gd_contact_to_get && context.state.a_gd_contact_to_get.length > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "get.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						this.progressReportOnSource(context.state.sourceid_pr, "get.many", context.state.a_gd_contact_to_get.length);
						this.set(SyncFsmObserver.PROG_CNT, 0);
					}

					progress_count = this.get(SyncFsmObserver.PROG_CNT) + 1;
					this.set(SyncFsmObserver.PROG_CNT, progress_count);
					percentage_progress_big_hand = progress_count / context.state.a_gd_contact_to_get.length;
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stUpdateZm':
			case 'stUpdateGd': {
				let max_suos = 0;

				function count_suos (fn) {
					var it = new SuoIterator(context.state.aSuo);
					var ret = 0;
					for (suo in it.iterator(fn))
						ret++;
					return ret;
				}

				if (!context.state.m_suo_generator)
					max_suos = count_suos(function(sourceid, bucket) { return sourceid == context.state.sourceid_pr; });

				if (context.state.m_suo_generator || max_suos > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "put.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						this.progressReportOnSource(context.state.sourceid_pr, "put.many", max_suos);
						this.set(SyncFsmObserver.PROG_CNT, 0);
					}

					progress_count = this.get(SyncFsmObserver.PROG_CNT) + 1;

					if (progress_count > this.get(SyncFsmObserver.PROG_MAX))
						ret = false;
					else
					{
						this.set(SyncFsmObserver.PROG_CNT, progress_count);
						percentage_progress_big_hand = progress_count / this.get(SyncFsmObserver.PROG_MAX);
					}

				}
				else
					this.progressReportOnSource(context.state.sourceid_pr, "put.one");
				break;
				}

			case 'final':
				if (fsmstate.event == 'evCancel')
					this.progressReportOn("cancelled");
				else
					this.progressReportOn("done");

				es = this.m_es;

				if (fsmstate.event == 'evCancel')
				{
					es.m_exit_status = 1;

					if (context.state.m_http && context.state.m_http.isFailed())
					{
						es.failcode(context.state.m_http.failCode());

						if (typeof(context.state.m_http.faultLoadFromXml) == 'function')  // for some reason instanceof doesn't work here
						{
							if (context.state.m_http.m_faultstring)
								es.m_fail_trailer = context.state.m_http.m_faultstring + "\n\n";
							else if (context.state.m_http.m_faultcode)
								es.m_fail_trailer = context.state.m_http.m_faultcode + "\n\n";

							es.m_fail_trailer += stringBundleString("text.zm.soap.method", [ context.state.m_http.m_method ]);
						}
					}
					else
						es.failcode('failon.cancel');
				}
				else if (fsmstate.event == 'evLackIntegrity')
				{
					es.m_exit_status = 1;

					if (context.state.stopFailCode)
						es.failcode(context.state.stopFailCode);
					else
						es.failcode('failon.unexpected');

					if (context.state.stopFailTrailer)
						es.m_fail_trailer = context.state.stopFailTrailer;
				}
				else if (context.state.authToken && isPropertyPresent(Maestro.FSM_GROUP_AUTHONLY, context.state.id_fsm))
					es.m_exit_status = 0;
				else if (fsmstate.event == 'evNext' && isPropertyPresent(Maestro.FSM_GROUP_TWOWAY, context.state.id_fsm))
					es.m_exit_status = 0;
				else
					zinAssert(false); // ensure that all cases are covered above

				if (context.state.stopFailArg)
					es.m_fail_arg = context.state.stopFailArg;

				if (es.failcode() == 'failon.unexpected')
				{
					if (context.state.stopFailTrailer)
						es.m_fail_trailer = context.state.stopFailTrailer;
					else
						es.m_fail_trailer = stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);
				}
				else if (es.failcode() == 'failon.service')
					es.m_fail_trailer = stringBundleString("status.failon.service.detail");
				else if (es.failcode() == 'failon.cancel')
					es.m_fail_trailer = stringBundleString("status.failon.cancel.detail");

				if (es.m_exit_status != 0)
					es.m_fail_fsmoldstate = fsmstate.oldstate;

				for (var i = 0; i < context.state.aConflicts.length; i++)
					this.m_logger.info("conflict: " + context.state.aConflicts[i]);

				es.m_count_conflicts = context.state.aConflicts.length;

				this.m_logger.debug("exit status: " + es.toString());

				if (this.m_perf)
				{
					let msg = "m_perf: ";
					let obj = null;
					let key = null;
					let prev = 0;

					for (let i = 0; i < this.m_perf.m_a_per_state.length; i++)
					{
						obj = this.m_perf.m_a_per_state[i];
						key = firstKeyInObject(obj);
						msg += "\n " + strPadTo(key, 40) + "  " + obj[key] + " " + (obj[key] - prev);
						prev = obj[key];
					}

					this.m_logger.debug(msg);
				}

				break;

			default:
				zinAssertAndLog(false, "missing case statement for: " + fsmstate.newstate);
		}

		var percentage_complete = count_states_seen / count_states_all;

		if (false)
		this.m_logger.debug("BLAH 3: " +
				" percentage_complete: " + percentage_complete +
		        " percentage_progress_big_hand: " + percentage_progress_big_hand +
		        " percentage_progress_big_hand corrected: " + percentage_progress_big_hand / count_states_all );

		if (percentage_progress_big_hand)
			zinAssert(this.get(SyncFsmObserver.PROG_MAX) > 0);

		percentage_progress_big_hand = ZinMin(percentage_progress_big_hand, 0.99);

		percentage_complete += percentage_progress_big_hand / count_states_all;

		// With shared addressbooks, we jump from Sync back to Getaccount.info
		// The progress indicator jumping backwards isn't a good look - this holds it steady.
		// Going backwards means we lose the "percentage_progress_big_hand" value too.
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
