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
	return this.sourceName(sourceid) + " " + stringBundleString(this.tweakStringId(stringid));
}

SyncFsmObserver.prototype.sourceName = function(sourceid)
{
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
		stGetAccountInfo: { count: 1 },
		stSelectSoapUrl:  { count: 1 },
		stSync:           { },
		stSyncResponse:   { },
		stGetContactZm:   { count: 1 },
		stGalConsider:    { },
		stGalSync:        { count: 1 },
		stGalCommit:      { },
		stGetContactPuZm: { count: 1 },
		stUpdateZm:       { count: 1 },
	};

	var a_states_gd = {
		stAuth:           { count: 1 },
		stAuthCheck:      { },
		stDelContactGd:   { }, // TODO to show progress, this can't be glommed on to another state - needs work, meantime: no progress
		stGetContactGd1:  { count: 1 },
		stGetContactGd2:  { count: 1 },
		stGetContactGd3:  { count: 1 },
		stDeXmlifyAddrGd: { count: 1 },
		stGetContactPuGd: { count: 1 },
		stUpdateGd:       { count: 1 },
	};

	var a_states_common = {
		start:            { count: 1 },
		stLoad:           { count: 1 },
		stLoadTb:         { count: 1 },
		stConverge1:      { count: 1 },
		stConverge2:      { count: 1 },
		stConverge3:      {          },
		stConverge4:      { count: 1 },
		stConverge5:      { count: 1 },
		stConverge6:      { },
		stConverge7:      { count: 1 },
		stConverge8:      { count: 1 },
		stConverge9:      { count: 1 },
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
	this.m_logger.debug("update: fsmstate: " + (fsmstate ? fsmstate.toString() : "null"));

	var context = fsmstate.context; // SyncFsm
	this.state = context.state;

	// this.m_logger.debug("updateState: blah: a_states: " +      aToString(a_states));
	// this.m_logger.debug("updateState: blah: m_transitions: " + aToString(context.fsm.m_transitions));

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
			case 'start':            this.progressReportOn("load.thunderbird");                             break;
			case 'stAuthSelect':
			case 'stAuthLogin':
			case 'stAuthPreAuth':
			case 'stAuth':           this.progressReportOnSource(context.state.sourceid_pr, "remote.auth");  break;
			case 'stLoad':           this.progressReportOn("load");                                         break;
			case 'stGetAccountInfo': this.progressReportOnSource(context.state.sourceid_pr, "account.info"); break;
			case 'stSync':          
			case 'stSyncResponse':
			case 'stGetContactGd1':
			case 'stGetContactGd2':
			case 'stDeXmlifyAddrGd': this.progressReportOnSource(context.state.sourceid_pr, "remote.sync");  break;
			case 'stGalSync':        
			case 'stGalCommit':      this.progressReportOnSource(context.state.sourceid_pr, "get.gal");      break;
			case 'stLoadTb':         this.progressReportOnSource(context.state.sourceid_tb, "load");        break;
			case 'stConverge1':     
			case 'stConverge2':     
			case 'stConverge4':     
			case 'stConverge5':     
			case 'stConverge7':     
			case 'stConverge8':     
			case 'stConverge9':      this.progressReportOn("converge");                                     break;
			case 'stUpdateTb':       this.progressReportOnSource(context.state.sourceid_tb, "put.one");      break;
			case 'stUpdateCleanup':  this.progressReportOn("saving");                                       break;

			case 'stSelectSoapUrl':
				if (context.state.suggestedSoapURL && !context.is_a_zm_tested_soapurl(context.state.suggestedSoapURL))
				{
					this.progressReportOnSource(context.state.sourceid_pr, "soapurl");
					this.set(SyncFsmObserver.OP, this.get(SyncFsmObserver.OP) + " " + context.state.suggestedSoapURL + "<br/>"
					                                      + stringBundleString(this.tweakStringId("soapurl2")));
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
					var hi = intMin(this.m_zm_get_contact_count + aGetContactRequest.length - 1, this.m_zm_get_contact_max);

					if (lo == hi)
						this.set(SyncFsmObserver.PROG_CNT, lo);
					else
						this.set(SyncFsmObserver.PROG_CNT, hyphenate('-', lo, hi));

					this.m_zm_get_contact_count += aGetContactRequest.length;
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContactGd3':
				if (aToLength(context.state.a_gd_contact) > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "get.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						function count_non_deleted(a) {
							var ret = 0;
							for (var id in a) {
								if (!a[id].is_deleted())
									ret++;
							}
							return ret;
						}

						// internally, the running total and chunking counts <entry> elements
						// externally, the display shows "contacts" ie non-deleted <entry>s
						//
						this.m_gd_length_non_deleted = count_non_deleted(context.state.a_gd_contact);
						this.m_gd_length_entry       = aToLength(context.state.a_gd_contact);

						this.progressReportOnSource(context.state.sourceid_pr, "get.many", this.m_gd_length_non_deleted);
					}

					function scale_to(x, y, z) {
						return parseInt(x*z/y); 
					}

					var lo = context.state.a_gd_contact_iterator.m_zindus_contact_count;
					var hi = intMin(this.m_gd_length_entry, this.state.a_gd_contact_iterator.m_zindus_contact_count +
					                                        this.state.a_gd_contact_iterator.m_zindus_contact_chunk - 1); 

					this.set(SyncFsmObserver.PROG_CNT, (lo == hi) ?
					                                     (scale_to(lo, this.m_gd_length_entry, this.m_gd_length_non_deleted) + 1) :
						                   hyphenate('-', scale_to(lo, this.m_gd_length_entry, this.m_gd_length_non_deleted) + 1,
						                                  scale_to(hi, this.m_gd_length_entry, this.m_gd_length_non_deleted)));
				}
				else
					ret = false; // no need to update the UI
				break;

			case 'stGetContactPuGd':
				if (context.state.a_gd_contact_to_get.length > 0)
				{
					var op = this.buildOp(context.state.sourceid_pr, "get.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						this.progressReportOnSource(context.state.sourceid_pr, "get.many", context.state.a_gd_contact_to_get.length);
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
					var op = this.buildOp(sourceid, "put.many");

					if (this.get(SyncFsmObserver.OP) != op)
					{
						var cTotal = 0; // aSuo definitely needs an iterator!
						for (y in context.state.aSuo[sourceid])
							for (var z in context.state.aSuo[sourceid][y])
								cTotal++;

						this.progressReportOnSource(sourceid, "put.many", cTotal);
						this.set(SyncFsmObserver.PROG_CNT, 0);
					}

					this.set(SyncFsmObserver.PROG_CNT, this.get(SyncFsmObserver.PROG_CNT) + 1);
				}
				else
					this.progressReportOnSource(context.state.sourceid_pr, "put.one");
				break;

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

					if (isInArray(fsmstate.oldstate,
					               [ 'start', 'stAuth', 'stGetContactGd2', 'stAuthSelect', 'stGetContactGd2', 'stLoad', 'stAuthCheck',
								     'stLoadTb', 'stConverge1', 'stConverge7', 'stConverge9', 'stUpdateCleanup' ]))
					{
						es.failcode(context.state.stopFailCode);

						if (context.state.stopFailTrailer)
							es.m_fail_trailer = context.state.stopFailTrailer;
					}
					else
						es.failcode('failon.unexpected');
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

				break;

			default:
				zinAssertAndLog(false, "missing case statement for: " + fsmstate.newstate);
		}

		var percentage_complete = a_states[fsmstate.newstate]['count'] / a_states['final']['count'];

		if (this.get(SyncFsmObserver.PROG_MAX) > 0)
			percentage_complete += this.get(SyncFsmObserver.PROG_CNT) / (this.get(SyncFsmObserver.PROG_MAX) * a_states['final']['count']);

		// With shared addressbooks, we jump from Sync back to Getaccount.info
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
