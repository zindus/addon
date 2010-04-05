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
// $Id: syncfsm.js,v 1.247 2010-04-05 06:37:33 cvsuser Exp $

includejs("fsm.js");
includejs("zmsoapdocument.js");
includejs("zmcontact.js");
includejs("xpath.js");
includejs("gdaddressconverter.js");
includejs("contactgoogle.js");
includejs("perlocale.js");
includejs("addressbook.js");
includejs("contactconverter.js");
includejs("folderconverter.js");
includejs("feed.js");
includejs("gcs.js");
includejs("suo.js");
includejs("zuio.js");
includejs("lso.js");
includejs("zidbag.js");
includejs("stopwatch.js");
includejs("cookieobserver.js");

const AUTO_INCREMENT_STARTS_AT = 256;  // the 'next' attribute of the AUTO_INCREMENT item starts at this value + 1.
const ZM_FIRST_USER_ID         = 256;
const AB_GAL                   = "GAL";
const GOOGLE_URL_HIER_PART     = "://www.google.com/m8/feeds/";
const GOOGLE_PROJECTION        = "/thin";  // use 'thin' to avoid gd:extendedProperty elements

function SyncFsm()
{
	this.state = null;
	this.fsm   = null;
}
function SyncFsmZm(id_fsm)     { SyncFsm.call(this);   }
function SyncFsmGd(id_fsm)     { SyncFsm.call(this);   }
function SyncFsmGdAuth(id_fsm) { SyncFsmGd.call(this); }

SyncFsmZm.prototype         = new SyncFsm();
SyncFsmGd.prototype         = new SyncFsm();
SyncFsmGdAuth.prototype     = new SyncFsmGd();

// Sync is broken up into a number of steps, coded as a finite state machine
// See: http://en.wikipedia.org/wiki/Finite_state_machine#Transducers (Mealy machine)
// Features:
// - control is released to Thunderbird on state transitions so that TB get other work done (process UI events)
// - minimise memory usage (release memory when it's not going to be used by later states)
// - there is a clear protocol for failing fast when correctness is lost (evLackIntegrity)
// Google and Zimbra have different fsms (though the general format is similar)

SyncFsmZm.prototype.initialiseFsm = function()
{
	var transitions = {
		start:             { evCancel: 'final', evNext: 'stAuthSelect',                                     evLackIntegrity: 'final'     },
		stAuthSelect:      { evCancel: 'final', evNext: 'stAuthLogin',      evPreAuth:     'stAuthPreAuth', evLackIntegrity: 'final'     },
		stAuthLogin:       { evCancel: 'final', evNext: 'stLoad',           evHttpRequest: 'stHttpRequest'                               },
		stAuthPreAuth:     { evCancel: 'final', evNext: 'stAuthCheck',      evHttpRequest: 'stHttpRequest'                               },
		stAuthCheck:       { evCancel: 'final', evNext: 'stLoad',                                           evLackIntegrity: 'final'     },
		stLoad:            { evCancel: 'final', evNext: 'stLoadTb',         evRepeat:      'stLoad',        evLackIntegrity: 'final'     },
 		stLoadTb:          { evCancel: 'final', evNext: 'stGetInfo',        evRepeat:      'stLoadTb',      evLackIntegrity: 'final'     },
 		stGetInfo:         { evCancel: 'final', evNext: 'stGetAccountInfo', evHttpRequest: 'stHttpRequest'                               },
		stGetAccountInfo:  { evCancel: 'final', evNext: 'stSelectSoapUrl',  evHttpRequest: 'stHttpRequest'                               },
		stSelectSoapUrl:   { evCancel: 'final', evNext: 'stSync',           evHttpRequest: 'stHttpRequest'                               },
		stSync:            { evCancel: 'final', evNext: 'stSyncResponse',   evHttpRequest: 'stHttpRequest'                               },
		stSyncResponse:    { evCancel: 'final', evNext: 'stGetContactZm',   evRedo:        'stSync',        evDo: 'stGetAccountInfo'     },
		stGetContactZm:    { evCancel: 'final', evNext: 'stGalConsider',    evHttpRequest: 'stHttpRequest', evRepeat: 'stGetContactZm'   },
		stGalConsider:     { evCancel: 'final', evNext: 'stGalSync',        evSkip:        'stGalCommit'                                 },
		stGalSync:         { evCancel: 'final', evNext: 'stGalCommit',      evHttpRequest: 'stHttpRequest'                               },
		stGalCommit:       { evCancel: 'final', evNext: 'stConverge'                                                                     },
		stConverge:        { evCancel: 'final', evNext: 'stGetContactPuZm', evRepeat:      'stConverge',    evLackIntegrity: 'final'     },
		stGetContactPuZm:  { evCancel: 'final', evNext: 'stUpdateTb',       evHttpRequest: 'stHttpRequest', evRepeat: 'stGetContactPuZm' },
		stUpdateTb:        { evCancel: 'final', evNext: 'stUpdateZm',       evRepeat:      'stUpdateTb',    evLackIntegrity: 'final'     },
		stUpdateZm:        { evCancel: 'final', evNext: 'stUpdateZmHttp'                                                                 },
		stUpdateZmHttp:    { evCancel: 'final', evNext: 'stUpdateCleanup',  evHttpRequest: 'stHttpRequest', evRepeat: 'stUpdateZm'       },
		stUpdateCleanup:   { evCancel: 'final', evNext: 'stCommit',         evRepeat:    'stUpdateCleanup', evLackIntegrity: 'final'     },

		stHttpRequest:     { evCancel: 'final', evNext: 'stHttpResponse'                                                                 },
		stHttpResponse:    { evCancel: 'final', evNext: 'final' /* evNext here is set by setupHttp */                                    },

		stCommit:          { evCancel: 'final', evNext: 'final'                                                                          },
		final:             { }
	};

	var a_entry = {
		start:                  this.entryActionStart,
		stAuthSelect:           this.entryActionAuthSelect,
		stAuthLogin:            this.entryActionAuthLogin,
		stAuthPreAuth:          this.entryActionAuthPreAuth,
		stAuthCheck:            this.entryActionAuthCheck,
		stLoad:                 this.entryActionLoad,
		stLoadTb:               this.entryActionLoadTb,
		stGetInfo:              this.entryActionGetInfo,
		stGetAccountInfo:       this.entryActionGetAccountInfo,
		stSelectSoapUrl:        this.entryActionSelectSoapUrl,
		stSync:                 this.entryActionSync,
		stSyncResponse:         this.entryActionSyncResponse,
		stGetContactZm:         this.entryActionGetContactZm,
		stGetContactPuZm:       this.entryActionGetContactPuZm,
		stGalConsider:          this.entryActionGalConsider,
		stGalSync:              this.entryActionGalSync,
		stGalCommit:            this.entryActionGalCommit,
		stConverge:             this.entryActionConverge,
		stUpdateTb:             this.entryActionUpdateTb,
		stUpdateZm:             this.entryActionUpdateZm,
		stUpdateZmHttp:         this.entryActionUpdateZmHttp,
		stUpdateCleanup:        this.entryActionUpdateCleanup,
		stCommit:               this.entryActionCommit,

		stHttpRequest:          this.entryActionHttpRequest,
		stHttpResponse:         this.entryActionHttpResponse,

		final:                  this.entryActionFinal
	};

	var a_exit = {
		stAuthLogin:            this.exitActionAuthLogin,
		stAuthPreAuth:          this.exitActionAuthPreAuth,
		stGetInfo:              this.exitActionGetInfo,
		stGetAccountInfo:       this.exitActionGetAccountInfo,
		stSelectSoapUrl:        this.exitActionSelectSoapUrl,
		stGetContactZm:         this.exitActionGetContactZm,
		stGetContactPuZm:       this.exitActionGetContactZm,
		stGalSync:              this.exitActionGalSync,
		stUpdateZmHttp:         this.exitActionUpdateZmHttp,
		stHttpResponse:         this.exitActionHttpResponse  /* this gets tweaked by setupHttpZm */
	};

	this.fsm = new Fsm(transitions, a_entry, a_exit);
}

SyncFsmGd.prototype.initialiseFsm = function()
{
	var transitions = {
		start:            { evCancel: 'final', evNext: 'stAuth',           evSkip: 'stAuthCheck',            evLackIntegrity: 'final'     },
		stAuth:           { evCancel: 'final', evNext: 'stAuthCheck',      evHttpRequest: 'stHttpRequest',   evLackIntegrity: 'final'     },
		stAuthCheck:      { evCancel: 'final', evNext: 'stLoad',                                             evLackIntegrity: 'final'     },
		stLoad:           { evCancel: 'final', evNext: 'stLoadTb',         evRepeat:      'stLoad',          evLackIntegrity: 'final'     },
		stLoadTb:         { evCancel: 'final', evNext: 'stGetGroupsGd1',   evRepeat:      'stLoadTb',        evLackIntegrity: 'final'     },
		stGetGroupsGd1:   { evCancel: 'final', evNext: 'stGetGroupsGd2',   evHttpRequest: 'stHttpRequest'                                 },
		stGetGroupsGd2:   { evCancel: 'final', evNext: 'stGetContactGd1',                                    evLackIntegrity: 'final'     },
		stGetContactGd1:  { evCancel: 'final', evNext: 'stGetContactGd2',  evHttpRequest: 'stHttpRequest'                                 },
		stGetContactGd2:  { evCancel: 'final', evNext: 'stGetContactGd3',  evRepeat:      'stGetContactGd1', evLackIntegrity: 'final'     },
		stGetContactGd3:  { evCancel: 'final', evNext: 'stDeXmlifyAddrGd', evSkip:        'stConverge',      evRepeat: 'stGetContactGd3'  },
		stDeXmlifyAddrGd: { evCancel: 'final', evNext: 'stConverge',       evHttpRequest: 'stHttpRequest',   evRepeat: 'stDeXmlifyAddrGd' },
		stConverge:       { evCancel: 'final', evNext: 'stConfirmUI',      evRepeat:      'stConverge',      evLackIntegrity: 'final'     },
		stConfirmUI:      { evCancel: 'final', evNext: 'stGetGroupPuGd'                                                                   },
		stGetGroupPuGd:   { evCancel: 'final', evNext: 'stGetContactPuGd', evHttpRequest: 'stHttpRequest',   evRepeat: 'stGetGroupPuGd'   },
		stGetContactPuGd: { evCancel: 'final', evNext: 'stUpdateGd',       evHttpRequest: 'stHttpRequest',   evRepeat: 'stGetContactPuGd' },
		stUpdateGd:       { evCancel: 'final', evNext: 'stUpdateTb',       evHttpRequest: 'stHttpRequest',   evRepeat: 'stUpdateGd',
		                                                                                                     evLackIntegrity: 'final'     },
		stUpdateTb:       { evCancel: 'final', evNext: 'stUpdateCleanup',  evRepeat:      'stUpdateTb',      evLackIntegrity: 'final'     },
		stUpdateCleanup:  { evCancel: 'final', evNext: 'stCommit',         evRepeat:      'stUpdateCleanup', evLackIntegrity: 'final'     },

		stHttpRequest:    { evCancel: 'final', evNext: 'stHttpResponse'                                                                   },
		stHttpResponse:   { evCancel: 'final', evNext: 'final' /* evNext here is set by setupHttp */                                      },

		stCommit:         { evCancel: 'final', evNext: 'final'                                                                            },
		final:            { }
	};

	var a_entry = {
		start:                  this.entryActionStart,
		stAuth:                 this.entryActionAuth,
		stAuthCheck:            this.entryActionAuthCheck,
		stLoad:                 this.entryActionLoad,
		stLoadTb:               this.entryActionLoadTb,
		stGetGroupsGd1:         this.entryActionGetGroupsGd1,
		stGetGroupsGd2:         this.entryActionGetGroupsGd2,
		stGetContactGd1:        this.entryActionGetContactGd1,
		stGetContactGd2:        this.entryActionGetContactGd2,
		stGetContactGd3:        this.entryActionGetContactGd3,
		stDeXmlifyAddrGd:       this.entryActionDeXmlifyAddrGd,
		stConverge:             this.entryActionConverge,
		stConfirmUI:            this.entryActionConfirmUI,
		stGetGroupPuGd:         this.entryActionGetGroupPuGd,
		stGetContactPuGd:       this.entryActionGetContactPuGd,
		stUpdateGd:             this.entryActionUpdateGd,
		stUpdateTb:             this.entryActionUpdateTb,
		stUpdateCleanup:        this.entryActionUpdateCleanup,
		stCommit:               this.entryActionCommit,

		stHttpRequest:          this.entryActionHttpRequest,
		stHttpResponse:         this.entryActionHttpResponse,

		final:                  this.entryActionFinal
	};

	var a_exit = {
		stAuth:                 this.exitActionAuth,
		stGetContactPuGd:       this.exitActionGetContactPuGd,
		stGetGroupPuGd:         this.exitActionGetGroupPuGd,
		stDeXmlifyAddrGd:       this.exitActionDeXmlifyAddrGd,
		stUpdateGd:             this.exitActionUpdateGd,
		stHttpResponse:         this.exitActionHttpResponse  /* this gets tweaked by setupHttpZm */
	};

	this.fsm = new Fsm(transitions, a_entry, a_exit);
}

SyncFsmGdAuth.prototype.initialiseFsm = function()
{
	SyncFsmGd.prototype.initialiseFsm.call(this);

	if (false && AppInfo.app_name() == 'firefox')
	{
		// TODO - this code is/was toying with the idea that "test connection" in firefox should also get the google groups..
		//
		this.fsm.m_transitions['stAuthCheck']['evNext'] = 'stGetAllGroups';
		this.fsm.m_transitions['stGetAllGroups'] = { evCancel: 'final', evNext: 'final',  evHttpRequest: 'stHttpRequest' };
		this.fsm.m_a_entry['stGetAllGroups'] = this.entryActionGetAllGroups;
		this.fsm.m_a_exit['stGetAllGroups'] = this.exitActionGetAllGroups;
	}
	else
		this.fsm.m_transitions['stAuthCheck']['evNext'] = 'final';
}

SyncFsm.prototype.start = function(win)
{
	this.fsm.m_window = win;
	fsmTransitionSchedule(this.state.id_fsm, null, 'start', 'evNext', this);
}

SyncFsm.prototype.cancel = function(timeoutID)
{
	if (this.state.m_http != null && this.state.m_http.m_xhr && this.state.m_http.m_xhr.readyState != 4)
	{
		this.state.m_http.is_cancelled = true

		this.debug("cancel: about to call: m_xhr.abort()");

		this.state.m_http.m_xhr.abort();
	}
	else
	{
		this.debug("cancel: clearing timeoutID: " + timeoutID);

		this.fsm.m_window.clearTimeout(timeoutID);

		if (!this.fsm.m_continuation)
		{
			// the fsm hasn't had a transition yet so there's no continuation
			// so we just enter the start state and give it a cancel event
			//
			this.debug("cancel: fsm was about to enter start state - now it does that on evCancel");
			fsmTransitionSchedule(this.state.id_fsm, null, 'start', 'evCancel', this);
		}
		else
		{
			this.debug("cancel: continuing on evCancel");

			this.fsm.m_continuation('evCancel');
		}
	}
}

SyncFsm.prototype.entryActionStart = function(state, event, continuation)
{
	var nextEvent = null;
	let sfcd      = this.state.m_sfcd;

	this.state.stopwatch.mark(state + " 1");

	this.state.m_logger.debug("start: " + " account: "        + this.account().username +
										  " zindus version: " + APP_VERSION_NUMBER +
	                                      " cookieEnabled: "  + navigator.cookieEnabled +
	                                      " online: "         + navigator.onLine +
										  " oscpu: "          + navigator.oscpu +
										  " platform: "       + navigator.platform +
										  " userAgent: "      + navigator.userAgent );

	// The first call to .getPabName() iterates through the thunderbird addressbooks, and the first load of the Mork addressbooks
	// can take *ages* (easily 5-6 seconds).
	// The addon currently has a race condition around the start of the timer vs start of 'Sync Now'. (see the comment in syncwindow.js).
	// The condition gets detected and an error reported. 
	// Putting .getPabName() here rather than the SyncFsmState constructor shrinks the size of the window of time in which this
	// race condition can emerge.
	// 
	this.state.m_folder_converter.localised_pab(this.state.m_addressbook.getPabName());

	this.state.stopwatch.mark(state + " 2");

	let pab_name = this.state.m_addressbook.getPabName()

	if (event == 'evCancel')
		nextEvent = 'evCancel';
	else if (typeof(document.evaluate) != 'function')
	{
		this.state.stopFailCode = 'failon.no.xpath';
		nextEvent = 'evLackIntegrity';
	}
	else if (!preference(MozillaPreferences.AS_ALLOW_PRE_RELEASE, 'bool') && String(navigator.userAgent).match(/pre$/))
	{
		this.state.stopFailCode = 'failon.no.tbpre';
		this.state.stopFailArg  = [ url('thunderbird-3') ];
		nextEvent = 'evLackIntegrity';
	}
	else if (sfcd.is_first_in_chain() && this.testForAccountsIntegrity())
	{
		nextEvent = 'evLackIntegrity';
	}
	else if (!pab_name || !this.state.m_addressbook.getAddressBookUriByName(pab_name) || pab_name.match(new RegExp("^" + APP_NAME, "i")))
	{
		// getAddressBookUriByName() returns null when there are two addressbooks of the given name, so
		// it catches when the user has two addressbooks named "Personal Address Book" - see issue#181
		// 
		let msg = "entryActionStart:  addressbooks: " + this.state.m_addressbook.addressbooksToString() + "\n pab_name: " + pab_name;

		if (pab_name)
			msg += "\n getAddressBookUriByName: " + this.state.m_addressbook.getAddressBookUriByName(pab_name) +
			           " is: " + Boolean(this.state.m_addressbook.getAddressBookUriByName(pab_name)) +
			           "\n match zindus prefix and therefore fail: " + Boolean(pab_name.match(new RegExp("^" + APP_NAME, "i")));

		this.debug(msg);

		this.state.stopFailCode = 'failon.no.pab.2';
		this.state.stopFailArg  = [ AppInfo.app_name(AppInfo.firstcap) ];

		nextEvent = 'evLackIntegrity';
	}

	// if we're doing a two-way sync and we've previously cached an authToken, use that (and skip auth)
	//
	if (this.formatPr() == FORMAT_GD && this.state.id_fsm == Maestro.FSM_ID_GD_TWOWAY)
	{
		var passwordlocator = new PasswordLocator(this.account().passwordlocator);
		passwordlocator.url(eGoogleLoginUrl.kAuthToken);

		this.state.authToken = passwordlocator.getPassword();

		if (this.state.authToken)
		{
			this.state.gd_is_use_cached_authtoken = true;
			nextEvent = 'evSkip';
			this.debug("authentication: skip ClientLogin in favour of the cached authToken for: " + passwordlocator.username());
		}
	}

	if (this.state.id_fsm in Maestro.FSM_GROUP_TWOWAY) {
		// auth fsm's don't have accounts yet
		let sourceid = this.account().sourceid;
		let c_start  = sfcd.sourceid(sourceid, 'c_start');
		sfcd.sourceid(sourceid, 'c_start', ++c_start);
		zinAssert(c_start <= MAX_SYNC_START);
	}

	if (!nextEvent)
		nextEvent = 'evNext';

	continuation(nextEvent);
}

SyncFsmZm.prototype.entryActionAuthSelect = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	var sourceid_pr = this.state.sourceid_pr;
	var url         = this.account().url;
	var username    = this.account().username;
	var password    = this.account().passwordlocator.getPassword();

	if (url && /^https?:\/\//.test(url) && username.length > 0 && password && password.length > 0 && isValidUrl(url))
	{
		zinAssert(this.state.zidbag.isPrimaryUser());

		this.state.zidbag.push(null);
		this.state.zidbag.set(null, eAccount.url, url);
		let prefset = prefsetMatchWithPreAuth(url);

		if (prefset)
		{
			url                    = url.replace(/^(https?:\/\/.+?\/).*$/, "$1");
			this.state.preauthURL  = url + prefset.getProperty(PrefSet.PREAUTH_URI_HIER_PART);
			this.state.preauthBody = prefset.getProperty(PrefSet.PREAUTH_POST_BODY);
			this.state.preauthBody = this.state.preauthBody.replace(/\%username\%/, username);
			this.state.preauthBody = this.state.preauthBody.replace(/\%password\%/, password);

			this.debug("entryActionAuthSelect: matched: " + url + " against: " + prefset.getProperty(PrefSet.PREAUTH_REGEXP)
			                                              + " preauth url: " + this.state.preauthURL);

			nextEvent = 'evPreAuth';
		}
		else
			nextEvent = 'evNext';
	}
	else
	{
		this.state.stopFailCode = 'failon.integrity.zm.bad.credentials';
		nextEvent = 'evLackIntegrity';
	}

	continuation(nextEvent);
}

SyncFsmZm.prototype.entryActionAuthLogin = function(state, event, continuation)
{
	this.state.stopwatch.mark(state);

	var sourceid_pr = this.state.sourceid_pr;

	this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(0), null, "Auth", this.account().username,
	                                  this.account().passwordlocator.getPassword());

	continuation('evHttpRequest');
}

SyncFsmZm.prototype.exitActionAuthLogin = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var response = this.state.m_http.response();

	if (response)
	{
		conditionalGetElementByTagNameNS(response, Xpath.NS_ZACCOUNT, "authToken", this.state, 'authToken');

		// ignore lifetime - in doing so we assume that no sync will take longer than the default lifetime of an hour.
		// conditionalGetElementByTagNameNS(response, Xpath.NS_ZACCOUNT, "lifetime",  this.state, 'lifetime');
	}
}

SyncFsmZm.prototype.entryActionAuthPreAuth = function(state, event, continuation)
{
	var headers = newObject("Content-type", "application/x-www-form-urlencoded");

	this.setupHttpGd(state, 'evNext', 'POST', this.state.preauthURL, headers, this.state.preauthBody, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_NO);

	var host = this.state.preauthURL.replace(/^https?:\/\/(.+?)\/.*$/, "$1");

	this.state.preauthCookieObserver = new CookieObserver(host);

	ObserverService.register(this.state.preauthCookieObserver, this.state.preauthCookieObserver.m_topic);

	continuation('evHttpRequest');
}

SyncFsmZm.prototype.exitActionAuthPreAuth = function(state, event)
{
	ObserverService.unregister(this.state.preauthCookieObserver, this.state.preauthCookieObserver.m_topic);

	if (!this.state.m_http || !this.state.m_http.response('text') || event == "evCancel")
		return;

	// http://developer.mozilla.org/en/docs/Code_snippets:Cookies
	// if the cookie:
	// a) was added or changed during the request               then it's fresh and
	// b) matches the cookie used in the XMLHttpRequest channel then it's associated with our request
	//
	var ios           = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var uri           = ios.newURI("http://zimbra.free.fr/", null, null);
	var cookieSvc     = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
	var cookieFromSvc = cookieSvc.getCookieString(uri, this.state.m_http.m_xhr.channel);

	this.debug("exitActionAuthPreAuth: cookie from observer:  " + this.state.preauthCookieObserver.m_cookie);
	this.debug("exitActionAuthPreAuth: cookie from cookieSvc: " + cookieFromSvc);

	if (this.state.preauthCookieObserver.m_cookie && cookieFromSvc &&
	    String(cookieFromSvc).replace(/^ZM_AUTH_TOKEN=(.*?);.*$/, "$1") == this.state.preauthCookieObserver.m_cookie)
	{
		this.state.authToken = this.state.preauthCookieObserver.m_cookie;

		this.debug("exitActionAuthPreAuth: authToken: " + this.state.authToken);
	}
}

SyncFsm.prototype.runEntryActionGenerator = function(state, event, generator_factory_fn)
{
	var nextEvent;

	if (event != 'evRepeat')
		this.state.m_generator = generator_factory_fn.call(this, state);

	nextEvent = this.state.m_generator.next() ? 'evRepeat' : 'evNext';

	if (this.state.stopFailCode)
	{
		this.debug("runEntryActionGenerator: stopFailCode: " + this.state.stopFailCode);
		nextEvent = 'evLackIntegrity';
	}

	return nextEvent;
}

SyncFsm.prototype.entryActionLoad = function(state, event, continuation)
{
	continuation(this.runEntryActionGenerator(state, event, this.entryActionLoadGenerator));
}

// reset
// - test:
//   - when: is_first_in_chain() is true
//   - cond: it's a reset (or first install) when any of lastsync.txt, gid.txt, or 1-tb.txt don't exist
//   - cond: the account_signature in lastsync.txt has changed
// - do: 
//   - remove all data stores - this forces a slow sync of the account
//   - initialise lastsync.txt, gid.txt, zfcTb, tb addressbook
//   - do a slow sync
// slow sync
// - test:
//   - when: every fsm
//   - cond: when the sourceid data file doesn't exist
//   - cond: when the sourceid isn't in lastsync.txt
//   - cond: when a critical detail changed between last sync and this one
// - do:
//   - remove the data file
//   - initialise the zfc
//     
// This is (one of the places) where we pay for not having a real data store.
// Even though data is stored in at least four separate files: 1-tb.txt, 2-zm.txt, gid.txt, lastsync.txt 
// as far as integrity is concerned they are a single unit.
//

SyncFsm.prototype.entryActionLoadGenerator = function(state)
{
	this.state.stopwatch.mark(state + " 1");

	var nextEvent = null;
	var sfcd      = this.state.m_sfcd;
	var is_reset  = false;
	var a_zfc     = new Object();          // associative array of zfc, key is the file name
	var filename, sourceid;

	this.state.zfcGid      = new FeedCollection();
	this.state.zfcLastSync = new FeedCollection();

	with (Filesystem.eFilename)
	{
		var a_account_independent_filenames = newObjectWithKeys(GID, LASTSYNC, FeedCollection.zfcFileNameFromSourceid(SOURCEID_TB));

		a_zfc[GID]      = this.state.zfcGid;     
		a_zfc[LASTSYNC] = this.state.zfcLastSync;

		a_zfc[GID].filename(GID);
		a_zfc[LASTSYNC].filename(LASTSYNC);
	}

	for (sourceid in this.state.sources)
	{
		filename = FeedCollection.zfcFileNameFromSourceid(sourceid);
		a_zfc[filename] = this.state.sources[sourceid]['zfcLuid'] = new FeedCollection();
		a_zfc[filename].filename(filename);
		a_zfc[filename].format(this.state.sources[sourceid]['format']);
	}

	this.debug("entryActionLoad: is_first_in_chain: " + sfcd.is_first_in_chain());

	// Work out whether the user forced a reset, or whether we are going to force one
	//
	var msg_reset = "forcing a reset because: ";

	if (sfcd.is_first_in_chain())
		for (filename in a_account_independent_filenames)
			if (!a_zfc[filename].nsifile().exists())
			{
				is_reset = true;
				msg_reset += "a file is missing: " + filename;
				break;
			}

	a_zfc[Filesystem.eFilename.LASTSYNC].load();

	var zfcLastSync = this.state.zfcLastSync;

	if (sfcd.is_first_in_chain())
	{
		if (!is_reset && !zfcLastSync.isPresent(FeedItem.KEY_LASTSYNC_COMMON))
		{
			is_reset = true;
			msg_reset += "a critical lastsync key isn't present.";
		}

		if (!is_reset)
		{
			var account_signature = zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('account_signature');

			if (account_signature != sfcd.signature())
			{
				is_reset = true;
				msg_reset += "account_signature changed.  last: " + account_signature + " now: " + sfcd.signature();
			}
		}

	    if (!is_reset && this.formatPr() == FORMAT_GD && 
		      zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('gd_is_sync_postal_address') !=
			    String(this.state.gd_is_sync_postal_address))
		{
			is_reset = true;
			msg_reset += "gd_is_sync_postal_address changed";
		}

		this.debug("entryActionLoad: " + (is_reset ? msg_reset : "is_reset: false"));
	}

	this.state.stopwatch.mark(state + " 2");

	// load (or reset) the account-independent data files
	//
	if (sfcd.is_first_in_chain() && is_reset)
	{
		this.debug("entryActionLoad: forcing a reset - removing data files and initialising maps and tb attributes...");

		this.initialiseZfcLastSync();
		this.initialiseZfcAutoIncrement(this.state.zfcGid);
		this.initialiseZfcAutoIncrement(this.zfcTb());

		generator = this.initialiseTbAddressbookGenerator();

		while (generator.next())
			yield true;
	}
	else
	{
		a_zfc[Filesystem.eFilename.GID].load();
		a_zfc[FeedCollection.zfcFileNameFromSourceid(SOURCEID_TB)].load();
	}

	this.state.stopwatch.mark(state + " 3");

	// Work out whether we're doing a slow sync
	//
	var sourceid_pr       = this.state.sourceid_pr;
	var filename_pr       = FeedCollection.zfcFileNameFromSourceid(sourceid_pr);
	var is_file_exists_pr = a_zfc[filename_pr].nsifile().exists();

	function zfitem(zfc, zfc_key, zfi_key) { return zfc.isPresent(zfc_key) ? zfc.get(zfc_key).getOrNull(zfi_key) : null; }

	this.debug("entryActionLoad: " +
	      " \n last sync soapURL:  "          + zfitem(zfcLastSync, sourceid_pr, eAccount.url) +
	      " \n last sync username: "          + zfitem(zfcLastSync, sourceid_pr, eAccount.username) +
	      " \n last sync account_signature: " + zfitem(zfcLastSync, FeedItem.KEY_LASTSYNC_COMMON, 'account_signature') +
	      " \n this sync soapURL:  "          + this.account().url +
	      " \n this sync username: "          + this.account().username +
	      " \n this sync account_signature: " + sfcd.signature() );

	this.debug("entryActionLoad: " +
	      " \n filename_pr :  "          + filename_pr +
	      " \n filename_pr path :  "     + a_zfc[filename_pr].nsifile().path +
	      " \n is_file_exists_pr :  "    + is_file_exists_pr);

	if (is_file_exists_pr)
		a_zfc[filename_pr].load()

	var a_reason    = new Object();
	var zfiLastSync = zfcLastSync.isPresent(sourceid_pr) ? zfcLastSync.get(sourceid_pr) : null;

	function set_a_reason(key, value) {
		if (!isAnyValue(a_reason, true))
			a_reason[key] = value;
	}

	a_reason['no-lastsync-1']  = !is_file_exists_pr;
	a_reason['no-lastsync-2']  = !zfiLastSync;

	set_a_reason('new-source',   zfiLastSync && !zfcLastSync.isPresent(sourceid_pr));
	set_a_reason('new-url',      zfiLastSync && (zfiLastSync.getOrNull(eAccount.url)      != this.account().url));
	set_a_reason('new-username', zfiLastSync && (zfiLastSync.getOrNull(eAccount.username) != this.account().username));

	if (this.formatPr() == FORMAT_ZM)
		set_a_reason('zm_emailed_contacts', zfiLastSync &&
		                                    (zfiLastSync.getOrNull(eAccount.zm_emailed_contacts) != this.account().zm_emailed_contacts));
	else if (this.formatPr() == FORMAT_GD)
	{
		set_a_reason('gd_gr_as_ab',  zfiLastSync && (zfiLastSync.getOrNull(eAccount.gd_gr_as_ab)  != this.account().gd_gr_as_ab));
		set_a_reason('gd_suggested', zfiLastSync && (zfiLastSync.getOrNull(eAccount.gd_suggested) != this.account().gd_suggested));
		set_a_reason('gd_sync_with', zfiLastSync && (zfiLastSync.getOrNull(eAccount.gd_sync_with) != this.account().gd_sync_with));
		set_a_reason('gd_is_sync_postal_address',
		                      zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('gd_is_sync_postal_address') !=
			  		          String(this.state.gd_is_sync_postal_address));
	}

	var is_slow_sync = isAnyValue(a_reason, true);

	this.debug("entryActionLoad: is_slow_sync: " + is_slow_sync + " a_reason: " + aToString(a_reason));

	sfcd.sourceid(sourceid_pr, 'is_slow_sync', is_slow_sync);

	if (is_slow_sync)
	{
		Filesystem.removeZfc(filename_pr);

		this.removeSourceIdFromGid(sourceid_pr);

		for (sourceid in this.state.sources)
			if (sourceid != SOURCEID_TB)
			{
				this.initialiseZfcLastSync(sourceid);
				this.initialiseZfcAutoIncrement(this.zfc(sourceid));
			}
	}
	else
		a_zfc[filename_pr].load();

	this.state.aReverseGid = new Object();

	this.state.stopwatch.mark(state + " 4");

	var result    = { is_consistent: true };
	var generator = this.isConsistentDataStoreGenerator(result, this.state.aReverseGid);

	while (generator.next())
		yield true;

	if (result.is_consistent)
	{
		nextEvent = 'evNext';

		if (this.formatPr() == FORMAT_ZM && zfcLastSync.isPresent(FeedItem.KEY_LASTSYNC_COMMON))
		{
			let str = zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('zm_tested_soapurls')

			if (str)
				this.state.a_zm_tested_soapurls = str.split(",");

			// put the server version string in the logfile - helpful for diagnosis
			//
			str = zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('zm_version')
			this.debug("entryActionLoad: zimbraVersion: " + (str ? str : "unknown"));
		}
	}
	else
	{
		nextEvent = 'evLackIntegrity';
		this.state.stopFailCode    = 'failon.integrity.data.store.in';
		this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
	}

	this.state.stopwatch.mark(state + " 8");

	yield false;
}

// Could also (but don't) test that:
// - 'ver' attributes make sense

SyncFsm.prototype.isConsistentDataStoreGenerator = function(result, aReverse)
{
	function do_debug(self, nn) { self.state.stopwatch.mark("isConsistentDataStore: " + nn + ": is_consistent: " + result.is_consistent); }

	do_debug(this, "1"); result.is_consistent = result.is_consistent && this.isConsistentZfcAutoIncrement(this.state.zfcGid);
	do_debug(this, "2"); result.is_consistent = result.is_consistent && this.isConsistentZfcAutoIncrement(this.zfcTb());
	do_debug(this, "3"); result.is_consistent = result.is_consistent && this.isConsistentGid(aReverse);
	do_debug(this, "4");

	if (result.is_consistent)
	{
		let generator = this.isConsistentSourcesGenerator(result);

		while (generator.next())
			yield true;
	}

	do_debug(this, "5");

	if (this.formatPr() == FORMAT_GD) {
		result.is_consistent = result.is_consistent && this.isConsistentGdCi();
		do_debug(this, "6");
	}
	else if (this.formatPr() == FORMAT_ZM)
	{
		result.is_consistent = result.is_consistent && this.isConsistentZfcAutoIncrement(this.zfcPr());
		do_debug(this, "6");
		result.is_consistent = result.is_consistent && this.isConsistentSharedFolderReferences();
		do_debug(this, "7");
	}

	yield false;
}

// every (sourceid, luid) in the gid must be in the corresponding source (tested by reference to aReverseGid)
//
SyncFsm.prototype.isConsistentGid = function(aReverse)
{
	var is_consistent = true;
	var luid, sourceid, zfc;

	this.state.stopwatch.mark("isConsistentGid: " + " 1");

	is_consistent = this.isConsistentGidParse(aReverse);

	this.state.stopwatch.mark("isConsistentGid: " + " 2");

	if (is_consistent)
		bigloop:
			for (sourceid in this.state.aReverseGid)
			{
				if (sourceid != SOURCEID_TB && !(sourceid in this.state.m_sfcd.m_a_sourceid))
				{
					this.debug("isConsistentGid: inconsistency: sourceid: " + sourceid + " not in sfcd ");
					is_consistent = false;
					break bigloop;
				}

				zfc = this.zfc(sourceid);

				for (luid in this.state.aReverseGid[sourceid])
					if (!(sourceid in this.state.sources) || !zfc.isPresent(luid))
					{
						this.debug("isConsistentGid: inconsistency: sourceid: " + sourceid + " luid: " + luid);
						is_consistent = false;
						break bigloop;
					}
			}

	this.state.stopwatch.mark("isConsistentGid: " + " 3");

	this.debug("isConsistentGid: " + is_consistent);

	return is_consistent;
}

// aReverse is a two dimensional associative array for reverse lookups - meaning given a sourceid and luid, find the gid.
// For example: reverse.1.4 == 7 means that sourceid == 1, luid == 4, gid == 7
// forward lookups are done via zfcGid: zfcGid.get(7).get(1) == 4
// this method tests that the gid is consistent and as a side-effect, if aReverse is supplied, sets it.
// We do this is one iteration for performance reasons.
// If we had a database with referential integrity we'd catch these type of problems on insert!
//
SyncFsm.prototype.isConsistentGidParse = function(aReverseOut)
{
	var is_consistent = true;
	var self          = this;
	var gid, sourceid, aReverse;

	if (aReverseOut)
		aReverse = aReverseOut;
	else
		aReverse = new Object();

	for (sourceid in this.state.sources)
		aReverse[sourceid] = new Object();

	var functor_each_gid_mapitem = {
		run: function(sourceid, luid) {
			if (sourceid in self.state.sources) {
				if (luid in aReverse[sourceid]) {
					self.debug("isConsistentGidParse: sourceid/luid " + sourceid + "/" + luid +
					              " appears in the gid twice! in this gid: " + gid + " and this gid: " + aReverse[sourceid][luid]);
					is_consistent = false;
				}
				else
					aReverse[sourceid][luid] = gid;

				if (self.state.sources[sourceid]['format'] == FORMAT_GD) {
					// gid mapitems never point to gdau contacts
					//
					zinAssertAndLog(self.zfc(sourceid).isPresent(luid), function() { return "gid: " + gid + " sourceid: " + sourceid + " luid: " + luid; } );
					let zfi = self.zfc(sourceid).get(luid);
					if (zfi.type() == FeedItem.TYPE_CN && zfi.styp() != FeedItem.eStyp.gdci) {
						self.debug("isConsistentGidParse: sourceid/luid " + sourceid + "/" + luid +
					              " refers to a contact that's not styp == gdci! zfi: " + zfi.toString());
						is_consistent = false;
					}
				}
			}

			return is_consistent;
		}
	};

	var functor_foreach_gid = {
		run: function(zfi) {
			gid = zfi.key();

			zfi.forEach(functor_each_gid_mapitem, FeedItem.ITER_GID_ITEM);

			return is_consistent;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid);

	this.debug("isConsistentGidParse: is_consistent: " + is_consistent);

	return is_consistent;
}

SyncFsm.prototype.isConsistentSourcesGenerator = function(result)
{
	var a_not_persisted = [ FeedItem.ATTR_KEEP, FeedItem.ATTR_PRES, FeedItem.ATTR_TBPA ];
	var error_msg       = "";
	var sourceid, zfc, format;

	zinAssert(result.is_consistent);

	var functor_foreach_luid = {
		state: this.state,
		run: function(zfi) {
			var luid = zfi.key();

			// all items in a source must be of interest
			//
			if (result.is_consistent && !zfi.isPresent(FeedItem.ATTR_XGID) && !SyncFsm.isOfInterest(zfc, luid)) {
				error_msg += "inconsistency: item not of interest: sourceid: " + sourceid + " luid: " + luid + " zfi: " + zfi.toString();
				result.is_consistent = false;
			}

			// all items in a source must be in the gid (tested via reference to aReverse)
			//
			if (result.is_consistent && !zfi.isPresent(FeedItem.ATTR_XGID) && SyncFsm.isRelevantToGid(zfc, luid) &&
			    !(luid in this.state.aReverseGid[sourceid]))
			{
				error_msg += "inconsistency vs gid: sourceid: " + sourceid + " luid: " + luid;
				result.is_consistent = false;
			}

			if (result.is_consistent)
				for (var i = 0; i < a_not_persisted.length; i++)
					if (zfi.isPresent(a_not_persisted[i])) {
						error_msg += "inconsistency re: " + a_not_persisted[i] + ": sourceid: " + sourceid + " luid: " + luid;
						result.is_consistent = false;
						break;
					}

			if (result.is_consistent && format == FORMAT_GD) {
				// gdau contacts never have an ls attribute
				//
				if (zfi.styp() == FeedItem.eStyp.gdau && zfi.isPresent(FeedItem.ATTR_LS)) {
					error_msg += "inconsistency re: " + a_not_persisted[i] + ": sourceid: " + sourceid + " luid: " + luid;
					result.is_consistent = false;
				}
					
			}

			return result.is_consistent;
		}
	};

	for (sourceid in this.state.sources) {
		this.state.stopwatch.mark("isConsistentSources sourceid: " + sourceid + " starts");

		zfc    = this.zfc(sourceid);
		format = this.state.sources[sourceid]['format'];

		let generator = zfc.forEachGenerator(functor_foreach_luid, chunk_size('feed'));

		while (generator.next())
			yield true;

		this.state.stopwatch.mark("isConsistentSources sourceid: " + sourceid + " ends");

		if (!result.is_consistent)
			break;
	}

	this.debug("isConsistentSources: " + result.is_consistent + " " + error_msg);

	yield false;
}

SyncFsmZm.prototype.isConsistentSharedFolderReferences = function()
{
	var is_consistent = true;
	var a_error_msg   = newObject('error_msg', "");
	var zfc, format;

	var functor_foreach_luid = {
		state: this.state,

		run: function(zfi)
		{
			if (is_consistent && zfi.type() == FeedItem.TYPE_SF)
			{
				is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_LKEY, a_error_msg);
				is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_FKEY, a_error_msg);
			}

			if (is_consistent && zfi.type() == FeedItem.TYPE_LN)
			{
				if (is_consistent && (!zfi.isPresent(FeedItem.ATTR_RID) || !zfi.isPresent(FeedItem.ATTR_ZID) ))
				{
					a_error_msg.error_msg += "missing required attributes: " + zfi.toString();
					is_consistent = false;
				}

				if (zfi.isPresent(FeedItem.ATTR_SKEY)) // <link> elements can be present without the foreign folder
					is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_SKEY, a_error_msg);
			}

			if (is_consistent && zfi.type() == FeedItem.TYPE_FL && zfi.isForeign())
			{
				is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_SKEY, a_error_msg);
			}

			return is_consistent;
		}
	};

	for (var sourceid in this.state.sources)
	{
		zfc = this.zfc(sourceid);
		format = this.state.sources[sourceid]['format'];

		if (format == FORMAT_ZM)
			zfc.forEach(functor_foreach_luid);
	}

	this.state.m_logger.debug("isConsistentSharedFolderReferences: " + is_consistent + " " + a_error_msg.error_msg);

	return is_consistent;
}

SyncFsm.isConsistentKeyReference = function(zfc, zfi, attr, a_error_msg)
{
	let ret = true;

	if (!zfi.isPresent(attr)) {
		a_error_msg.error_msg += "missing required attribute: " + attr + " zfi: " + zfi.toString();
		ret = false;
	}

	if (ret && !zfc.isPresent(zfi.get(attr))) {
		a_error_msg.error_msg += "missing key " + zfi.get(attr) + " referenced from zfi: " + zfi.toString();
		ret = false;
	}

	return ret;
}

SyncFsmGd.prototype.isConsistentGdCi = function()
{
	var is_consistent = true;
	var a_error_msg   = newObject('error_msg', "");
	var a_gdci_references_gdau = new Object();
	var a_gdau_seen = new Object();
	var zfc;

	var functor_foreach_luid = {
		state: this.state,
		run: function(zfi) {
			if (is_consistent && zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdci)
			{
				is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_GDID, a_error_msg);
				is_consistent = is_consistent && SyncFsm.isConsistentKeyReference(zfc, zfi, FeedItem.ATTR_L, a_error_msg);
				a_gdci_references_gdau[zfi.get(FeedItem.ATTR_GDID)] = true;
			}

			if (is_consistent && zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdau)
			{
				if (!zfi.isPresent(FeedItem.ATTR_GDGP)) {
					is_consistent = false;
					a_error_msg.error_msg = " zfi for gdau is missing ATTR_GDGP: zfi: " + zfi.toString();
				}
				
				a_gdau_seen[zfi.key()] = true;
			}

			return is_consistent;
		}
	};

	for (var sourceid in this.state.sources) {
		zfc = this.zfc(sourceid);

		if (this.state.sources[sourceid]['format'] == FORMAT_GD)
			zfc.forEach(functor_foreach_luid);
	}

	if (is_consistent && firstDifferingObjectKey(a_gdci_references_gdau, a_gdau_seen)) {
		is_consistent = false;
		a_error_msg.error_msg = " mismatched gdci and gdau references: " +
		               "\n a_gdci_references_gdau: " + keysToString(a_gdci_references_gdau) + 
		               "\n a_gdau_seen: " + keysToString(a_gdau_seen) +
					   "\n diff: " + firstDifferingObjectKey(a_gdci_references_gdau, a_gdau_seen);
	}

	this.debug("isConsistentGdCi: " + is_consistent + " " + a_error_msg.error_msg);

	return is_consistent;
}

SyncFsm.prototype.isConsistentZfcAutoIncrement = function(zfc)
{
	return zfc.isPresent(FeedItem.KEY_AUTO_INCREMENT) &&
	       zfc.get(FeedItem.KEY_AUTO_INCREMENT).isPresent('next') &&
		   Number(zfc.get(FeedItem.KEY_AUTO_INCREMENT).get('next')) > AUTO_INCREMENT_STARTS_AT;
}

SyncFsm.prototype.initialiseZfcLastSync = function(sourceid)
{
	var zfcLastSync = this.state.zfcLastSync;

	if (sourceid)
	{
		if (zfcLastSync.isPresent(sourceid))
			zfcLastSync.del(sourceid);

		zfcLastSync.set(new FeedItem(null, FeedItem.ATTR_KEY, sourceid));
	}
	else
	{
		zfcLastSync.empty();

		zfcLastSync.set(new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_LASTSYNC_COMMON));
	}
}

SyncFsm.prototype.initialiseZfcAutoIncrement = function(zfc)
{
	zfc.empty();

	zfc.set( new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_AUTO_INCREMENT, 'next', AUTO_INCREMENT_STARTS_AT + 1));
}

// remove any luid attributes in the addressbook
//
SyncFsm.prototype.initialiseTbAddressbookGenerator = function()
{
	let addressbook = this.state.m_addressbook;
	let aUri        = new Object();
	let a_ids_to_remove;

	switch (AppInfo.ab_version()) {
		case 'firefox':      a_ids_to_remove = null;                                                                 break;
		case 'thunderbird2': a_ids_to_remove = newObject(TBCARD_ATTRIBUTE_LUID, "");                                 break;
		default:             a_ids_to_remove = newObject(TBCARD_ATTRIBUTE_LUID, "", TBCARD_ATTRIBUTE_LUID_ITER, ""); break;
	}

 	var functor_foreach_card = {
		run: function(uri, item) {
			var abCard = addressbook.qiCard(item);

			addressbook.updateCard(abCard, uri, null, a_ids_to_remove, FORMAT_TB);

			return true;
		}
	};

	var functor_foreach_addressbook = {
		run: function(elem) {
			aUri[addressbook.directoryProperty(elem, "URI")] = true;

			return true;
		}
	};

	addressbook.forEachAddressBook(functor_foreach_addressbook);

	if (a_ids_to_remove)
		for (var uri in aUri) {
			let generator = addressbook.forEachCardGenerator(uri, functor_foreach_card, chunk_size('cards'));

			while (generator.next())
				yield true;
		}

	yield false;
}

SyncFsm.prototype.removeSourceIdFromGid = function(sourceid)
{
	var functor_foreach_gid = {
		run: function(zfi)
		{
			if (zfi.isPresent(sourceid))
				zfi.del(sourceid);

			return true;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid);
}

SyncFsm.prototype.entryActionGetInfo = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	this.state.stopwatch.mark(state);

	if (this.is_slow_sync()) {
		this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(), null, "GetInfo");
		nextEvent = 'evHttpRequest';
	}
	else
		nextEvent = 'evNext';
	

	continuation(nextEvent);
}

SyncFsm.prototype.exitActionGetInfo = function(state, event)
{
	if (!this.state.m_http.response() || event == "evCancel" || !this.is_slow_sync())
		return;

	zinAssert (this.is_slow_sync());

	let xpath_query = "/soap:Envelope/soap:Body/za:GetInfoResponse/za:version";
	let warn_msg    = "<version> not present";

	Xpath.setConditionalFromSingleElement(this.state, 'zimbraVersion', xpath_query, this.state.m_http.response(), warn_msg);

	if (this.state.zimbraVersion)
		this.debug("exitActionGetInfo: zimbraVersion: " + this.state.zimbraVersion);
}


SyncFsm.prototype.entryActionGetAccountInfo = function(state, event, continuation)
{
	this.state.stopwatch.mark(state);

	var by, value;

	if (this.state.zidbag.isPrimaryUser())
	{
		by    = "name";
		value = this.account().username;
	}
	else
	{
		by    = "id";
		value = this.state.zidbag.zimbraId();
	}

	this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(), this.state.zidbag.zimbraId(), "GetAccountInfo", by, value);

	continuation('evHttpRequest');
}

// if the url that the user entered in the server settings is returned by the server, use that
// otherwise, prefer a url of type preferSchemeForSoapUrl (http or https)
// otherwise, use the first one
//
SyncFsm.prototype.exitActionGetAccountInfo = function(state, event)
{
	if (!this.state.m_http.response() || event == "evCancel")
		return;

	var obj = new Object();
	var xpath_query;

	xpath_query = "/soap:Envelope/soap:Body/za:GetAccountInfoResponse/za:attr[@name='zimbraId']";
	Xpath.setConditionalFromSingleElement(this.state, 'zimbraId', xpath_query, this.state.m_http.response(), null);

	if (this.state.zimbraId)
		this.state.m_logger.debug("exitActionGetAccountInfo: zimbraId: " + this.state.zimbraId);
	else
		this.state.m_logger.error("exitActionGetAccountInfo: cannot continue without zimbraId in response");

	var xpath_query = "/soap:Envelope/soap:Body/za:GetAccountInfoResponse/za:soapURL";
	var functor     = new FunctorArrayOfTextNodeValue();
	var scheme_url  = null;
	var newSoapURL;

	Xpath.runFunctor(functor, xpath_query, this.state.m_http.response());

	// if multiple urls are returned, we look for one that matches the preference preferSchemeForSoapUrl
	// otherwise, we don't have any basis for selecting one and choose the first
	//
	if (functor.a.length > 1)
	{
		var scheme = this.getCharPref(MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME);
		var scheme_length = scheme.length;
		var is_current_url = false;

		for (var i = 0; i < functor.a.length; i++)
			if (functor.a[i].substr(0, scheme_length) == scheme)
				scheme_url = functor.a[i];
	}

	if (scheme_url)
		newSoapURL = scheme_url;
	else
		newSoapURL = functor.a[0];

	if (newSoapURL != this.state.zidbag.soapUrl())
		this.state.suggestedSoapURL = String(newSoapURL);

	this.state.m_logger.debug("exitActionGetAccountInfo: suggestedSoapURL: " + this.state.suggestedSoapURL);
}

SyncFsm.prototype.is_a_zm_tested_soapurl = function(url)
{
	return this.state.a_zm_tested_soapurls.indexOf(url) != -1;
}

// In a non-trivial number of Zimbra installations, the soapURL returned via GetAccountInfo doesn't work -
// mostly because it uses a domain name that's not in the public dns.  This is often seen in SOHO installations.
// OTOH, enterprises/Universities really want clients to respect GetAccountInfo's soapURL because their accounts are partitioned
// across multiple servers.  HTTP HEAD would be the most lightweight way of testing the soapURL returned in GetAccountInfoResponse.
// But as at Zimbra 5.0.1_GA_1902, the server doesn't support HTTP HEAD, so a SOAP document is sent that should be unknown to the server.
// Note: 2008-05-19: instead of testing the recommended soapURL before use, a better approach would be to revert back to the original
// soapURL if the first use of the recommended soapURL fails.

SyncFsm.prototype.entryActionSelectSoapUrl = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	this.state.stopwatch.mark(state);

	if (this.state.suggestedSoapURL && !this.is_a_zm_tested_soapurl(this.state.suggestedSoapURL))
	{
		this.setupHttpZm(state, 'evNext', this.state.suggestedSoapURL, null, 'FakeHead');
		nextEvent = 'evHttpRequest';
	}

	continuation(nextEvent);
}

SyncFsm.prototype.exitActionSelectSoapUrl = function(state, event)
{
	if (!this.state.suggestedSoapURL || event == "evCancel")
		return;

	var msg = "exitActionSelectSoapUrl: ";

	var is_tested = this.is_a_zm_tested_soapurl(this.state.suggestedSoapURL);

	if (is_tested || this.state.m_http.m_faultcode == "service.UNKNOWN_DOCUMENT")
	{
		this.state.zidbag.set(this.state.zidbag.zimbraId(), eAccount.url, this.state.suggestedSoapURL);

		if (!is_tested)
			this.state.a_zm_tested_soapurls.push(this.state.suggestedSoapURL); // array is passed to hyphenate, which wants a string

		msg += " suggestedSoapURL " + (is_tested ? "had been tested previously" : "works") +
		                              ", switching to it: " + this.state.zidbag.soapUrl();
	}
	else
		msg += " suggestedSoapURL doesn't work, continuing with the one used for Auth: " + this.state.zidbag.soapUrl();

	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.entryActionSync = function(state, event, continuation)
{
	this.state.stopwatch.mark(state);

	var msg = "";

	if (this.state.isRedoSyncRequest)
	{
		this.state.SyncTokenInRequest = null;
		msg += "isRedoSyncRequest:";
	}
	else if (this.state.zidbag.isPrimaryUser())
	{
		this.state.SyncTokenInRequest = this.state.zfcLastSync.get(this.state.sourceid_pr).getOrNull(Zuio.key('SyncToken', null));
		msg += "isPrimaryUser:";
	}
	else
	{
		this.state.SyncTokenInRequest = this.state.zidbag.get(this.state.zidbag.zimbraId(), 'SyncToken');
		msg += "zimbraId:";
	}

	this.state.m_logger.debug("entryActionSync: " + msg + " zimbraId: " + this.state.zidbag.zimbraId() +
	                                                      " SyncTokenInRequest: " + this.state.SyncTokenInRequest);

	this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(), this.state.zidbag.zimbraId(), "Sync", this.state.SyncTokenInRequest);

	continuation('evHttpRequest');
}

SyncFsm.prototype.entryActionSyncResponse = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	if (!this.state.m_http.response())
		nextEvent = 'evCancel';
	else
	{
		var response    = this.state.m_http.response();
		var zfcZm       = this.zfcPr();
		var sourceid_pr = this.state.sourceid_pr;
		var change      = newObject('acct', null);
		var self        = this;
		var a_foreign_folder_present = null;
		var key, id, functor, xpath_query, msg;

		Xpath.setConditional(change, 'token', "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);
		Xpath.setConditional(change, 'acct',  "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

		var node = Xpath.getOneNode("/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder", response, response);

		if (node && change.acct)
			a_foreign_folder_present = new Object(); // turns on change detection for folders in foreign accounts

		this.state.m_logger.debug("foreign folder change detection: " + (a_foreign_folder_present ? "on" : "off"));

		// Note: ... what if the sync token went backwards (eg if the server restored from a backup) ??

		// Things we're expecting:
		// <folder view="contact" ms="2713" md="1169690090" l="1" name="address-book-3" id="563"><acl/></folder>
		// <cn ids="567,480,501"/>
		// <cn d="1169685098000" ms="2708" md="1169685098" email="a.b@example.com" fileAsStr="a b" l="7" id="561" rev="2708"/>
		// <deleted ids="561"/>
		// <link f="" rev="7" ms="7" l="1" id="258" md="1204158424" rid="464" zid="1d5c34c8-8c54-4b3f-a23c-eed92decfa67"
		//       name="Leni Mayo's ab-1" owner="leni@george.ho.example.com" rest="blah" view="contact"/>
	
		// <folder view="contact" ms="2713" md="1169690090" l="1" name="address-book-3" id="563"><acl/></folder>
		//  ==> if id is present, update the map
		//      else if l=1
		//        if SyncToken was non-null, set a flag indicating that we need to redo <SyncRequest>
		//        else add it to the map
		//
		// xpath_query_folders = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder[@view='contact' or @id='" + ZM_ID_FOLDER_TRASH + "']";
		//
		var xpath_query_folders = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder[@view='contact']";
		xpath_query = xpath_query_folders;
		xpath_query += " | /soap:Envelope/soap:Body/zm:SyncResponse//zm:link[@view='contact']";

		this.state.isRedoSyncRequest = false;

		functor = {
			state: this.state,
			run: function(doc, node)
			{
				var attribute    = attributesFromNode(node);
				var nodeName     = node.nodeName;
				var is_processed = false;
				var l            = attribute[FeedItem.ATTR_L];
				var name         = attribute[FeedItem.ATTR_NAME];
				var type         = nodeName == 'folder' ? FeedItem.TYPE_FL : FeedItem.TYPE_LN;

				if (node.hasChildNodes() && nodeName == 'folder')
				{
					let i;
					for (i = 0; i < node.childNodes.length; i++) {
						let child = node.childNodes.item(i);
						if (child.nodeType == Node.ELEMENT_NODE && child.nodeName == 'acl' && child.hasChildNodes()) {
							this.state.m_logger.debug("acl node: " + xmlDocumentToString(child));
							attribute[FeedItem.ATTR_ACL] = xmlDocumentToString(child);
						}
					}
				}

				key = Zuio.key(attribute['id'], change.acct);
				msg = "entryActionSyncResponse: found a " + nodeName + ": key=" + key +" l=" + l + " name=" + name;

				if (nodeName == 'link')
					msg += " rid: " + attribute[FeedItem.ATTR_RID] + " zid: " + attribute[FeedItem.ATTR_ZID];
				msg += " :";

				attribute[FeedItem.ATTR_KEY] = key;

				zinAssert( !(change.acct && type == FeedItem.TYPE_LN)); // don't expect to see <link> elements in foreign accounts

				if (self.account().zm_emailed_contacts != "true" && key == ZM_ID_FOLDER_AUTO_CONTACTS)
					msg += "ignoring emailed contacts";
				else if (zfcZm.isPresent(key))
				{
					zfcZm.get(key).set(attribute);  // update existing item

					this.state.isAnyChangeToFolders = true;  // relevant to link too

					msg += " updated in map";

					is_processed = true;
				}
				else if (l == '1')
				{
					if (nodeName == 'folder' && this.state.SyncTokenInRequest)
					{
						// Do another SyncRequest to get the child contacts of this folder
						this.state.isRedoSyncRequest = true;
						msg += " new: need to do another <SyncRequest>";
					}

					if (!("ms" in attribute))
					{
						// see issue #126
						msg += " WARNING: folder didn't have an 'ms' attribute - giving it a fake one";
						attribute["ms"] = 1;
					}

					zfcZm.set(new FeedItem(type, attribute));
					msg += " adding to map";

					is_processed = true;
				}

				if (is_processed && a_foreign_folder_present)
					a_foreign_folder_present[key] = true;
					
				if (!is_processed)
					msg += " ignoring: not of interest";

				this.state.m_logger.debug(msg);
			}
		};

		Xpath.runFunctor(functor, xpath_query, response);

		// <cn d="1169685098000" ms="2708" md="1169685098" email="a.b@example.com" fileAsStr="a b" l="7" id="561" rev="2708"/>
		//   This element appears as a child of a <SyncResponse> element
		//
		//   if the id isn't in the map
		//           ==> add the id to the queue for GetContactRequest,
		//               in which case the id get added to the map in GetContactResponse
		//   else
		//     update the attributes in the map
		//     if the rev attribute is unchanged and the item became of interest or
		//       the rev attribute changed and it's a contact we're interested in
		//           ==> add the id to the queue for GetContactRequest,
		//               in which case the id get added to the map in GetContactResponse
		//

		xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:cn[not(@ids) and not(@type='group')]";

		functor = {
			state: this.state,

			run: function(doc, node)
			{
				var attribute = attributesFromNode(node);
				var id  = attribute[FeedItem.ATTR_ID];
				var l   = attribute[FeedItem.ATTR_L];

				key = Zuio.key(id, change.acct);

				msg = "entryActionSyncResponse: found a <cn key='" + key +"' l='" + l + "'>";
				
				// if the rev attribute is different from that in the map, it means a content change is pending so add the id to the queue,
				// otherwise just add it to the map
				//

				if (!('id' in attribute) || !(FeedItem.ATTR_L in attribute))
					this.state.m_logger.error("<cn> element received from server without an 'id' or 'l' attribute.  Unexpected.  Ignoring: " + aToString(attribute));
				else
				{
					var fAddToTheQueue = false;

					if (!zfcZm.isPresent(key))
					{
						if (SyncFsm.isOfInterest(zfcZm, Zuio.key(l, change.acct)))
						{
							fAddToTheQueue = true;
							msg += " - first time it's been seen ";
						}
						else
						{
							msg += " - isn't of interest - ignored";
						}
					}
					else
					{
						var isInterestingPreUpdate = SyncFsm.isOfInterest(zfcZm, key);

						// When a contact is updated on the server the rev attribute returned with the response is written to the map.
						// The <cn> element returned with the next <SyncResponse> doesn't have a rev attribute -
						// perhaps the zimbra server figures it already gave the client the rev attribute with the <ContactActionResponse>.
						// In the absence of a rev attribute on the <cn> element we use the token attribute in the <change> element
						// in the soap header to decide whether our rev of the contact is the same as that on the server.
						// Note: <SyncResponse> also has a token attribute - no idea whether this merely duplicates the one in the header
						// or whether it serves a different purpose
						//
						var rev_attr = null;
						if (FeedItem.ATTR_REV in attribute)
							rev_attr = attribute[FeedItem.ATTR_REV];
						else if ('token' in change)
							rev_attr = change['token'];

						var isRevChange = !rev_attr ||
						                  !zfcZm.get(key).isPresent(FeedItem.ATTR_REV)  ||
						                   rev_attr != zfcZm.get(key).get(FeedItem.ATTR_REV);

						attribute[FeedItem.ATTR_KEY] = key;

						zfcZm.get(key).set(attribute);

						msg += " - updated in map";

						var isInterestingPostUpdate = SyncFsm.isOfInterest(zfcZm, key);

						if (!isRevChange && isInterestingPostUpdate && !isInterestingPreUpdate)
						{
							fAddToTheQueue = true;
							msg += " - rev didn't change but the contact become of interest";
						}
						else if (isRevChange && isInterestingPostUpdate)
						{
							fAddToTheQueue = true;
							msg += " - rev changed and the contact is of interest";
						}
					}

					if (fAddToTheQueue)
					{
						msg += " - add to the queue for GetContactRequest";
						this.state.aContact.push(new Zuio(id, change.acct));
					}
				}

				this.state.m_logger.debug(msg);
			}
		};

		Xpath.runFunctor(functor, xpath_query, response);

		// <cn ids="567,480,501"/>
		//   This element appears as a child of a <folder> element
		//     ==> add each id to the queue for GetContactRequest
		//     ==> the id is added to the map in GetContactResponse
		//
		// xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder[@l='1' and (@view='contact' or @name='Trash')]/zm:cn/@ids";
		//
		xpath_query = xpath_query_folders + "/zm:cn[@ids]";

		var functor_folder_ids = {
			ids: new Object(),
			state: this.state,

			run: function(doc, node)
			{
				zinAssert(node.nodeType == Node.ELEMENT_NODE);

				var attribute = attributesFromNode(node);
				var parent_folder_attribute = attributesFromNode(node.parentNode);
				var parent_folder_key       = Zuio.key(parent_folder_attribute['id'], change.acct);

				if (SyncFsm.isOfInterest(zfcZm, parent_folder_key))
					for each (var id in attribute['ids'].split(','))
						this.ids[id] = true;
				else
					this.state.m_logger.debug("ignored <cn ids='" + attribute['ids'] +
					                             "'> - because parent folder id='" + parent_folder_attribute['id'] + "' isn't of interest");
			}
		};

		Xpath.runFunctor(functor_folder_ids, xpath_query, response);

		for (id in functor_folder_ids.ids)
			this.state.aContact.push(new Zuio(id, change.acct));

		// <deleted ids="561,542"/>
		//   ==> set the FeedItem.ATTR_DEL flag in the map
		// Some of the deleted ids might not relate to contacts at all
		// So we may never have seen them and no map entry exists.
		// The FeedItem.ATTR_DEL flag is set only on items already in the map.
		//
		xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:deleted/@ids";

		var functor_deleted_ids = {
			ids: new Object(),

			run: function(doc, node)
			{
				zinAssert(node.nodeType == Node.ATTRIBUTE_NODE);

				for each (var id in node.nodeValue.split(","))
					this.ids[id] = true;
			}
		};

		Xpath.runFunctor(functor_deleted_ids, xpath_query, response);

		for (id in functor_deleted_ids.ids)
		{
			key = Zuio.key(id, change.acct);

			if (zfcZm.isPresent(key))
			{
				zfcZm.get(key).set(FeedItem.ATTR_DEL, 1);
				this.state.m_logger.debug("marked a key as deleted: " + key + " zfi: " + zfcZm.get(key).toString());
			}
		}

		// From soap.txt: the folders provided is the complete hierarchy of visible folders -
		// which means that if a folder isn't in this complete list, it was deleted (or perm=""). 
		//
		if (a_foreign_folder_present)
		{
			functor = {
				state: this.state,
				run: function(zfi)
				{
					if (zfi.type() == FeedItem.TYPE_FL && zfi.isForeign() && (new Zuio(zfi.key())).zid() == change.acct
					                                                      && !(zfi.key() in a_foreign_folder_present))
					{
						zfi.set(FeedItem.ATTR_DEL, 1);
						this.state.m_logger.debug("foreign folder change detection: marked deleted: " + zfi.toString());
					}

					return true;
				}
			};

			this.state.m_logger.debug("change.acct: " + change.acct + " a_foreign_folder_present: " + aToString(a_foreign_folder_present));

			zfcZm.forEach(functor);
		}

		// At the end of all this:
		// - our map points to subset of items on the server - basically all top-level folders with @view='contact' and their contacts
		// - this.state.aContact is populated with the ids of:
		//   - contacts that are in the parent folders of interest, and
		//   - contacts whose content has changed (indicated by the rev attribute being bumped)
		//
		msg = "entryActionSyncResponse: aContact: length: " + this.state.aContact.length + " zuios: ";
		for (var i = 0; i < this.state.aContact.length; i++)
			msg += " " + i + ": " + this.state.aContact[i].toString();
		this.state.m_logger.debug(msg);

		if (this.state.isRedoSyncRequest)
		{
			nextEvent = 'evRedo';
			this.state.m_logger.debug("entryActionSyncResponse: forcing a second <SyncRequest>");
		}
		else
		{
			if (this.state.zidbag.isPrimaryUser())
			{
				// populate zidbag based on the <link> elements of the primary user
				// also set the SyncToken attribute from zfcLastSync unless a new <link> elements appeared
				//
				functor = {
					state: this.state,
					m_soapurl: this.state.zidbag.soapUrl(0),
					aNewLink : new Object(),
					run: function(zfi)
					{
						if (zfi.type() == FeedItem.TYPE_LN)
						{
							zinAssert(zfi.isPresent(FeedItem.ATTR_ZID));

							var zid = zfi.get(FeedItem.ATTR_ZID);

							if (!this.state.zidbag.isPresent(zid))
							{
								this.state.zidbag.push(zid);
								this.state.zidbag.set(zid, eAccount.url, this.m_soapurl);
							}

							if (!zfi.isPresent(FeedItem.ATTR_SKEY))
								this.aNewLink[zid] = null;
						}

						return true;
					}
				};

				zfcZm.forEach(functor);

				msg = "zidbag:";

				for (var zid in this.state.zidbag.m_properties)
					if (zid in functor.aNewLink)
					{
						this.state.zidbag.set(zid, 'SyncToken', null);
						msg += "\n " + zid + ": null (because a new link element was found)";
					}
					else
					{
						key = Zuio.key('SyncToken', zid);
						this.state.zidbag.set(zid, 'SyncToken', this.state.zfcLastSync.get(sourceid_pr).getOrNull(key));
						msg += "\n " + zid + ": " + this.state.zidbag.get(zid, 'SyncToken');
					}

				this.state.m_logger.debug(msg);
			}
		}

		var SyncResponse = new Object();

		Xpath.setConditional(SyncResponse, 'SyncMd',   "/soap:Envelope/soap:Body/zm:SyncResponse/attribute::md",         response, null);
		Xpath.setConditional(SyncResponse, 'SyncToken',"/soap:Envelope/soap:Body/zm:SyncResponse/attribute::token",      response, null);

		if ('SyncMd' in SyncResponse)
			this.state.SyncMd = SyncResponse.SyncMd;

		if ('SyncToken' in SyncResponse)
			this.state.zidbag.set(change.acct, 'SyncToken', SyncResponse.SyncToken);

		if (nextEvent == 'evRedo')
			; // do nothing - this was set up above
		else if (this.state.SyncMd == null)
		{
			this.state.m_logger.warn("Can't proceed with sync because (for some reason) <SyncResponse> didn't have an 'md' attribute");

			nextEvent = 'evCancel';
		}
		else if ((this.state.zidbag.a_zid.length - 1) > this.state.zidbag.m_index)
		{
			nextEvent = 'evDo';
			this.state.zidbag.m_index++;
		}
		else
			nextEvent = 'evNext';

		this.state.m_logger.debug("entryActionSyncResponse: zidbag: " + this.state.zidbag.toString());
	}

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGetContactZm = function(state, event, continuation)
{
	var nextEvent = this.entryActionGetContactZmSetup(state);

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGetContactPuZm = function(state, event, continuation)
{
	if (!this.state.is_done_get_contacts_pu)
	{
		var sourceid_pr = this.state.sourceid_pr;
		var zfcGid      = this.state.zfcGid;
		var fn          = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.DEL | FeedItem.TYPE_CN)); }

		zinAssert(this.state.aContact.length == 0);

		for (var suo in this.state.m_suo_iterator.iterator(fn))
			if (zfcGid.get(suo.gid).isPresent(suo.sourceid_target))
			{
				let luid_target = zfcGid.get(suo.gid).get(suo.sourceid_target);
				let zfc         = this.zfc(suo.sourceid_target);

				if (zfc.get(luid_target).isForeign())
					this.state.aContact.push(new Zuio(zfc.get(luid_target).key()));
			}

		this.state.is_done_get_contacts_pu = true;

		let msg = "";
		for (var i = 0; i < this.state.aContact.length; i++)
			msg += " " + i + ": " + this.state.aContact[i].toString();
		this.state.m_logger.debug("entryActionGetContactPuZm: " + msg);
	}

	var nextEvent = this.entryActionGetContactZmSetup(state);

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGetContactZmSetup = function(state)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	if (this.state.aContact.length == 0)
	{
		this.state.m_http = null;

		nextEvent = 'evNext';
	}
	else
	{
		var zuio = this.state.aContact[0];

		var aGetContactRequest = SyncFsm.GetContactZmNextBatch(this.state.aContact);

		this.state.m_logger.debug("entryActionGetContactZm: calling GetContactsRequest: zid: " + zuio.zid() +
		                          " ids:" + aGetContactRequest.toString());

		this.setupHttpZm(state, 'evRepeat', this.state.zidbag.soapUrl(zuio.zid()), zuio.zid(), "GetContacts", aGetContactRequest);

		nextEvent = 'evHttpRequest';
	}

	return nextEvent;
}

SyncFsm.GetContactZmNextBatch = function(aContact)
{
	var zuio  = null;
	var a_ret = new Array();

	// all contacts in the request have to be using the same zid
	//
	for (var i = 0; i < MAX_BATCH_SIZE && i < aContact.length; i++)
	{
		if (!zuio || zuio.zid() == aContact[i].zid())
			zuio = aContact[i];
		else
			break;
		
		a_ret.push(zuio.id());
	}

	return a_ret;
}

SyncFsm.prototype.exitActionGetContactZm = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var xpath_query = "/soap:Envelope/soap:Body/zm:GetContactsResponse/zm:cn";
	var functor     = new ZmContactFunctorToMakeArrayFromNodes(Xpath.nsResolver("zm")); // see <cn> above
	var response    = this.state.m_http.response();

	Xpath.runFunctor(functor, xpath_query, response);

	var change = newObject('acct', null);
	Xpath.setConditional(change, 'acct', "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

	if (functor.a.length < 1)
		this.state.m_logger.warn("GetContactsResponse recieved without a <cn> element");
	else
	{
		for (var i = 0; i < functor.a.length; i++)
		{
			var key = Zuio.key(functor.a[i].attribute['id'], change.acct);

			if (this.state.aContact[i].key() == key)
			{
				if (functor.a[i].isMailList())
					this.state.m_logger.debug("exitActionGetContactZm: ignore mailing lists for the moment");
				else
				{
					this.state.aSyncContact[key] = functor.a[i];

					functor.a[i].attribute[FeedItem.ATTR_KEY] = key;

					if (this.zfcPr().isPresent(key))
						this.zfcPr().get(key).set(functor.a[i].attribute);                         // update existing item
					else
						this.zfcPr().set(new FeedItem(FeedItem.TYPE_CN, functor.a[i].attribute));  // add new item
				}
			}
			else
				this.state.m_logger.warn("GetContactsResponse recieved an unexpected contact ignored: requested: " + key +
				                          " got: " + this.state.aContact[i].key());
		}

		for (var i = 0; i < functor.a.length; i++)
			this.state.aContact.shift();
	}
}

SyncFsm.prototype.entryActionGalConsider = function(state, event, continuation)
{
	var nextEvent   = null;
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_pr = this.state.sourceid_pr;

	this.state.stopwatch.mark(state);

	if (!isInArray(this.account().zm_sync_gal_enabled, [ "yes", "no", "if-fewer" ] ))
	{
		this.state.m_logger.warn("entryActionGalConsider: bad preference value for zm_sync_gal_enabled: " +
		                          this.account().zm_sync_gal_enabled + " - setting to 'no'");

		this.account().zm_sync_gal_enabled = "no";
	}

	this.debug("entryActionGalConsider: zm_sync_gal_enabled: " + this.account().zm_sync_gal_enabled);

	if (this.account().zm_sync_gal_enabled == "no")
		nextEvent = 'evSkip';
	else
	{
		var SyncGalMdInterval = this.getIntPref(MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL);
		var SyncMd = parseInt(zfcLastSync.get(sourceid_pr).getOrNull('SyncMd'));
		var isSyncGalEnabledChanged = this.account().zm_sync_gal_enabled != zfcLastSync.get(sourceid_pr).getOrNull('zm_sync_gal_enabled');

		this.debug("entryActionGalConsider: isSyncGalEnabledChanged: "        + isSyncGalEnabledChanged +
	                                      " SyncMd: "                         + SyncMd +
										  " this.state.SyncMd: "              + this.state.SyncMd +
	                                      " SyncGalMdInterval == "            + SyncGalMdInterval +
	                                      " (SyncMd + SyncGalMdInterval) == " + (SyncMd + SyncGalMdInterval) );


		if (isSyncGalEnabledChanged || SyncMd == null || (this.state.SyncMd > (SyncMd + SyncGalMdInterval)))
		{
			this.state.SyncGalTokenInRequest = null;

			this.debug("entryActionGalConsider: Gal expired or had no state or Gal pref changed - SyncGalTokenInRequest set to null");
		}
		else
		{
			this.state.SyncGalTokenInRequest = zfcLastSync.get(sourceid_pr).getOrNull('SyncGalToken');

			this.debug("entryActionGalConsider: Gal hasn't expired - SyncGalTokenInRequest: " + this.state.SyncGalTokenInRequest);
		}

		if (this.account().zm_sync_gal_enabled == "if-fewer")
			nextEvent = (zfcLastSync.get(sourceid_pr).isPresent('SyncGalEnabledRecheck') &&
			             Number(zfcLastSync.get(sourceid_pr).get('SyncGalEnabledRecheck')) > 0) ? 'evSkip' : 'evNext';
		else
			nextEvent = 'evNext';
	}

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGalSync = function(state, event, continuation)
{
	this.state.stopwatch.mark(state);

	this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(0), null, "SyncGal", this.state.SyncGalTokenInRequest);

	continuation('evHttpRequest');
}

SyncFsm.prototype.exitActionGalSync = function(state, event)
{
	if (!this.state.m_http.response() || event == "evCancel")
		return;

	var xpath_query = "/soap:Envelope/soap:Body/za:SyncGalResponse/attribute::token";
	var warn_msg    = "SyncGalResponse received without a token attribute - don't know how to handle so ignoring it...";

	Xpath.setConditional(this.state, 'SyncGalTokenInResponse', xpath_query, this.state.m_http.response(), warn_msg);

	// zimbra server versions 4.0.x and 4.5 does some caching thing whereby it returns <cn> elements
	// in the SyncGalResponse even though the token is unchanged vs the previous response.
	//
	// Here, aSyncGalContact gets populated with the <cn> child elements of <SyncGalResponse> only when
	// the token attribute is present and different from the previous response.
	//
	if (this.state.SyncGalTokenInResponse != null && this.state.SyncGalTokenInRequest != this.state.SyncGalTokenInResponse)
	{
		var functor = new ZmContactFunctorToMakeArrayFromNodes(Xpath.nsResolver("za")); // see SyncGalResponse below

		Xpath.runFunctor(functor, "/soap:Envelope/soap:Body/za:SyncGalResponse/za:cn", this.state.m_http.response());

		this.state.aSyncGalContact     = functor.a;
		this.state.mapIdSyncGalContact = functor.mapId;
	}
	else
		this.state.m_logger.debug("exitActionGalSync: SyncGalResponse: token is unchanged - ignoring any <cn> elements in the response");
}

// the reference to this.state.SyncMd here is why GalCommit must come *after* SyncResponse
//
SyncFsm.prototype.entryActionGalCommit = function(state, event, continuation)
{
	var aAdd   = new Array(); // each element in the array is an index into aSyncGalContact
	var abName = APP_NAME + ">" + AB_GAL;
	var uri    = this.state.m_addressbook.getAddressBookUriByName(abName);
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_pr = this.state.sourceid_pr;
	var zc, attributes, properties, isGalEnabled, element, i, j;

	this.state.stopwatch.mark(state);

	// work out whether the Gal is enabled by our preferences or not

	if (this.account().zm_sync_gal_enabled == "no")
		isGalEnabled = false;
	else if (this.account().zm_sync_gal_enabled == "yes")
		isGalEnabled = true;
	else
	{
		zinAssert(this.account().zm_sync_gal_enabled == "if-fewer");

		// if request == null and response is non-null 

		if (this.state.SyncGalTokenInRequest == null && this.state.SyncGalTokenInResponse != null)
		{
			var if_fewer = this.getIntPref(MozillaPreferences.ZM_SYNC_GAL_IF_FEWER);

			this.state.m_logger.debug("entryActionGalCommit: if_fewer: " + if_fewer + " this.state.aSyncGalContact.length: " +
			                          (this.state.aSyncGalContact != null ? this.state.aSyncGalContact.length : "null"));

			isGalEnabled = (this.state.aSyncGalContact == null || this.state.aSyncGalContact.length < if_fewer);
		}
		else
			isGalEnabled = !zfcLastSync.get(sourceid_pr).isPresent('SyncGalEnabledRecheck'); // stay as we are

		this.state.m_logger.debug("entryActionGalCommit: this.account().zm_sync_gal_enabled: " + this.account().zm_sync_gal_enabled);
	}
		
	this.state.m_logger.debug("entryActionGalCommit: isGalEnabled: " + isGalEnabled +
	                          " this.account().zm_sync_gal_enabled: " + this.account().zm_sync_gal_enabled);

	if (isGalEnabled && uri == null)
	{
		var abip = this.state.m_addressbook.newAddressBook(abName);
		uri = abip.m_uri;
	}

	if (!isGalEnabled)
	{
		if (uri)
			this.state.m_addressbook.deleteAddressBook(uri);

		if (zfcLastSync.get(sourceid_pr).isPresent('SyncGalToken'))
			zfcLastSync.get(sourceid_pr).del('SyncGalToken');
	}
	else if (!uri)
		this.state.m_logger.error("Unable to find or create the GAL addresbook - skipping GAL sync");
	else if (this.state.SyncGalTokenInResponse == null || this.state.SyncGalTokenInRequest == this.state.SyncGalTokenInResponse)
		this.state.m_logger.debug("entryActionGalCommit: nothing to commit - SyncGalTokenInResponse: " + this.state.SyncGalTokenInResponse);
	else
	{
		// since aSyncGalContact is only populated if there's a change in token, it seems reasonable to assert that length is > 0
		// mm, except when the user doesn't have access to the GAL and SyncGalResponse returns an empty element
		//
		// zinAssert(this.state.aSyncGalContact.length > 0 && this.state.SyncGalTokenChanged);

		for (i in this.state.aSyncGalContact)
		{
			// First, we remove Zimbra <cn> email2, email3 etc because:
			// 1. background: for <cn> elements that come from an addressbook, email, email2 and email3 have corresponding
			//    fields in Zimbra's web-UI
			// 2. for <cn> elements that come from SyncGalResponse, email2, email3, email4, etc are set to the aliases for the account
			//    a. don't want Zm:email2 to map to Tb:SecondEmail
			//    b. don't want to implement regexp matching mapping Zm:email* to Tb:null
			//    c. if/when we preserve Zimbra contact fields that don't have a corresponding Thunderbird field, we won't
			//       want to do it for GAL contacts 'cos they're never written back to Zimbra.

			let a_keys_to_delete = new Object();

			for (j in this.state.aSyncGalContact[i].element)
				if (j != "email1" && j.match(/email[0-9]+/))
					a_keys_to_delete[j] = true;

			for (j in a_keys_to_delete)
				delete this.state.aSyncGalContact[i].element[j];
		}

		let a_luid_tb_to_zm;

		let zfi = this.zfcTb().get(FeedItem.KEY_ZIMBRA_GAL_IDS); // keys are tb luids, values are zimbra <cn> ids

		if (!zfi) {
			zfi = new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_ZIMBRA_GAL_IDS, FeedItem.ATTR_JSON, JSON.toString({}));
			this.zfcTb().set(zfi);
		}

		a_luid_tb_to_zm = JSON.fromString(zfi.get(FeedItem.ATTR_JSON));

		if (this.state.SyncGalTokenInRequest == null)
		{
			this.state.m_logger.debug("entryActionGalCommit: SyncGalTokenInRequest == null ==> recreating the GAL");

			zinAssertAndLog(uri && abName, "uri: " + uri + " abName: " + abName);

			// Instead of deleting/adding/repopulating the GAL addressbook, the code here used to:
			// 1. iterate through the cards in the GAL addressbook,
			// 2. delete cards not in the SyncGalResponse
			// 3. populate aAdd with the remainder
			// But ... for reasons I don't understand (see issue #31), every now and again, the deleteCards() method
			// would simply hang - ie fail to return.  Several users reported this and it happened
			// to me once too.  I could never reproduce it.  The GAL code now avoids using deleteCards() entirely.
			// deleteCards() gets called by UpdateTb but it never seems to hang when called from there, perhaps
			// because the array only ever contains a single element when called from there - but this is only speculation.
			// The Mork addressbook code contains all sorts of race conditions - the previous GAL code by processing a bunch of cards
			// one after another may have triggered something, whereas the updateTb code has an fsm state change between each operation.
			// leni - Wed Feb 27 11:30:36 AUSEDT 2008

			this.state.m_addressbook.deleteAddressBook(uri);

			var abip = this.state.m_addressbook.newAddressBook(abName);
			uri = abip.m_uri;

			for (i in this.state.aSyncGalContact)
				aAdd.push(i);
		}
		else
		{
			this.state.m_logger.debug("entryActionGalCommit: SyncGalTokenInRequest != null - " +
			                          "looking for Tb cards to overwrite where the Tb card id matches a contact in the SyncGalResponse...");

			var self = this;

			// for each card, if there's a corresponding <cn>, overwrite the card's properties.
			//
			var functor = {
				state: this.state,
				run: function(uri, item)
				{
					var abCard     = this.state.m_addressbook.qiCard(item);
					var attributes = this.state.m_addressbook.getCardAttributes(abCard);
					var luid       = attributes[TBCARD_ATTRIBUTE_LUID]; // the tbcard's luid
					var cn_id      = (luid in a_luid_tb_to_zm) ? a_luid_tb_to_zm[luid] : null;
					var index      = (cn_id && (cn_id in this.state.mapIdSyncGalContact)) ? this.state.mapIdSyncGalContact[cn_id] : null;

					if (luid && cn_id && index)
					{
						zc = this.state.aSyncGalContact[index];

						properties = self.contact_converter().convert(FORMAT_TB, FORMAT_ZM, zc.element);

						this.state.m_addressbook.updateCard(abCard, uri, properties, null, FORMAT_ZM);

						this.state.aSyncGalContact[index].present = true;
					}

					return true;
				}
			}

			this.state.m_addressbook.forEachCard(uri, functor);

			for (i in this.state.aSyncGalContact)
				if (!this.state.aSyncGalContact[i].present)
					aAdd.push(i);
		}

		for (i in aAdd)
		{
			zc = this.state.aSyncGalContact[aAdd[i]];

			attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id);
			properties = this.contact_converter().convert(FORMAT_TB, FORMAT_ZM, zc.element);

			this.state.m_logger.debug("entryActionGalCommit: adding aSyncGalContact[" + aAdd[i] + "]: " +
			                            this.shortLabelForContactProperties(properties));

			let abfCard = this.state.m_addressbook.addCard(uri, properties, attributes);

			a_luid_tb_to_zm[abfCard.id()] = zc.attribute.id;
		}

		zfi.set(FeedItem.ATTR_JSON, JSON.toString(a_luid_tb_to_zm));
	}

	if (this.state.SyncGalTokenInResponse) // remember that this state is run even though SyncGalRequest wasn't called...
	{
		zfcLastSync.get(sourceid_pr).set('SyncGalToken', this.state.SyncGalTokenInResponse);
		zfcLastSync.get(sourceid_pr).set('SyncMd',       this.state.SyncMd);
	}

	if (this.account().zm_sync_gal_enabled == "if-fewer" && this.state.SyncGalTokenInRequest == null && !isGalEnabled)
	{
		if (!zfcLastSync.get(sourceid_pr).isPresent('SyncGalEnabledRecheck'))
			zfcLastSync.get(sourceid_pr).set('SyncGalEnabledRecheck', this.getIntPref(MozillaPreferences.ZM_SYNC_GAL_RECHECK));
		else
		{
			if (zfcLastSync.get(sourceid_pr).get('SyncGalEnabledRecheck') <= 1)
				zfcLastSync.get(sourceid_pr).del('SyncGalEnabledRecheck');
			else
				zfcLastSync.get(sourceid_pr).decrement('SyncGalEnabledRecheck');
		}
	}

	if ((isGalEnabled || this.account().zm_sync_gal_enabled != "if-fewer") &&
	    zfcLastSync.get(sourceid_pr).isPresent('SyncGalEnabledRecheck'))
		zfcLastSync.get(sourceid_pr).del('SyncGalEnabledRecheck');
		
	continuation('evNext');
}

SyncFsm.prototype.entryActionLoadTb = function(state, event, continuation)
{
	continuation(this.runEntryActionGenerator(state, event, this.entryActionLoadTbGenerator));
}

// Notes:
// - A big decision in simplifying the loading of the tb addressbook and cards was the decision to give up convergence.
//   If there's a problem, the sync just aborts and the user has to fix it.
//
SyncFsm.prototype.entryActionLoadTbGenerator = function(state)
{
	this.state.stopwatch.mark(state + " 1");

	var gd_ab_name_internal = null;
	var gd_ab_name_public   = null;
	var re_gd_ab_names      = null;
	var passed              = true;
	let ab_name;

	this.state.zfcTbPreMerge = this.zfcTb().clone();           // 1. remember the tb luid's before merge so that we can follow changes

	// we do this when syncing non-zimbra accounts because without the correct mapping of zindus_emailed_contacts to the
	// localised name, when the localised name is encountered in loadTbAddressBooks() it'll think that the address book has
	// changed it's name
	// An alternative approach would be for loadTbAddressBooks to only mess with zindus/blah@gmail.com and pab.
	//
	if (this.formatPr() == FORMAT_ZM)
	{
		this.loadTbLocaliseEmailedContacts();                  // 2. ensure that emailed contacts is in the current locale

		if (this.is_slow_sync())
			this.loadTbDeleteReadOnlySharedAddresbooks();      // 3. ensure that we don't try to update read-only addressbooks on the server
	}
	else if (this.formatPr() == FORMAT_GD)
	{
		this.state.m_folder_converter.gd_account_email_address(this.account().username);

		if (this.is_slow_sync()) {
			//   if gd_sync_with == 'zg'  and there's no zindus/<email-address> folder, create it
			//
			ab_name   = this.gdAddressbookName('zg');
			let aUris = this.state.m_addressbook.getAddressBooksByPattern(new RegExp( "^" + ab_name + "$" ));

			if (this.account().gd_sync_with == 'zg' && isObjectEmpty(aUris))
			{
				let abip = this.state.m_addressbook.newAddressBook(ab_name);

				this.debug("entryActionLoadTbGenerator: created: addressbook: " + ab_name + " uri: " + abip.uri());
			}
		}

		this.loadTbGoogleSystemGroupPrepare();

		gd_ab_name_internal = this.gdAddressbookName('internal');
		gd_ab_name_public   = this.gdAddressbookName('public');
		re_gd_ab_names      = new RegExp("^" + this.state.m_folder_converter.tb_ab_name_for_gd_group(".", ".*") + "$");

		this.debug("loadTb: gd_ab_name_public: " + gd_ab_name_public + " gd_ab_name_internal: " + gd_ab_name_internal);
	}

	let tb_cc_meta = this.loadTbAddressBooks(re_gd_ab_names);  // 4. merge the current tb luid map with the current addressbook(s)

	if (this.formatPr() == FORMAT_GD)
	{
		// loadTbAddressBooks tests the addressbooks for public names to know whether they're relevant to google
		// a_gd_luid_ab_in_tb (which drives isInScopeTbLuid) is populated from names in the map because that catches and keeps in scope
		// addressbooks that might have been deleted during a zimbra sync (so they're no longer in tb) but they remain in
		// the tb luid map because the deletes are yet to propagate to google.
		//
		this.state.a_gd_luid_ab_in_tb = new Object();
		let self = this;
		let functor = {
			run: function(zfi) {
				if (zfi.type() == FeedItem.TYPE_FL &&
				    (zfi.name() == gd_ab_name_internal || (self.account().gd_gr_as_ab  == 'true' && re_gd_ab_names.test(zfi.name()))))
					self.state.a_gd_luid_ab_in_tb[zfi.key()] = true;
				return true;
			}
		};

		this.zfcTb().forEach(functor, FeedCollection.ITER_NON_RESERVED);

		this.debug("loadTb: a_gd_luid_ab_in_tb: " + keysToString(this.state.a_gd_luid_ab_in_tb));
			
		if (this.account().gd_sync_with == 'zg') {
			// altering m_folder_converter here means that we can't use it in a zm sync...
			// Another option here would be to add a method in functor_foreach_luid_slow_sync
			// to do the mapping to+from abName and GD_PAB 
			//
			this.state.m_folder_converter.m_bimap_pab.delete(FORMAT_TB, null);
			this.state.m_folder_converter.m_bimap_pab.add( [ FORMAT_TB ], [ gd_ab_name_public ] );
		}
	}

	this.state.stopwatch.mark(state + " 2");

	this.state.foreach_tb_card_functor = this.get_foreach_card_functor();

	var generator = this.loadTbCardsGenerator(tb_cc_meta);  // 5. load cards, excluding mailing lists and their cards

	while (generator.next())
		yield true;

	passed = (this.state.stopFailCode == null);

	this.state.stopwatch.mark(state + " 3: passed: " + passed);

	if (this.formatPr() == FORMAT_GD)
	{
		passed = passed && this.loadTbTestForEmptyCards(tb_cc_meta);
	}
	else if (this.formatPr() == FORMAT_ZM)
	{
		passed = passed && this.testForLegitimateFolderNames(); // test for duplicate folder names, zimbra-reserved names, illegal chars
		passed = passed && this.testForEmptyContacts();         // test that there are no empty contacts
	}

	// test that the main addressbook is present
	//
	ab_name = (this.formatPr() == FORMAT_ZM) ? TB_PAB : gd_ab_name_internal;

	passed = passed && this.testForFolderPresentInZfcTb(ab_name);

	if (!this.is_slow_sync())
		passed = passed && this.testForReservedFolderInvariant(ab_name);

	if (passed) { // test for duplicate tb addressbooks
		let a_match = this.state.m_addressbook.getAddressBooksByPattern(/.*/);

		for (ab_name in a_match)
			if ((a_match[ab_name].length > 1) && (this.state.m_folder_converter.prefixClass(ab_name) != FolderConverter.PREFIX_CLASS_NONE)){
				this.state.stopFailCode = 'failon.folder.name.duplicate';
				this.state.stopFailArg  = [ ab_name ];
				this.debug("loadTb: multiple folders named: " + ab_name);
			}
	}

	yield false;
}

SyncFsm.prototype.get_foreach_card_functor = function()
{
	var self = this;

	var functor = {
		m_a_empty_contacts: new Object(),
		m_format_pr : self.formatPr(),
		run: function(card, id, properties) {
			var properties_pr = self.contact_converter().convert(this.m_format_pr, FORMAT_TB, properties);

			if (this.is_empty(properties_pr))
				this.m_a_empty_contacts[id] = properties;
		},
		is_empty : function(properties) {
			var ret = true;

			for (var key in properties)
			{
				if (this.m_format_pr == FORMAT_GD)
					ret = !(properties[key] && properties[key].length > 0 && !zinIsWhitespace(properties[key]));
				else
					ret = !(properties[key] && properties[key].length > 0);

				if (!ret)
					break;
			}

			return ret;
		}
	};

	return functor;
}

SyncFsmGd.prototype.gdAddressbookName = function(arg)
{
	zinAssertAndLog(this.account().gd_sync_with == 'zg' || this.account().gd_sync_with == 'pab', this.account().gd_sync_with);

	var name_when_zg = FolderConverter.PREFIX_PRIMARY_ACCOUNT + this.account().username;
	var ret;

	switch(arg)
	{
		case 'public':   ret = this.account().gd_sync_with == 'zg' ? name_when_zg : this.state.m_addressbook.getPabName(); break;
		case 'internal': ret = this.account().gd_sync_with == 'zg' ? name_when_zg : TB_PAB;                                break;
		case 'zg':       ret = name_when_zg;                                                                               break;
		default:         zinAssertAndLog(false, arg)
	}

	return ret;
}

// the convertFor routines take a zfi (because they need to cater for foreign folders
// zfi_from_name returns a zfi for a name as if it were the name of a folder in the primary account
//
SyncFsm.zfi_from_name = function(name)
{
	return new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, 123, FeedItem.ATTR_NAME, name);
}

SyncFsm.zfi_from_name_gd = function(name)
{
	let zfi = new FeedItem(FeedItem.TYPE_GG, FeedItem.ATTR_KEY, 123, FeedItem.ATTR_NAME, name, FeedItem.ATTR_L, '1');

	if (ContactGoogle.eSystemGroup.isPresent(name))
		zfi.set(FeedItem.ATTR_GGSG, '1');
	
	return zfi;
}

SyncFsm.prototype.testForFolderPresentInZfcTb = function(name)
{
	var key = SyncFsm.zfcFindFirstFolder(this.zfcTb(), name);

	if (!key || this.zfcTb().get(key).isPresent(FeedItem.ATTR_DEL))
	{
		this.state.stopFailCode = 'failon.folder.must.be.present';
		this.state.stopFailArg  = [ this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfi_from_name(name)) ];
	}

	let ret = (this.state.stopFailCode == null);

	this.state.m_logger.debug("testForFolderPresentInZfcTb: name: " + stringAsUnicodeEscapeSequence(name) + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.testForReservedFolderInvariant = function(name)
{
	let zfcTbPre  = this.state.zfcTbPreMerge;
	let zfcTbPost = this.zfcTb();
	let ret;

	zinAssert(!this.state.stopFailCode && !this.is_slow_sync());

	let pre_id      = SyncFsm.zfcFindFirstFolder(zfcTbPre, name);
	let post_id     = SyncFsm.zfcFindFirstFolder(zfcTbPost, name);
	let pre_prefid  = pre_id  ? zfcTbPre.get(pre_id).get(FeedItem.ATTR_TPI) : null;
	let post_prefid = post_id ? zfcTbPost.get(post_id).get(FeedItem.ATTR_TPI) : null;

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + stringAsUnicodeEscapeSequence(name) +
		" pre_id="      + pre_id     + " post_id="      + post_id + 
		" pre_prefid: " + pre_prefid + " post_prefid: " + post_prefid);

	if (!post_id || pre_prefid != post_prefid)    // no folder by this name or it changed since last sync
	{
		let ab_name = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfi_from_name(name));

		this.state.stopFailCode    = 'failon.folder.reserved.changed';
		this.state.stopFailArg     = [ ab_name ];
		this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
	}

	ret = (this.state.stopFailCode == null);

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.testForTbAbPresentAndInvariant = function(id, name)
{
	var passed = true;
	var msg = "testForTbAbPresentAndInvariant: id: " + id + " name: " + stringAsUnicodeEscapeSequence(name);

	if (!this.zfcPr().isPresent(id) || this.zfcPr().get(id).isPresent(FeedItem.ATTR_DEL))
		msg += " server doesn't have a folder corresponding to this name";
	else if (this.is_slow_sync())
		msg += " sourceid: " + this.state.sourceid_pr + " is_slow_sync: " + this.is_slow_sync();
	else
	{
		msg += " server has a folder corresponding to: " + stringAsUnicodeEscapeSequence(name);

		passed = passed && this.testForFolderPresentInZfcTb(name);

		msg += " present: " + passed;

		passed = passed && this.testForReservedFolderInvariant(name);

		msg += " invariant: " + passed;
	}

	this.debug(msg + " passed: " + passed);

	return passed;
}

SyncFsmGd.prototype.testForTbAbGdCiIntegrity = function()
{
	let self        = this;
	let sourceid_tb = this.state.sourceid_tb;
	let sourceid_pr = this.state.sourceid_pr;
	let zfcPr       = this.zfcPr();
	let a_gd_au_in_tb_ab = new Object();

	zinAssert(self.formatPr() == FORMAT_GD);

	let functor = {
		run: function(zfi) {
			let ret = true;

			if (zfi.type() == FeedItem.TYPE_CN && (zfi.key() in self.state.aReverseGid[sourceid_tb])) {
				let gid = self.state.aReverseGid[sourceid_tb][zfi.key()];

				if (self.state.zfcGid.get(gid).isPresent(sourceid_pr)) {
					let luid_gd   = self.state.zfcGid.get(gid).get(sourceid_pr);
					let l         = zfi.get(FeedItem.ATTR_L);

					if (!(l in a_gd_au_in_tb_ab))
						a_gd_au_in_tb_ab[l] = new Object();
				
					zinAssert(zfcPr.get(luid_gd).styp() == FeedItem.eStyp.gdci);

					let gdid = zfcPr.get(luid_gd).get(FeedItem.ATTR_GDID);

					if (gdid in a_gd_au_in_tb_ab[l]) {
						self.state.stopFailCode    = 'failon.folder.reserved.changed';
						let ab_name                = self.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, self.zfcTb().get(l));
						self.state.stopFailArg     = [ ab_name ];
						self.state.stopFailTrailer = stringBundleString("status.failon.gd.lost.sync") + "\n\n" +
						                             stringBundleString("text.suggest.reset");

						ret = false;
					}
					else
						a_gd_au_in_tb_ab[l][gdid] = true;
				}
			}

			return ret;
		}
	};

	if (this.account().gd_gr_as_ab == 'true' && !this.is_slow_sync())
		this.zfcTb().forEach(functor);

	return !this.state.stopFailCode;
}

// The ui should not allow these conditions, so if these errors are triggered, then
// a) the ui is broken or
// b) the user created a second zimbra account by editing preferences manually
//
SyncFsm.prototype.testForAccountsIntegrity = function()
{
	var a_keys          = new Object();
	var index_identical = null;
	var sfcd            = this.state.m_sfcd;
	var cZimbra         = 0;
	var i, account, key, ret;

	// test that no two accounts are the same
	//
	for (i = 0; i < sfcd.length(); i++)
	{
		account = sfcd.account(i);
		key     = account.format + account.url + account.username;

		if (account.format_xx() == FORMAT_ZM)
			cZimbra++;

		if (key in a_keys)
			index_identical = i;
		else
			a_keys[key] = true;
	}

	if (cZimbra > 1)
	{
		this.state.stopFailCode    = 'failon.unexpected';
		this.state.stopFailTrailer = "Syncing with more than one Zimbra account isn't supported." +
		                             "  Suggest you remove all but one of the Zimbra accounts and try again." +
		                             "\n\n" + stringBundleString("text.file.bug", [ url('reporting-bugs') ]);
	}
	else if (index_identical)
	{
		account = sfcd.account(index_identical);

		this.state.stopFailCode    = 'failon.unexpected';
		this.state.stopFailTrailer = "You have configured two accounts with identical details.  This isn't supported." +
		                             "  Suggest you delete one of these accounts and try again:" +
		                             "\n\n" + format_xx_to_localisable_string(account.format_xx()) + ": ";

		if (account.format_xx() == FORMAT_ZM)
			this.state.stopFailTrailer += " " + account.url;

		this.state.stopFailTrailer += " " + account.username;
	}

	ret = (this.state.stopFailCode != null);

	this.state.m_logger.debug("testForIdenticalAccounts: returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstFolder = function(zfc, name)
{
	var f = function(zfi) {
		return zfi.type() == FeedItem.TYPE_FL && zfi.getOrNull(FeedItem.ATTR_NAME) == name;
	};

	var ret = zfc.findFirst(f, name);

	// logger().debug("zfcFindFirstFolder: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstSharedFolder = function(zfc, key)
{
	var f = function(zfi, key) {
		return (zfi.type() == FeedItem.TYPE_SF) && (zfi.getOrNull(FeedItem.ATTR_FKEY) == key);
	};

	var ret = zfc.findFirst(f, key);

	// logger().debug("zfcFindFirstSharedFolder: key: " + key + " returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstLink = function(zfc, key)
{
	var zuio = new Zuio(key);

	var f = function(zfi) {
		return zfi.type() == FeedItem.TYPE_LN && zfi.getOrNull(FeedItem.ATTR_RID) == zuio.id() &&
		                                            zfi.getOrNull(FeedItem.ATTR_ZID) == zuio.zid();
	};

	var ret = zfc.findFirst(f);

	// logger().debug("lookupInZfc: zfcFindFirstLink: key: " + key + " returns: " + ret);

	return ret;
}

SyncFsm.isZmFolderReservedName = function(name)
{
	// for the list used by the zimbra web client, see ZimbraWebClient/WebRoot/js/zimbraMail/share/model/ZmFolder.js 
	// even though 'contacts' and 'emailed contacts' are reserved names, they aren't in the list below
	// because we expect them to have corresponding tb addressbooks
	//
	var reReservedFolderNames = /^\s*(inbox|trash|junk|sent|drafts|tags|calendar|notebook|chats)\s*$/i;
	var ret = name.match(reReservedFolderNames) != null;

	// logger().debug("isZmFolderReservedName: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.isZmFolderContainsInvalidCharacter = function(name)
{
	var reInvalidCharacter = /[:/\"\t\r\n]/;
	var ret = name.match(reInvalidCharacter) != null;

	// logger().debug("isZmFolderContainsInvalidCharacter: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.getAbNameNormalised = function(elem)
{
	var ret;

	if (this.state.m_addressbook.isElemPab(elem))
		ret = TB_PAB;
	else if (elem.dirName == this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfi_from_name(TB_EMAILED_CONTACTS)))
		ret = TB_EMAILED_CONTACTS;
	else 
		ret = elem.dirName;

	return ret;
}

SyncFsm.prototype.loadTbLocaliseEmailedContacts = function()
{
	var msg = "LocaliseEmailedContacts: ";

	if (this.state.m_sfcd.first_sourceid_of_format(FORMAT_ZM) == this.state.sourceid_pr)
	{
		var uri, old_translation, old_localised_ab;
		var translation = PerLocaleStatic.translation_of(ZM_FOLDER_EMAILED_CONTACTS);

		this.state.m_folder_converter.localised_emailed_contacts(translation);

		this.state.zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('zm_localised_emailed_contacts', translation);

		var ab_localised = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfi_from_name(TB_EMAILED_CONTACTS));

		// if there's a "zindus/Emailed Contacts" addressbook, rename it to the localised equivalent
		//
		uri = this.state.m_addressbook.getAddressBookUriByName(ab_localised);

		msg += " translation_of(ZM_FOLDER_EMAILED_CONTACTS): " + translation + " ab_localised: " + ab_localised + " uri: " + uri;

		if (!uri)
		{
			for (old_translation in PerLocaleStatic.all_translations_of(ZM_FOLDER_EMAILED_CONTACTS))
			{
				old_localised_ab = FolderConverter.PREFIX_PRIMARY_ACCOUNT + old_translation;

				uri = this.state.m_addressbook.getAddressBookUriByName(old_localised_ab);

				// unicode chars bugger up stty: msg += " testing for: " + old_localised_ab + " uri: " + uri;

				if (uri)
				{
					msg += " found: " + old_localised_ab + " uri: " + uri;

					this.state.m_addressbook.renameAddressBook(uri, ab_localised);

					msg += " renamed to " + ab_localised + " uri: " + this.state.m_addressbook.getAddressBookUriByName(ab_localised);

					break;
				}
			}
		}
		else if (this.is_slow_sync() && this.account().zm_emailed_contacts != "true")
			this.state.m_addressbook.renameAddressBook(uri, dateSuffixForFolder() + " " + ab_localised);
	}
	else
		this.state.m_folder_converter.localised_emailed_contacts(this.state.zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).get('zm_localised_emailed_contacts'));
				
	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.loadTbGoogleSystemGroupPrepare = function()
{
	let msg = "loadTbGoogleSystemGroupPrepare: ";
	let self = this;
	let system_group_name, zfi, ab_localised, uri;

	function get_ab(system_group_name) {
		let zfi          = SyncFsm.zfi_from_name_gd(system_group_name);
		let ab_localised = self.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_GD, zfi);
		let uri          = self.state.m_addressbook.getAddressBookUriByName(ab_localised);
		return [ ab_localised, uri ];
	}

	// create the tb addressbooks corresponding to google system groups if they don't exist.
	// In this approach, the google system group names are hardcoded - they're not obtained from google
	// which suits the current fsm which (1) interrogates tb then (2) interrogates google
	// Zimbra emailed contacts is a similar problem (a remote and 'immutable' folder) but addressbook creation
	// isn't handled explicitly - it's just a normal "add" operation
	// 
	if (this.account().gd_gr_as_ab == 'true' && this.is_slow_sync()) {
		for (system_group_name in ContactGoogleStatic.systemGroups(this.account())) {
			[ ab_localised, uri ] = get_ab(system_group_name);

			if (!uri) {
				let abip = this.state.m_addressbook.newAddressBook(ab_localised);
				msg += " created: addressbook: " + ab_localised + " uri: " + abip.uri() + "\n";
			}
		}
	}

	let zfiStatus    = StatusBarState.toZfi();
	let data_version = zfiStatus ? zfiStatus.getOrNull('appversion') : "";

	// TODO remove this once 0.8.15 is released
	if ((self.account().gd_gr_as_ab == 'true') &&
		this.is_slow_sync() &&
	    ContactGoogleStatic.is_google_apps(self.account()) &&
		data_version.match(/0\.8\.14\.20/)) {
		for (system_group_name in ContactGoogle.eSystemGroup)
			if (!ContactGoogle.eSystemGroupForApps.isPresent(system_group_name)) {
				[ ab_localised, uri ] = get_ab(system_group_name);
				if (uri) {
					msg += " deleted: system addressbook in google apps account: " + ab_localised + " uri: " + uri + "\n";
					this.state.m_addressbook.deleteAddressBook(uri);
				}
			}
		
	}

	// migrate any old translations of the mapped system groups to their localised name
	//
	if (this.account().gd_gr_as_ab == 'true')
		for (system_group_name in ContactGoogleStatic.systemGroups(this.account())) {
			[ ab_localised, uri ] = get_ab(system_group_name);

			this.debug("loadTbGoogleSystemGroupPrepare: system_group_name: " + system_group_name +
			                        " ab_localised: " + ab_localised + " uri: " + uri);

			if (!uri)
				for (var old_translation in PerLocaleStatic.all_translations_of(system_group_name)) {
					let old_localised_ab = this.state.m_folder_converter.tb_ab_name_for_gd_group("/", old_translation);
					uri                  = this.state.m_addressbook.getAddressBookUriByName(old_localised_ab);

					// this.debug("loadTbGoogleSystemGroupPrepare: system_group_name: " + system_group_name +
					//                 " old_localised_ab: " + old_localised_ab + " uri: " + uri);

					if (uri) {
						msg += "\n found: system_group_name: " + system_group_name +
						       " old_localised_ab: "           + stringAsUnicodeEscapeSequence(old_localised_ab) +
							   " uri: "                        + uri;

						this.state.m_addressbook.renameAddressBook(uri, ab_localised);

						msg += " renamed to " + stringAsUnicodeEscapeSequence(ab_localised) +
						       " uri: "       + this.state.m_addressbook.getAddressBookUriByName(ab_localised);

						// twiddle zfcTb and the pre so that we pass testForReservedFolderInvariant
						//
						function twiddle_zfc(zfc) {
							let pre_id = SyncFsm.zfcFindFirstFolder(zfc, old_localised_ab);
							if (pre_id)
								zfc.get(pre_id).set(FeedItem.ATTR_NAME, ab_localised);
						}
						twiddle_zfc(this.state.zfcTbPreMerge);
						twiddle_zfc(this.zfcTb());

						break;
					}
				}
		}

	if (this.is_slow_sync() && this.account().gd_gr_as_ab != 'true') {
		let gct   = new GoogleRuleTrash(this.state.m_addressbook);
		let re    = new RegExp(this.state.m_folder_converter.tb_ab_name_for_gd_group('.', ''));
		let a_ab  = this.state.m_addressbook.getAddressBooksByPattern(re);
		let a_uri = new Object();
		let i;

		for (ab_name in a_ab)
			for (i = 0; i < a_ab[ab_name].length; i++)
				a_uri[a_ab[ab_name][i].uri()] = true;

		gct.moveToTrashAbs(this.contact_converter(), a_uri);
	}
				
	this.debug(msg);
}

SyncFsm.prototype.loadTbDeleteReadOnlySharedAddresbooks = function()
{
	zinAssert(this.is_slow_sync());

	var aUris = this.state.m_addressbook.getAddressBooksByPattern(new RegExp(FolderConverter.PREFIX_FOREIGN_READONLY));

	this.state.m_logger.debug("loadTbDeleteReadOnlySharedAddresbooks: about to delete: " + aToString(aUris));

	for (var key in aUris)
		for (var i = 0; i < aUris[key].length; i++)
			this.state.m_addressbook.deleteAddressBook(aUris[key][i].uri());
}

// When syncing with Google, only look at the google addressbooks because then we don't need to have previously
// set up zimbra's Emailed Contacts mapping or refer to zfcLastSync's zm_localised_emailed_contacts key
//
SyncFsm.prototype.loadTbAddressBooks = function(re_gd_ab_names)
{
	var sourceid           = this.state.sourceid_tb;
	var zfcTb              = this.zfcTb();
	var self               = this;
	var format             = this.state.sources[this.state.sourceid_pr]['format'];
	var stopwatch          = this.state.stopwatch;
	var mapTbFolderTpiToId = SyncFsm.getTopLevelFolderHash(zfcTb, FeedItem.ATTR_TPI, FeedItem.ATTR_KEY);
	let tb_cc_meta         = new ContactCollectionMeta();

	stopwatch.mark("loadTbAddressBooks: 1");

	this.debug("loadTbAddressBooks: mapTbFolderTpiToId == " + aToString(mapTbFolderTpiToId));

	// do change detection for addressbooks
	// Personal Address Book is identified by isElemPab() and regardless of its localised name, the zfi's ATTR_NAME is set to TB_PAB
	//
	var functor_foreach_addressbook =
	{
		run: function(elem)
		{
			var is_elem_pab = self.state.m_addressbook.isElemPab(elem);
			var uri         = self.state.m_addressbook.directoryProperty(elem, "URI");
			var dirname     = elem.dirName;
			var prefid      = elem.dirPrefId;
			var is_process  = is_elem_pab;

			if (format == FORMAT_ZM)
				is_process = is_elem_pab || (self.state.m_folder_converter.prefixClass(dirname) != FolderConverter.PREFIX_CLASS_NONE &&
				                                dirname.indexOf("/", self.state.m_folder_converter.m_prefix_length) == -1);
			else
				is_process = (self.account().gd_gr_as_ab  == 'true' && re_gd_ab_names.test(dirname)) ||
				             (dirname == self.gdAddressbookName('public'));

			let msg = "addressbook:" +
			          " dirName: "              + dirname +
			          " dirPrefId: "            + prefid +
				      " URI: "                  + uri +
			          " isElemPab(elem): "      + (is_elem_pab ? "yes" : "no") +
			          " description: "          + elem.description +
			          " supportsMailingLists: " + elem.supportsMailingLists +
			          " is_process: "           + is_process;

			if (is_process)
			{
				let name = self.getAbNameNormalised(elem);
				let key;

				msg = "addressbook of interest to zindus: " + msg;

				if (!(prefid in mapTbFolderTpiToId))
				{
					key = Zuio.key(zfcTb.get(FeedItem.KEY_AUTO_INCREMENT).increment('next'), FeedItem.FAKE_ZID_FOR_AB);

					zfcTb.set(new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, key , FeedItem.ATTR_L, 1,
					    FeedItem.ATTR_NAME, name,
					    FeedItem.ATTR_MS, 1,
						FeedItem.ATTR_TPI, prefid));
					
					msg = "added to the map: " + msg + " : " + zfcTb.get(key).toString();
				}
				else
				{
					key = mapTbFolderTpiToId[prefid];

					// the mozilla addressbook doesn't offer anything useful for change detection for addressbooks so we do our own...
					// 
					let zfi = zfcTb.get(key);

					if (zfi.name() != name)
					{
						zfi.set(FeedItem.ATTR_NAME, name);
						zfi.increment(FeedItem.ATTR_MS);

						msg += " - folder changed: " + zfi.toString();
					}
				}

				tb_cc_meta.push(newObject('uri', uri, 'luid_tb', key));
				zfcTb.get(key).set(FeedItem.ATTR_PRES, '1');  // this drives deletion detection

				msg += " - elem properties: " + " dirType: "  + self.state.m_addressbook.directoryProperty(elem, "dirType") + " key=" + key;
			}
			else
				msg = "ignored: " + msg;

			self.debug("loadTbAddressBooks: " + msg);
		
			return true;
		}
	};

	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);

	this.debug("loadTbAddressBooks: returns tb_cc_meta: " + aToString(tb_cc_meta));

	stopwatch.mark("loadTbAddressBooks: 2");

	return tb_cc_meta;
}

SyncFsm.prototype.loadTbCardsGenerator = function(tb_cc_meta)
{
	// when you iterate through cards in an addressbook, you also see cards that are members of mailing lists
	// and the only way I know of identifying such cards is to iterate to them via a mailing list uri.
	// So there's a 3-pass thing here:
	// pass 1 - iterate through the cards in the zindus folders:
	//  - making sure all cards have an luid (not nec when the underlying ab supports uuids), and
	//  - building an associative array of mailing list uris
	//      aListUris['moz-abmdbdirectory://abook.mab/MailList3'] = moz-abmdbdirectory://abook.mab
	// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
	//   - a card key is a concatenation of mdbCard. dbTableID dbRowID key == 1 797 402
	//      aListCardKey['1-797-402'] = moz-abmdbdirectory://abook.mab;
	// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aListCardKey
	//          where the uri matches the uri of the addressbook
	// The key '1-797-402' is only unique within an addressbook.
	//

	function is_card_attribute_valid(attributes, key) {
		return ((key in attributes) && (attributes[key] > 0));
	}

	// pass 1 - iterate through the cards in the zindus folders building an associative array of mailing list uris
	//          and do some housekeeping.
	//
	var aMailListUri       = new Object();
	var zfcTb              = this.zfcTb();
	var a_uuid_of_new_card = new Object();
	var ab_has_uuids       = this.state.m_addressbook.has_uuids();
	var self               = this;
	var tb3_luid_iter      = 1;
	var i, msg, uri, functor_foreach_card, generator;

	functor_foreach_card = {
		state: this.state,
		run: function(uri, item)
		{
			var abCard     = this.state.m_addressbook.qiCard(item);
			var attributes = this.state.m_addressbook.getCardAttributes(abCard);
			var id         = attributes[TBCARD_ATTRIBUTE_LUID];

			if (abCard.isMailList)
				aMailListUri[abCard.mailListURI] = uri;

			// if a sync gets cancelled somewhere between assigning+writing luid attributes to cards and saving the map,
			// we might end up with a card with an luid attribute but without the luid being in the map
			// Here, we remove any such attributes...
			//
			if (ab_has_uuids || (id > AUTO_INCREMENT_STARTS_AT))
			{
				// pass 3 gives the card an luid and commits it to the database
				// But if we failed to converge (eg because of a conflict when trying to update google)
				// the on the next sync, the luid isn't in the map
				// With Thunderbird 3 it might be possible to give the card an luid (so that it can be looked up luid)
				// but not commit it to the db until after the remote update is successful.
				// As things stand though, this warning message appears and everything works ok.
				//
				if (!zfcTb.isPresent(id))
				{
					if (ab_has_uuids) {
						this.state.m_logger.debug("loadTbCards: card id=" + id + " not in map ... must be new");

						a_uuid_of_new_card[id] = true;
					}
					else {
						this.state.m_logger.debug("loadTbCards: attribute luid=" + id +
						                          " is being removed because it's not in the map.  Card: " +
				                                  this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard));

						this.state.m_addressbook.updateCard(abCard, uri, null, newObject(TBCARD_ATTRIBUTE_LUID, 0), FORMAT_TB);

						delete attributes[TBCARD_ATTRIBUTE_LUID]; // delete the id from attributes to force temporary luid assignment below
					}
				}
				else if (zfcTb.get(id).type() != FeedItem.TYPE_CN)
				{
					this.state.m_logger.error("card had attribute luid=" + id + " but this luid isn't a contact!  zfi: " +
					                          zfcTb.get(id).toString() + "Card: " +
											  this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) +
											  "uri: " + uri);

					this.state.stopFailCode    = 'failon.integrity.data.store.map';
					this.state.stopFailTrailer = stringBundleString("text.file.bug", [ url('reporting-bugs') ]) +
					                             stringBundleString("status.failon.integrity.data.store.detail") +
					                             stringBundleString("text.suggest.reset");
				}
			}

			// nsIAbMDBCard has disappeared from Components.interfaces in Tb3 and I can't figure out
			// how to get mdb rowid out of an abCard.
			// So the Tb2 method of constructing a id from tableid+rowid+key isn't used.
			// Instead, we give cards that don't have an TBCARD_ATTRIBUTE_LUID attribute, a TBCARD_ATTRIBUTE_LUID_ITER attribute
			// AddressBookTb3.prototype.nsIAbMDBCardToKey incorporates the first attribute in preference to the latter but either way
			// returns a unique key.
			// This will get a lot simpler when Tb3 cards get a unique id.
			// And even simpler when we don't need three passes to identify mailing list cards.
			//
			if (!ab_has_uuids && AppInfo.ab_version() != 'thunderbird2' && !abCard.isMailList
			                                             && !is_card_attribute_valid(attributes, TBCARD_ATTRIBUTE_LUID))
			{
				this.state.m_addressbook.updateCard(abCard, uri, null,
				                                    newObject(TBCARD_ATTRIBUTE_LUID_ITER, tb3_luid_iter), FORMAT_TB);

				// was debugging garcha here
				if (false)
					this.state.m_logger.debug("loadTbCards: pass 1: assigning: " +
				        " tb3_luid_iter: " + tb3_luid_iter + " to card: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard));

				tb3_luid_iter++;
			}

			// was debugging garcha here
			if (false)
				if (AppInfo.ab_version() != 'thunderbird2')
					this.state.m_logger.debug("loadTbCards: pass 1: key: " + this.state.m_addressbook.nsIAbMDBCardToKey(abCard) +
					                           " for card: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard));

			return this.state.stopFailCode == null;
		}
	};

	for (i = 0; i < tb_cc_meta.m_a.length; i++)
	{
		generator = this.state.m_addressbook.forEachCardGenerator(tb_cc_meta.m_a[i].uri, functor_foreach_card, chunk_size('cards', 3));

		while (generator.next())
			yield true;
	}

	if (!this.state.stopFailCode)
	{
		this.debug("loadTbCards pass 1: tb_cc_meta: " + aToString(tb_cc_meta) + " aMailListUri: " + aToString(aMailListUri));

		// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
		//
		var aCardKeysToExclude = new Object();
		msg = "loadTbCards: aCardKeysToExclude: pass 2: ";

		functor_foreach_card = {
			state: this.state,
			run: function(uri, item)
			{
				var abCard  = this.state.m_addressbook.qiCard(item);
				var key     = this.state.m_addressbook.nsIAbMDBCardToKey(abCard);

				aCardKeysToExclude[key] = aMailListUri[uri];

				msg += "\n excluding card: " + key + " " + aMailListUri[uri] + " " + uri + " " +
				         this.state.m_addressbook.nsIAbCardToPrintable(abCard);

				return true;
			}
		};

		for (uri in aMailListUri)
		{
			generator = this.state.m_addressbook.forEachCardGenerator(uri, functor_foreach_card, chunk_size('cards', 3));

			while (generator.next())
				yield true;
		}

		this.state.m_logger.debug(msg);

		if (ab_has_uuids)
			this.debug("loadTbCards pass 3: a_uuid_of_new_card: " + aToString(a_uuid_of_new_card));

		// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aCardKeysToExclude
		//
		functor_foreach_card = {
			state: this.state,
			run: function(uri, item) {
				var abCard  = this.state.m_addressbook.qiCard(item);
				var key     = this.state.m_addressbook.nsIAbMDBCardToKey(abCard);
				msg         = "loadTb pass 3: uri: " + uri + " card key: " + key;

				var isInTopLevelFolder = false;

				if (!abCard.isMailList && ( !(key in aCardKeysToExclude) ||
				                            ((key in aCardKeysToExclude) && aCardKeysToExclude[key] != uri)))
						isInTopLevelFolder = true;

				if (false)
				this.state.m_logger.debug("loadTbCards pass 3: blah: " + " uri: " + uri + " isInTopLevelFolder: " + isInTopLevelFolder +
				                          " key: " + key +
				                          " card: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard) +
				                          " properties: " + aToString(this.state.m_addressbook.getCardProperties(abCard)) +
				                          " attributes: " + aToString(this.state.m_addressbook.getCardAttributes(abCard)) +
				                          " lastModifiedDate: " + abCard.lastModifiedDate);

				if (isInTopLevelFolder)
				{
					let attributes = this.state.m_addressbook.getCardAttributes(abCard);
					let id         = (TBCARD_ATTRIBUTE_LUID in attributes) ? attributes[TBCARD_ATTRIBUTE_LUID] : 0;
					let properties = this.state.m_addressbook.getCardProperties(abCard);
					let is_changed = false;
					let zfi, is_new_card;

					if (ab_has_uuids)
						is_new_card = (id in a_uuid_of_new_card);
					else
						is_new_card = (! (id > AUTO_INCREMENT_STARTS_AT)); // id == null ==> not present or
					                                                       // id == zero ==> reset after the map was deleted

					this.state.m_tb_card_count++;

					// first, we do subtle transformations on cards.
					// 
					if (is_new_card)
					{
						// these problems only arise when cards are imported - they can't be created via the tb UI.
						// so if we've seen this card before, no need to test.
						// 

						// replace \r\n with \n - issue #121 and https://bugzilla.mozilla.org/show_bug.cgi?id=456678
						// 
						if (("Notes" in properties) && properties["Notes"].match(/\r\n/))
						{
							properties["Notes"] = properties["Notes"].replace(new RegExp("\r\n", "mg"), "\n");
							is_changed = true;

							this.state.m_logger.debug("loadTbCards pass 3: transform: found a card with \\r\\n in the notes field" +
							                          " - normalising it to \\n as per IRC discussion. Notes: " + properties["Notes"]);
						}

						// strip characters out of the notes field that aren't XML
						// issue #151 and https://bugzilla.mozilla.org/show_bug.cgi?id=466545
						//
						for (var key in properties)
							if (properties[key].length > 0) {
								let newstr = stripInvalidXMLCharsFromString(properties[key]);

								if (newstr != properties[key]) {
									properties[key] = newstr;
									is_changed = true;

									self.debug("loadTbCards pass 3: transform: found a card with invalid XML characters: key: "
									              + key + " new value: " + properties[key]);
								}
							}

						// normalise the birthday fields
						//
						ContactConverterStatic.tb_birthday_trim_leading_zeroes(properties, 'BirthYear');
						ContactConverterStatic.tb_birthday_trim_leading_zeroes(properties, 'BirthMonth');
						ContactConverterStatic.tb_birthday_trim_leading_zeroes(properties, 'BirthDay')
					}

					// if this addressbook is being synced with google...
					//
					if (self.formatPr() == FORMAT_GD)
					{ 
						// If SecondEmail is populated and PrimaryEmail isn't, move SecondEmail to PrimaryEmail
						//
						if (("SecondEmail" in properties) && (!("PrimaryEmail" in properties) ||
						      properties["PrimaryEmail"].length == 0 || zinIsWhitespace(properties["PrimaryEmail"])))
						{
							properties["PrimaryEmail"] = properties["SecondEmail"];
							properties["SecondEmail"] = "";
							is_changed = true;

							self.debug("loadTbCards pass 3: transform: found a card with a SecondEmail and no PrimaryEmail" +
							                          " - swapping: luid=" + id + " PrimaryEmail: " + properties["PrimaryEmail"]);
						}
					}

					if (is_changed)
						this.state.m_addressbook.updateCard(abCard, uri, properties, attributes, FORMAT_TB);

					let luid_l = tb_cc_meta.find('uri', uri, 'luid_tb');
					zinAssertAndLog(luid_l, uri);
					var checksum = self.contact_converter().crc32(properties, { l: luid_l }); // added l to checksum so that tb3 drag+drop is seen as a change

					if (is_new_card)
					{
						if (ab_has_uuids)
							id = attributes[TBCARD_ATTRIBUTE_LUID];
						else {
							id = zfcTb.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

							this.state.m_addressbook.updateCard(abCard, uri, null, newObject(TBCARD_ATTRIBUTE_LUID, id), FORMAT_TB);
						}

						zfi = new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, id, FeedItem.ATTR_CS, checksum, FeedItem.ATTR_L, luid_l);
						zfcTb.set(zfi);

						msg += " added:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfi.toString();
					}
					else
					{
						zinAssert(zfcTb.isPresent(id)); // See the validity checking in pass 1 above

						zfi = zfcTb.get(id);

						// if things have changed, update the map...
						//
						var keyParent = zfi.keyParent();

						if (keyParent != luid_l || zfi.get(FeedItem.ATTR_CS) != checksum)
						{
							var reason = " reason: ";
							if (keyParent != luid_l)
								reason += " parent folder changed: l:" + keyParent + " luid_l: " + luid_l;
							if (zfi.get(FeedItem.ATTR_CS) != checksum)
								reason += " checksum changed: ATTR_CS: " + zfi.get(FeedItem.ATTR_CS) + " checksum: " + checksum;

							zfi.set(FeedItem.ATTR_CS, checksum);
							zfi.set(FeedItem.ATTR_L, luid_l);

							msg += " changed: " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " +zfi.toString();
							msg += reason;
						}
						else
							msg += " found:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " +zfi.toString();
					}

					// if we're syncing with google, then while we've got the properties, work out whether the contact
					// has a postal address field populated - avoids lookup and retrieval a second time (during twiddle)
					//
					if (self.formatPr() == FORMAT_GD && self.is_slow_sync(this.state.sourceid_pr) && this.state.gd_is_sync_postal_address)
					{
						function is_tb_contact_have_an_address_field(properties) {
							var ret = false;
							for (var key in self.state.m_contact_converter_style_gd_postal.m_a_multiplexed['gd_address'][FORMAT_TB])
								if (key in properties) {
									ret = true;
									break;
								}

							return ret;
						}

						zfi.set(FeedItem.ATTR_TBPA, is_tb_contact_have_an_address_field(properties) ? '1' : '0');
					}

					// if we're migrating fields, work out whether this tb contact has any data in any of those fields
					// avoids lookup and retrieval a second time (during twiddle)
					//
					if (typeof(this.m_is_migrating_fields) == 'undefined')
						this.m_is_migrating_fields = !isObjectEmpty(self.contact_converter().properties_being_migrated());
						
					if (this.m_is_migrating_fields)
					{
						function tb_migration_fields_with_data(properties) {
							var ret = "blahnotused";
							for (var key in self.contact_converter().properties_being_migrated())
								if (key in properties && properties[key].length > 0)
									ret += "," + key;

							return ret;
						}

						zfi.set(FeedItem.ATTR_TBFM, tb_migration_fields_with_data(properties));
					}

					if (false && self.isInScopeTbLuid(id)) // future work: warn but don't fail when there are empty cards
					{
						function is_empty(properties) {
							var ret = true;
							for (var key in properties) {
								if (self.formatPr() == FORMAT_GD)
									ret = !(properties[key] && properties[key].length > 0 && !zinIsWhitespace(properties[key]));
								else
									ret = !(properties[key] && properties[key].length > 0);

								if (!ret)
									break;
							}

							return ret;
						}

						let properties_pr = self.contact_converter().convert(self.formatPr(), FORMAT_TB, properties);

						if (is_empty(properties_pr))
							zfi.set(FeedItem.ATTR_EMPT, '1');
						else if (zfi.isPresent(FeedItem.ATTR_EMPT))
							zfi.del(FeedItem.ATTR_EMPT);
					}
							
					zfi.set(FeedItem.ATTR_PRES, '1');

					if (this.state.foreach_tb_card_functor && self.isInScopeTbLuid(id))
						this.state.foreach_tb_card_functor.run(abCard, id, properties);
				}
				else
					msg += " - ignored";

				this.state.m_logger.debug(msg);

				return true;
			}
		};

		for (i = 0; i < tb_cc_meta.m_a.length; i++)
		{
			generator = this.state.m_addressbook.forEachCardGenerator(tb_cc_meta.m_a[i].uri, functor_foreach_card, chunk_size('cards'));

			while (generator.next())
				yield true;
		}

		// deletion detection works as follows.
		// 1. a FeedItem.ATTR_PRES attribute was added in pass 3 above
		// 2. iterate through the map
		//    - an item without a FeedItem.ATTR_PRES attribute is marked as deleted
		//    - remove the FeedItem.ATTR_PRES attribute so that it's not saved
		// 
		var functor_mark_deleted = {
			run: function(zfi) {
				if (zfi.isPresent(FeedItem.ATTR_DEL))
					; // do nothing
				else if (zfi.isPresent(FeedItem.ATTR_PRES))
					zfi.del(FeedItem.ATTR_PRES);
				else if (self.isInScopeTbLuid(zfi.key())) {
					zfi.set(FeedItem.ATTR_DEL, 1);
					self.debug("loadTbCards: - marking as deleted: " + zfi.toString());
				}

				return true;
			}
		};

		this.zfcTb().forEach(functor_mark_deleted, FeedCollection.ITER_NON_RESERVED);
	}

	yield false;
}

SyncFsmZm.prototype.testForEmptyContacts = function()
{
	var a_empty_contacts = this.state.foreach_tb_card_functor.m_a_empty_contacts;
	var a_empty_folder_names = new Object();
	var msg_empty = "";
	var key;

	// this.debug("testForEmptyContacts: a_empty_contacts: " + aToString(a_empty_contacts));

	for (key in a_empty_contacts)
	{
		var luid_parent = SyncFsm.keyParentRelevantToGid(this.zfcTb(), key);
		var name_parent_public = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, this.zfcTb().get(luid_parent));
		a_empty_folder_names[name_parent_public] = true;
	}

	if (!isObjectEmpty(a_empty_folder_names))
	{
		this.state.stopFailCode = 'failon.zm.empty.contact';
		this.state.stopFailArg  = [ AppInfo.app_name(AppInfo.firstcap), keysToString(a_empty_folder_names) ];
	}

	return this.state.stopFailCode == null;
}

SyncFsmZm.prototype.testForLegitimateFolderNames = function()
{
	var msg = "";

	var functor = {
		a_folder_count:     new Object(),
		a_folder_violation: new Object(),
		m_folder_converter: this.state.m_folder_converter,
		state: this.state,

		run: function(zfi)
		{
			var ret = true;

			if (zfi.type() == FeedItem.TYPE_FL && !zfi.isPresent(FeedItem.ATTR_DEL))
			{
				zinAssert(zfi.isPresent(FeedItem.ATTR_NAME));
				var name = this.m_folder_converter.convertForMap(FORMAT_ZM, FORMAT_TB, zfi);

				msg += " " + name;

				if (zinTrim(name).length == 0)
					this.a_folder_violation[name] = 'failon.folder.name.empty';

				if (!(name in this.a_folder_count))
					this.a_folder_count[name] = true;
				else
					this.a_folder_violation[name] = 'failon.folder.name.duplicate';

				if (SyncFsm.isZmFolderReservedName(name))
					this.a_folder_violation[name] = 'failon.folder.name.reserved';

				if (SyncFsm.isZmFolderContainsInvalidCharacter(name))
					this.a_folder_violation[name] = 'failon.folder.name.invalid';

				if (name in this.a_folder_violation)
					ret = false; // stop at the first violation

				// this.state.m_logger.debug("testForLegitimateFolderNames: zfi: " + zfi + " name: " + name + " " +
				//                                      (ret ? "" : this.a_folder_violation[name])); 
			}

			return ret;
		}
	};

	this.zfcTb().forEach(functor);

	if (!isObjectEmpty(functor.a_folder_violation))
	{
		var name = firstKeyInObject(functor.a_folder_violation);
		this.state.stopFailCode   = functor.a_folder_violation[name];
		this.state.stopFailArg    = [ name ];
	}

	var ret = this.state.stopFailCode == null;

	this.state.m_logger.debug("testForLegitimateFolderNames: names: " + msg + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.loadTbTestForEmptyCards = function(tb_cc_meta)
{
	var a_empty_contacts = this.state.foreach_tb_card_functor.m_a_empty_contacts;

	this.debug("loadTbTestForEmptyCards: gd_sync_with: " + this.account().gd_sync_with + " a_email_luid: " + aToString(a_empty_contacts));

	if (!isObjectEmpty(a_empty_contacts))
	{
		var grd                 = new GoogleRuleDetail(this.account().username);
		this.state.stopFailCode = 'failon.gd.conflict.4';
		this.state.stopFailArg  = [ grd ];

		grd.m_empty = new Object();
		
		for (var luid in a_empty_contacts)
			grd.m_empty[luid] = new GoogleRuleContactHandle(FORMAT_TB, luid, a_empty_contacts[luid],
			                                { uri: tb_cc_meta.find('luid_tb', this.zfcTb().get(luid).get(FeedItem.ATTR_L), 'uri') } );
	}

	return this.state.stopFailCode == null;
}

SyncFsm.addToGid = function(zfcGid, sourceid, luid, reverse)
{
	var gid = zfcGid.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

	zfcGid.set(new FeedItem(null, FeedItem.ATTR_KEY, gid, FeedItem.ATTR_PRES, 1, sourceid, luid));

	reverse[sourceid][luid] = gid;

	return gid;
}

SyncFsm.prototype.setTwin = function(sourceid, luid, sourceid_tb, luid_tb, reverse)
{
	var zfcGid = this.state.zfcGid;

	zinAssertAndLog(luid_tb in reverse[sourceid_tb], function() { return "sourceid_tb: " + sourceid_tb + " luid_tb: " + luid_tb; });

	var gid = reverse[sourceid_tb][luid_tb];
	zfcGid.get(gid).set(sourceid, luid);
	reverse[sourceid][luid] = gid;

	// set the VER attribute in the gid and the LS attributes in the luid maps
	// so that the compare algorithm can decide that there's no change.
	//
	this.resetLsoVer(gid, this.zfcTb().get(luid_tb));             // set VER in gid and LS attribute in the tb    luid map
	SyncFsm.setLsoToGid(zfcGid.get(gid), this.zfcPr().get(luid)); // set                LS attribute in the other luid map

	return gid;
}

SyncFsm.prototype.deTwin = function(gid)
{
	var zfcGid      = this.state.zfcGid;
	var sourceid_pr = this.state.sourceid_pr;
	var luid_pr     = zfcGid.get(gid).get(this.state.sourceid_pr);
	var gid_new;

	zfcGid.get(gid).del(sourceid_pr);
	delete this.state.aReverseGid[sourceid_pr][luid_pr];

	gid_new = SyncFsm.addToGid(zfcGid, sourceid_pr, luid_pr, this.state.aReverseGid);

	zfcGid.get(gid_new).del(FeedItem.ATTR_PRES);

	this.zfc(sourceid_pr).get(luid_pr).del(FeedItem.ATTR_LS);
}

// Some items on a Zimbra server are supposed to be immutable (eg the "Contacts" folder) but in fact the ms and md attributes can change
// when the user changes the folder's colour for example.
// In that case, we reset the gid's and the LS attributes in the sources to the new values so that buildGcs doesn't see any change.
// If a reset happened for Zimbra, then the new ver has to percolate through to the Google zfc, otherwise we'll think there's a
// change that must be propagated to google which we definitely don't want for pab or the system groups.
//
SyncFsm.prototype.twiddleMapsForImmutables = function()
{
	let sourceid_tb = this.state.sourceid_tb;
	let sourceid_pr = this.state.sourceid_pr;
	let zfcGid      = this.state.zfcGid;
	let zfcPr       = this.zfcPr();
	let reverse     = this.state.aReverseGid; // bring it into the local namespace
	let msg         = "twiddleMapsForImmutable:";
	let a_luid      = new Object();

	if (this.formatPr() == FORMAT_GD)
		for (var i = 0; i < this.state.gd_cc_meta.m_a.length; i++) {
			let luid = this.state.gd_cc_meta.m_a[i].luid_gd;
			if (this.zfcPr().get(luid).isPresent(FeedItem.ATTR_GGSG) || this.state.gd_cc_meta.m_a[i].name == GD_PAB)
				a_luid[luid] = true;
		}
	else if (this.formatPr() == FORMAT_ZM) {
		a_luid[ZM_ID_FOLDER_CONTACTS] = true;

		if (this.account().zm_emailed_contacts == "true")
			a_luid[ZM_ID_FOLDER_AUTO_CONTACTS] = true;
	}

	for (luid_pr in a_luid)
		if (zfcPr.isPresent(luid_pr) && zfcPr.get(luid_pr).isPresent(FeedItem.ATTR_LS)) {
			zinAssertAndLog(luid_pr in reverse[sourceid_pr], luid_pr);

			let zfi = zfcPr.get(luid_pr);
			let lso = new Lso(zfi.get(FeedItem.ATTR_LS));
			let gid = reverse[sourceid_pr][luid_pr];
			zinAssert(zfcGid.isPresent(gid) && zfcGid.get(gid).isPresent(sourceid_tb));
			let luid_tb = zfcGid.get(gid).get(sourceid_tb);

			if (this.formatPr() == FORMAT_ZM) {
				if (lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER)) {
					let res = lso.compare(zfi);

					if (res != 0) {                                               // this would result in a change of note in buildGcs...
						this.resetLsoVer(gid, zfi);                                      // set VER in gid and LS in the pr luid map
						SyncFsm.setLsoToGid(zfcGid.get(gid), this.zfcTb().get(luid_tb)); // set                LS in the tb luid map

						msg += " folder: " + zfi.name() + " changed!  sourceid: " + sourceid_pr + " and luid_pr=" + luid_pr;
					}
				}
			} else if (this.formatPr() == FORMAT_GD) {
				if (lso.get(FeedItem.ATTR_VER) < zfcGid.get(gid).get(FeedItem.ATTR_VER)) {
					SyncFsm.setLsoToGid(zfcGid.get(gid), zfcPr.get(luid_pr));            // set                LS in the pr luid map

					msg += " folder: " + zfi.name() + " changed!  sourceid: " + sourceid_pr + " and luid_pr=" + luid_pr;
				}
			}
			else
				zinAssert(false);
		}

	this.debug(msg);
}

SyncFsm.prototype.updateGidDoChecksumsGenerator = function()
{
	var self = this;
	var sourceid, zfc, generator;

	var functor_foreach_luid_do_checksum = {
		run: function(zfi) {
			let luid     = zfi.key();
			let checksum = null;
			let luid_parent;
			let msg = "";

			if (!SyncFsm.isOfInterest(zfc, luid))
				msg = " not of interest";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				msg = " not relevant to gid";
			else if (zfi.isPresent(FeedItem.ATTR_DEL))
				msg = " deleted - ignoring";
			else if (sourceid == SOURCEID_TB && !self.isInScopeTbLuid(luid))
				msg = " not in scope - ignoring";
			else if (zfi.type() == FeedItem.TYPE_CN)
			{
				var a_properties    = self.getContactPropertiesNormalised(sourceid, luid, self.state.m_contact_converter_style_basic);
				var a_parent_in_map = self.getContactParentInMap(sourceid, luid);

				if (a_properties) // a card with no properties will never be part of a twin so don't bother
				{
					checksum = self.contact_converter().crc32(a_properties);
					var key = hyphenate('-', sourceid, a_parent_in_map, checksum);

					if (!(key in self.state.aHasChecksum))
						self.state.aHasChecksum[key] = new Object();

					self.state.aHasChecksum[key][luid] = true;
					self.state.aChecksum[sourceid][luid] = checksum;

					msg += "checksum: " + strPadTo(checksum, 11) + " parent: " + a_parent_in_map +
					        " PrimaryEmail: " + (a_properties['PrimaryEmail'] ? a_properties['PrimaryEmail'] : "null");
				}
			}
			else if (zfi.type() == FeedItem.TYPE_FL || zfi.type() == FeedItem.TYPE_SF || zfi.type() == FeedItem.TYPE_GG)
				msg += "n/a: " + zfi.name();

			var x = String(luid);
			if (x.length < 40)
				x = strPadTo(luid, 40);
			else
				x = strPadTo(x.substr(0,17) + "..." + x.substr(x.length-17), 40);

			self.debug_continue(" luid: =" + x + msg);

			return true;
		}
	};

	for (sourceid in this.state.sources) {
		zfc       = this.zfc(sourceid);
		generator = zfc.forEachGenerator(functor_foreach_luid_do_checksum, chunk_size('feed'));

		while (generator.next())
			yield true;
	}

	if (false) {
		let msg = "updateGidDoChecksums: aHasChecksum: ";
		for (var key in this.state.aHasChecksum)
			msg += "aHasChecksum  key: " + key + ": " + this.state.aHasChecksum[key];
		for (sourceid in this.state.sources)
			for (var luid in this.state.aChecksum[sourceid])
				msg += "aChecksum sourceid: " + sourceid + " luid=" + luid + ": " + this.state.aChecksum[sourceid][luid];
		this.debug(msg);
	}

	yield false;
}

SyncFsm.prototype.updateGidFromSourcesGenerator = function()
{
	var zfcGid  = this.state.zfcGid;
	var reverse = this.state.aReverseGid; // bring it into the local namespace
	var self    = this;
	var sourceid, zfc, format, event, generator;

	var functor_foreach_luid_fast_sync = {
		run: function(zfi)
		{
			let luid = zfi.key();
			let msg  = "fast_sync: " + sourceid + "/=" + luid;

			if (luid in reverse[sourceid])
			{
				zfcGid.get(reverse[sourceid][luid]).set(FeedItem.ATTR_PRES, 1);
				msg += " already in gid";
			}
			else if (SyncFsm.isOfInterest(zfc, luid) && SyncFsm.isRelevantToGid(zfc, luid))
			{
				let gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);

				msg += " added to gid=" + gid;
			}
			else
				msg += " not of interest - ignoring";

			self.state.m_logger.debug_continue(msg);

			return true;
		}
	};

	var functor_foreach_luid_slow_sync = {
		mapTbFolderNameToId: SyncFsm.getTopLevelFolderHash(this.zfcTb(), FeedItem.ATTR_NAME, FeedItem.ATTR_KEY),
		a_name_parent : new Object(),
		m_perf : newObject('a_mark', new Object(), 'a_start', new Object()),

		run: function(zfi)
		{
			let luid        = zfi.key();
			let msg         = "slow_sync: " + sourceid + "/=" + luid;
			let sourceid_tb = self.state.sourceid_tb;
			let luid_tb     = null;
			let gid;

			zinAssertAndLog(!(luid in reverse[sourceid]), luid);
			zinAssert(sourceid != SOURCEID_TB);

			this.perf('a', 'mark');

			if (!SyncFsm.isOfInterest(zfc, luid))
				msg += " luid is not of interest - ignoring";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				msg += " luid is not relevant - ignoring";
			else
			{
				if (zfi.type() == FeedItem.TYPE_FL || zfi.type() == FeedItem.TYPE_SF || zfi.type() == FeedItem.TYPE_GG)
				{
					this.perf('b', 'mark');
					zinAssertAndLog((zfi.type() != FeedItem.TYPE_FL) || !zfi.isForeign(),
					                 function() { "foreign folder? zfi: " + zfi.toString(); } );

					var abName = self.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfi);

					if (abName in this.mapTbFolderNameToId)
						luid_tb = this.mapTbFolderNameToId[abName];

					if (luid_tb)
					{
						gid = self.setTwin(sourceid, luid, sourceid_tb, luid_tb, reverse)
						msg += " twin: folder with tb luid=" + luid_tb + " at gid=" + gid;
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid=" + gid;
					}
					this.perf('b', 'copy');
				}
				else
				{
					this.perf('c', 'mark');

					zinAssert(zfi.type() == FeedItem.TYPE_CN);
					zinAssert((sourceid in self.state.aChecksum) && (luid in self.state.aChecksum[sourceid]));

					this.perf('d', 'mark');
					var checksum    = self.state.aChecksum[sourceid][luid];
					var luid_parent = SyncFsm.keyParentRelevantToGid(zfc, luid);

					var key = hyphenate('-', sourceid_tb, this.name_parent(luid_parent), checksum);
					// self.state.m_logger.debug("functor_foreach_luid_slow_sync: blah: testing twin key: " + key);

					if ((key in self.state.aHasChecksum) && !isObjectEmpty(self.state.aHasChecksum[key]))
						for (var luid_possible in self.state.aHasChecksum[key])
							if (self.state.aHasChecksum[key][luid_possible] &&
						    	self.isTwin(sourceid_tb, sourceid, luid_possible, luid, self.state.m_contact_converter_style_basic))
							{
								luid_tb = luid_possible;
								break;
							}
					this.perf('d', 'copy');

					this.perf('e', 'mark');
					if (luid_tb)
					{
						gid = self.setTwin(sourceid, luid, sourceid_tb, luid_tb, reverse);
						msg += " twin: contact with tb luid=" + luid_tb + " at gid=" + gid + " tb contact: " + 
									self.shortLabelForLuid(sourceid_tb, luid_tb);

						delete self.state.aHasChecksum[key][luid_tb];
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid=" + gid;
					}
					this.perf('e', 'copy');
					this.perf('c', 'copy');
				}
			}

			this.perf('a', 'copy');

			self.debug_continue(msg);

			return true;
		},
		perf: function(key, action)
		{
			if (false)  // turn this off except for debugging
			{
			let elapsed = self.state.stopwatch.elapsed();

			if (action == 'copy')
			{
				if (!(key in this.m_perf.a_mark))
					this.m_perf.a_mark[key] = 0;

				this.m_perf.a_mark[key] += elapsed - this.m_perf.a_start[key];
			}
			else // action == 'mark'
				this.m_perf.a_start[key] = elapsed;
			}
		},
		name_parent: function(luid_parent)
		{
			if (!(luid_parent in this.a_name_parent))
				this.a_name_parent[luid_parent] = self.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfc.get(luid_parent));

			return this.a_name_parent[luid_parent];
		},
		reset : function()
		{
			this.a_name_parent = new Object();
		}
	};

	// iterate through SuggestedContacts last because if the Google account contains duplicates we want
	// the non-suggested version to twin.  Otherwise if the suggested version twins, it may get deleted while the non-suggested version adds
	// which isn't fatal, but runs the risk of side-effects eg if the Google duplicates aren't exact duplicates but almost-duplicates eg
	// one has a picture and one doesn't.
	//
	function SuggestedGenerator (functor, chunk_size) {
		var functorx  = {
			run: function(zfi) {
				var key          = zfi.key();
				var is_suggested = (zfi.styp() == FeedItem.eStyp.gdci) && 
				                   (zfi.get(FeedItem.ATTR_GDID) in self.state.a_gd_contact) &&
								   (self.state.a_gd_contact[zfi.get(FeedItem.ATTR_GDID)].groups.length == 0);
				var ret;
				if ((pass_number == 1 && !is_suggested) || (pass_number == 2 && is_suggested))
					ret = functor.run(zfi);
				else
					ret = true;
				return ret;
			}
		};
		var generator, pass_number;

		pass_number = 1; generator = zfc.forEachGenerator(functorx, chunk_size); while (generator.next()) yield true;
		pass_number = 2; generator = zfc.forEachGenerator(functorx, chunk_size); while (generator.next()) yield true;
		yield false;
	}

	for (sourceid in this.state.sources)
	{
		zfc         = this.zfc(sourceid);
		format      = this.state.sources[sourceid]['format'];
		event       = 'evRepeat';

		functor_foreach_luid_slow_sync.reset();

		if ((format == FORMAT_TB) || !this.is_slow_sync(sourceid))
			generator = zfc.forEachGenerator(functor_foreach_luid_fast_sync, chunk_size('feed'));
		else
		{
			// we chunk it up more finely when there's more contacts
			// FIXME: the isTwin code can be made more effcient by working out per-field checksums earlier
			// when the sources are loaded/parsed.  Something like { field-name-1, checksum, field-name-2, checksum ...}
			//
			let rate = (this.state.m_tb_card_count < 1000) ? 1 : 
			           (this.state.m_tb_card_count < 5000) ? .75 : .5;

			this.state.m_logger.debug("updateGidFromSourcesGenerator: generator rate: " + rate + " m_tb_card_count: "+this.state.m_tb_card_count);
			if (format == FORMAT_GD)
				generator = SuggestedGenerator(functor_foreach_luid_slow_sync, chunk_size('feed', rate));
			else
				generator = zfc.forEachGenerator(functor_foreach_luid_slow_sync, chunk_size('feed', rate));
		}

		while (generator.next())
			yield true;
	}

	// this.debug("updateGidFromSourcesGenerator: slow_sync perf: " + aToString(functor_foreach_luid_slow_sync.m_perf));

	yield false;
}

SyncFsm.prototype.updateGidFromSourcesSanityCheck = function()
{
	// sanity check that that all gid's have been visited
	//
	let functor_foreach_gid = {
		run: function(zfi) {
			if (zfi.isPresent(FeedItem.ATTR_PRES))
				zfi.del(FeedItem.ATTR_PRES);
			else
				zinAssertAndLog(false, function() { return "Found a gid not referenced by any sourceid/luids.  zfi: " + zfi.toString(); });
			return true;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid);

	this.debug("updateGidFromSourcesSanityCheck : zfcGid:\n"  + this.state.zfcGid.toString());
	this.debug("updateGidFromSourcesSanityCheck : reverse: " + aToString(this.state.aReverseGid));
}

// Migration of the new fields associated with Google API v3: birthday, web url etc
// This code runs only once - the MozillaPreferences.AS_MIGRATION preferences stops it from running again
//
// On slow sync, for each thunderbird/remote twin:
//
// if the tb contact has data in one of the to-be-migrated fields and remote doesn't then 
//     tick the remote version backwards to force Thunderbird to win
// else if the remote contact has data in one of the to-be-migrated fields and tb doesn't then 
//     tick the tb version backwards to force remote to win
// 
SyncFsm.prototype.twiddleMapsForFieldMigration = function()
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_pr = this.state.sourceid_pr;
	var zfcTb       = this.zfcTb();
	var self        = this;

	this.debug("twiddleMapsForFieldMigration:");

	zinAssert(this.is_slow_sync());

	var functor_foreach_gid = {
		run: function(zfi) {
			if (zfi.isPresent(sourceid_tb) && zfi.isPresent(sourceid_pr) && zfcTb.get(zfi.get(sourceid_tb)).type() == FeedItem.TYPE_CN) {
				// Thunderbird and remote contact are twins
				//
				let luid_pr    = zfi.get(sourceid_pr);
				let luid_tb    = zfi.get(sourceid_tb);
				let the_winner = this.the_winner(zfi);
				let msg        = null;

				if (the_winner == 'tb' || the_winner == 'both') {
					self.backdateZfcForcingItToLose(sourceid_pr, luid_pr);
					msg = " zfi: " + zfi.toString() + " the_winner: " + the_winner + " - backdating remote to force it to lose";
				}
				else if (the_winner == 'remote') {
					self.backdateZfcForcingItToLose(sourceid_tb, luid_tb);
					msg = " zfi: " + zfi.toString() + " the_winner: " + the_winner + " - backdating tb to force it to lose";
				}

				if (msg)
					self.debug_continue(msg);
			}

			return true;
		},
		the_winner : function(zfi) {
			let a_fields          = zfcTb.get(zfi.get(sourceid_tb)).get(FeedItem.ATTR_TBFM).split(',');
			let remote_properties = self.getContactAsTbProperties(sourceid_pr, zfi.get(sourceid_pr));
			let ret               = 'none';
			let i;

			// tb wins if it has a migration field populated and the remote contact doesn't
			for (i = 1; i < a_fields.length && ret == 'none'; i++)
				if (!(a_fields[i] in remote_properties))
					ret = 'tb';
			
			// remote wins if it has a migration field populated and the tb contact doesn't
			// *unless* tb had already won in which case there are updates that need to be propagated 'both' ways
			// 'both' is possible but unlikely - folk tend to use one location (tb/google/zimbra) as authoritative.
			// we're talking here about two contacts that have been twinned during slow sync...
			//
			for (i in self.contact_converter().properties_being_migrated())
				if (i in remote_properties && remote_properties[i].length > 0 && a_fields.indexOf(i) == -1) {
					if (ret == 'none')
						ret = 'remote';
					else if (ret == 'tb')
						ret = 'both';
					break;
				}

			return ret;
		}
	};

	if (!isObjectEmpty(this.contact_converter().properties_being_migrated())) {
		let generator = this.state.zfcGid.forEachGenerator(functor_foreach_gid, chunk_size('feed'));

		while (generator.next())
			yield true;
	}
	else
		this.debug("no fields being migrated");

	yield false;
}

// On slow sync...
// For each thunderbird/google twin:
// if the google address doesn't have zindus xml then 
//   if thunderbird address field is not empty
//     tick the google version backwards to force Thunderbird to win
// else (the google address has zindus xml): 
//   if the google contact exactly matches the thunderbird contact (meaning the postal address fields match too)
//     do nothing
//   else if thunderbird address field is empty
//     tick the thunderbird contact backwards to force Google to win
//   else
//     tick the google contact backwards to let tb win
//

SyncFsm.prototype.twiddleMapsForGdPostalAddressGenerator = function()
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_gd = this.state.sourceid_pr;
	var zfcTb       = this.zfcTb();
	var zfcPr       = this.zfcPr();
	var self        = this;

	this.debug("twiddleMapsForGdPostalAddress:");

	zinAssert(this.is_slow_sync());

	var functor_foreach_gid = {
		run: function(zfi) {
			if (zfi.isPresent(sourceid_tb) && zfi.isPresent(sourceid_gd) && zfcTb.get(zfi.get(sourceid_tb)).type() == FeedItem.TYPE_CN) {
				// Thunderbird and Google contact are twins
				//
				let luid_gd_ci = zfi.get(sourceid_gd);
				let luid_gd_au = zfcPr.get(luid_gd_ci).get(FeedItem.ATTR_GDID);
				let luid_tb    = zfi.get(sourceid_tb);
				let contact    = self.state.a_gd_contact[luid_gd_au];
				let msg        = " zfi: " + zfi.toString();

				zinAssertAndLog(luid_gd_au in self.state.a_gd_contact, function() { return "luid_gd_au=" + luid_gd_au; } );
				zinAssert(contact.mode() & ContactGoogle.ePostal.kEnabled);

				if (!contact.isAnyPostalAddressInXml()) {
					msg += " gd doesn't have xml";

					if (this.is_tb_contact_have_an_address_field(luid_tb)) {
						self.backdateZfcForcingItToLose(sourceid_gd, luid_gd_ci);

						msg += " and tb has an address so backdating gd to force it to lose";
					}
					else
						msg += " and tb has no address";
				}
				else {
					msg += " gd has xml";

					if (self.isTwin(sourceid_tb, sourceid_gd, luid_tb, luid_gd_au, self.state.m_contact_converter_style_gd_postal))
						msg += " is twin";
					else if (!this.is_tb_contact_have_an_address_field(luid_tb)) {
						self.backdateZfcForcingItToLose(sourceid_tb, luid_tb);
						msg += " and tb doesn't have an address so backdating tb to force it to lose";
					}
					else {
						msg += " different from tb and no email address so backdating gd to force it to lose";

						// self.debug("blah: gd contact: " + contact.toString() + " tb properties: " + 
						//                      aToString(self.getContactFromLuid(sourceid_tb, luid_tb, FORMAT_TB)));

						self.backdateZfcForcingItToLose(sourceid_gd, luid_gd_ci);
					}
				}

				self.debug_continue(msg);
			}

			return true;
		},
		is_tb_contact_have_an_address_field: function(luid_tb) {
			return self.zfcTb().get(luid_tb).get(FeedItem.ATTR_TBPA) == '1';
		}
	};

	let generator = this.state.zfcGid.forEachGenerator(functor_foreach_gid, chunk_size('feed'));

	while (generator.next())
		yield true;

	this.debug("twiddleMapsForGdPostalAddress: zfcGid: " + this.state.zfcGid.toString());

	yield false;
}

// On slow sync...
// For each thunderbird/google twin:
//   if the google contact exactly matches the thunderbird contact
//   and the google contact is a suggested contact then
//     tick the thunderbird contact backwards to force Google to win
// Also, mark as deleted the google suggested contacts so that:
// a) the ones that twinned will cause their thunderbird counterparts to get deleted and
// b) the ones that didn't twin will get removed from the gid and zfc and not generate ADD operations.
//

SyncFsm.prototype.twiddleMapsToRemoveFromTbGdSuggestedContacts = function()
{
	let sourceid_tb = this.state.sourceid_tb;
	let sourceid_gd = this.state.sourceid_pr;
	let zfcPr       = this.zfcPr();
	let self        = this;
	let id_gd_pab   = this.state.gd_cc_meta.find('name', GD_PAB, 'luid_gd')

	this.debug("twiddleMapsToRemoveFromTbGdSuggestedContacts:");

	zinAssert(this.is_slow_sync() && this.account().gd_suggested == 'ignore')

	var functor_foreach_gid = {
		run: function(zfi)
		{
			let luid_gd = zfi.isPresent(sourceid_gd) ? zfi.get(sourceid_gd) : false;

			if (luid_gd &&
			    zfcPr.get(luid_gd).type() == FeedItem.TYPE_CN &&
				zfcPr.get(luid_gd).styp() == FeedItem.eStyp.gdci &&
				zfcPr.get(luid_gd).get(FeedItem.ATTR_L) == id_gd_pab)
			{
				let luid_gd_au = zfcPr.get(zfi.get(sourceid_gd)).get(FeedItem.ATTR_GDID);
				let contact    = self.state.a_gd_contact[luid_gd_au];
				let msg        = " zfi: " + zfi.toString();
				let is_twin    = false;

				if (zfi.isPresent(sourceid_tb))
				{
					// Thunderbird and Google contact are twins
					//
					let luid_tb = zfi.get(sourceid_tb);

					if ((contact.groups.length == 0) && self.isTwin(sourceid_tb, sourceid_gd, luid_tb, luid_gd_au, self.contact_converter()))
					{
						self.backdateZfcForcingItToLose(sourceid_tb, luid_tb);
						msg += " tb contact matches a suggested contact so backdating tb to force it to lose and be deleted";
						is_twin = true;
					}

					self.debug_continue(msg);
				}

				if (contact.groups.length == 0) {
					zfcPr.get(luid_gd).set(FeedItem.ATTR_DEL, '1');

					if (self.account().gd_gr_as_ab != 'true')
						zfcPr.get(zfcPr.get(luid_gd).get(FeedItem.ATTR_GDID)).set(FeedItem.ATTR_DEL, '1');
				}
			}

			return true;
		}
	};

	var generator = this.state.zfcGid.forEachGenerator(functor_foreach_gid, chunk_size('feed'));

	while (generator.next())
		yield true;

	yield false;
}

SyncFsm.prototype.backdateZfcForcingItToLose = function(sourceid, luid)
{
	var zfc    = this.zfc(sourceid);
	var zfi    = zfc.get(luid);
	var format = this.state.sources[sourceid]['format'];

	switch (format)
	{
		case FORMAT_TB:
			zfi.set(FeedItem.ATTR_CS, TBCARD_CHECKSUM_BACKWARDS);
			break;
		case FORMAT_GD:
		case FORMAT_ZM:
			var rev = zfi.get(FeedItem.ATTR_REV);
			zfi.set(FeedItem.ATTR_REV, "1" + rev.substr(1)); // set first digit of year to '1'
			break;
		default:
			zinAssertAndLog(false, "format: " + format);
	}
}

// 1. iterate through the gid looking for "relevant" contacts that exist on one side but not the other
//    meaning that they are going to be added to the other side
// 2. calculate checksums for them
// 3. where the checksums match, twin them, so that they won't generate "add" operations
//
// This routine written to support issue #89
// It supplies "forward error recovery" in the event that the previous sync added a bunch of contacts before failing to complete.
//
SyncFsm.prototype.twiddleMapsToPairNewMatchingContacts = function()
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_pr = this.state.sourceid_pr;
	var reverse     = this.state.aReverseGid;
	var zfcGid      = this.state.zfcGid;
	var msg         = "twiddleMapsToPairNewMatchingContacts:";
	var self        = this;
	var a_checksum  = {};

	zinAssert(!this.is_slow_sync());

	var functor_foreach_gid = {
		run: function(zfi) {
			var a_luid = newObject(sourceid_tb, false, sourceid_pr, false);
			var count  = 0;
			var luid, sourceid, zfc;

			for (sourceid in a_luid) {
				if (zfi.isPresent(sourceid)) {
					zfc  = self.zfc(sourceid);
					luid = zfi.get(sourceid);

					if (zfc.get(luid).type() == FeedItem.TYPE_CN) {
						if (zfc.get(luid).isPresent(FeedItem.ATTR_DEL)) {
							count = 0;
							break;
						}
						else {
							count++;
							a_luid[sourceid] = luid;
						}
					}
				}
			}

			// self.debug("gid: " + zfi.toString() + " count: " + count + " a_luid: " + aToString(a_luid));

			if (count == 1) {
				sourceid       = a_luid[sourceid_tb] ? sourceid_tb : sourceid_pr;
				luid           = a_luid[sourceid];
				let properties = null;
				let do_lookup  = true;

				if (sourceid == sourceid_tb)
					do_lookup = do_lookup && self.isInScopeTbLuid(luid);

				do_lookup = do_lookup && SyncFsm.isOfInterest(self.zfc(sourceid), luid);
				do_lookup = do_lookup && SyncFsm.isRelevantToGid(self.zfc(sourceid), luid);

				// when a group gets deleted at google, contacts that were in that group might become suggested
				// but they won't appear in the contacts feed (because they haven't changed).
				// so we won't have any properties for them - don't try to look them up.
				//
				if (do_lookup && !self.is_suggested_candidate(sourceid, luid))
					properties = self.getContactPropertiesNormalised(sourceid, luid, self.state.m_contact_converter_style_basic);

				// self.debug("properties: " + (properties ? aToString(properties) : "null"));

				if (properties) // a contact with no properties will never be part of a twin so don't bother
					this.add_to_a_checksum(sourceid, luid, properties);
			}

			return true;
		},
		add_to_a_checksum: function(sourceid, luid, properties) {
			let checksum = self.contact_converter().crc32(properties);

			if (!(checksum in a_checksum))
				a_checksum[checksum] = new Array();

			let l     = SyncFsm.keyParentRelevantToGid(self.zfc(sourceid), luid);
			let l_gid = reverse[sourceid][l];

			a_checksum[checksum].push(newObject('sourceid', sourceid, 'luid', luid, 'l_gid', l_gid, 'is_processed', false));
		}
	};

	zfcGid.forEach(functor_foreach_gid);

	// this.debug("a_checksum: " + aToString(a_checksum));

	let contact_converter = this.state.m_contact_converter_style_basic;
	let checksum, i;

	for (checksum in a_checksum) {
		while (a_checksum[checksum].length > 1) {
			let a_new = new Array();
			let first = a_checksum[checksum][0];

			first.is_processed = true;

			for (i = 1; i < a_checksum[checksum].length; i++) {
				let current = a_checksum[checksum][i];

				if (!current.is_processed && (first.l_gid == current.l_gid) && (first.sourceid != current.sourceid) &&
				    this.isTwin(first.sourceid, current.sourceid, first.luid, current.luid, contact_converter)) {
					let luid_tb, luid_pr;

					current.is_processed = true;

					if (first.sourceid == sourceid_tb) {
						luid_tb = first.luid;
						luid_pr = current.luid;
					}
					else {
						luid_tb = current.luid;
						luid_pr = first.luid;
					}

					let old_gid = reverse[sourceid_pr][luid_pr]; // setTwin uses the gid belonging to sourceid_tb

					delete reverse[sourceid_pr][luid_pr];

					zfcGid.del(old_gid);

					let gid = this.setTwin(sourceid_pr, luid_pr, sourceid_tb, luid_tb, reverse);

					msg += "\n ADD by twinning: tb: " + sourceid_tb + "/=" + luid_tb + " and gd: " + sourceid_pr + "/=" + luid_pr + " gid=" + gid;
				}

				if (!current.is_processed)
					a_new.push(current);
				else {
					let j;
					for (j = i+1; j < a_checksum[checksum].length; j++)
						a_new.push(a_checksum[checksum][j]);
					break;
				}
			}

			a_checksum[checksum] = a_new;
		}
	}

	this.debug(msg);
}

SyncFsm.prototype.is_suggested_candidate = function(sourceid, luid)
{
	let zfc = this.zfc(sourceid);
	let zfi = zfc.get(luid);
	let ret = false;
	
	if (zfi.styp() == FeedItem.eStyp.gdci) {
		let luid_au = zfi.get(FeedItem.ATTR_GDID);
		let zfi_au  = zfc.get(luid_au);
		let a_group = this.gd_groups_in_zfi(zfi_au, false);

		ret = (a_group.length == 0);
	}

	return ret;
}

SyncFsm.prototype.getContactParentInMap = function(sourceid, luid)
{
	var zfc         = this.zfc(sourceid);
	var zfi         = zfc.get(luid); zinAssert(zfi);
	var luid_parent = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
	var format      = this.state.sources[sourceid]['format'];
	var ret;

	zinAssert(zfi.type() == FeedItem.TYPE_CN);

	ret = this.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfc.get(luid_parent));

	return ret;
}

SyncFsm.prototype.getContactAsTbProperties = function(sourceid, luid, contact_converter)
{
	var zfc    = this.zfc(sourceid);
	var zfi    = zfc.get(luid);
	let format = this.state.sources[sourceid]['format'];
	let ret;

	zinAssert(zfi);
	zinAssert(zfi.type() == FeedItem.TYPE_CN);

	if (!contact_converter)
		contact_converter = this.contact_converter();

	if (format == FORMAT_TB) {
		zinAssert(zfi.isPresent(FeedItem.ATTR_L));

		let luid_parent        = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
		let name_parent_public = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid_parent));
		let uri                = this.state.m_addressbook.getAddressBookUriByName(name_parent_public);
		let abCard             = uri ? this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid) : null;

		if (abCard)
			ret = this.state.m_addressbook.getCardProperties(abCard);
		else {
			ret = { };

			this.state.m_logger.warn("getContactPropertiesNormalised: unable to retrieve properties for card: luid: " + luid +
			                         " uri: " + uri + " luid_parent: " + luid_parent +
			                         " name_parent_public: " + name_parent_public +
			                         " name_parent_public: " + name_parent_public +
									 " addressbooks: " + this.state.m_addressbook.getNameToUriMapAsString() +
									 "\n" + executionStackAsString());
		}
	}
	else if (format == FORMAT_ZM) {
		zinAssertAndLog(luid in this.state.aSyncContact, luid);
		ret = contact_converter.convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncContact[luid].element);
	}
	else if (format == FORMAT_GD) {
		if (zfi.styp() == FeedItem.eStyp.gdci)
			luid = zfi.get(FeedItem.ATTR_GDID);
		zinAssertAndLog(luid in this.state.a_gd_contact, luid);
		ret = contact_converter.convert(FORMAT_TB, FORMAT_GD, this.state.a_gd_contact[luid].properties);
	}

	return ret;
}

// This method is mostly used in matching contacts.
// it filters out properties not common to all formats and normalises PrimaryEmail and SecondEmail to lowercase
// (via ContactGoogle.transformProperties)
// So don't use it when updating a target source!
// 
SyncFsm.prototype.getContactPropertiesNormalised = function(sourceid, luid, contact_converter)
{
	if (!contact_converter)
		contact_converter = this.contact_converter();

	zinAssert(arguments.length == 2 || arguments.length == 3);

	let properties = this.getContactAsTbProperties(sourceid, luid, contact_converter);

	// This is why slow sync doesn't notice differences in _AimScreenName for example ... even though it is synced b/n tb and google
	//
	contact_converter.removeKeysNotCommonToAllFormats(FORMAT_TB, properties);

	// This is why Hello.World@example.com in Thunderbird matches hello.world@example.com in google (and vice versa)
	//
	if (this.formatPr() == FORMAT_GD)
		ContactGoogle.transformTbProperties(ContactGoogle.eTransform.kAll, properties);

	// this.state.m_logger.debug("getContactPropertiesNormalised: sourceid: " + sourceid + " luid=" + luid +
	//                           " returns: " properties: " + aToString(properties));

	return properties;
}

// return true iff all the fields (that are common to both data formats) exactly match
//
SyncFsm.prototype.isTwin = function(sourceid_a, sourceid_b, luid_a, luid_b, contact_converter)
{
	var a        = this.getContactPropertiesNormalised(sourceid_a, luid_a, contact_converter);
	var b        = this.getContactPropertiesNormalised(sourceid_b, luid_b, contact_converter);
	var length_a = aToLength(a);
	var length_b = aToLength(b);
	var is_twin  = (length_a == length_b);
	var cMatch   = 0;

	if (is_twin)
	{
		for (var i in a)
			if ((i in b) && a[i] == b[i])
				cMatch++;
	}

	is_twin = length_a == cMatch;

	if (false)
	this.debug("isTwin: returns: " + is_twin +
		" sourceid/luid: " + sourceid_a + "/=" + luid_a +
		" sourceid/luid: " + sourceid_b + "/=" + luid_b +
		"\n properties a: " + aToString(a) +
		"\n properties b: " + aToString(b));

	return is_twin;
}

SyncFsm.prototype.buildGcsGenerator = function()
{
	var aGcs          = new Object();  // an associative array where the key is a gid and the value is a Gcs object
	var aZfcCandidate = new Object();  // a copy of the luid maps updated as per this sync
	var sourceid_tb   = this.state.sourceid_tb;
	var zfcGid        = this.state.zfcGid;
	var reverse       = this.state.aReverseGid; // bring it into the local namespace
	var self          = this;
	var sourceid, generator, buildgcs_msg;

	for (var i in this.state.sources)
		aZfcCandidate[i] = this.zfc(i).clone(); // cloned because items get deleted out of this during merge

	// delete candidate mapitems in other sources once they've been compared
	//
	var functor_delete_other_candidate_mapitems = {
		run: function(key, value) {
			if ((key in self.state.sources) && key != FeedItem.ATTR_VER && key != sourceid)
				aZfcCandidate[key].del(value);
			return true;
		}
	};

	var functor_foreach_candidate = {
		run: function(zfi) {
			var zfc  = self.zfc(sourceid);
			var luid = zfi.key();
			var gid, skip_msg;

			buildgcs_msg = "";
			skip_msg     = null;

			if (sourceid == self.state.sourceid_tb && !self.isInScopeTbLuid(luid))
				skip_msg = "not in scope";
			else if (!SyncFsm.isOfInterest(zfc, luid))
				skip_msg = "not of interest";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				skip_msg = "not relevant";
			else
			{
				zinAssert((sourceid in reverse) && (luid in reverse[sourceid]));

				gid = reverse[sourceid][luid];

				buildgcs_msg += " gid=" + gid;
				
				if (zfcGid.get(gid).isPresent(FeedItem.ATTR_VER))
					buildgcs_msg += " ver: " + zfcGid.get(gid).get(FeedItem.ATTR_VER);

				aGcs[gid] = this.compare(gid);// aZfcCandidate, reverse, zfcGid

				zfcGid.get(gid).forEach(functor_delete_other_candidate_mapitems, FeedItem.ITER_GID_ITEM);
			}

			if (skip_msg)
				self.debug("buildGcs: candidate sourceid: " + sourceid + " - " + skip_msg + " - skipped: zfi: "+ zfi.toString());
			else
				self.debug("buildGcs:\n  candidate sourceid: " + sourceid + buildgcs_msg);

			return true;
		},

		compare: function(gid)
		{
			var aNeverSynced   = new Object();
			var aChangeOfNote  = new Object();
			var aVerMatchesGid = new Object();
			var ret = null;
			var msg = "";

			var functor_each_luid_in_gid = {
				run: function(sourceid, luid) {
					if (!(sourceid in self.state.sources) || sourceid == FeedItem.ATTR_VER)
						return true;

					var zfi = aZfcCandidate[sourceid].get(luid);
					var msg = "  compare:  sourceid: " + sourceid + " zfi: " + zfi.toString(FeedItem.TOSTRING_RET_FIRST_ONLY);

					if (!zfi.isPresent(FeedItem.ATTR_LS))
					{
						aNeverSynced[sourceid] = true;
						msg += " added to aNeverSynced";
					}
					else
					{
						var lso = new Lso(zfi.get(FeedItem.ATTR_LS));

						if (sourceid == self.state.sourceid_tb && !self.isInScopeTbLuid(luid)) {
							msg += " AMHERE1: sourceid: " + sourceid + " luid: " + luid + " is out of scope.";
						}

						if (lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER))
						{
							var res = lso.compare(zfi);

							if (res == 0 && sourceid == self.state.sourceid_tb && !self.isInScopeTbLuid(luid)) {
								aChangeOfNote[sourceid] = true;
								msg += " sourceid: " + sourceid + " luid: " + luid + " is out of scope.";
								msg += " added to aChangeOfNote";
							}
							else if (res == 0)
							{
								aVerMatchesGid[sourceid] = true;
								msg += " added to aVerMatchesGid";
							}
							else if (res == 1)
							{
								aChangeOfNote[sourceid] = true;
								msg += " added to aChangeOfNote";

								// sanity check that the Contact folder hasn't changed - it's supposed to be immutable
								//
								if (self.zfc(sourceid).get(luid).type() == FeedItem.TYPE_FL)
								{
									let folder = self.state.m_folder_converter.convertForPublic(FORMAT_TB,
									                      self.state.sources[sourceid]['format'],
														  self.zfc(sourceid).get(luid));
									zinAssertAndLog(folder != TB_PAB, folder);
								}
							}
							else
								msg += " not added to any assoc array";
						}
						else
							msg += " gid ver != lso ver: " + lso.get(FeedItem.ATTR_VER);

						msg += " lso: " + lso.toString() + " lso.compare == " + lso.compare(zfi);
					}

					buildgcs_msg += "\n" + msg;

					return true;
				}
			};

			zfcGid.get(gid).forEach(functor_each_luid_in_gid, FeedItem.ITER_GID_ITEM);

			var cNeverSynced   = aToLength(aNeverSynced);
			var cVerMatchesGid = aToLength(aVerMatchesGid);
			var cChangeOfNote  = aToLength(aChangeOfNote);

			msg += " aNeverSynced: "   + keysToString(aNeverSynced) +
			       " aVerMatchesGid: " + keysToString(aVerMatchesGid) +
			       " aChangeOfNote: "  + keysToString(aChangeOfNote);

			zinAssertAndLog(cNeverSynced == 0 || cNeverSynced == 1,
			    function() { return "gid=" + gid + " cNeverSynced: " + cNeverSynced + " " + buildgcs_msg + "\n" + msg; } );

			if (cNeverSynced == 1)
			{
				zinAssertAndLog(cVerMatchesGid == 0 && cChangeOfNote == 0,
				      function() { return "gid=" + gid + " " + buildgcs_msg + "\n" + msg; } );

				ret = new Gcs(firstKeyInObject(aNeverSynced), eGcs.win);
			}
			else if (cChangeOfNote == 0)
			{
				if (cVerMatchesGid == 1)
					ret = new Gcs(firstKeyInObject(aVerMatchesGid), eGcs.win);
				else
				{
					// if this assertion fails, you want to look elsewhere for the cause eg issue #85
					//
					zinAssertAndLog((sourceid_tb in aVerMatchesGid), function() { return buildgcs_msg + "\n" + msg; } );
					ret = new Gcs(sourceid_tb, eGcs.win);
				}
			}
			else if (cChangeOfNote == 1)
				ret = new Gcs(firstKeyInObject(aChangeOfNote), eGcs.win);
			else
			{
				var lowest_sourceid = null;

				for (var i in aChangeOfNote)
					if (lowest_sourceid == null || aChangeOfNote[i] < lowest_sourceid)
						lowest_sourceid = i;

				ret = new Gcs(lowest_sourceid, eGcs.conflict);
			}

			buildgcs_msg += "\n  compare: gid=" + gid + " returns: " + ret.toString() + msg;

			return ret;
		}
	};

	for (sourceid in this.state.sources)
	{
		generator = aZfcCandidate[sourceid].forEachGenerator(functor_foreach_candidate, chunk_size('feed'));

		while (generator.next())
			yield true;
	}

	yield true;

	var a_winner_tb_state_win = new Array();
	var big_msg = new BigString();

	for (let gid in aGcs)
	{
		if (aGcs[gid].sourceid == SOURCEID_TB && aGcs[gid].state == eGcs.win)
			a_winner_tb_state_win.push(gid);
		else
			big_msg.concat("\n gid=" + gid + ": " + aGcs[gid].toString());
	}

	this.state.m_logger.debug("buildGcs: aGcs:" + big_msg.toString() +
	      (a_winner_tb_state_win.length > 0 ?
		  	("\n " + aGcs[a_winner_tb_state_win[0]].toString() + ": " + a_winner_tb_state_win.toString()) : ""));

	this.state.aGcs = aGcs;

	yield false;
}

SyncFsm.prototype.isInScopeGid = function(gid)
{
	var zfcGid = this.state.zfcGid;
	var format = this.formatPr();
	var ret = true;

	switch(format)
	{
		case FORMAT_TB:
		case FORMAT_ZM:
			break;
		case FORMAT_GD:
			if (zfcGid.get(gid).isPresent(this.state.sourceid_pr)) // added re: #236
				ret = true;
			else if (zfcGid.get(gid).isPresent(this.state.sourceid_tb))
				ret = this.isInScopeTbLuid(zfcGid.get(gid).get(this.state.sourceid_tb));
			
			break;
		default:
			zinAssertAndLog(false, "unmatched case: " + format);
	}

	return ret;
}

SyncFsm.prototype.isInScopeTbLuid = function(luid_tb)
{
	var ret = true;

	zinAssertAndLog(this.zfcTb().isPresent(luid_tb), luid_tb);

	if (this.formatPr() == FORMAT_GD)
	{
		zinAssert(this.state.a_gd_luid_ab_in_tb);

		var zfi = this.zfcTb().get(luid_tb);
	
		if (zfi.type() == FeedItem.TYPE_CN)
			ret = (zfi.get(FeedItem.ATTR_L) in this.state.a_gd_luid_ab_in_tb);
		else if (zfi.type() == FeedItem.TYPE_FL)
			ret = (luid_tb in this.state.a_gd_luid_ab_in_tb);
	}

	return ret;
}

// This method builds the list of (MDU) operations required to update the meta-data for winners.
// - if a winning item is new to the gid, generate an MDU operation (which will create the version)
// - if a winning item was already in the gid and changed, generate an MDU operation (which will bump it's version)
// - if a winning item was already in the gid but didn't change, do nothing
//
SyncFsm.prototype.suoBuildWinners = function(aGcs)
{
	var zfcGid      = this.state.zfcGid;
	var aSuoResult  = new Array();
	var big_msg     = "suoBuildWinners: ";
	var a_no_change = new Object();
	var msg, suo, gid;

	for (gid in aGcs)
		if (this.isInScopeGid(gid)) {
			suo = null;
			msg = null;

			switch (aGcs[gid].state) {
				case eGcs.win:
				case eGcs.conflict:
					var sourceid_winner = aGcs[gid].sourceid;
					var zfcWinner = this.zfc(sourceid_winner);
					var zfiWinner = zfcWinner.get(zfcGid.get(gid).get(sourceid_winner));

					if (!zfiWinner.isPresent(FeedItem.ATTR_LS)) {
						// winner is new to gid
						//
						zinAssert(!zfcGid.get(gid).isPresent(FeedItem.ATTR_VER));

						zinAssert(zfcGid.get(gid).length() == 2); // just the id property and the winning sourceid

						msg = "is new to gid  - MDU";

						suo = new Suo(gid, aGcs[gid].sourceid, sourceid_winner, Suo.MDU);
					}
					else {
						var lso = new Lso(zfiWinner.get(FeedItem.ATTR_LS));
						var res = lso.compare(zfiWinner);

						zinAssert(lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER));
						zinAssert(res >= 0); // winner either changed in an interesting way or stayed the same

						if (res == 1) {
							msg = "changed in an interesting way - MDU";
							suo = new Suo(gid, aGcs[gid].sourceid, sourceid_winner, Suo.MDU);
						}
						else {
							if (!(aGcs[gid].sourceid in a_no_change))
								a_no_change[aGcs[gid].sourceid] = new Array();

							a_no_change[aGcs[gid].sourceid].push(gid);

							msg = "didn't change";
						}
					}
					break;

				default:
					zinAssert(false);
			}

			if (suo != null) {
				big_msg += "\n gid=" + gid + " winner: " + aGcs[gid].sourceid + " " + msg;
				aSuoResult.push(suo);
			}
		}

	for (var sourceid in a_no_change)
		big_msg += "\n winner=" + aGcs[gid].sourceid + " didn't change: " + a_no_change[sourceid].toString();

	this.state.m_logger.debug(big_msg);

	return aSuoResult;
}

// The suo's returned by this method are organised into buckets to suit later processing (by source, by operation, by content type):
// - aSuo[sourceid][Suo.ADD | FeedItem.TYPE_FL][id] = suo
// - for Suo.MOD and Suo.DEL, id is the target luid (so that the zimbra response can easily find the the corresponding suo,
// - for Suo.ADD, id is just an autoincremented number.
//

SyncFsm.prototype.suoBuildLosers = function(aGcs)
{
	var zfcGid     = this.state.zfcGid;
	var aSuoResult = new Object();
	var indexSuo   = 0;
	var big_msg    = new BigString();
	var a_winner_matches_gid = new Object();
	var suo, a_sourceid;;

	for (sourceid in this.state.sources)
		aSuoResult[sourceid] = new Object();

	for (var gid in aGcs)
		for (sourceid in this.state.sources)
			if (sourceid != aGcs[gid].sourceid) // only look at losers
				if (this.isInScopeGid(gid))
	{
		let msg = "";
		suo = null;

		switch (aGcs[gid].state)
		{
			case eGcs.win:
			case eGcs.conflict:
			{
				var sourceid_winner = aGcs[gid].sourceid;
				var zfcWinner       = this.zfc(sourceid_winner);
				var luid_winner     = zfcGid.get(gid).get(sourceid_winner);
				var zfiWinner       = zfcWinner.get(luid_winner);
				var zfcTarget       = this.zfc(sourceid);
				var zfiTarget       = zfcGid.get(gid).isPresent(sourceid) ? zfcTarget.get(zfcGid.get(gid).get(sourceid)) : null;
				var is_delete_pair  = false;

				if (!zfcGid.get(gid).isPresent(sourceid))
				{
					// We implement delete for Zimbra as a move to Trash.
					// When zimbra's Trash is emptied, we see the deletes, by which time the item is long gone from
					// the original source.
					// So here, we only add items to the gid if the winner is of interest (and not deleted)
					//
					if (zfiWinner.isPresent(FeedItem.ATTR_DEL))
						msg = " winner is deleted - no change";
					else if (!SyncFsm.isOfInterest(zfcWinner, zfiWinner.key()))
						msg = " winner isn't of interest - no change";
					else if (zfiWinner.type() == FeedItem.TYPE_CN &&
					         this.isParentBeingDeletedInTarget(sourceid_winner, luid_winner, sourceid))
						msg = " new contact's parent folder was deleted in target - don't add";
					else
					{
						msg = " source not in gid";
						suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.ADD);
					}
				}
				else if (this.isLsoVerMatch(gid, zfcTarget.get(zfcGid.get(gid).get(sourceid))))
				{
					if (!(sourceid in a_winner_matches_gid))
						a_winner_matches_gid[sourceid] = new Array();

					a_winner_matches_gid[sourceid].push(gid); // msg = " winner matches gid - no change";
				}
				else if (zfiWinner.isPresent(FeedItem.ATTR_DEL) ||
				        (sourceid_winner == this.state.sourceid_tb && !this.isInScopeTbLuid(zfiWinner.key()))) // added re: #236
				{
					if (!zfiTarget.isPresent(FeedItem.ATTR_DEL))
						suo = new Suo(gid, sourceid_winner, sourceid, Suo.DEL);
					else
					{
						is_delete_pair = true;
						msg = " both winner and loser deleted - no change";
					}
				}
				else if (!SyncFsm.isOfInterest(zfcWinner, zfiWinner.key()))
					suo = new Suo(gid, sourceid_winner, sourceid, Suo.DEL);
				else if (zfiTarget.isPresent(FeedItem.ATTR_DEL) || !SyncFsm.isOfInterest(zfcTarget, zfiTarget.key()))
				{
					msg = " winner modified but loser had been deleted - ";
					suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.ADD);
				}
				else
					suo = new Suo(gid, sourceid_winner, sourceid, Suo.MOD);

				if (aGcs[gid].state == eGcs.conflict && !is_delete_pair)
				{
					zinAssert(suo);

					var self = this;
					function getSourceName(sourceid) {
						return self.state.sources[sourceid]['format'] == FORMAT_TB ?
				           		format_xx_to_localisable_string(FORMAT_TB).toLowerCase() :
				           		stringBundleString("brand.server").toLowerCase();
					};

					var conflict_msg       = "";
					var source_name_winner = getSourceName(sourceid_winner);
					var source_name_loser  = getSourceName(sourceid);
					var format_winner      = this.state.sources[sourceid_winner]['format'];
					var item               = (zfiWinner.type() == FeedItem.TYPE_CN ? "contact" : "addressbook");
					var short_label_winner = this.shortLabelForLuid(sourceid_winner, luid_winner);

					conflict_msg += "conflict: " + item + ": " + short_label_winner +
									" on " + source_name_winner +
									" wins and " + item + " on " + source_name_loser +
									" will " + Suo.opcodeAsString(suo.opcode);

					this.state.aConflicts.push(conflict_msg);

					// sanity check that PAB and it's counterpart is invariant
					//
					if (zfiWinner.type() == FeedItem.TYPE_FL)
					{
						var luid_loser         = zfcGid.get(gid).get(sourceid);
						var short_label_loser  = this.shortLabelForLuid(sourceid, luid_loser);

						zinAssert(short_label_winner != TB_PAB && short_label_loser != TB_PAB);
					}
				}

				break;
			}
			default:
				zinAssert(false);
		}

		if (suo != null)
		{
			var bucket = this.suoOpcode(suo);

			if (!(sourceid in aSuoResult))
				aSuoResult[sourceid] = new Object();

			if (!(bucket in aSuoResult[sourceid]))
				aSuoResult[sourceid][bucket] = new Object();

			if (suo.opcode == Suo.ADD)
				aSuoResult[sourceid][bucket][indexSuo++] = suo;
			else
				aSuoResult[sourceid][bucket][this.state.zfcGid.get(gid).get(sourceid)] = suo;

			msg += " added suo: " + suo.toString();
		}

		if (msg.length > 0)
			big_msg.concat("\n gid=" + gid + " loser: " + sourceid + " gcs: " + aGcs[gid].toString() + " -" + msg);
	}

	for (sourceid in a_winner_matches_gid)
		if (a_winner_matches_gid[sourceid].length > 0)
			big_msg.concat("\n loser: " + sourceid + " gcs: " + aGcs[a_winner_matches_gid[sourceid][0]].toString() +
			           ": gids: " + a_winner_matches_gid[sourceid].toString());

	this.debug("suoBuildLosers: " + big_msg.toString());

	return aSuoResult;
}

SyncFsm.prototype.gdGroupsFromTbState = function(luid_gd_au)
{
	let a_group         = this.gdciLuidsForGroups(this.zfcPr().get(luid_gd_au));
	let sourceid_pr     = this.state.sourceid_pr;
	let sourceid_tb     = this.state.sourceid_tb;
	let id_gd_pab       = this.state.gd_cc_meta.find('name', GD_PAB,       'luid_gd')
	let id_gd_suggested = this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Suggested, 'luid_gd')
	let ret             = new Array();
	let gp_id;

	for (gp_id in a_group) {
		let luid_gd_ci = SyncFsmGd.gdci_id_from_pair(luid_gd_au, gp_id);

		zinAssertAndLog(luid_gd_ci in this.state.aReverseGid[sourceid_pr], luid_gd_ci);

		let gid = this.state.aReverseGid[sourceid_pr][luid_gd_ci];

		if (this.state.zfcGid.get(gid).isPresent(sourceid_tb)) {
			let luid_tb = this.state.zfcGid.get(gid).get(sourceid_tb);

			if (!this.zfcTb().get(luid_tb).isPresent(FeedItem.ATTR_DEL)) {
				let luid_tb_l = this.zfcTb().get(luid_tb).get(FeedItem.ATTR_L);

				zinAssertAndLog(luid_tb_l in this.state.aReverseGid[sourceid_tb], luid_tb_l);
				let gid_l     = this.state.aReverseGid[sourceid_tb][luid_tb_l];
				let luid_gd_l = this.state.zfcGid.get(gid_l).get(sourceid_pr);

				if (luid_gd_l != id_gd_pab && luid_gd_l != id_gd_suggested)
					ret.push(luid_gd_l);
			}
		}
		// else we've got a conflict b/n a group-mod at google and tb
		// eg. if in the same sync, the user simultaneously (1) at google: added a group and put a contact into it and
		// (b) in tb: the user dragged+dropped from one ab to another
		// in which case
		// But, if the user (1) at google removed a contact's group membership simultaneously with (2) a tb: drag/drop
		// then there's a conflict but the google group removal is respected.  That's ok, but we could mount an argument
		// that this outcome is in contrast to how the addon generally handles conflicts, ie: tb always wins.
		// The right way to implement this would be to keep a zfcPrPreMerge and pass that to gdciLuidsForGroups
		// but that'd suck up a whole heap more memory in return for conflict-resolution correctness in one very infrequent edge case.
	}

	this.debug("gdGroupsFromTbState: luid_gd_au: " + luid_gd_au + " returns: " + ret.toString());

	return ret;
}

SyncFsmGd.prototype.suoGdTweakCiOps = function()
{
	let zfc             = this.zfcPr();
	let self            = this;
	let a_suo_to_delete = new Array();
	let id_gd_pab       = this.state.gd_cc_meta.find('name', GD_PAB,       'luid_gd')
	let id_gd_suggested = this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Suggested, 'luid_gd')
	let sourceid_pr     = this.state.sourceid_pr;
	let fn_add          = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.ADD | FeedItem.TYPE_CN)); }
	let fn_mod          = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.MOD | FeedItem.TYPE_CN)); }
	let fn_del          = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.DEL | FeedItem.TYPE_CN)); }
	let a_seen_del      = new Object();
	let a_turn_del_into_mod   = new Object();
	let a_gd_au_group_for_mod = this.state.gd_au_group_for_mod;
	let i, key, suo, luid_au, luid_l, luid_target, zfiTarget;

	zinAssert(this.formatPr() == FORMAT_GD && this.account().gd_gr_as_ab == 'true');

	function get_au_l() {
		let luid_target = self.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
		let zfiTarget   = zfc.get(luid_target);
		return [ zfiTarget.get(FeedItem.ATTR_GDID), zfiTarget.get(FeedItem.ATTR_L) ];
	}

	// for DELs in pab or suggested...
	//
	for ([key, suo] in this.state.m_suo_iterator.iterator(fn_del)) {
		[ luid_au, luid_l ] = get_au_l();

		if (luid_l == id_gd_pab || luid_l == id_gd_suggested)
			a_seen_del[luid_au] = true;
	}

	// for DELs in the 'group' folders:
	// 	turn all DELs into MODs because:
	// 	a) the first one really is a MOD - it's a change of group membership and
	// 	b) other DELs have to be MODs not DELs because suo's are processed in bucket order and we want to 
	//	   iterate through them in the same order here as in UpdateGd and avoid depending on Suo sort order.
	//
	//  we have to iterate through the suo's twice:
	//  1) once to identify those contacts that are really being deleted, and
	//  2) secondly, to turn DELs into MODs those contacts not identified in (1)
	//

	for ([key, suo] in this.state.m_suo_iterator.iterator(fn_del)) {
		[ luid_au, luid_l ] = get_au_l();

		if (!(luid_au in a_seen_del)) { 
			if (!(luid_au in a_gd_au_group_for_mod)) {
				a_gd_au_group_for_mod[luid_au] = false;
				a_turn_del_into_mod[luid_au] = new Array();
				a_turn_del_into_mod[luid_au].push(key);
			}
			else
				a_turn_del_into_mod[luid_au].push(key);
		}
	}

	// Turn DELs into MODs - note that this means that the entryAction MOD code needs to cope with the winner not existing...
	//
	for (luid_au in a_turn_del_into_mod)
		for (i = 0; i < a_turn_del_into_mod[luid_au].length; i++) {
			key        = a_turn_del_into_mod[luid_au][i];
			a_suo_to_delete.push(key);

			let key_new = new SuoKey(key.sourceid, Suo.MOD | FeedItem.TYPE_CN, key.id);
			if (!(key_new.bucket in this.state.aSuo[key_new.sourceid]))
				this.state.aSuo[key_new.sourceid][key_new.bucket] = new Object();

			suo        = this.state.aSuo[key.sourceid][key.bucket][key.id];
			suo.opcode = Suo.MOD;

			this.state.aSuo[key_new.sourceid][key_new.bucket][key_new.id] = suo;
		}

	// When it's a slow sync and this.account().gd_gr_as_ab == 'true', we run the risk of duplicates because if google doesn't have
	// any contacts, ADDs get generated both for tb_pab and the 'group' addressbooks.
	//
	// So here, we remove ADDs where the winning addressbook is tb_pab so that only one contact is added to google.
	// On the next sync twiddleMapsToPairNewMatchingContacts pairs the added contact with the one in tb_pab which is why we don't
	// get duplicates there.
	// 
	// If there's a contact in tb_pab but not the '#Contacts' addressbook, then:
	// - although the ADD is removed on the slow sync
	// - on the subsequent fast sync, an ADD operation is generated
	// - and on the next fast sync it appears in the :Contacts addressbook.  Strictly speaking, we should set is_gd_group_mod
	//   back to force sync to go around again but it's a minor edge case and it works out correctly on the next sync anyway.
	//
	if (this.is_slow_sync(sourceid_pr) && this.account().gd_gr_as_ab == 'true') {
		let gid_pab   = this.state.aReverseGid[sourceid_pr][id_gd_pab];
		let id_tb_pab = this.state.zfcGid.get(gid_pab).get(this.state.sourceid_tb);
		let msg = "";

		for ([key, suo] in this.state.m_suo_iterator.iterator(fn_add)) {
			let luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
			let l           = this.zfc(suo.sourceid_winner).get(luid_winner).get(FeedItem.ATTR_L);

			if (l == id_tb_pab) {
				a_suo_to_delete.push(key);
				msg += "\n key: " + key.toString() + "suo: " + suo.toString();
			}
		}

		if (msg.length > 0)
			this.debug("suoGdTweakCiOps: ADD ops marked for removal from id_tb_pab: " + msg);
	}

	// Here, we turn:
	// - two ADDs of identical contacts in separate 'group' addressbooks into:
	// - one ADD of a contact that's a member of the relevant groups
	//
	if (this.is_slow_sync(sourceid_pr) && this.account().gd_gr_as_ab == 'true') {
		function get_a_luid_gp_abs() {
			// return associative array of the luids of the tb addressbooks that correspond with google groups
			let gd_ab_name_internal = self.gdAddressbookName('internal');
			let zfi_suggested       = SyncFsm.zfi_from_name_gd(ContactGoogle.eSystemGroup.Suggested);
			let name_gd_suggested   = self.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_GD, zfi_suggested);
			let ret                 = new Object();

			for (var key in self.state.a_gd_luid_ab_in_tb) {
				let ab_name = self.zfcTb().get(key).name();

				if (ab_name != gd_ab_name_internal && ab_name != name_gd_suggested)
						ret[key] = new Object();
			}
			return ret;
		}

		let contact_converter = this.state.m_contact_converter_style_basic;
		let a_luid_gp_abs     = get_a_luid_gp_abs();
		let a_checksum        = new Object();
		let key, checksum, i, gid;

		for ([key, suo] in this.state.m_suo_iterator.iterator(fn_add))
			if (this.state.sources[suo.sourceid_target]['format'] == FORMAT_GD) {
				let sourceid = suo.sourceid_winner;
				let luid     = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
				let l        = this.zfc(suo.sourceid_winner).get(luid).get(FeedItem.ATTR_L);

				if (l in a_luid_gp_abs) {
					checksum = this.state.aChecksum[sourceid][luid];

					if (!(checksum in a_checksum))
						a_checksum[checksum] = new Array();

					a_checksum[checksum].push(newObject('sourceid', sourceid, 'luid', luid, 'gid', suo.gid, 'l', l, 'key', key, 'is_processed', false));
				}
			}

		function mark_as_processed(i) {
			let item = a_checksum[checksum][i];
			item.is_processed = true;
			self.state.gd_au_group_for_add[gid][item.l] = true;
		}

		// this.debug("a_checksum: " + aToString(a_checksum));

		for (checksum in a_checksum) {
			while (a_checksum[checksum].length > 0) {
				let a_new = new Array();
				let first = a_checksum[checksum][0];
				gid       = first.gid;

				zinAssertAndLog(!(gid in self.state.gd_au_group_for_add), gid);

				self.state.gd_au_group_for_add[gid] = new Object();

				mark_as_processed(0);

				for (i = 1; i < a_checksum[checksum].length; i++) {
					let current = a_checksum[checksum][i];

					if (!current.is_processed && !(current.l in self.state.gd_au_group_for_add[gid]) && 
					    this.isTwin(first.sourceid, current.sourceid, first.luid, current.luid, contact_converter)) {
						mark_as_processed(i);
						a_suo_to_delete.push(current.key);
					}

					if (!current.is_processed)
						a_new.push(current);
				}

				a_checksum[checksum] = a_new;
			}
		}
	}

	for (i = 0; i < a_suo_to_delete.length; i++) {
		key = a_suo_to_delete[i];
		delete this.state.aSuo[key.sourceid][key.bucket][key.id];
	}

	// for MODs - just identify them
	//
	for ([key, suo] in this.state.m_suo_iterator.iterator(fn_mod)) {
		[ luid_au, luid_l ] = get_au_l();

		if (!(luid_au in a_seen_del) && !(luid_au in a_gd_au_group_for_mod))
			a_gd_au_group_for_mod[luid_au] = false;
	}

	this.debug("suoGdTweakCiOps: " + "\n" +
			" keys removed from aSuo: "   + a_suo_to_delete.toString()                + "\n" +
			" a_turn_del_into_mod:    "   + aToString(a_turn_del_into_mod)            + "\n" +
			" gd_au_group_for_add:  "     + aToString(this.state.gd_au_group_for_add) + "\n" +
			" a_gd_au_group_for_mod:  "   + aToString(a_gd_au_group_for_mod)          + "\n" +
			" a_seen_del: "               + aToString(a_seen_del)                     + "\n" +
			" aSuo: "                     + ((a_suo_to_delete.length > 0) ? Suo.arrayToString(this.state.aSuo) : " unchanged") );
}

// Here we remove Suo's that delete contacts when there is already a Suo to delete the parent folder because:
// - When we move the folder to Trash, the contacts remain in the parent folder in the trash
//   If we deleted the contacts first, we'd lose the parent-child relationship between contact and folder in the Zimbra Trash.
// Likewise for shared folders and their contacts.
// It's also a performance optimisation.
// And if we wanted to process folder delete before contact delete we'd have to do this.
// There's matching code in UpdateTb that mark the contacts whose DEL suo's have been removed as deleted
// UpdateZm doesn't have analoguos code because with Tb, when the folder is deleted, the contacts are really deleted,
// whereas with Zimbra, the contacts aren't deleted, they're in the Trash and get removed from the source map + gid because
// they're no longer of interest.
//
SyncFsm.prototype.suoRemoveContactOpsWhenFolderIsBeingDeleted = function()
{
	let fn              = function (sourceid, bucket) { return bucket & FeedItem.TYPE_CN; }
	let a_suo_to_delete = new Array();
	let msg             = "";
	let key, suo;

	this.state.a_folders_deleted = new Object();

	for (suo in this.state.m_suo_iterator.iterator(Suo.match_with_bucket(Suo.DEL | FeedItem.TYPE_FL, Suo.DEL | FeedItem.TYPE_SF, Suo.DEL | FeedItem.TYPE_GG)))
		this.state.a_folders_deleted[suo.gid] = new Array();

	for ([key, suo] in this.state.m_suo_iterator.iterator(fn))
	{
		if (key.bucket & Suo.ADD)
		{
			// we don't expect to see contacts being added to folders that are being deleted:
			// a) Thunderbird: this can't happen
			// b) Zimbra: we should be ignoring any new contacts in folders that aren't of interest
			// c) Google: n/a
			//
			let luid_winner  = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
			let l_winner     = SyncFsm.keyParentRelevantToGid(this.zfc(suo.sourceid_winner), luid_winner);
			let gid_l_winner = this.state.aReverseGid[suo.sourceid_winner][l_winner];

			zinAssertAndLog(!(gid_l_winner in this.state.a_folders_deleted), function() { return key.toString(); });
		}
		else
		{
			let luid_target  = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
			let l_target     = SyncFsm.keyParentRelevantToGid(this.zfc(suo.sourceid_target), luid_target);
			let gid_l_target = this.state.aReverseGid[suo.sourceid_target][l_target];

			if (gid_l_target in this.state.a_folders_deleted)
			{
				this.state.a_folders_deleted[gid_l_target].push(suo);
				a_suo_to_delete.push(key);
			}
		}
	}

	for (var i = 0; i < a_suo_to_delete.length; i++) {
		key = a_suo_to_delete[i];
		delete this.state.aSuo[key.sourceid][key.bucket][key.id];
	}

	this.debug("suoRemoveContactOpsWhenFolderIsBeingDeleted: " +
				" \n removed these keys from aSuo: " + a_suo_to_delete.toString() +
	            " \n a_folders_deleted: " + aToString(this.state.a_folders_deleted));
}


// Test that no folder names have both an ADD and/or MOD and/or DEL operation
//
// If there is, we give up convergence because:
// we apply the operations in a fixed order, namely MOD, then ADD then DEL, and:
// - if there's a ADD+DEL then almost certainly the user did DEL followed by ADD so we'd be applying them in the wrong order
// - if there's a MOD+DEL then the user might have deleted x then renamed y to x (ie DEL then MOD)
//   but we'd rename y to x giving two x's then we'd try to delete the first x which would work ok with Zimbra but not
//   with thunderbird because we don't delete tb addressbooks by luid (ie uri), we delete them by name and we lose name-uniqueness we're
//   screwed.  Also, the set of tb addressbooks would temporarily be in an inconsistent state, which is undesirable.
//
SyncFsm.prototype.suoTestForConflictingUpdateOperations = function()
{
	var self    = this;
	var a_name  = new Object(); // a_name[sourceid][folder-name] == 1 or 2;
	var msg     = "";
	var fn      = function (sourceid, bucket) { return bucket & (FeedItem.TYPE_FL | FeedItem.TYPE_SF | FeedItem.TYPE_GG); }
	var key, suo;

	function count_folder_names() {
		// When working out a name:
		// - if it's an ADD or MOD, then use winner, but if it's DEL, then use target because the winner's name might have changed
		//   eg when a zimbra folder gets moved into trash it may also get renamed to avoid clashes.
		// - names are normalised into thunderbird's namespace so that we match zimbra: fred with thunderbird: zindus/fred
		//
		let is_name_from_winner = Boolean(key.bucket & (Suo.ADD | Suo.MOD));
		let sourceid            = is_name_from_winner ? suo.sourceid_winner : suo.sourceid_target;
		let format              = self.state.sources[sourceid]['format'];
		let luid                = self.state.zfcGid.get(suo.gid).get(sourceid);
		let name                = self.state.m_folder_converter.convertForPublic(FORMAT_TB, format, self.zfc(sourceid).get(luid));

		if (!(suo.sourceid_target in a_name))
			a_name[suo.sourceid_target] = new Object();

		if (name in a_name[suo.sourceid_target])
			a_name[suo.sourceid_target][name]++;
		else
			a_name[suo.sourceid_target][name]=1;
	}

	for ([key, suo] in this.state.m_suo_iterator.iterator(fn))
		count_folder_names();

	bigloop:
		for (var sourceid in a_name)
			for (var name in a_name[sourceid])
				if (a_name[sourceid][name] >= 2)
				{
					this.state.stopFailCode    = 'failon.folder.source.update';
					this.state.stopFailArg     = [ name ];
					this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
					break bigloop;
				}

	this.debug("suoTestForConflictingUpdateOperations: anything >= 2 implies failure: " + aToString(a_name));

	return this.state.stopFailCode == null;
}

SyncFsm.prototype.shortLabelForLuid = function(sourceid, luid)
{
	var zfc    = this.zfc(sourceid);
	var format = this.state.sources[sourceid]['format'];
	var zfi    = zfc.get(luid);
	var type   = zfi.type();
	var ret    = "";
	var key;

	if (type == FeedItem.TYPE_FL || type == FeedItem.TYPE_SF)
		ret += this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfi);
	else
	{
		zinAssertAndLog(type == FeedItem.TYPE_CN, type);

		if (zfi.isPresent(FeedItem.ATTR_DEL))
			ret += "<deleted>";
		else
		{
			var properties = this.getContactFromLuid(sourceid, luid, FORMAT_TB);
		
			if (properties)
				ret += this.shortLabelForContactProperties(properties);
			else
				ret += "contact sourceid: " + sourceid + " luid=" + luid;
		}
	}

	// this.debug("shortLabelForLuid: blah: sourceid: " + sourceid + " luid=" + luid + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.shortLabelForContactProperties = function(properties)
{
	var ret = "";
	var key;

	key = 'DisplayName';

	if ((key in properties))
		ret += "<" + properties[key] + "> ";

	key = 'PrimaryEmail';

	if ((key in properties))
		ret += properties[key];

	key = 'SecondEmail';

	if (ret == "" && (key in properties))
		ret += key + ": " + properties[key];

	return ret;
}

SyncFsm.prototype.testForFolderNameDuplicate = function(aGcs)
{
	var aFolderName = new Object();
	var name;

	zinAssert(!this.state.stopFailCode);

	for (var gid in aGcs)
	{
		var sourceid = aGcs[gid].sourceid;
		var zfc      = this.zfc(sourceid);
		var format   = this.state.sources[sourceid]['format'];
		var luid     = this.state.zfcGid.get(gid).get(sourceid);
		var zfi      = zfc.get(luid);

		if (zfi.type() == FeedItem.TYPE_FL && !zfi.isPresent(FeedItem.ATTR_DEL) && SyncFsm.isOfInterest(zfc, luid))
		{
			zinAssert(zfi.isPresent(FeedItem.ATTR_NAME));

			name = this.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfi);

			if ((name in aFolderName))
			{
				this.state.stopFailCode    = 'failon.folder.name.clash';
				this.state.stopFailArg  = [ name ]; // FIXME - this is an internal facing name ie zindus_pab
				this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
				break;
			}
			else
				aFolderName[name] = gid;
		}
	}

	var ret = this.state.stopFailCode == null;

	if (!ret)
		this.state.m_logger.debug("testForFolderNameDuplicate:" + " returns: " + ret + " name: " + name +
						          " aFolderName: " + aToString(aFolderName) + " stopFailCode: " + this.state.stopFailCode +
								  " has gids: =" + gid + " and =" + aFolderName[name]);

	return ret;
}

SyncFsm.prototype.buildPreUpdateWinners = function(aGcs)
{
	for (var gid in aGcs)
	{
		var sourceid = aGcs[gid].sourceid;
		var zfc      = this.zfc(sourceid);
		var luid     = this.state.zfcGid.get(gid).get(sourceid);
		var zfi      = cloneObject(zfc.get(luid));

		zfi.set(FeedItem.ATTR_KEY, gid);

		this.state.zfcPreUpdateWinners.set(zfi);
	}
}

SyncFsm.prototype.suoRunWinners = function(aSuoWinners)
{
	var msg = "";

	for (var i = 0; i < aSuoWinners.length; i++)
	{
		let suo = aSuoWinners[i];

		msg += "\n suo: "  + suo.toString();

		var zfcWinner   = this.zfc(suo.sourceid_winner);
		var luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);

		this.resetLsoVer(suo.gid, zfcWinner.get(luid_winner));
	}

	this.state.m_logger.debug("suoRunWinners: " + (aSuoWinners.length == 0 ? " nothing to do" : msg));
}

// Test that we're not going to try to create a shared addressbook in Zimbra
// Slow Sync ==> test that for all the zindus+ and zindus- addressbooks in zfcTb, there's a TYPE_SF item in zfcZm with the same name
// Fast Sync ==> test that     all the zindus+ and zindus- addressbooks in zfcTb have an entry in the gid
// This method therefore has to be called *before* the gid is updated from the sources.
//
SyncFsm.prototype.testForCreateSharedAddressbook = function()
{
	var zfc, format, sourceid;
	var is_slow_sync = this.is_slow_sync();

	var functor = {
		converter: this.state.m_folder_converter,
		state: this.state,
		run: function(zfi)
		{
			// var msg = "testForCreateSharedAddressbook: countName: zfi: " + zfi.toString();
			// if (zfi.type() == FeedItem.TYPE_FL)
			//	msg += " folder name: " + zfi.name() + " prefixClass: " + this.converter.prefixClass(zfi.name());
			// else
			// 	msg += " not a folder";
			// this.state.m_logger.debug(msg);

			if (format == FORMAT_TB && zfi.type() == FeedItem.TYPE_FL
			                        && this.converter.prefixClass(zfi.name()) == FolderConverter.PREFIX_CLASS_SHARED
			                        && (is_slow_sync || !this.state.aReverseGid[sourceid][zfi.key()]) )
				this.countName(zfi.name());
			else if (format == FORMAT_ZM && is_slow_sync && zfi.type() == FeedItem.TYPE_SF)
				this.countName(this.converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfi));

			return true;
		},
		countName: function(name)
		{
			this.state.m_logger.debug("testForCreateSharedAddressbook: countName: sourceid: " + sourceid + " name: " + name);
			a_name[sourceid][name] = true;
		}
	};

	var a_name = new Object();

	for (sourceid in this.state.sources)
	{
		zfc    = this.zfc(sourceid);
		format = this.state.sources[sourceid]['format'];
		a_name[sourceid] = new Object();

		zfc.forEach(functor);
	}

	this.debug("testForCreateSharedAddressbook: is_slow_sync(" + this.state.sourceid_pr + "): " + is_slow_sync +
	                   " Tb: " + aToString(a_name[this.state.sourceid_tb]) + " Zm: " + aToString(a_name[this.state.sourceid_pr]));

	for (var name in a_name[this.state.sourceid_tb])
		if (!(name in a_name[this.state.sourceid_pr]))
		{
			this.state.stopFailCode   = 'failon.folder.cant.create.shared';
			this.state.stopFailArg    = [ AppInfo.app_name(AppInfo.firstcap), name ];
			break;
		}

	var passed = this.state.stopFailCode == null;

	this.state.m_logger.debug("testForCreateSharedAddressbook: passed: " + passed);

	return passed;
}

SyncFsm.prototype.fakeDelOnUninterestingContacts = function()
{
	var zfcZm = this.zfcPr();

	// Iterate through contacts and add an ATTR_DEL to any contact that's
	// no longer of interest (eg because it's folder moved to Trash)

	var functor_fakeDelOnUninterestingContacts = {
		state: this.state,

		run: function(zfi)
		{
			if (zfi.type() == FeedItem.TYPE_CN)
			{
				var luid = zfi.key();

				if (!SyncFsm.isOfInterest(zfcZm, luid))
				{
					zfcZm.get(luid).set(FeedItem.ATTR_DEL, 1);
					this.state.m_logger.debug("faking a delete on a contact that's no longer of interest: luid=" + luid);
				}
			}

			return true;
		}
	};

	if (this.state.isAnyChangeToFolders)
		zfcZm.forEach(functor_fakeDelOnUninterestingContacts);
}

// In a batch update, the change token in the soap envelope corresponds to the modification sequence number of the very last item
// in the batch.
// But we've used that as the MS attribute (and therefore the LS attribute) of each and every item in the batch.
// So unless we do something, the ms attribute in the subsequent <SyncResponse> will appear to have gone backwards!
// Here, we reset the LS attribute to what it'd be if we udpated the items on the server without using batch.
// and since we now write the REV attribute on the ZmUpdate too, we twiddle rev here too, along with ms
//
SyncFsm.prototype.twiddleZmFxMs = function()
{
	let zfcZm  = this.zfcPr();
	let bigmsg = new BigString();

	bigmsg.concat("twiddleZmFxMs: ");

	let functor = {
		run: function(zfi) {
			if (zfi.isPresent(FeedItem.ATTR_FXMS)) {
				let lso   = new Lso(zfi.get(FeedItem.ATTR_LS));
				let lsoms = Number(lso.get(FeedItem.ATTR_MS));
				let ms    = Number(zfi.get(FeedItem.ATTR_MS));
				let type  = zfi.type();

				if (ms <= lsoms) {
					lso.set(FeedItem.ATTR_MS, ms);
					if (type != FeedItem.TYPE_LN && type != FeedItem.TYPE_FL && type != FeedItem.TYPE_SF)
						lso.set(FeedItem.ATTR_REV, Number(zfi.get(FeedItem.ATTR_REV)));
					let str = lso.toString();
					zfi.set(FeedItem.ATTR_LS, str);
					bigmsg.concat("\n key=" + zfi.key() + " reset ATTR_LS: " + str);
				}
				else
					bigmsg.concat("\n key=" + zfi.key() + " has an fxms but not reset: ms: " + ms + " lsoms: " + lsoms +
					              " ms < lsoms: " + (ms < lsoms));

				zfi.del(FeedItem.ATTR_FXMS);
			}

			return true;
		}
	};

	zfcZm.forEach(functor);

	this.debug(bigmsg.toString());
}

// In zfcZm:
// - pass 1: Handle deletes - we need a separate pass for this in case a link to the a folder gets deleted then added in the same sync.
//           Also look for multiple links to the same foreign folder - this isn't supported.
//           The code assumes a 1:1:1 relationship between TYPE_SF:TYPE_FL:TYPE_LN.
//           If we wanted to support this we've have to change that assumption. The cost would be more complexity and we'd lose the
//           backlink from the TYPE_FL to the TYPE_SF.  And what purpose would it serve?  the user ends up with two
//           thunderbird addressbooks (with different names) that both point to the same shared addressbook!
//           So we detect this state of affairs and stop with an error.
// - pass 2: Create and update the TYPE_SF items
// - pass 3: Mark as deleted foreign folders which aren't pointed to by a <link>
//
SyncFsm.prototype.sharedFoldersUpdateZm = function()
{
	var zfcZm = this.zfcPr();
	var msg = "sharedFoldersUpdateZm: ";
	var passed = true;

	var functor_pass_1 = {
		a_key_fl: new Object(),
		run: function(zfi)
		{
			if (zfi.type() == FeedItem.TYPE_LN ||
			    (zfi.type() == FeedItem.TYPE_FL && zfi.isForeign()))
			{
				var is_deleted = SyncFsm.sharedFoldersUpdateSfOnDel(zfcZm, zfi);

				if (is_deleted)
					msg += "\n pass 1: TYPE_SF marked as deleted (and it's references removed) on the basis of: " + zfi.toString();
			}

			if (zfi.type() == FeedItem.TYPE_LN)
			{
				var keyFl = Zuio.key(zfi.get(FeedItem.ATTR_RID), zfi.get(FeedItem.ATTR_ZID));

				if (keyFl in this.a_key_fl)
					this.a_key_fl[keyFl].push(zfi.key())
				else
					this.a_key_fl[keyFl] = new Array(zfi.key());
			}

			return true;
		}
	};

	var functor_pass_2 = {
		run: function(zfi)
		{
			if (zfi.type() == FeedItem.TYPE_LN && !zfi.isPresent(FeedItem.ATTR_DEL))
			{
				var keyFl = Zuio.key(zfi.get(FeedItem.ATTR_RID), zfi.get(FeedItem.ATTR_ZID));

				if (zfcZm.isPresent(keyFl) && !zfcZm.get(keyFl).isPresent(FeedItem.ATTR_DEL))
				{
					var keyLn  = zfi.key();
					var zfiLn  = zfi;
					var zfiFl  = zfcZm.get(keyFl);
					var zfiSf;

					if (!zfiFl.isPresent(FeedItem.ATTR_SKEY))
					{
						var keySf = Zuio.key(zfcZm.get(FeedItem.KEY_AUTO_INCREMENT).increment('next'), "zindus-sf");

						zinAssertAndLog(!zfcZm.isPresent(keySf), "auto-incrememented key shouldn't exist: " + keySf);

						zfiSf = new FeedItem(FeedItem.TYPE_SF,
	 				                                  	FeedItem.ATTR_KEY,  keySf,
					                                  	FeedItem.ATTR_LKEY, keyLn,
					                                  	FeedItem.ATTR_FKEY, keyFl );
					                                  	// for ATTR_L, ATTR_NAME, ATTR_MS, ATTR_PERM see sharedFoldersUpdateAttributes()
						zfcZm.set(zfiSf);

						// these reverse-links make it easy to find the shared folder given either the <link> or foreign <folder>
						//
						zfcZm.get(keyLn).set(FeedItem.ATTR_SKEY, keySf);
						zfcZm.get(keyFl).set(FeedItem.ATTR_SKEY, keySf);

						msg += "\n pass 2: added to map: " + zfiSf.toString();
					}
					else
						zfiSf = zfcZm.get(zfiLn.get(FeedItem.ATTR_SKEY));

					msg += "\n pass 2: blah: before update: "+ "\n ln: " + zfiLn.toString() +
					                                           "\n sf: " + zfiSf.toString() + "\n fl: " + zfiFl.toString();

					SyncFsm.sharedFoldersUpdateAttributes(zfcZm, zfiLn.key());

					msg += "\n pass 2: blah: after update: " + "\n ln: " + zfiLn.toString() +
					                                           "\n sf: " + zfiSf.toString() + "\n fl: " + zfiFl.toString();
				   }
			}

			return true;
		}
	};

	var functor_pass_3 = {
		run: function(zfi)
		{
			if (zfi.type() == FeedItem.TYPE_FL && zfi.isForeign() && !zfi.isPresent(FeedItem.ATTR_SKEY))
			{
				// ok to flush these out because if a <link> element appears, we do a SyncRequest on the foreign folder without a token
				//
				zfi.set(FeedItem.ATTR_DEL, 1);
				msg += "\n pass 3: marked as deleted foreign folder not referenced by a <link>: " + zfi.toString();
			}

			return true;
		}
	};

	zfcZm.forEach(functor_pass_1);

	for (var key in functor_pass_1.a_key_fl)
		if (functor_pass_1.a_key_fl[key].length > 1)
		{
			passed = false;

			this.state.stopFailCode    = 'failon.multiple.ln';
			this.state.stopFailTrailer = "";

			for (var i = 0; i < functor_pass_1.a_key_fl[key].length; i++)
			{
				this.state.stopFailTrailer += "\n";

				this.state.stopFailTrailer += zfcZm.get(functor_pass_1.a_key_fl[key][i]).get(FeedItem.ATTR_NAME);
			}

			msg += " about to fail: stopFailCode: " + this.state.stopFailCode + " stopFailTrailer: " + this.state.stopFailTrailer;

			break;
		}

	if (passed)
	{
		zfcZm.forEach(functor_pass_2);
		zfcZm.forEach(functor_pass_3);
	}

	this.state.m_logger.debug(msg);

	return passed;
}

SyncFsm.sharedFoldersUpdateSfOnDel = function(zfc, zfi)
{
	var ret = 0;

	if (zfi.type() == FeedItem.TYPE_LN && zfi.isPresent(FeedItem.ATTR_DEL))
	{
		ret = 1;

		SyncFsm.sharedFoldersUpdateSfOnDelHelper(zfc, zfi, FeedItem.ATTR_FKEY);
	}
	else if (zfi.type() == FeedItem.TYPE_FL && zfi.isPresent(FeedItem.ATTR_DEL))
	{
		ret = 1;

		SyncFsm.sharedFoldersUpdateSfOnDelHelper(zfc, zfi, FeedItem.ATTR_LKEY);
	}

	return ret;
}

SyncFsm.sharedFoldersUpdateSfOnDelHelper = function(zfc, zfi, attribute)
{
	zfiSf = zfi.isPresent(FeedItem.ATTR_SKEY) ? zfc.get(zfi.get(FeedItem.ATTR_SKEY)) : null;

	if (zfiSf)
	{
		zfiSf.set(FeedItem.ATTR_DEL, '1');

		zfi = (zfiSf.isPresent(attribute)) ? zfc.get(zfiSf.get(attribute)) : null;

		if (zfi && zfi.isPresent(FeedItem.ATTR_SKEY))
			zfi.del(FeedItem.ATTR_SKEY);
	}
}

SyncFsm.sharedFoldersUpdateAttributes = function(zfc, luid_link)
{
	var zfiLn = zfc.get(luid_link);

	zinAssertAndLog(zfiLn.isPresent(FeedItem.ATTR_SKEY), function() { return "luid_link=" + luid_link + " zfiLn: " + zfiLn.toString();});

	var zfiSf = zfc.get(zfiLn.get(FeedItem.ATTR_SKEY));

	zinAssertAndLog(zfiSf.isPresent(FeedItem.ATTR_FKEY), function() { return "zfiSf: " + zfiSf.toString();});

	var zfiFl = zfc.get(zfiSf.get(FeedItem.ATTR_FKEY));

	zfiSf.set( FeedItem.ATTR_L,    zfiLn.get(FeedItem.ATTR_L));
	zfiSf.set( FeedItem.ATTR_NAME, zfiLn.name());
	zfiSf.set( FeedItem.ATTR_MS,   ((zfiLn.get(FeedItem.ATTR_MS) + 1) * (zfiFl.get(FeedItem.ATTR_MS) + 1)));
	zfiSf.set( FeedItem.ATTR_PERM, zfiFl.get(FeedItem.ATTR_PERM));
}

// Converge is slow when "verbose logging" is turned on so it is broken up into multiple states.  This means:
// - mozilla's failsafe stop/continue javascript dialog is less likely to pop up
// - the user sees a little of movement in the progress bar between each state
//

SyncFsm.prototype.entryActionConverge = function(state, event, continuation)
{
	continuation(this.runEntryActionGenerator(state, event, this.entryActionConvergeGenerator));
}

SyncFsm.prototype.entryActionConvergeGenerator = function(state)
{
	var passed = true;
	var nextEvent, generator;

	this.state.m_progress_count = 0;  // syncfsmobserver reckons there are 12 subdivisions here

	this.state.stopwatch.mark(state + " Converge: enters: " + this.state.m_progress_count++);

	if (this.formatPr() == FORMAT_GD) {
		this.gdciExpand();
		this.state.m_progress_yield_text = "gdciExpand";
		yield true;
	}

	this.debug("entryActionConverge: zfcTb:\n" + this.zfcTb().toString());
	this.state.m_progress_yield_text = "zfcPr.toString";
	yield true;

	this.logZfc(this.zfcPr(), "entryActionConverge: zfcPr:\n");

	this.state.stopwatch.mark(state + " Converge: after zfcPr.toString: " + this.state.m_progress_count++);
	this.state.m_progress_yield_text = "constraints";
	yield true;

	if (this.formatPr() == FORMAT_ZM)
	{
		this.twiddleZmFxMs();

		passed = passed && this.sharedFoldersUpdateZm();

		if (passed)
			this.fakeDelOnUninterestingContacts();

		passed = passed && this.testForCreateSharedAddressbook();
	}

	if (this.formatPr() == FORMAT_ZM && this.account().zm_emailed_contacts == "true")
		passed = passed && this.testForTbAbPresentAndInvariant(ZM_ID_FOLDER_AUTO_CONTACTS, TB_EMAILED_CONTACTS);
	else if (this.formatPr() == FORMAT_GD) {
		for (var i = 0; i < this.state.gd_cc_meta.m_a.length; i++) {
			let zfi = this.zfcPr().get(this.state.gd_cc_meta.m_a[i].luid_gd);
			if (zfi.isPresent(FeedItem.ATTR_GGSG) && !zfi.isPresent(FeedItem.ATTR_XGID))
				passed = passed && this.testForTbAbPresentAndInvariant(zfi.key(),
					this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_GD, SyncFsm.zfi_from_name_gd(zfi.name())));
		}

		passed = passed && this.testForTbAbGdCiIntegrity();
	}

	this.state.stopwatch.mark(state + " Converge: updateGidDoChecksums: " + this.state.m_progress_count++);

	if (passed)
	{
		if (this.is_slow_sync())
		{
			this.state.m_progress_yield_text = "checksums";

			generator = this.updateGidDoChecksumsGenerator();

			do { yield true; } while (generator.next());
		}

		this.state.stopwatch.mark(state + " Converge: updateGidFromSources: " + this.state.m_progress_count++);

		generator = this.updateGidFromSourcesGenerator(); // 1. map all luids into a single namespace (the gid)

		do {
			this.state.m_progress_yield_text = "gid-from-sources";
			yield true;
		} while (generator.next());

		this.state.stopwatch.mark(state + " Converge: updateGidFromSourcesSanityCheck: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "sanity-check";
		yield true;

		this.updateGidFromSourcesSanityCheck();              // 2. sanity check

		this.state.stopwatch.mark(state + " Converge: twiddle: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "twiddle";
		yield true;

		if (this.formatPr() == FORMAT_GD)
		{
			this.state.stopwatch.mark(state + " before twiddleMapsForGdPostalAddress: ");

			if (this.is_slow_sync())
			{
				if (this.state.gd_is_sync_postal_address)
				{
					generator = this.twiddleMapsForGdPostalAddressGenerator();
					do { yield true; } while (generator.next());
				}

				if (this.account().gd_suggested == 'ignore')
				{
					generator = this.twiddleMapsToRemoveFromTbGdSuggestedContacts();
					do { yield true; } while (generator.next());
				}
			}

			this.state.stopwatch.mark(state + " before twiddleMapsToPairNewMatchingContacts: ");
			if (!this.is_slow_sync())
				this.twiddleMapsToPairNewMatchingContacts();
		}

		if (this.is_slow_sync()) {
			this.state.stopwatch.mark(state + " before twiddleMapsForFieldMigration: ");
			generator = this.twiddleMapsForFieldMigration();
			do { yield true; } while (generator.next());
		}

		this.twiddleMapsForImmutables();

		this.state.stopwatch.mark(state + " buildGcs: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "buildGcs";
		yield true;

		generator = this.buildGcsGenerator();                // 3. reconcile the sources (via the gid) into a single truth
	                                                         //    winners and conflicts are identified here
		while (generator.next())
			yield true;

		this.state.stopwatch.mark(state + " Converge: buildPreUpdateWinners: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "pre-update-winners";
		yield true;

		this.buildPreUpdateWinners(this.state.aGcs);         // 4. save winner state before winner update to distinguish ms vs md update
	}

	this.state.stopwatch.mark(state + " Converge: conflict detection: " + this.state.m_progress_count++);
	this.state.m_progress_yield_text = "conflicts";
	yield true;

	this.state.stopwatch.mark(state + " Converge: before testForFolderNameDuplicate: ");
	passed = passed && this.testForFolderNameDuplicate(this.state.aGcs); // 4. a bit of conflict detection

	if (passed)
	{
		this.state.stopwatch.mark(state + " Converge: build and run winners: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "winners";
		yield true;

		let aSuoWinners = this.suoBuildWinners(this.state.aGcs);   // 6.  generate ops required to bring meta-data for winners up to date

		this.suoRunWinners(aSuoWinners);                           // 7.  run the ops that update winner meta-data

		this.state.stopwatch.mark(state + " Converge: suoBuildLosers: " + this.state.m_progress_count++);
		this.state.m_progress_yield_text = "losers";
		yield true;

		this.state.aSuo = this.suoBuildLosers(this.state.aGcs);   // 8. generate the ops required to bring the losing sources up to date
		this.state.m_suo_iterator = new SuoIterator(this.state.aSuo);

		if (this.formatPr() == FORMAT_GD) {
			if (this.account().gd_gr_as_ab == 'true')
				this.suoGdTweakCiOps();                      // 9. 
		}

		passed = this.suoTestForConflictingUpdateOperations();// 11. abort if any update ops could lead to potential inconsistency

		if (passed) {
			this.state.stopwatch.mark(state + " Converge: suoRemoveContactOpsWhenFolderIsBeingDeleted: " + this.state.m_progress_count++);
			this.state.m_progress_yield_text = "prepare-to-update";
			yield true;

			this.suoRemoveContactOpsWhenFolderIsBeingDeleted();   // 10. remove contact ops when folder is being deleted
		}
	}

	this.state.stopwatch.mark(state + " Converge: done: " + this.state.m_progress_count++)

	yield false;
}

SyncFsmGd.prototype.entryActionConfirmUI = function(state, event, continuation)
{
	let is_confirm_on_erase = preference(MozillaPreferences.GD_CONFIRM_ON_ERASE, 'bool');
	let nextEvent           = 'evNext';
	let id_gd_pab           = this.state.gd_cc_meta.find('name', GD_PAB, 'luid_gd')
	let id_gd_suggested     = (this.account().gd_gr_as_ab == 'true') ?
	                               this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Suggested, 'luid_gd') : null;
	let self                = this;

	function do_count(zfc, functor, format) {
		zfc.forEach(functor);
		let fn = function(sourceid, bucket) { return (self.state.sources[sourceid]['format'] == format) && (bucket & Suo.DEL); }
		return [ functor.count, Suo.count(self.state.aSuo, fn) ];
	}

	let functor_gd = {
		count : 0,
		run: function(zfi) {
			if (zfi.type() == FeedItem.TYPE_CN &&
			    zfi.styp() == FeedItem.eStyp.gdci &&
				!zfi.isPresent(FeedItem.ATTR_DEL))
			{
				if (zfi.get(FeedItem.ATTR_L) == id_gd_pab)
					this.count++;

				if ((self.account().gd_suggested == 'ignore') &&
				    self.account().gd_gr_as_ab == 'true' &&
				    zfi.get(FeedItem.ATTR_L) == id_gd_suggested)
					this.count++;
			}
			return true;
		}
	};

	let functor_tb = {
		count : 0,
		run: function(zfi) {
			if (zfi.type() == FeedItem.TYPE_CN && !zfi.isPresent(FeedItem.ATTR_DEL) && self.isInScopeTbLuid(zfi.key()))
				this.count++;
			return true;
		}
	};

	let c_at_gd, c_at_tb, c_to_be_deleted_gd, c_to_be_deleted_tb;

	[ c_at_gd, c_to_be_deleted_gd ] = do_count(this.zfcPr(), functor_gd, FORMAT_GD);
	[ c_at_tb, c_to_be_deleted_tb ] = do_count(this.zfcTb(), functor_tb, FORMAT_TB);
	
	this.debug("entryActionConfirmUI: " +
	           " c_at_gd: " + c_at_gd + " c_to_be_deleted_gd: " + c_to_be_deleted_gd +
	           " c_at_tb: " + c_at_tb + " c_to_be_deleted_tb: " + c_to_be_deleted_tb);

	let more_info = "<a href='" + url('slow-sync') + "'>" + stringBundleString("text.more.information.on.slow.sync") + "</a>";
	let txt_tb    = AppInfo.app_name(AppInfo.firstcap);
	let txt_gd    = stringBundleString("brand.google");

	if (is_confirm_on_erase) {
		function do_cancel(string_arg) {
			if (self.state.m_is_attended) {
				let msg    = stringBundleString("up.confirm.erase.1", [ string_arg ]);
				let dlg    = UserPrompt.show(msg, {'buttons' : "accept,cancel"});
				nextEvent  = (dlg.button == 'accept') ? 'evNext' : 'evCancel';

				if (dlg.button != 'accept')
					UserPrompt.show(stringBundleString("up.confirm.erase.2", [ more_info ]));
			}
			else
				nextEvent = 'evCancel';
		}

		if (c_to_be_deleted_gd > 0 && (c_to_be_deleted_gd == c_at_gd))
			do_cancel(txt_gd);
		else if (c_to_be_deleted_tb > 0 && (c_to_be_deleted_tb == c_at_tb))
			do_cancel(txt_tb);
	}

	let sourceid_pr   = this.state.sourceid_pr;
	let sourceid_tb   = this.state.sourceid_tb;
	let fn_add_gd     = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.ADD | FeedItem.TYPE_CN)); }
	let fn_add_tb     = function(sourceid, bucket) { return (sourceid == sourceid_tb) && (bucket == (Suo.ADD | FeedItem.TYPE_CN)); }
	let c_added_to_gd = Suo.count(this.state.aSuo, fn_add_gd);
	let c_added_to_tb = Suo.count(this.state.aSuo, fn_add_tb);
	let is_show_again = preference(MozillaPreferences.AS_SHOW_AGAIN_SLOW_SYNC, 'bool');

	// this.debug("entryActionConfirmUI: c_added_to_gd: " + c_added_to_gd + " c_added_to_tb: " + c_added_to_tb);

	if (this.state.m_is_attended && is_show_again && this.is_slow_sync() && c_at_tb != 0 && c_at_gd != 0 &&
	      !(c_added_to_tb == 0 && c_added_to_gd == 0)) {
		let msg    = stringBundleString("up.slow.sync", [
		                 txt_tb, txt_gd, c_added_to_tb, c_added_to_gd, c_at_gd + c_added_to_gd, more_info ]);
		let dlg    = UserPrompt.show(msg, {'buttons' : "accept,cancel", 'show_again' : true });
		nextEvent  = (dlg.button == 'accept') ? 'evNext' : 'evCancel';

		if (dlg.button == 'accept' && !dlg.show_again) {
			let prefs   = new MozillaPreferences();
			prefs.setBoolPref(prefs.branch(), MozillaPreferences.AS_SHOW_AGAIN_SLOW_SYNC, false);
		}
	}

	continuation(nextEvent);
}

// Add the ATTR_KEEP attribute to deleted tb mapitems when the gid has references to sources that aren't being synced.
// This drives deletion of the items in those sources when they get synced because the deleted tb item wins.
//
SyncFsm.prototype.keepCertainDeletedTbMapItems = function()
{
	let sourceid_tb = this.state.sourceid_tb;
	let aReverseGid = this.state.aReverseGid;
	let zfcGid      = this.state.zfcGid;
	let msg         = "";
	let self        = this;
	let is_a_source_in_gid_not_being_synced;

	var functor_gid = {
		run: function(sourceid, luid) {
			is_a_source_in_gid_not_being_synced = !(sourceid in self.state.sources);
			return !is_a_source_in_gid_not_being_synced;
		}
	};

	var functor_tb = {
		run: function(zfi) {
			if (zfi.isPresent(FeedItem.ATTR_DEL)) {
				var luid = zfi.key();
				var gid  = (luid in aReverseGid[sourceid_tb]) ? aReverseGid[sourceid_tb][luid] : null;

				is_a_source_in_gid_not_being_synced = false;

				zfcGid.get(gid).forEach(functor_gid, FeedItem.ITER_GID_ITEM);

				if (is_a_source_in_gid_not_being_synced)
				{
					zfi.set(FeedItem.ATTR_KEEP, 1);
					msg += " " + luid;
				}
			}

			return true;
		}
	};

	this.zfcTb().forEach(functor_tb);

	this.debug("keepCertainDeletedTbMapItems: " +
	           (msg.length > 0 ? ("added ATTR_KEEP to tb luids because the gid references sources not currently being synced: " + msg) :
			     "nothing to do"));
}

SyncFsm.prototype.entryActionUpdateTb = function(state, event, continuation)
{
	continuation(this.runEntryActionGenerator(state, event, this.entryActionUpdateTbGenerator));
}

SyncFsm.prototype.entryActionUpdateTbGenerator = function(state)
{
	var gid, type, sourceid_target, sourceid_winner, luid_winner, luid_target, zfcWinner, zfcTarget, zfcGid, zfiWinner, zfiGid;
	var suo, key, zc, uri, abfCard, abCard, l_winner, l_gid, l_target, l_current, properties, attributes, msg, format_winner, checksum;
	var count       = 0;
	var self        = this;
	var addressbook = this.state.m_addressbook;
	var fn          = function(sourceid, bucket) { return (sourceid == self.state.sourceid_tb); }

	this.state.stopwatch.mark(state);

	if (!this.state.stopFailCode)
		for (suo in this.state.m_suo_iterator.iterator(fn))
	{
		gid             = suo.gid;
		type            = this.feedItemTypeFromGid(gid, suo.sourceid_winner);
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		format_winner   = this.state.sources[sourceid_winner]['format'];
		zfcWinner       = this.zfc(sourceid_winner);
		zfcTarget       = this.zfc(sourceid_target);
		zfcGid          = this.state.zfcGid;
		luid_winner     = zfcGid.get(gid).get(sourceid_winner);
		zfiGid          = zfcGid.get(gid);
		zfiWinner       = zfcWinner.get(luid_winner);
		luid_target     = null;  // if non-null at the bottom of loop, it means that a change was made
		properties      = null;
		msg             = "";

		this.debug("entryActionUpdateTb: acting on suo:" +
			" opcode: " + suo.opcodeAsString() +
			" type: " + FeedItem.typeAsString(type) +
			" suo: "  + suo.toString());

		zinAssert(!suo.is_processed);
		suo.is_processed = true;

		this.state.m_sfcd.sourceid(this.state.sourceid_pr, 'is_tb_changed', true);

		if (type == FeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
			zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

		switch(suo.opcode | type)
		{
			case Suo.ADD | FeedItem.TYPE_CN:
				// allocate a new luid in the source map
				// add to thunderbird addressbook
				// add the luid in the source map (zfc)
				// update the gid with the new luid
				// update the reverse map 
				//
				luid_target = zfcTarget.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

				msg += "About to add a contact to the thunderbird addressbook, gid=" + gid + " and luid_winner=" + luid_winner;

				properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);
				zinAssertAndLog(properties, msg);
				zinAssertAndLog(aToLength(properties) > 0, msg);
				attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);

				msg += " properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

				l_winner = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key()); // luid of the parent folder in the source
				l_gid    = this.state.aReverseGid[sourceid_winner][l_winner];          // gid  of the parent folder
				l_target = zfcGid.get(l_gid).get(sourceid_target);                     // luid of the parent folder in the target
				uri      = addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abfCard  = addressbook.addCard(uri, properties, attributes);
				checksum = this.contact_converter().crc32(properties, { l : l_target } );

				luid_target = abfCard.id();

				msg += " l_winner=" + l_winner + " l_gid=" + l_gid + " l_target=" + l_target + " parent uri: " + uri;

				zfcTarget.set(new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, luid_target,
				                                                   FeedItem.ATTR_CS, checksum,
				                                                   FeedItem.ATTR_L, l_target));

				zfiGid.set(sourceid_target, luid_target);
				this.state.aReverseGid[sourceid_target][luid_target] = gid;
				break;

			case Suo.ADD | FeedItem.TYPE_FL:
			case Suo.ADD | FeedItem.TYPE_SF:
			case Suo.ADD | FeedItem.TYPE_GG:
				zinAssert(this.formatPr() != FORMAT_GD || self.account().gd_gr_as_ab == 'true');

				var abName = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format_winner, zfiWinner);

				if (!addressbook.getAddressBookUriByName(abName))
				{
					msg += "About to add a thunderbird addressbook, gid=" + gid + " and luid_winner=" + luid_winner + " abName: " + abName;

					let abip = addressbook.newAddressBook(abName);
					uri = abip.m_uri;

					if (!abip.m_uri || abip.m_uri.length < 1 || !abip.m_prefid || abip.m_prefid.length < 1) // re: issue #38
					{
						this.state.m_logger.error("bad uri or tpi after creating a tb addressbook: " + msg + " abip: " + abip.toString());
						this.state.stopFailCode    = 'failon.unable.to.update.thunderbird';
						this.state.stopFailTrailer = stringBundleString("status.failon.unable.to.update.thunderbird.detail1", [ abName ]);
					}

					luid_target = Zuio.key(zfcTarget.get(FeedItem.KEY_AUTO_INCREMENT).increment('next'), FeedItem.FAKE_ZID_FOR_AB);

					var name_for_map = this.state.m_folder_converter.convertForMap(FORMAT_TB, format_winner, zfiWinner);

					zfcTarget.set(new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, luid_target,
					                       FeedItem.ATTR_NAME, name_for_map, FeedItem.ATTR_L, 1,
					                       FeedItem.ATTR_MS, 1, FeedItem.ATTR_TPI, abip.m_prefid));

					msg += ".  Added: luid_target=" + luid_target + " name_for_map: " + name_for_map + " uri: " + abip.m_uri + " tpi: " + abip.m_prefid;

					zfiGid.set(sourceid_target, luid_target);
					this.state.aReverseGid[sourceid_target][luid_target] = gid;
				}
				else
					this.state.m_logger.error("Was about to create an addressbook: " + abName +
					                         " but it already exists.  This shouldn't happen.");
				break;

			case Suo.MOD | FeedItem.TYPE_CN:
				// there are two scenarios here:
				// 1. the contact's content didn't change, it just got moved from one folder to another (l attribute in the map changed)
				// 2. the contact's content changed (might have changed folders as well)
				// These scenarios are distinguished by whether the server bumped the rev attribute or not.
				// See: http://wiki/index.php/LedapZimbraSynchronisation#rev_attribute
				// A content change bumps the rev attribute in which case we would have issued a GetContactRequest
				// So in the event of a content change, the source is this.state.aSyncContact[luid_winner] or this.state.a_gd_contact
				// otherwise it's the contact in the thunderbird addressbook.
				//
				luid_target = zfiGid.get(sourceid_target);
				l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key()); // luid of the parent folder in the winner
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];          // gid  of the parent folder
				l_target    = zfcGid.get(l_gid).get(sourceid_target);                     // luid of the winner's parent in the target
				l_current   = zfcTarget.get(luid_target).keyParent();                     // luid of the target's parent before changes
				abfCard     = null;

				msg += "About to modify a contact in the addressbook, gid=" + gid + " luid_target=" + luid_target;
				msg += " l_winner=" + l_winner + " l_gid=" + l_gid + " l_target=" + l_target + " l_current=" + l_current;

				properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);

				var is_noop_modification = false;
				var is_delete_failed = false;

				if (l_target == l_current && !properties)
				{
					// parent folder didn't change and we didn't get the contact from the server so it must
					// have been a meta-data change that's irrelevant to Thunderbird (eg tag added)
					//
					msg += " - uninteresting meta-data change on server - no local change"; 

					is_noop_modification = true;
				}
				else if (l_target == l_current)
				{
					// if the parent folder hasn't changed, there must have been a content change on the server
					// in which case rev was bumped and we issued a GetContactRequest
					// Now, overwrite the card...
					//
					msg += " - parent folder hasn't changed - must have been a content change";

					zinAssertAndLog(properties, "luid_winner=" + luid_winner);
					attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);

					uri    = addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					abCard = addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);

					if (abCard)
					{
						msg += " setting card to: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						abCard = addressbook.updateCard(abCard, uri, properties, attributes, format_winner);
					}
					else
						msg += "ERROR: couldn't find the card to modify by searching on luid.  It's possible that it was deleted between now and the start of sync but it may also indicate a problem.";
				}
				else
				{
					// implement as delete+add, except for FF

					msg += " - parent folder changed";

					let uri_from = addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_current));
					let uri_to   = addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					abCard       = addressbook.lookupCard(uri_from, TBCARD_ATTRIBUTE_LUID, luid_target);

					if (abCard)
					{
						if (format_winner == FORMAT_ZM && this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB)) {
							properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);
							attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);

							msg += " - content changed";
						}
						else
						{
							attributes = addressbook.getCardAttributes(abCard);
							properties = addressbook.getCardProperties(abCard);

							msg += " - content didn't change";
						}

						is_delete_failed = !addressbook.deleteCards(uri_from, [ abCard ]);

						if (!is_delete_failed)
						{
							luid_target = zfcTarget.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

							attributes[TBCARD_ATTRIBUTE_LUID] = luid_target;

							msg += " - card deleted - card added: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);
							abfCard = addressbook.addCard(uri_to, properties, attributes);
							abCard = abfCard.abCard();
							luid_target = abfCard.id();

							if (!abCard)
								msg += "ERROR: card add failed, uri_to: " + uri_to;
						}
						else
							msg += "ERROR: card delete failed";
					}
				}

				if (is_noop_modification)
					; // do nothing - luid_target is set so the gid's ver and the target's lso get updated below
				else if (abCard)
				{
					properties = addressbook.getCardProperties(abCard);
					checksum   = this.contact_converter().crc32(properties, { l : l_target });
					zfcTarget.set(new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, luid_target,
					                                             FeedItem.ATTR_CS,  checksum,
					                                             FeedItem.ATTR_L,   l_target));
					if (abfCard)
					{
						let old_luid_target = zfiGid.get(sourceid_target);
						zinAssert(luid_target != old_luid_target);
						zfcTarget.del(old_luid_target);
						delete this.state.aReverseGid[sourceid_target][old_luid_target];
						this.state.aReverseGid[sourceid_target][luid_target] = gid;
						zfiGid.set(sourceid_target, luid_target);
					}

				}
				else
				{
					this.state.m_logger.error(" msg: " + msg);

					this.state.stopFailCode = 'failon.unable.to.update.thunderbird';

					if (is_delete_failed)
						this.state.stopFailTrailer = stringBundleString("status.failon.unable.to.update.thunderbird.detail2")
					else
						this.state.stopFailTrailer = "\n";
				}
				break;

			case Suo.MOD | FeedItem.TYPE_FL:
			case Suo.MOD | FeedItem.TYPE_SF:
			case Suo.MOD | FeedItem.TYPE_GG:
				zinAssert(this.formatPr() != FORMAT_GD || self.account().gd_gr_as_ab == 'true');

				luid_target     = zfiGid.get(sourceid_target);
				var name_target = this.getTbAddressbookNameFromLuid(sourceid_target, luid_target);

				zinAssertAndLog(zfiWinner.get(FeedItem.ATTR_L) == '1', "zfiWinner: " + zfiWinner.toString());

				var name_winner_map    = this.state.m_folder_converter.convertForMap(FORMAT_TB, format_winner, zfiWinner);
				var name_winner_public = this.getTbAddressbookNameFromLuid(sourceid_winner, luid_winner);

				if (name_target == name_winner_public)
				{
					zfcTarget.get(luid_target).increment(FeedItem.ATTR_MS);  // don't rename an addressbook to the name it already has

					msg += "do nothing: thunderbird addressbook already has the name we intended to give it: name: " + name_winner_public +
								" gid=" + gid + " luid_winner=" + luid_winner;
				}
				else
				{
					uri = addressbook.getAddressBookUriByName(name_target);

					if (uri)
					{
						msg += "About to rename a thunderbird addressbook: gid=" + gid + " luid_winner=" + luid_winner;

						addressbook.renameAddressBook(uri, name_winner_public);

						zfcTarget.get(luid_target).set(FeedItem.ATTR_NAME, name_winner_map);
						zfcTarget.get(luid_target).increment(FeedItem.ATTR_MS);
					}
					else
					{
						this.state.m_logger.warn("Was about to rename an addressbook: " +
					                             this.getTbAddressbookNameFromLuid(sourceid_target, luid_target) +
							    				 " but it didn't exist.  This shouldn't happen.");

						luid_target = null;
					}
				}
				break;

			case Suo.DEL | FeedItem.TYPE_CN:
				luid_target = zfiGid.get(sourceid_target);
				l_target    = zfcTarget.get(luid_target).keyParent();
				uri         = addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target,l_target));
				abCard      = addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);
				var is_deleted = false;

				if (abCard)
				{
					msg += "Card to be deleted: " + addressbook.nsIAbCardToPrintable(abCard);

					is_deleted = addressbook.deleteCards(uri, [ abCard ]);

					if (is_deleted)
						zfcTarget.get(luid_target).set(FeedItem.ATTR_DEL, 1);
					else
						msg += "ERROR: delete of cards failed."
				}
				else
					msg = "ERROR: Can't find card to delete in the addressbook: luid=" + luid_target + " - this shouldn't happen.";

				if (!is_deleted)
				{
					this.state.m_logger.error(msg)

					this.state.stopFailCode    = 'failon.unable.to.update.thunderbird';
					this.state.stopFailTrailer = !is_deleted ? stringBundleString("status.failon.unable.to.update.thunderbird.detail2"): "";
				}
				break;

			case Suo.DEL | FeedItem.TYPE_FL:
			case Suo.DEL | FeedItem.TYPE_SF:
			case Suo.DEL | FeedItem.TYPE_GG:
				zinAssert(this.formatPr() != FORMAT_GD || self.account().gd_gr_as_ab == 'true');

				luid_target     = zfiGid.get(sourceid_target);
				var name_target = this.getTbAddressbookNameFromLuid(sourceid_target, luid_target);
				uri             = addressbook.getAddressBookUriByName(name_target);

				if (uri)
				{
					msg += "Addressbook to be deleted: name: " + name_target + " uri: " + uri;

					addressbook.deleteAddressBook(uri);
					zfcTarget.get(luid_target).set(FeedItem.ATTR_DEL, 1);

					if (this.state.a_folders_deleted) {
						// partner with suoRemoveContactOpsWhenFolderIsBeingDeleted...
						// mark as deleted any contacts that are children of the deleted addressbook
						// and leave the map as if the contacts were actually deleted (which they are!)
						//
						zinAssertAndLog((gid in this.state.a_folders_deleted), gid);

						let a_suo = this.state.a_folders_deleted[gid];
						let zfi_gid_cn, luid_cn, j;

						if (a_suo.length > 0)
							msg += " setting DEL attribute on contact luids: ";

						for (j = 0; j < a_suo.length; j++)
						{
							zfi_gid_cn = zfcGid.get(a_suo[j].gid);
							luid_cn    = zfi_gid_cn.get(a_suo[j].sourceid_target);
							zfcTarget.get(luid_cn).set(FeedItem.ATTR_DEL, 1);
							SyncFsm.setLsoToGid(zfi_gid_cn, zfcTarget.get(luid_cn)); 
							msg += " =" + luid_cn;
						}
					}
				}
				else
				{
					this.state.m_logger.warn("Can't find addressbook to delete: luid=" + luid_target + " - this shouldn't happen.");

					luid_target = null;
				}
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + suo.opcode | type);
		}

		if (this.state.stopFailCode)
			break;

		if (luid_target)
			SyncFsm.setLsoToGid(zfiGid, zfcTarget.get(luid_target));

		this.debug("entryActionUpdateTb: " + msg);

		if ((++count % chunk_size('cards')) == 0)
			yield true;
	}

	yield false;
}

// case Suo.ADD:
//  contact:
//   <CreateContactRequest><cn l="7"><a n="company"></a><a n="email">o-1-first.o-1-last@example.com</a><a n="fileAs">1</a></cn>
//   <CreateContactResponse><cn md="1169688921" l="7" id="562" rev="2712" ... />
// folder:
//   <CreateFolderRequest><folder name="ab-1" l="482" view="contact" fie="1"/>
//   <CreateFolderResponse><folder view="contact" l="482" name="ab-1" id="630"/>
// case Suo.MOD:
// contact:
//    <ContactActionRequest><action id="348" op="update" l="482"><a n="email">blah@example.com</a><a n="fileAs">1</a>
//    <ContactActionResponse><action op="update" id="348"/>
//    id may be "707cac8a-fa68-4da1-a99e-4a571c51a354:776" if the contact was remote
// folder:
//	rename:
//    <FolderActionRequest><action id="631" op="move" l="1"/>
//    <FolderActionResponse><action op="move" id="631"/>
// case Suo.DEL:
// contact: same as Suo.MOD with l=3
// folder:  same as Suo.MOD with l=3, but on response we also remove pending deletes for contained contacts
//
// To support Batch, we build an array where the index is 0-n and the value is remote_update_package.  add to this array 50 at a time
// then empty it by Batch'ing together the operations that use the same zid.
//

SyncFsm.prototype.entryActionUpdateZm = function(state, event, continuation)
{
	var msg     = "";
	var self    = this;
	var fn      = function(sourceid, bucket) { return (self.state.sources[sourceid]['format'] == FORMAT_ZM); }
	var remote  = null;
	var a, key_suo, suo, is_more_ops;

	this.state.stopwatch.mark(state);

	if (!this.state.m_suo_generator)
		this.state.m_suo_generator = this.state.m_suo_iterator.generator(fn);

	if (!this.state.m_suo_last_in_bucket) {
		// we want to stop when we get to the end of a bucket because we don't want to call updateZmRemoteUpdatePackage
		// to add contacts (for example) until after add folders have been processed.
		//
		let generator = this.state.m_suo_iterator.generator(fn);
		this.state.m_suo_last_in_bucket = new Object();
		let bucket = null;

		while (Boolean(a = generator.next())) {
			[key_suo, suo] = a;
			this.state.m_suo_last_in_bucket[key_suo.bucket] = key_suo;
		}

		this.state.m_a_remote_update_package.m_c_total = Suo.count(this.state.aSuo, fn); // for observer
	}

	if (!this.state.stopFailCode && this.state.m_a_remote_update_package.length == 0) {
		do {
			is_more_ops = Boolean(a = this.state.m_suo_generator.next());

			if (is_more_ops) {
				[key_suo, suo] = a;

				let remote_update_package = this.updateZmRemoteUpdatePackage(key_suo, suo);

				if (remote_update_package)
					this.state.m_a_remote_update_package.push(remote_update_package);
			}
		} while (is_more_ops &&
		         this.state.m_a_remote_update_package.length < MAX_BATCH_SIZE &&
				 !key_suo.isEqual(this.state.m_suo_last_in_bucket[key_suo.bucket]));

		if (this.state.m_a_remote_update_package.length != 0) {
			// work out how many we're going to process in the next batch
			//
			let i;
			if (this.state.m_a_remote_update_package[0].remote.method in ZmSoapDocument.complexMethod)
				i = 1; // do these one at a time
			else {
				let zid = this.state.m_a_remote_update_package[0].remote.zid;

				for (i = 0; (i < this.state.m_a_remote_update_package.length) &&
						    (zid == this.state.m_a_remote_update_package[i].remote.zid) &&
						    !(this.state.m_a_remote_update_package[i].remote.method in ZmSoapDocument.complexMethod); i++)
					;
			}

			this.state.m_a_remote_update_package.m_c_used_in_current_batch = i;

			this.debug("entryActionUpdateZm: m_a_remote_update_package: " + aToString(this.state.m_a_remote_update_package));

			zinAssert(this.state.m_a_remote_update_package.m_c_used_in_current_batch != 0);
			zinAssert(this.state.m_a_remote_update_package.m_c_used_in_current_batch <= MAX_BATCH_SIZE);
		}
		else
			this.state.m_a_remote_update_package.m_c_used_in_current_batch = 0;
	}

	continuation('evNext');
}

SyncFsm.prototype.entryActionUpdateZmHttp = function(state, event, continuation)
{
	var nextEvent;

	this.debug("entryActionUpdateZmHttp: stopFailCode: " + this.state.stopFailCode + " m_a_remote_update_package.length: " + this.state.m_a_remote_update_package.length);

	if (!this.state.stopFailCode && this.state.m_a_remote_update_package.length > 0) {
		let remote = this.state.m_a_remote_update_package[0].remote;
		let zid    = remote.zid;
		let method, arg;

		if (remote.method in ZmSoapDocument.complexMethod) {
			method = remote.method;
			arg    = remote.arg;
		}
		else {
			method = "Batch";
			arg    = { a_remote_update_package: this.state.m_a_remote_update_package };
		}

		this.setupHttpZm(state, 'evRepeat', this.state.zidbag.soapUrl(zid), zid, method, arg);

		nextEvent = 'evHttpRequest';
	}
	else
	{
		nextEvent = 'evNext';

		this.state.m_http = null;
		this.state.m_suo_generator = null;           // free memory
		this.state.m_a_remote_update_package = null; // free memory
		this.state.m_suo_last_in_bucket = null;      // free memory
	}

	continuation(nextEvent);
}

SyncFsm.prototype.updateZmRemoteUpdatePackage = function(key_suo, suo)
{
	let msg             = "";
	let remote          = newObject('method', null);
	let type            = this.feedItemTypeFromGid(suo.gid, suo.sourceid_winner);
	let sourceid_winner = suo.sourceid_winner;
	let sourceid_target = suo.sourceid_target;
	let format_winner   = this.state.sources[sourceid_winner]['format'];
	let luid_winner     = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
	let zfcWinner       = this.zfc(suo.sourceid_winner);
	let zfcTarget       = this.zfc(suo.sourceid_target);
	let zfiWinner       = zfcWinner.get(luid_winner);
	var l_gid, l_winner, l_target, name_winner, zuio_target, l_zuio, properties, luid_target, is_more_ops;

	this.debug("updateZmRemoteUpdatePackage: " +
				" opcode: " + suo.opcodeAsString() +
				" type: "   + FeedItem.typeAsString(type) +
				" suo: "    + suo.toString());

	zinAssert(!suo.is_processed);

	if (type & FeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
		zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

	switch(suo.opcode | type)
	{
		case Suo.ADD | FeedItem.TYPE_FL:
			zinAssertAndLog(format_winner == FORMAT_ZM ||
			                this.state.m_folder_converter.prefixClass(zfiWinner.name()) == FolderConverter.PREFIX_CLASS_PRIMARY,
			                   "zfiWinner: " + zfiWinner.toString());
			name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);

			msg          += " add folder name: " + name_winner + " l: " + '1';
			remote.method = "CreateFolder";
			remote.arg    = newObject(FeedItem.ATTR_NAME, name_winner, FeedItem.ATTR_L, '1');
			remote.zid    = null;
			break;

		case Suo.ADD | FeedItem.TYPE_CN:
			l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
			l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
			l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);

			if (zfcTarget.get(l_target).type() == FeedItem.TYPE_SF)
				l_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, l_target, FeedItem.TYPE_FL);

			l_zuio        = new Zuio(l_target);
			properties    = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
			msg          += " add contact: ";
			remote.method = "CreateContact";
			remote.arg    = newObject('properties', properties, FeedItem.ATTR_L, l_zuio.id());
			remote.zid    = l_zuio.zid();
			break;

		case Suo.MOD | FeedItem.TYPE_FL:
			name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);
			luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

			if (zfcTarget.get(luid_target).type() == FeedItem.TYPE_SF)
			{
				luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, FeedItem.TYPE_LN);
				remote.luid_target = luid_target;
			}

			// sanity check that we never modify any of zimbra's immutable folders
			zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "id=" + luid_target + "folder name: " + name_winner);

			msg          += " rename folder to: " + name_winner;
			remote.method = "FolderAction";
			remote.arg    = newObject('id', luid_target, 'op', 'update', FeedItem.ATTR_NAME, name_winner);
			remote.zid    = null;
			break;

		case Suo.MOD | FeedItem.TYPE_CN:
			luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
			l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
			l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
			l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);

			if (zfcTarget.get(l_target).type() == FeedItem.TYPE_SF)
				l_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, l_target, FeedItem.TYPE_FL);

			zuio_target = new Zuio(luid_target);
			l_zuio      = new Zuio(l_target);

			properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);

			// populate properties with the contact attributes that must be deleted on the server...
			//
			for (key in this.contact_converter().m_common_to[FORMAT_ZM][FORMAT_TB])
				if (!(key in properties))
					properties[key] = null;

			msg          += " modify contact: ";
			remote.zid    = zuio_target.zid();
			remote.method = "ContactAction";
			remote.arg    = newObject('id', zuio_target.id(), 'op', 'update', FeedItem.ATTR_L, l_zuio.id(), 'properties', properties);
			break;

		case Suo.DEL | FeedItem.TYPE_FL:
			luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
			name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);

			msg        += " move folder to trash: " + name_winner;
			remote.method = "FolderAction";
			remote.zid    = null;

			if (zfcTarget.get(luid_target).type() == FeedItem.TYPE_SF)
			{
				luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, FeedItem.TYPE_LN);
				remote.luid_target = luid_target;
			}

			zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "luid_target=" + luid_target);

			// add the date to the folder's name in the Trash to avoid name clashes
			// this isn't guaranteed to work of course, but if it doesn't, the sync will abort
			// and the folder will re-appear on the next slow sync.  No drama, the user will just scratch their head and
			// then complain and/or retry.  The correct logic is "retry until success" but it's complex to code...
			// would prefer an iso8601 date but zimbra doesnt allow folder names to contain colons
			//
			var newname = "/Trash/" + name_winner + dateSuffixForFolder();

			msg += " - name of the folder in the Trash will be: " + newname;

			// op == 'move' is what we'd use if we weren't changing it's name
			// remote.arg     = newObject('id', luid_target, 'op', 'move', FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
			// with op=update, the server does the move before the rename so still fails because of folder name conflict in Trash
			// remote.arg     = newObject('id', luid_target, 'op', 'update', FeedItem.ATTR_NAME, newname, FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
			remote.arg     = newObject('id', luid_target, 'op', 'rename', FeedItem.ATTR_NAME, newname);
			break;

		case Suo.DEL | FeedItem.TYPE_CN:
			luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

			if (zfcTarget.get(luid_target).isForeign())
			{
				zuio_target = new Zuio(luid_target);
				properties  = this.getContactFromLuid(sourceid_target, luid_target, FORMAT_ZM);
				zinAssert(properties);
				remote.method = "ForeignContactDelete";
				remote.arg    = newObject('properties', properties, 'id', zuio_target.id(), 'zid', zuio_target.zid());
				remote.zid    = null;
				msg        += " about to copy foreign contact to trash then delete it.";
			}
			else
			{
				remote.method = "ContactAction";
				remote.arg    = newObject('id', luid_target, 'op', 'move', FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
				remote.zid    = null;
				msg        += " about to move contact to trash.";
			}
			break;

		default:
			zinAssertAndLog(false, "unmatched case: " + suo.opcode | type);
	}

	let remote_update_package = null;

	if (remote.method)
		remote_update_package = newObject('key_suo', key_suo, 'remote', remote);

	this.state.m_logger.debug("updateZmRemoteUpdatePackage: " + msg);

	return remote_update_package;
}

SyncFsm.prototype.exitActionUpdateZmHttp = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var response  = this.state.m_http.response();
	var change    = newObject('acct', null);
	var self      = this;
	var msg       = "exitActionUpdateZmHttp: ";
	var is_failed = false;
	var xpath_query, functor, remote, key_suo, suo, is_response_understood;
	var msg = "";

	this.debug("exitActionUpdateZmHttp: a_remote_update_package: " +  aToString(this.state.m_a_remote_update_package));

	var functor_create_blah_response = {
		state: this.state,
		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var l    = attribute[FeedItem.ATTR_L];
			var id   = attribute[FeedItem.ATTR_ID];
			var type = key_suo.bucket & FeedItem.TYPE_MASK;

			is_response_understood = true;

			if (remote.method == "CreateFolder")
				msg += " created: <folder id=" + id + " l=" + l + " name='" + attribute['name'] + "'>";
			else if (remote.method == "CreateContact")
				msg += " created: <cn id=" + id +" l=" + l + ">";

			if (change.acct)
				msg += " in acct zid: " + change.acct;

			if (!(FeedItem.ATTR_ID in attribute) || !(FeedItem.ATTR_L in attribute))
				this.state.m_logger.error("<folder> element received seems to be missing an 'id' or 'l' attribute - ignoring: " + aToString(attribute));
			else
			{
				let zfiGid    = this.state.zfcGid.get(suo.gid);
				let zfcTarget = self.zfc(suo.sourceid_target);
				let key       = Zuio.key(id, change.acct);
				let zfi;

				attribute[FeedItem.ATTR_KEY] = key;

				zfi = new FeedItem(type, attribute);
				zfi.set(FeedItem.ATTR_MS, change.token);
				zfi.set(FeedItem.ATTR_FXMS, '1');
				SyncFsm.setLsoToGid(zfiGid, zfi);

				zfcTarget.set(zfi);

				zfiGid.set(suo.sourceid_target, key);
				this.state.aReverseGid[suo.sourceid_target][key] = suo.gid;
				msg += " - added luid and gid"; 
			}
		}
	};

	var functor_action_response = {
		state: this.state,
		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var id   = attribute['id'];
			var type = key_suo.bucket & FeedItem.TYPE_MASK;

			msg += " recieved: <action id=" + id + ">";

			is_response_understood = true;

			if (!('id' in attribute))
				this.state.m_logger.error("<action> element received seems to be missing an 'id' attribute - ignoring: " + aToString(attribute));
			else
			{
				var zfcTarget   = self.zfc(suo.sourceid_target);
				var luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
				var zfiTarget   = zfcTarget.get(luid_target);
				var key         = Zuio.key((id.indexOf(':') == -1) ? id : rightOfChar(id, ':'), change.acct);
				var zfiRelevantToGid;

				if ('luid_target' in remote)
					zfiTarget = zfcTarget.get(remote.luid_target);  // used in MOD | TYPE_FL

				if (key_suo.bucket == (Suo.DEL | FeedItem.TYPE_FL) ||
				   (key_suo.bucket == (Suo.DEL | FeedItem.TYPE_LN) ))
					zfiTarget.set(FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH); // the folder got "renamed" into trash so fake the l attribute
				else
				{
					remote.arg[FeedItem.ATTR_KEY] = key;
					zfiTarget.set(remote.arg);
				}

				zfiTarget.set(FeedItem.ATTR_MS,  change.token);
				zfiTarget.set(FeedItem.ATTR_REV, change.token);

				if (zfiTarget.type() == FeedItem.TYPE_LN)
				{
					SyncFsm.sharedFoldersUpdateAttributes(zfcTarget, key);
					zfiRelevantToGid = zfcTarget.get(zfiTarget.get(FeedItem.ATTR_SKEY));
				}
				else
					zfiRelevantToGid = zfiTarget;

				zfiRelevantToGid.set(FeedItem.ATTR_FXMS, '1');

				SyncFsm.setLsoToGid(this.state.zfcGid.get(suo.gid), zfiRelevantToGid);

				msg += " - luid map updated - new zfi: " + zfcTarget.get(luid_target);
			}
		}
	};

	var functor_foreign_contact_delete_response = {
		state: this.state,
		run: function(doc, node)
		{
			var zfcTarget = self.zfc(suo.sourceid_target);
			var key       = Zuio.key(remote.arg.id, remote.arg.zid);

			zfcTarget.get(key).set(FeedItem.ATTR_DEL, 1);

			msg += " recieved: foreign_contact_delete_response - marking as deleted: key: " + key;

			is_response_understood = true;
		}
	};

	Xpath.setConditional(change, 'token', "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);
	Xpath.setConditional(change, 'acct',  "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

	if (!('token' in change))
	{
		// for safety's sake, we could also check that change.acct matches the zid in remote_update_package - don't bother at the mo...
		this.state.m_logger.error("No change token found.  This shouldn't happen.  Ignoring soap response.");
	}
	else
	{
		let a_remote_update_package = this.state.m_a_remote_update_package;

		msg += " change.token: " + change.token + " change.acct: " + change.acct;

		for (var i = 0; i < a_remote_update_package.m_c_used_in_current_batch && !is_failed; i++) {
			remote  = a_remote_update_package[i].remote;
			key_suo = a_remote_update_package[i].key_suo;
			suo     = this.state.aSuo[key_suo.sourceid][key_suo.bucket][key_suo.id];

			let xprefix = "/soap:Envelope/soap:Body/z:BatchResponse";
			let j = i + 1;

			switch(key_suo.bucket) {
				case Suo.ADD | FeedItem.TYPE_FL:
					xpath_query = xprefix + "/zm:CreateFolderResponse[@requestId='" + j + "']/zm:folder";
					functor = functor_create_blah_response;
					break;
				case Suo.ADD | FeedItem.TYPE_CN:
					xpath_query = xprefix +"/zm:CreateContactResponse[@requestId='" + j + "']/zm:cn";
					functor = functor_create_blah_response;
					break;
				case Suo.MOD | FeedItem.TYPE_FL:
					xpath_query = xprefix +"/zm:FolderActionResponse[@requestId='" + j + "']/zm:action";
					functor = functor_action_response;
					break;
				case Suo.MOD | FeedItem.TYPE_CN:
					xpath_query = xprefix +"/zm:ContactActionResponse[@requestId='" + j + "']/zm:action";
					functor = functor_action_response;
					break;
				case Suo.DEL | FeedItem.TYPE_FL:
					xpath_query = xprefix +"/zm:FolderActionResponse[@requestId='" + j + "']/zm:action";
					functor = functor_action_response;
					break;
				case Suo.DEL | FeedItem.TYPE_CN: {
					let luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
					let zfcTarget = this.zfc(suo.sourceid_target);

					if (zfcTarget.get(luid_target).isForeign()) {
						xpath_query = xprefix;
						functor = functor_foreign_contact_delete_response;
					}
					else {
						xpath_query = xprefix + "/zm:ContactActionResponse[@requestId='" + j + "']/zm:action";
						functor = functor_action_response;
					}
					}
					break;
				default:
					zinAssert(false);
			}

			is_response_understood = false;

			Xpath.runFunctor(functor, xpath_query, this.state.m_http.response());

			if (!is_response_understood)
				is_failed = true;
			else
				suo.is_processed = true;
		}
	}

	if (is_failed)
	{
		msg += " - soap response didn't match xpath query: " + xpath_query;

		this.state.stopFailCode    = 'failon.unable.to.update.server';
		this.state.stopFailTrailer = stringBundleString("text.zm.soap.method",
								     [ remote.method + " " + aToString(remote.arg) ] );
	}
	else {
		this.debug("exitActionUpdateZmHttp: shifting: " + this.state.m_a_remote_update_package.m_c_used_in_current_batch);

		zinAssert(this.state.m_a_remote_update_package.m_c_used_in_current_batch != 0);

		for (var i = 0; i < this.state.m_a_remote_update_package.m_c_used_in_current_batch; i++)
			this.state.m_a_remote_update_package.shift();
	}

	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.entryActionUpdateGd = function(state, event, continuation)
{
	var msg       = "";
	var self      = this;
	var fn        = function(sourceid, bucket) { return (self.state.sources[sourceid]['format'] == FORMAT_GD); }
	var remote    = newObject('method', null);
	var sourceid_winner, sourceid_target, luid_winner, luid_target, name_winner, properties, contact, zfcTarget, zfcWinner;
	var zfiTarget, zfiWinner, zfiGid, a, type, suo, key_suo, contact, group, format_winner;

	this.state.stopwatch.mark(state);

	if (!this.state.m_suo_generator)
		this.state.m_suo_generator = this.state.m_suo_iterator.generator(fn);

	var is_more_ops = !this.state.stopFailCode && Boolean(a = this.state.m_suo_generator.next());

	if (!is_more_ops)
		this.state.m_suo_generator = null;
	else
	{
		[key_suo, suo]  = a;
		type            = this.feedItemTypeFromGid(suo.gid, suo.sourceid_winner);
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		zfcTarget       = this.zfc(suo.sourceid_target);
		zfcWinner       = this.zfc(suo.sourceid_winner);
		zfiGid          = this.state.zfcGid.get(suo.gid);
		luid_winner     = zfiGid.get(suo.sourceid_winner);
		zfiWinner       = this.zfc(suo.sourceid_winner).get(luid_winner);
		format_winner   = this.state.sources[sourceid_winner]['format'];

		this.debug("entryActionUpdateGd: " + " opcode: " + suo.opcodeAsString() + " type: " + FeedItem.typeAsString(type) +
				                             " suo: "    + suo.toString());

		zinAssert(!suo.is_processed);

		zinAssert((type == FeedItem.TYPE_FL) ? (this.account().gd_gr_as_ab == 'true') : true);

		if (this.account().gd_gr_as_ab == 'true')
			this.state.m_sfcd.sourceid(this.state.sourceid_pr, 'is_gd_group_mod', true);

		function set_remote_for_add_from(gd) {
			let type = GoogleData.element_type_from_instance(gd);
			remote.method          = "POST";
			remote.url             = self.gd_url_base(type);
			remote.headers         = newObject("Content-type", "application/atom+xml");
			remote.body            = gd.toStringXml();
			remote.sourceid_winner = sourceid_winner;
			remote.luid_winner     = luid_winner;
			remote.gd              = gd;
		}

		function set_remote_for_mod(gd, old_gd) {
			let type     = GoogleData.element_type_from_instance(gd);
			let is_match = isMatchObjects(gd.properties, old_gd.properties);

			if (type == GoogleData.eElement.contact)
				is_match = is_match && gd.groups.slice().sort().toString() == old_gd.groups.slice().sort().toString();

			if (is_match) {
				// for groups we could get in here because a) we sync with both zimbra and google and b) the sync
				// with zimbra causes the gid's ver to get bumped ==> that'll generate a modify operation for google
				//
				zfiTarget  = zfcTarget.get(luid_target);
				msg       += " the local mod doesn't affect the remote " + GoogleData.eElement.keyFromValue(type) +
				             " - skip update: " + old_gd.toString();
				SyncFsm.setLsoToGid(zfiGid, zfiTarget);
				suo.is_processed = true;
			}
			else {
				remote.method          = "POST";  // POST // PUT
				remote.url             = gdAdjustHttpHttps(gd.meta.edit);
				remote.headers         = newObject("Content-type", "application/atom+xml", "X-HTTP-Method-Override", "PUT", "If-Match","*");
				remote.body            = gd.toStringXml();
				remote.sourceid_winner = sourceid_winner;
				remote.luid_winner     = luid_winner;
				remote.gd              = gd;
			}
		}

		switch(suo.opcode | type)
		{
			case Suo.ADD | FeedItem.TYPE_FL: {
				msg                   += " about to add group: ";

				let name               = this.state.m_folder_converter.convertForPublic(FORMAT_GD, format_winner, zfiWinner);
				group                  = new GroupGoogle();
				group.properties       = { title : name };

				let translation, system_group_name;

				for (system_group_name in ContactGoogle.eSystemGroup)
					for (translation in PerLocaleStatic.all_translations_of(system_group_name))
						if (name == translation) {
							this.state.stopFailCode    = 'failon.folder.name.reserved';
							this.state.stopFailArg     = [ zfiWinner.name() ];
							break;
						}
			
				if (this.state.stopFailCode)
					break;

				set_remote_for_add_from(group);
				}
				break;

			case Suo.ADD | FeedItem.TYPE_CN: {
				msg               += " about to add contact: ";
				properties         = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_GD);

				contact            = new ContactGoogle(null, this.google_contact_mode());
				contact.properties = properties;

				let l_winner       = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
				let l_gid          = this.state.aReverseGid[sourceid_winner][l_winner];
				let l_target       = this.state.zfcGid.get(l_gid).get(sourceid_target);

				let id_gd_pab         = this.state.gd_cc_meta.find('name', GD_PAB, 'luid_gd')
				let id_gd_suggested   = this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Suggested, 'luid_gd')
				let id_gd_my_contacts = this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Contacts,  'luid_gd')

				if (l_target == id_gd_pab)
					contact.groups = [ zfcTarget.get(id_gd_my_contacts).get(FeedItem.ATTR_GGID) ];
				else if (l_target == id_gd_suggested)
					contact.groups = [];
				else if (suo.gid in this.state.gd_au_group_for_add) {
					let luid_gp_in_tb;
					let a_groups = [];

					for (luid_gp_in_tb in this.state.gd_au_group_for_add[suo.gid]) {
						let gid_gp        = this.state.aReverseGid[suo.sourceid_winner][luid_gp_in_tb];
						let luid_gp_in_gd = this.state.zfcGid.get(gid_gp).get(suo.sourceid_target);

						a_groups.push(zfcTarget.get(luid_gp_in_gd).get(FeedItem.ATTR_GGID));
					}

					contact.groups = a_groups;
				}
				else
					contact.groups = [ zfcTarget.get(l_target).get(FeedItem.ATTR_GGID) ];

				set_remote_for_add_from(contact);
				remote.l_target     = l_target;
				}
				break;

			case Suo.MOD | FeedItem.TYPE_FL: {
				msg           += " about to modify group: ";
				luid_target    = zfiGid.get(sourceid_target);
				name_winner    = this.state.m_folder_converter.convertForPublic(FORMAT_GD, format_winner, zfiWinner);

				if (!(luid_target in this.state.a_gd_group)) {
					// FIXME remove this code once google fixes: http://code.google.com/p/gdata-issues/issues/detail?id=997
					//
					this.state.stopFailCode    = 'failon.known.bug';
					this.state.stopFailArg     = [ stringBundleString("brand.google"), url("google-bug-997") ];
					this.state.stopFailTrailer = stringBundleString("text.suggest.reset");

					break;
				}

				group = this.state.a_gd_group[luid_target];

				zinAssert(!group.systemGroup());

				let old_group = group.copy();

				group.properties = { title: name_winner };

				set_remote_for_mod(group, old_group);
				}
				break;

			case Suo.MOD | FeedItem.TYPE_CN: {
				msg               += " about to modify contact: ";
				luid_target        = zfiGid.get(sourceid_target);
				let luid_target_au = this.zfc(sourceid_target).get(luid_target).get(FeedItem.ATTR_GDID);

				if (!(luid_target_au in this.state.a_gd_contact)) {
					// FIXME remove this code once google fixes:
					// http://code.google.com/p/gdata-issues/issues/detail?id=997
					//
					this.state.stopFailCode    = 'failon.known.bug';
					this.state.stopFailArg     = [ stringBundleString("brand.google"), url("google-bug-997") ];
					this.state.stopFailTrailer = stringBundleString("text.suggest.reset");

					break;
				}

				contact = this.state.a_gd_contact[luid_target_au];
				let old_contact = contact.copy();

				if (!zfiWinner.isPresent(FeedItem.ATTR_DEL))
					properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_GD);

				if (false)
				this.debug("\n winning properties: " + aToString(properties) +
				           "\n contact.mode: " + contact.mode() +
				           "\n contact.properties before update: " + aToString(old_contact.properties) +
				           "\n contact.properties after update: " + aToString(contact.properties));

				// the MOD may be a change of group membership, or properties, or both
				//
				if (this.state.gd_au_group_for_mod[luid_target_au]) {
					msg += " have already modified this gdau contact, so skip update for this MOD";
					zfiTarget = zfcTarget.get(luid_target);
					if (zfiWinner.isPresent(FeedItem.ATTR_DEL))
						zfiTarget..set(FeedItem.ATTR_DEL, 1);
					SyncFsm.setLsoToGid(zfiGid, zfiTarget);
					suo.is_processed = true;
				}
				else {
					let a_group = this.gdGroupsFromTbState(luid_target_au);
					let groups  = [ ];
					let i;

					for (i = 0; i < a_group.length; i++)
						groups.push(zfcTarget.get(a_group[i]).get(FeedItem.ATTR_GGID));

					if (zfiWinner.isPresent(FeedItem.ATTR_DEL))
						; // contact.properties are unchanged... we're just changing group membership
					else
						contact.properties = properties;

					if (this.account().gd_gr_as_ab == 'true') // MOD can't change group unless we're syncing groups with ab's
						contact.groups = groups;

					this.state.gd_au_group_for_mod[luid_target_au] = true;
				}

				if (!suo.is_processed) {
					// convert the properties to a gd contact so that transformations apply before the identity test
					//
					contact.postalAddressRemoveEmptyElements(); // issue #160
					contact.modify(ContactGoogle.eModify.kRemoveDeletedGroupMembershipInfo); // issue #202

					set_remote_for_mod(contact, old_contact);
				}
				}
				break;

			case Suo.DEL | FeedItem.TYPE_FL:
			case Suo.DEL | FeedItem.TYPE_CN: {
				msg           += " about to delete: ";
				luid_target    = zfiGid.get(sourceid_target);
				zfiTarget      = zfcTarget.get(luid_target);
				let luid_target_au = (type == FeedItem.TYPE_FL) ? null : zfiTarget.get(FeedItem.ATTR_GDID);

				if ((type == FeedItem.TYPE_CN) && (luid_target_au in this.state.a_gd_contacts_deleted)) {
					msg += " the gdau contact was already deleted, so we mark the gdci contact as deleted and skip update ";
					zfiTarget.set(FeedItem.ATTR_DEL, 1);
					SyncFsm.setLsoToGid(zfiGid, zfiTarget);
					suo.is_processed = true;
				}
				else {
					zinAssert((type == FeedItem.TYPE_FL) ? !zfiTarget.isPresent(FeedItem.ATTR_GGSG) : true);

					let edit_url = (type == FeedItem.TYPE_FL) ? zfiTarget.get(FeedItem.ATTR_EDIT) :
					                                            zfcTarget.get(luid_target_au).get(FeedItem.ATTR_EDIT);

					remote.method  = "POST"; // POST DELETE
					remote.url     = gdAdjustHttpHttps(edit_url);
					remote.headers = newObject("X-HTTP-Method-Override", "DELETE", "If-Match", "*");
					remote.body    = null;
				}
				}
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + (suo.opcode | type));
		}
	}

	var nextEvent;

	if (remote.method)
	{
		this.state.remote_update_package = newObject('key_suo', key_suo, 'remote', remote);

		msg += "remote_update_package: " + " key_suo: " + key_suo.toString() + " remote method: " + remote.method + " url: " + remote.url;

		this.setupHttpGd(state, 'evRepeat', remote.method, remote.url, remote.headers, remote.body, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

		nextEvent = 'evHttpRequest';
	}
	else
	{
		nextEvent = is_more_ops ? 'evRepeat' : 'evNext' ;
		this.state.m_http = null;
		this.state.remote_update_package = null; // free memory
	}

	this.state.m_logger.debug("entryActionUpdateGd: " + msg);

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionUpdateGd = function(state, event)
{
	if (!this.state.m_http || event == "evCancel")
		return;

	let remote_update_package = this.state.remote_update_package;
	let is_response_processed = false;
	let key_suo   = remote_update_package.key_suo;
	let suo       = this.state.aSuo[key_suo.sourceid][key_suo.bucket][key_suo.id];
	let zfiGid    = this.state.zfcGid.get(suo.gid);
	let zfcTarget = this.zfc(suo.sourceid_target);
	let response  = this.state.m_http.response();
	let msg       = "exitActionUpdateGd: ";
	let self      = this;

	this.debug("exitActionUpdateGd: " + remote_update_package.remote.method + " " + remote_update_package.remote.url);

	// Google's structured field processing for gd:name and gd:structuredPostalAddress
	// means that the contact returned may have changed from the one we POST'ed
	//
	function modify_zfi(g) {
		let luid_target = self.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
		let type        = GoogleData.element_type_from_instance(g);
		let zfiTarget   = (type == GoogleData.eElement.group) ? zfcTarget.get(luid_target) :
		                                                        zfcTarget.get(zfcTarget.get(luid_target).get(FeedItem.ATTR_GDID));

		zinAssertAndLog(zfiTarget, function() { return suo.toString(); });
		zinAssertAndLog(zfiTarget.key() == g.meta.id, function() { return " key: " + zfiTarget.key() + " g.meta.id: " + g.meta.id; });

		zfiTarget.set(FeedItem.ATTR_REV,  g.meta.updated);
		zfiTarget.set(FeedItem.ATTR_EDIT, g.meta.edit);
		zfiTarget.set(FeedItem.ATTR_SELF, g.meta.self);

		if (type == GoogleData.eElement.contact)
			zfiTarget.set(FeedItem.ATTR_GDGP, g.groups.toString());
		else {
			zinAssert(!g.systemGroup());
			zfiTarget.set(FeedItem.ATTR_NAME, g.properties.title);
		}

		is_response_processed = true;

		return zfiTarget;
	}

	if (this.state.m_http.is_http_status(HTTP_STATUS_2xx) ||
	    (key_suo.bucket == (Suo.DEL | FeedItem.TYPE_CN) && this.state.m_http.is_http_status(HTTP_STATUS_404_NOT_FOUND)))
		switch (key_suo.bucket)
		{
			case Suo.ADD | FeedItem.TYPE_FL:
				if (this.state.m_http.is_http_status(HTTP_STATUS_201_CREATED))
				{
					let group   = GoogleData.new(this.state.m_http.m_xhr);
					let id      = group.meta.id;
					let updated = group.meta.updated;

					msg += " created: group id=" + id;

					if (group.properties.title != remote_update_package.remote.gd.properties.title) {
						updated = "1" + updated.substr(1); // set first digit of year to '1'
						msg += " google changed this group - ticking backwards: updated: " + updated;
					}

					let zfi = this.newZfiGroup(group);

					SyncFsm.setLsoToGid(zfiGid, zfi);

					zfcTarget.set(zfi);

					zfiGid.set(suo.sourceid_target, id);
					this.state.aReverseGid[suo.sourceid_target][id] = suo.gid;

					msg += " added luid and gid"; 

					is_response_processed = true;
				}
				break;

			case Suo.ADD | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_201_CREATED))
				{
					let contact = GoogleData.new(this.state.m_http.m_xhr);
					let id      = contact.meta.id;
					let updated = contact.meta.updated;

					let new_properties = contact.properties;
					let old_properties = remote_update_package.remote.gd.properties;

					msg += " created: contact id=" + id;

					if (!isMatchObjects(new_properties, old_properties)) {
						updated = "1" + updated.substr(1); // set first digit of year to '1'
						msg += " google changed this contact - ticking backwards: updated: " + updated;
						msg += " old_properties: " + aToString(old_properties);
						msg += " new_properties: " + aToString(new_properties);
					}

					let zfi_au = this.newZfiCnGdAu(id, updated, contact.meta.edit, contact.meta.self, contact.groups);
					zfcTarget.set(zfi_au);
					let zfi_ci = this.newZfiCnGdCi(id, remote_update_package.remote.l_target);
					zfcTarget.set(zfi_ci);

					SyncFsm.setLsoToGid(zfiGid, zfi_ci);

					zfiGid.set(suo.sourceid_target, zfi_ci.key());
					this.state.aReverseGid[suo.sourceid_target][zfi_ci.key()] = suo.gid;

					msg += " added luid and gid"; 

					is_response_processed = true;
				}
				break;

			case Suo.MOD | FeedItem.TYPE_FL:
				if (this.state.m_http.is_http_status(HTTP_STATUS_200_OK)) {
					let zfiTarget = modify_zfi(new GroupGoogle(ContactGoogleStatic.newXml(this.state.m_http.m_xhr)));

					SyncFsm.setLsoToGid(self.state.zfcGid.get(suo.gid), zfiTarget);

					msg += " map updated: zfi: " + zfiTarget.toString();
				}
				break;

			case Suo.MOD | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_200_OK)) {
					let contact     = GoogleData.new(this.state.m_http.m_xhr);
					let luid_target = self.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
					let zfi_au      = modify_zfi(contact);
					let zfi_ci      = zfcTarget.get(luid_target);
					let a_groups    = this.gdciLuidsForGroups(zfi_au);
					let zfiWinner   = this.zfc(remote_update_package.remote.sourceid_winner).get(remote_update_package.remote.luid_winner);

					if (zfiWinner.isPresent(FeedItem.ATTR_DEL)) {
						zfi_ci.set(FeedItem.ATTR_DEL, 1);
						msg += " group membership removed, set DEL attribute on zfi: " + zfi_ci.toString();
					}
					else {
						let luid_tb_l = zfiWinner.get(FeedItem.ATTR_L);

						zinAssertAndLog(luid_tb_l in this.state.aReverseGid[this.state.sourceid_tb], luid_tb_l);
						let gid_l     = this.state.aReverseGid[this.state.sourceid_tb][luid_tb_l];
						let luid_gd_l = this.state.zfcGid.get(gid_l).get(this.state.sourceid_pr);

						let zfi_ci_new = this.newZfiCnGdCi(zfi_au.key(), luid_gd_l);
						zfcTarget.set(zfi_ci_new);

						if (luid_gd_l != zfi_ci.get(FeedItem.ATTR_L)) {
							// if the 'l' attribute changed, we delete the old zfi_ci and create a new one
							//
							zfcTarget.del(zfi_ci.key());
							delete this.state.aReverseGid[suo.sourceid_target][zfi_ci.key()];
							this.state.aReverseGid[suo.sourceid_target][zfi_ci_new.key()] = suo.gid;
							this.state.zfcGid.get(suo.gid).set(suo.sourceid_target, zfi_ci_new.key());
						}

						zfi_ci = zfi_ci_new;
					}

					SyncFsm.setLsoToGid(self.state.zfcGid.get(suo.gid), zfi_ci);
					msg += " map updated: zfi: " + zfi_ci.toString();
				}
				break;

			case Suo.DEL | FeedItem.TYPE_FL:
			case Suo.DEL | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_200_OK) ||
				    this.state.m_http.is_http_status(HTTP_STATUS_404_NOT_FOUND))
				{
					if (this.state.m_http.is_http_status(HTTP_STATUS_404_NOT_FOUND))
						this.state.m_logger.warn("exitActionUpdateGd: Tried to delete an entry at Google and Google responded with a 404.  It's conceivable that this is correct but it's more likely to be a bug at Google, see http://groups.google.com/group/google-contacts-api/browse_thread/thread/d8fe64dc4e7dfe35");
						
					let luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
					let zfiTarget   = zfcTarget.get(luid_target);

					zfiTarget.set(FeedItem.ATTR_DEL, 1);

					// We don't set the DEL attribute on the gdau here because there might be some gdci's
					// and if the gdau got cleaned up, any gdci's that referenced it would be left dangling.
					// All those other gdci's get deleted during the next sync.

					if (zfiTarget.type() == FeedItem.TYPE_CN)
						this.state.a_gd_contacts_deleted[zfiTarget.get(FeedItem.ATTR_GDID)] = true;

					msg += " marking as deleted: id=" + luid_target;

					is_response_processed = true;
				}
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + key_suo.bucket);
		}

	if (!is_response_processed)
	{
		// If-Match: * seems to guarantee that an old edit url works - so no need to handle a 409 conflict...
		//
		this.state.stopFailCode    = 'failon.unable.to.update.server';
		this.state.stopFailTrailer = stringBundleString("text.zm.soap.method", [ remote_update_package.remote.method ] ) + " " +
			                         stringBundleString("status.failon.unable.to.update.server.response",
				                        [ this.state.m_http.m_http_status_code,
					                      ((this.state.m_http.response('text') && this.state.m_http.response('text').length > 0) ?
						                    this.state.m_http.response('text') : "") ] );
		msg += " the update operation wasn't successful";
	}

	suo.is_processed = true;

	this.state.m_logger.debug(msg);
}

SyncFsm.luidFromLuidTypeSf = function(zfcTarget, luid_target, item_type)
{
	zinAssertAndLog(item_type == FeedItem.TYPE_FL || item_type == FeedItem.TYPE_LN, "invalid argument: item_type: " + item_type);

	var sf_attribute = (item_type == FeedItem.TYPE_FL) ? FeedItem.ATTR_FKEY : FeedItem.ATTR_LKEY;

	zinAssertAndLog(zfcTarget.get(luid_target).isPresent(sf_attribute), "luid_target=" + luid_target);

	luid_target = zfcTarget.get(luid_target).get(sf_attribute); // the TYPE_LN item - ie the <link> element

	zinAssertAndLog(zfcTarget.get(luid_target).type() == item_type, "luid_target=" + luid_target);

	if (item_type == FeedItem.TYPE_LN)
		zinAssertAndLog(!zfcTarget.get(luid_target).isForeign(), "luid_target=" + luid_target);

	return luid_target;
}

SyncFsm.prototype.getContactFromLuid = function(sourceid, luid, format_to)
{
	var format_from = this.state.sources[sourceid]['format'];
	var zfc         = this.zfc(sourceid);
	var zfi         = zfc.get(luid);
	var ret         = null;

	zinAssertAndLog(zfi && zfi.type() == FeedItem.TYPE_CN, function() { "sourceid: " + sourceid + " luid=" + luid; });
	zinAssert(isValidFormat(format_to));

	switch(format_from)
	{
		case FORMAT_TB:
			var l      = zfi.keyParent();
			var uri    = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid, l));
			var abCard = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

			if (abCard)
			{
				ret = this.state.m_addressbook.getCardProperties(abCard);
				ret = this.contact_converter().convert(format_to, FORMAT_TB, ret);
			}
			else {
				this.state.m_logger.warn("can't find contact for to sourceid: " + sourceid + " and luid=" + luid +
				                         " in thunderbird addressbook uri: " + uri + " - this shouldn't happen.");
				this.debug("execution stack: \n " + executionStackAsString());
			}
			break;

		case FORMAT_ZM:
			if (luid in this.state.aSyncContact, luid)
				ret = this.contact_converter().convert(format_to, FORMAT_ZM, this.state.aSyncContact[luid].element);

			break;

		case FORMAT_GD:
			if (zfi.styp() == FeedItem.eStyp.gdci)
				luid = zfi.get(FeedItem.ATTR_GDID);

			if (luid in this.state.a_gd_contact)
				ret = this.contact_converter().convert(format_to, FORMAT_GD, this.state.a_gd_contact[luid].properties);
			break;

		default:
			zinAssertAndLog(false, "unmatched case: format_from: " + format_from);
	};

	return ret;
}

SyncFsm.prototype.entryActionUpdateCleanup = function(state, event, continuation)
{
	continuation(this.runEntryActionGenerator(state, event, this.entryActionUpdateCleanupGenerator));
}

SyncFsm.prototype.entryActionUpdateCleanupGenerator = function(state)
{
	var nextEvent = 'evNext';
	var self      = this;

	this.state.stopwatch.mark(state + " 1");

	if (!this.state.stopFailCode)
	{
		var aGidsToDelete = new Array();
		var format;

		this.keepCertainDeletedTbMapItems();

		this.state.stopwatch.mark(state + " 2");

		this.debug("UpdateCleanup: ");
		this.debug("zfcTb:\n" + this.zfcTb().toString());
		this.state.m_progress_yield_text = "zfcPr.toString";
		yield true;
		this.logZfc(this.zfcPr(), "zfcPr:\n");
		this.state.m_progress_yield_text = "zfcGid.toString";
		yield true;
		this.debug("zfcGid:\n" + this.state.zfcGid.toString());

		//  delete the luid item if it has a DEL attribute (or zimbra: it's not of interest)
		//  delete the mapping between a gid and an luid when the luid is not of interest
		//
		var functor_foreach_luid = {
			run: function(zfi)
			{
				let luid = zfi.key();
				let zfc  = self.zfc(sourceid);
				let gid  = (luid in self.state.aReverseGid[sourceid]) ? self.state.aReverseGid[sourceid][luid] : null;
				let msg  = " gid=" + gid + " " + sourceid + "/=" + luid;

				if (self.formatPr() == FORMAT_GD && self.is_slow_sync(self.state.sourceid_pr)
				                                    && self.state.gd_is_sync_postal_address
					                                && sourceid == self.state.sourceid_tb 
													&& zfi.isPresent(FeedItem.ATTR_TBPA))
				{
					zfi.del(FeedItem.ATTR_TBPA); // ATTR_TBPA won't be present if the zfi is the folder or if it was added by UpdateTb
				}

				if (self.is_slow_sync() && sourceid == self.state.sourceid_tb && zfi.isPresent(FeedItem.ATTR_TBFM))
				{
					zfi.del(FeedItem.ATTR_TBFM);
				}

				if (format == FORMAT_GD && zfi.getOrNull(FeedItem.ATTR_STYP) == FeedItem.eStyp.gdau)
				{
					let a_group = self.gdciLuidsForGroups(zfi);
					let is_one_alive = false;
					let gp_id;

					for (gp_id in a_group) {
						let luid_gd_ci = SyncFsmGd.gdci_id_from_pair(zfi.key(), gp_id);

						if (!self.zfcPr().isPresent(luid_gd_ci) || !self.zfcPr().get(luid_gd_ci).isPresent(FeedItem.ATTR_DEL)) {
							is_one_alive = true;
							break;
						}
					}

					if (!is_one_alive) {
						zfi.set(FeedItem.ATTR_DEL, '1');
						msg += " - all gdci's deleted so marking the gdau as deleted too";
					}
				}

				if (zfi.isPresent(FeedItem.ATTR_XGID) && !zfi.isPresent(FeedItem.ATTR_DEL))
					msg += " - kept";
				else if (zfi.isPresent(FeedItem.ATTR_KEEP))
				{
					// if a Thunderbird contact was deleted and the remote update failed for a reason that's likely to be temporary
					// (eg a Google MOD/DEL conflict where the update will work once we've got the right edit url)
					// we remember the DEL in the map to try again on the next sync
					//
					msg += " - kept";

					zfi.del(FeedItem.ATTR_KEEP);
				}
				else if (zfi.isPresent(FeedItem.ATTR_DEL) || !SyncFsm.isOfInterest(zfc, luid))
				{
					// delete luids and their link to the gid when FeedItem.ATTR_DEL is set or when the item is no longer of interest
					// eg because a contact's parent folder got deleted and we removed the Suo's that were going to
					// delete the child contacts
					//

					zfc.del(luid);
					msg += " - deleted";

					if (gid)
					{
						var luid_in_gid = self.state.zfcGid.get(gid).get(sourceid);

						if (luid_in_gid == luid)
						{
							msg += " and deleted gid's reference to sourceid";
							self.state.zfcGid.get(gid).del(sourceid);
						}
						else
						{
							// This happens when there is a mod/del conflict
							// The losing source has both a del and an add and when the add got processed it wrote a new luid
							// into the gid.  So we don't want to remove it.
							//
							msg += " but didn't delete gid reference to sourceid because it had changed to luid=" + luid_in_gid;
						}

						delete self.state.aReverseGid[sourceid][luid];
					}
				}

				self.debug_continue(msg);

				return true;
			}
		};

		for (sourceid in this.state.sources)
		{
			format = this.state.sources[sourceid]['format'];

			this.state.stopwatch.mark(state + " 3: sourceid: " + sourceid);
			this.state.m_progress_yield_text = "for-source-" + sourceid;
			yield true;

			let generator = this.zfc(sourceid).forEachGenerator(functor_foreach_luid, chunk_size('feed'));

			while (generator.next())
				yield true;
		}
			
		this.state.stopwatch.mark(state + " 5");

		// delete the gid when all the mapitems source maps have a FeedItem.ATTR_DEL attribute
		//
		var functor_count_luids_in_gid = {
			count: 0,
			run: function(sourceid, luid) {
				this.count++;
				return true;
			}
		};

		var functor_foreach_gid = {
			run: function(zfi) {
				functor_count_luids_in_gid.count = 0;

				zfi.forEach(functor_count_luids_in_gid, FeedItem.ITER_GID_ITEM);

				let msg = " gid: " + zfi.toString() + " count: " + functor_count_luids_in_gid.count;

				if (functor_count_luids_in_gid.count == 0)
				{
					msg += " had no luid properties - deleted.";
					self.state.zfcGid.del(zfi.key());
				}

				self.debug_continue(msg);

				return true;
			}
		};

		this.state.zfcGid.forEach(functor_foreach_gid, FeedCollection.ITER_NON_RESERVED);

		this.state.stopwatch.mark(state + " 5");

		var result    = { is_consistent: true };
		var generator = this.isConsistentDataStoreGenerator(result);

		do {
			this.state.m_progress_yield_text = "consistent";
			yield true;
		} while (generator.next())

		if (!result.is_consistent)
		{
			this.state.stopFailCode    = 'failon.integrity.data.store.out'; // this indicates a bug in our code
			this.state.stopFailTrailer = stringBundleString("text.file.bug", [ url('reporting-bugs') ]);
		}

		if (!this.state.stopFailCode)
			for (var suo in this.state.m_suo_iterator.iterator(function() { return true; } ))
				if (!suo.is_processed)
				{
					this.state.m_logger.error("Internal error: failed to process suo: " + suo.toString());
					this.state.stopFailCode    = 'failon.integrity.data.store.out'; // this indicates a bug in our code
					this.state.stopFailTrailer = stringBundleString("text.file.bug", [ url('reporting-bugs') ]);
					break;
				}
	}

	if (this.state.stopFailCode)
		nextEvent = 'evLackIntegrity';

	yield false;
}

SyncFsm.prototype.entryActionCommit = function(state, event, continuation)
{
	var sourceid_pr = this.state.sourceid_pr;
	var zfcLastSync = this.state.zfcLastSync;
	var sfcd        = this.state.m_sfcd;

	this.state.stopwatch.mark(state);

	if (this.formatPr() == FORMAT_ZM)
	{
		for (var zid in this.state.zidbag.m_properties)
			zfcLastSync.get(sourceid_pr).set(Zuio.key('SyncToken', zid), this.state.zidbag.get(zid, 'SyncToken'));

		zfcLastSync.get(sourceid_pr).set('zm_sync_gal_enabled', this.account().zm_sync_gal_enabled);
		zfcLastSync.get(sourceid_pr).set('zm_emailed_contacts', this.account().zm_emailed_contacts);

		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('zm_tested_soapurls', hyphenate(",", this.state.a_zm_tested_soapurls));

		if (this.state.zimbraVersion)
			zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('zm_version', this.state.zimbraVersion);
	}
	else if (this.formatPr() == FORMAT_GD)
	{
		zfcLastSync.get(sourceid_pr).set('SyncToken',           this.state.gd_sync_token);
		zfcLastSync.get(sourceid_pr).set('gd_updated_group',    this.state.gd_updated_group);
		zfcLastSync.get(sourceid_pr).set(eAccount.gd_gr_as_ab,  this.account().gd_gr_as_ab);
		zfcLastSync.get(sourceid_pr).set(eAccount.gd_suggested, this.account().gd_suggested);
		zfcLastSync.get(sourceid_pr).set(eAccount.gd_sync_with, this.account().gd_sync_with);
	}

	if (sfcd.first_sourceid_of_format(FORMAT_GD) == this.state.sourceid_pr) // if this is the first GD source...
	{
		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('gd_is_sync_postal_address', String(this.state.gd_is_sync_postal_address));
	}

	if (sfcd.is_first_in_chain())
	{
		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('account_signature', sfcd.signature());
	}

	if (this.formatPr() == FORMAT_GD && this.state.m_sfcd.last_sourceid_of_format(FORMAT_GD) == this.state.sourceid_pr)
	{
		// Consider expiring the ToBeDeleted addressbook on the last successful sync with Google.
		// Doing it then ensures that the 'fix google rule violation' code isn't going to re-create ToBeDeleted immediately after this sync.
		// This avoids deleting+creating the addressbook between two successive syncs, which isn't currently supported,
		// see: failon.folder.source.update
		//
		var gct = new GoogleRuleTrash(this.state.m_addressbook);
		gct.expire();
	}

	zfcLastSync.get(sourceid_pr).set(eAccount.url,      this.account().url);
	zfcLastSync.get(sourceid_pr).set(eAccount.username, this.account().username);

	this.state.m_logger.debug("entryActionCommit: url: " + this.account().url +
	                                       " username: " + this.account().username +
	                                      " SyncToken: " + zfcLastSync.get(sourceid_pr).get('SyncToken') +
	                              " account_signature: " + sfcd.signature());

	if (false)
	this.debug("entryActionCommit: stopwatch: " +
		" SyncFsm.isOfInterest: " +
		" count: "   + SyncFsm.isOfInterest._count +
		" elapsed: " + SyncFsm.isOfInterest._elapsed);

	zfcLastSync.save();

	this.state.zfcGid.save();

	for (var sourceid in this.state.sources)
		this.zfc(sourceid).save();

	if (this.is_slow_sync() && sfcd.is_last_in_chain()) {
		// mark the migrations as 'done'
		let a_keys = preferences().getImmediateChildren(preferences().branch(), MozillaPreferences.AS_MIGRATION + '.');
		let i, j;

		for (i in a_keys) {
			let a_str = preference(MozillaPreferences.AS_MIGRATION + '.' + i, 'char').split(':');

			zinAssert(a_str.length == 2);

			if (Number(a_str[0]) < 8)
				preferences().branch().setCharPref(MozillaPreferences.AS_MIGRATION + '.' + i, hyphenate(':', '9', a_str[1]));
		}
	}

	continuation('evNext');
}

SyncFsm.prototype.entryActionFinal = function(state, event, continuation)
{
	// Note that you don't get in here on an 'evCancel' event.  This breaks our nice assumptions about how fsm's work
	// but it has to be this way because if the calling window closes (eg MailWindow or PrefsDialog timers) anything you
	// want to do has to be done before releasing control.  So we can't do a state transition (which does release control).
	//
	this.state.stopwatch.mark(state);

	this.state.m_logappender.close();
}

SyncFsm.prototype.suoOpcode = function(suo)
{
	var type = this.feedItemTypeFromGid(suo.gid, suo.sourceid_winner);

	return (type | suo.opcode);
}

SyncFsm.prototype.zfcTb        = function()         { return this.zfc(this.state.sourceid_tb);                       }
SyncFsm.prototype.zfcPr        = function()         { return this.zfc(this.state.sourceid_pr);                       }
SyncFsm.prototype.formatPr     = function()         { return this.state.sources[this.state.sourceid_pr]['format'];   }
SyncFsm.prototype.account      = function()         { return this.state.sources[this.state.sourceid_pr]['account'];  }
SyncFsm.prototype.getIntPref   = function(key)      { var p = preferences(); return p.getIntPref(  p.branch(), key); }
SyncFsm.prototype.getCharPref  = function(key)      { var p = preferences(); return p.getCharPref( p.branch(), key); }

SyncFsm.prototype.is_slow_sync = function(sourceid)
{
	return this.state.m_sfcd.sourceid(sourceid ? sourceid : this.state.sourceid_pr, 'is_slow_sync');
}

SyncFsm.prototype.zfc = function(sourceid)
{
	zinAssertAndLog(sourceid in this.state.sources, sourceid);

	return this.state.sources[sourceid]['zfcLuid'];
}

SyncFsm.prototype.debug          = function(str) { zinAssert(arguments.length == 1); this.debug_do(str, false); }
SyncFsm.prototype.debug_continue = function(str) { zinAssert(arguments.length == 1); this.debug_do(str, true);  }

SyncFsm.prototype.debug_do = function(str, is_continue)
{
	if (this.state.m_debug_filter_out)
		str = str.replace(this.state.m_debug_filter_out, "~");

	if (is_continue)
		this.state.m_logger.debug_continue(str);
	else
		this.state.m_logger.debug(str);
}

SyncFsm.prototype.contact_converter = function()
{
	var ret;

	if (this.formatPr() == FORMAT_GD && this.state.gd_is_sync_postal_address)
		ret = this.state.m_contact_converter_style_gd_postal;
	else
		ret = this.state.m_contact_converter_style_basic;

	zinAssert(ret);

	return ret;
}

SyncFsm.prototype.google_contact_mode = function()
{
	return this.state.gd_is_sync_postal_address ? ContactGoogle.ePostal.kEnabled : ContactGoogle.ePostal.kDisabled;
}

// if there's no ver in the gid, add it and reset the zfi ls
// else if the zfi ls doesn't match either the zfi or the gid attributes, bump the gid's ver and reset the zfi's ls
// otherwise do nothing
//
SyncFsm.prototype.resetLsoVer = function(gid, zfi)
{
	var lsoFromZfiAttributes = new Lso(zfi);
	var lsoFromLsAttribute   = zfi.isPresent(FeedItem.ATTR_LS) ? new Lso(zfi.get(FeedItem.ATTR_LS)) : null;
	var zfiGid = this.state.zfcGid.get(gid);
	var ver    = null;

	if (!zfiGid.isPresent(FeedItem.ATTR_VER))
	{
		ver = 1;
		zfiGid.set(FeedItem.ATTR_VER, ver);
	}
	else if (lsoFromLsAttribute == null ||
	        lsoFromLsAttribute.get(FeedItem.ATTR_VER) != zfiGid.get(FeedItem.ATTR_VER) ||
			lsoFromLsAttribute.compare(zfi) != 0 )
	{
		this.state.zfcGid.get(gid).increment(FeedItem.ATTR_VER);
		ver = zfiGid.get(FeedItem.ATTR_VER);
	}

	if (ver)
	{
		lsoFromZfiAttributes.set(FeedItem.ATTR_VER, ver);
		zfi.set(FeedItem.ATTR_LS, lsoFromZfiAttributes.toString());
	}
}

SyncFsm.prototype.feedItemTypeFromGid = function(gid, sourceid)
{
	var luid = this.state.zfcGid.get(gid).get(sourceid);
	return this.zfc(sourceid).get(luid).type();
}

SyncFsm.prototype.getTbAddressbookNameFromLuid = function(sourceid, luid)
{
	var zfc    = this.state.sources[sourceid]['zfcLuid'];
	var format = this.state.sources[sourceid]['format'];

	zinAssertAndLog(zfc.isPresent(luid), "sourceid: " + sourceid + " luid=" + luid);

	var ret  = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid));

	return ret;
}

SyncFsm.prototype.isLsoVerMatch = function(gid, zfi)
{
	var ret = false;

	if (zfi.isPresent(FeedItem.ATTR_LS))
	{
		var lso = new Lso(zfi.get(FeedItem.ATTR_LS));

		if (lso.get(FeedItem.ATTR_VER) == this.state.zfcGid.get(gid).get(FeedItem.ATTR_VER))
		{
			var res = lso.compare(zfi);

			ret = (res == 0);
		}
	}

	return ret;
}

SyncFsm.setLsoToGid = function(zfiGid, zfiTarget)
{
	var lso = new Lso(zfiTarget);
	var ver = zfiGid.get(FeedItem.ATTR_VER);

	lso.set(FeedItem.ATTR_VER, ver);

	zfiTarget.set(FeedItem.ATTR_LS, lso.toString());
}

SyncFsm.getTopLevelFolderHash = function(zfc, attr_key, attr_value)
{
	var ret = new Object();

	var functor = {
		type_fl: FeedItem.typeAsString(FeedItem.TYPE_FL),
		run: function(zfi) {
			if (zfi.get(FeedItem.ATTR_TYPE) == this.type_fl && zfi.get(FeedItem.ATTR_L) == '1')
				ret[zfi.get(attr_key)] = zfi.get(attr_value);

			return true;
		}
	};

	zfc.forEach(functor);

	logger().debug("getTopLevelFolderHash: returns: " + aToString(ret));

	return ret;
}

// This method supports the fix for issue #117.
// When a contact is added on one end of a sync, we don't want to do an ADD in the target if the parent folder has been deleted
//
SyncFsm.prototype.isParentBeingDeletedInTarget = function(sourceid_winner, luid_winner, sourceid_target)
{
	var l_winner     = SyncFsm.keyParentRelevantToGid(this.zfc(sourceid_winner), luid_winner);
	var gid_l_winner = this.state.aReverseGid[sourceid_winner][l_winner];
	var l_target     = this.state.zfcGid.get(gid_l_winner).isPresent(sourceid_target) ?
	                   this.state.zfcGid.get(gid_l_winner).get(sourceid_target) : null;

	var ret = l_target && this.zfc(sourceid_target).get(l_target).isPresent(FeedItem.ATTR_DEL);

	return ret;
}

SyncFsm.prototype.logZfc = function(zfc, text)
{
	var generator = zfc.generateZfis();
	var format    = zfc.format();
	var zfi;

	this.debug(text);

	while (Boolean(zfi = generator.next()))
		if (format == FORMAT_ZM)
			this.debug_continue(zfi.toString());
		else
			this.debug_continue(zfi.toString(FeedItem.TOSTRING_RET_FIRST_ONLY));
}

SyncFsm.keyParentRelevantToGid = function(zfc, key)
{
	var format = zfc.format();
	var zfi = zfc.get(key);
	var ret;

	zinAssertAndLog(zfi && zfi.type() == FeedItem.TYPE_CN, function() { zfi ? zfi.toString() : " null"; } );

	if (format == FORMAT_ZM)
	{
		ret = zfi.keyParent();

		if (zfc.isPresent(ret))
		{
			zfi = zfc.get(ret);

			if (zfi.isForeign())
			{
				if (zfi.type() == FeedItem.TYPE_FL)
					ret = zfi.get(FeedItem.ATTR_SKEY);
				else
					zinAssertAndLog(false, function () { return "something is wrong: zfi: " + zfi.toString() + " key: " + key; });
			}
		}
	}
	else
		ret = zfi.get(FeedItem.ATTR_L);

	// logger().debug("keyParentRelevantToGid: blah: key: " + key + " returns: " + ret + " isPresent: " + zfc.isPresent(ret));

	return ret;
}

// <link> elements (ie TYPE_LN) and foreign <folder> elements (ie TYPE_FL with a zid component in it's key)
// are represented in the gid by a facade element: TYPE_SF.
//
SyncFsm.isRelevantToGid = function(zfc, key)
{
	var ret;

	// zinAssertAndLog(SyncFsm.isOfInterest(zfc, key), "key not of interest: " + key);

	var zfi = zfc.get(key);

	switch (zfi.type())
	{
		case FeedItem.TYPE_GG: ret = !zfi.isPresent(FeedItem.ATTR_XGID); break;
		case FeedItem.TYPE_LN: ret = false;            break;
		case FeedItem.TYPE_SF: ret = true;             break;
		case FeedItem.TYPE_CN: ret = true;             break;
		case FeedItem.TYPE_FL: ret = !zfi.isForeign(); break;
		default:
			zinAssertAndLog(false, "unmatched case: " + zfi.type());
	}

	// logger().debug("isRelevantToGid: blah: zfi: " + zfi.toString() + " returns: " + ret);

	return ret;
}

// A FeedItem is of interest if we want to keep track of it's luid across syncs.
//
// TYPE_SF is always of interest
// TYPE_LN is of interest if the 'l' attribute is '1'
// TYPE_CN is of interest if the 'l' attribute is '1'
// TYPE_FL is of interest if:
// - when the folder is in the primary account, the 'l' attribute is '1'
// - when the folder is in a   foreign account, there's a link element whose rid and zid attributes point to it and
//                                              the folder's perm indicates that the user has access
// TYPE_GG is if interest unless it's a) not a systemGroup and b) isn't prefixed with 'zindus'
//
SyncFsm.isOfInterest = function(zfc, key)
{
	// logger().debug("SyncFsm.isOfInterest: blah: key: " + key + " arguments.length: " + arguments.length +
	//                " zfc: " + (zfc ? "non-null" : "null") + " zfc.isPresent(key): " + zfc.isPresent(key));

	zinAssert(arguments.length == 2);
	zinAssert(zfc);
	zinAssert(key);

	var ret = null;

	if (!zfc.isPresent(key))
		ret = false;
	else
	{
		var zfi = zfc.get(key);

		switch (zfi.type())
		{
			case FeedItem.TYPE_SF:
			case FeedItem.TYPE_LN:
				ret = (zfi.get(FeedItem.ATTR_L) == 1); // if present, must be a top-level folder
				break;

			case FeedItem.TYPE_FL:
				if (!zfi.isForeign())
					ret = (zfi.get(FeedItem.ATTR_L) == 1);
				else
				{
					// would like to only use ATTR_SKEY to find the TYPE_SF item but if ATTR_SKEY isn't present, we have to
					// linear search through the map for the TYPE_SF because this function is called from SyncResponse processing
					// in which the ATTR_SKEY attributes haven't yet been added
					//
					ret = (zmPermFromZfi(zfi.getOrNull(FeedItem.ATTR_PERM)) != ZM_PERM_NONE);

					if (ret)
						if (zfi.isPresent(FeedItem.ATTR_SKEY))
							ret = SyncFsm.isOfInterest(zfc, zfi.get(FeedItem.ATTR_SKEY));
						else
						{
							var skey = SyncFsm.zfcFindFirstLink(zfc, key);

							if (skey != null)
								ret = SyncFsm.isOfInterest(zfc, skey);
							else
								ret = false;
						}
				}
				break;

			case FeedItem.TYPE_CN:
				// not sure how a contact could end up at the very top level but it might be possible!

				if (zfi.isPresent(FeedItem.ATTR_XGID) || zfi.get(FeedItem.ATTR_L) == 1) 
					ret = false;
				else
					ret = SyncFsm.isOfInterest(zfc, SyncFsm.keyParentRelevantToGid(zfc, key));
				break;

			case FeedItem.TYPE_GG:
				ret = (!zfi.isPresent(FeedItem.ATTR_XGID) && zfi.isPresent(FeedItem.ATTR_GGSG)) ||
				      re_gd_group.test(zfi.get(FeedItem.ATTR_NAME));
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + zfi.type());
		}
	}

	// logger().debug("SyncFsm.isOfInterest: blah: key: " + key + " returns: " + ret);

	return ret;
}

SyncFsm.newSyncFsm = function(syncfsm_details, sfcd)
{
	var id_fsm  = null;
	var account = sfcd.account();
	var type    = syncfsm_details.type;
	var format  = account.format_xx();
	var syncfsm;

	zinAssert(account);

	logger().debug("newSyncFsm: account: " + account.toString() + " account_index: " + sfcd.m_account_index +
	                   " is_attended: " + syncfsm_details.is_attended);

	if      (format == FORMAT_ZM && type == "twoway")    { syncfsm = new SyncFsmZm();     id_fsm = Maestro.FSM_ID_ZM_TWOWAY;   }
	else if (format == FORMAT_GD && type == "twoway")    { syncfsm = new SyncFsmGd();     id_fsm = Maestro.FSM_ID_GD_TWOWAY;   }
	else if (format == FORMAT_ZM && type == "authonly")  { syncfsm = new SyncFsmZm();     id_fsm = Maestro.FSM_ID_ZM_AUTHONLY; }
	else if (format == FORMAT_GD && type == "authonly")  { syncfsm = new SyncFsmGdAuth(); id_fsm = Maestro.FSM_ID_GD_AUTHONLY; }
	else zinAssertAndLog(false, "mismatched case: format: " + format + " type: " + type);

	syncfsm.initialise(id_fsm, (syncfsm_details.is_attended ? true : false), sfcd);

	return syncfsm;
}

SyncFsm.prototype.setupHttpGd = function(state, eventOnResponse, http_method, url, headers, body, on_error, log_response)
{
	// this.state.m_logger.debug("setupHttpGd: blah: " +
	//                           " state: " + state + " eventOnResponse: " + eventOnResponse + " url: " + url +
	//                           " http_method: " + http_method + " evNext will be: " + this.fsm.m_transitions[state][eventOnResponse]);

	zinAssert(SyncFsm.prototype.setupHttpGd.length == arguments.length); // catch programming errors
	zinAssert(http_method && url);

	this.state.m_http = new HttpStateGd(http_method, url, headers, this.state.authToken, body, on_error, log_response, this.state.m_logger);

	this.setupHttpCommon(state, eventOnResponse);
}

// note: this function takes a variable number of arguments following the last parameter
// Function.length below returns the number of formal arguments
//
SyncFsm.prototype.setupHttpZm = function(state, eventOnResponse, url, zid, method)
{
	if (true)
		this.state.m_logger.debug("setupHttpZm: " +
		                          " state: " + state + " eventOnResponse: " + eventOnResponse + " url: " + url +
		                          " method: " + method + " evNext will be: " + this.fsm.m_transitions[state][eventOnResponse]);

	zinAssert(url != null);

	this.state.m_http = new HttpStateZm(url, this.state.m_logger);
	this.state.m_http.m_method = method;
	this.state.m_http.m_zsd.context(this.state.authToken, zid, !(method in ZmSoapDocument.complexMethod));
	this.state.m_http.m_zsd[method].apply(this.state.m_http.m_zsd, arrayFromArguments(arguments, SyncFsm.prototype.setupHttpZm.length));

	this.setupHttpCommon(state, eventOnResponse);
}

SyncFsm.prototype.setupHttpCommon = function(state, eventOnResponse)
{
	this.fsm.m_transitions['stHttpResponse']['evNext'] = this.fsm.m_transitions[state][eventOnResponse];

	if (this.fsm.m_a_exit[state])
	{
		this.fsm.m_a_exit['stHttpResponse'] = this.fsm.m_a_exit[state];

		this.state.m_http.m_restore_exit_function = this.fsm.m_a_exit[state]
		this.state.m_http.m_restore_exit_state  = state;

		this.fsm.m_a_exit[state] = null;
	}
	else
		this.fsm.m_a_exit['stHttpResponse'] = this.exitActionHttpResponse;
}

SyncFsm.prototype.entryActionHttpRequest = function(state, event, continuation)
{
	var self  = this;
	var http = this.state.m_http;

	zinAssert(!http.is_cancelled);
	zinAssert(http.isPreResponse());
	zinAssert(!http.isPostResponse());

	this.state.cCallsToHttp++;

	this.state.m_logger.debug("http request: #" + this.state.cCallsToHttp + ": " + http.toStringFiltered());

	http.m_xhr = new XMLHttpRequest();
	http.m_xhr.onreadystatechange = closureToHandleXmlHttpResponse(self, continuation);

	http.m_xhr.open(http.m_http_method, http.m_url, true);

	if (http.m_http_headers)
		set_http_request_headers(http.m_xhr, http.m_http_headers);

	http.m_xhr.send(http.httpBody());
}

function closureToHandleXmlHttpResponse(self, continuation)
{
	var ret = function()
	{
		// zinSleep(1000); // used to test that cancel works when an http request is pending
		// self.debug("am here: readyState: " + self.state.m_http.m_xhr.readyState);

		if (self.state.m_http.m_xhr.readyState == 4)
			self.handleXmlHttpResponse(continuation, self);
	}

	return ret;
}

SyncFsm.prototype.handleXmlHttpResponse = function (continuation, self)
{
	var msg  = "handleXmlHttpResponse: ";
	var http = self.state.m_http;
	var nextEvent = null;

	if (http.is_cancelled)
	{
		http.m_http_status_code = HTTP_STATUS_ON_CANCEL;

		msg += " cancelled - set m_http_status_code to: " + http.m_http_status_code;

		nextEvent = 'evCancel';
	}
	else
	{
		let is_failed = false;

		try {
			// when the server is down:
			// in Tb2, an exception is thrown when m_xhr.status is referenced
			// in Tb3, m_xhr.status is set to zero
			//
			http.m_http_status_code = http.m_xhr.status;

			if (false && this.state.cCallsToHttp == 2) // pretend that we got a 404 for testing
				http.m_http_status_code = 404;

			is_failed = (http.m_http_status_code == 0);
		}
		catch(e) {
			is_failed = true;
			msg += " http.m_xhr.status threw an exception: " + e;
		}

		if (is_failed)
			http.m_http_status_code = HTTP_STATUS_ON_SERVICE_FAILURE;
			
		msg += " http status: " + http.m_http_status_code;

		nextEvent = 'evNext';
	}

	zinAssert(http.m_http_status_code != null); // status should always be set to something when we leave here

	self.state.m_logger.debug(msg);

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionHttpResponse = function(state, event, continuation)
{
	var http = this.state.m_http;

	zinAssertAndLog(http.isPostResponse(), function () { return http.toString(); });

	if (http.m_restore_exit_function) // if setupHttpZm zapped the exit method of the state that called it, restore it...
		this.fsm.m_a_exit[http.m_restore_exit_state] = http.m_restore_exit_function;

	var nextEvent = http.handleResponse();

	continuation(nextEvent); // the state that this corresponds to in the transitions table was set by setupHttpCommon()
}

SyncFsm.prototype.exitActionHttpResponse = function(state, event)
{
	// this method's entry in the m_a_exit table may be overwritten by setupHttp
	// otherwise, do nothing...
}

function HttpState(http_method, url, http_headers, logger)
{
	this.m_xhr                   = null;  // the XMLHttpRequest object
	this.m_url                   = url;   // the url used in the HTTP request
	this.m_http_status_code      = null;
	this.m_http_method           = http_method;  // Zm: POST, Gd: GET, POST etc
	this.m_http_headers          = http_headers;

	this.m_logger                = logger;

	this.m_restore_exit_function = null;  // the exit action to be restored
	this.m_restore_exit_state    = null;  // the state that the restored exit action belongs to
	this.is_cancelled            = false;

	zinAssert(this.isPreResponse());
	zinAssert(!this.isPostResponse());
	zinAssert(!this.is_cancelled);
}

HttpState.prototype.isFailed = function()
{
	return this.isPostResponse() && (!this.is_http_status(HTTP_STATUS_2xx));
}

HttpState.prototype.isPostResponse = function()
{
	return (this.m_http_status_code != null);
}

// pre-request would be m_xhr == null
//
HttpState.prototype.isPreResponse = function()
{
	return (this.response() == null) && (this.m_http_status_code == null);
}

HttpState.prototype.is_http_status = function(arg)
{
	zinAssert(arguments.length == 1);
	var ret;

	if (typeof(arg) == 'number')
		ret = this.m_http_status_code == arg;
	else if (typeof(arg) == 'object' && arg instanceof Array && arg.length == 2)
		ret = this.m_http_status_code >= arg[0] && this.m_http_status_code <= arg[1];
	else
		zinAssertAndLog(false, arg);

	return ret;
}

HttpState.prototype.response = function(style)
{
	var ret;

	if (arguments.length == 0)
		style = 'xml';

	if (!this.m_xhr)
		ret = null;
	else if (style == 'xml')
		ret = this.m_xhr.responseXML;
	else if (style == 'text')
		ret = this.m_xhr.responseText;
	else
		zinAssertAndLog(false, "style: " + style);

	return ret;
}

HttpState.prototype.toString = function()
{
	var ret = "\n xhr          = "        + (this.m_xhr ? this.m_xhr.readyState : "null") +
	          "\n cancelled    = "        + this.is_cancelled +
	          "\n http status code = "    + this.m_http_status_code +
	          "\n response = "            + (this.response() ? this.m_xhr.responseText : "null");

	return ret;
}

HttpState.prototype.toHtml = function()
{
	return this.toString().replace(/\n/g, "<html:br>");
}

HttpState.prototype.toStringFiltered = null; // abstract method 
HttpState.prototype.httpBody         = null; // abstract method 

function HttpStateZm(url, logger)
{
	HttpState.call(this, "POST", url, null, logger);

	this.m_zsd                   = new ZmSoapDocument();
	this.m_method                = null;  // the prefix of the soap method, eg: "Auth" or "GetContacts"

	this.m_faultcode             = null;  // These are derived from the soap fault element
	this.m_fault_element_xml     = null;  // the soap:Fault element as string xml
	this.m_fault_detail          = null;
	this.m_faultstring           = null;
	this.is_mismatched_response  = false;
}

HttpStateZm.prototype = new HttpState();

HttpStateZm.prototype.failCode = function()
{
	var ret;

	// don't come in here unless we've failed...
	zinAssertAndLog(this.m_xhr && this.isFailed(), function () { return "HttpState: " + this.toString();});

	if (this.is_cancelled)                         ret = 'failon.cancel';
	else if (this.is_mismatched_response)          ret = 'failon.mismatched.response';
	else if (this.m_fault_element_xml != null)     ret = 'failon.fault';
	else if (this.is_http_status(HTTP_STATUS_4xx) ||
	         this.is_http_status(HTTP_STATUS_5xx) ||
	         this.is_http_status(HTTP_STATUS_ON_SERVICE_FAILURE))
	                                               ret = 'failon.service';
	else                                           ret = 'failon.unexpected';  // this really is unknown

	if (ret == 'failon.unexpected')
		this.m_logger.debug("failCode: " + ret + " and this: " + this.toString());

	return ret;
}

HttpStateZm.prototype.faultLoadFromXml = function()
{
	var nodelist;
	var doc = this.response();

	this.m_fault_element_xml = xmlDocumentToString(doc);

	conditionalGetElementByTagNameNS(doc, Xpath.NS_SOAP_ENVELOPE, "faultstring", this, 'm_faultstring');
	conditionalGetElementByTagNameNS(doc, Xpath.NS_ZIMBRA,        "Trace",       this, 'm_fault_detail');
	conditionalGetElementByTagNameNS(doc, Xpath.NS_ZIMBRA,        "Code",        this, 'm_faultcode');
}

HttpStateZm.prototype.toString = function()
{
	var ret = HttpState.prototype.toString.apply(this);

	ret += "\n mismatched_response = " + this.is_mismatched_response +
	       "\n fault code = "          + this.m_faultcode +
	       "\n fault string = "        + this.m_faultstring +
	       "\n fault detail = "        + this.m_fault_detail +
	       "\n fault elementxml = "    + this.m_fault_element_xml;

	return ret;
}

HttpStateZm.prototype.httpBody = function()
{
	return this.m_zsd.doc;
}

HttpStateZm.prototype.toStringFiltered = function()
{
	return this.m_zsd.toStringFiltered();
}

HttpStateZm.prototype.handleResponse = function()
{
	var msg      = "HttpStateZm:";
	var response = this.response();
	var nextEvent;

	if (response)
		msg += " response: " + xmlDocumentToString(response);
	else
		msg += " response: " + "empty";

	if (response)
	{
		var nodelist = response.getElementsByTagNameNS(Xpath.NS_SOAP_ENVELOPE, "Fault");

		if (nodelist.length > 0)
			this.faultLoadFromXml();
	}

	// For "CheckLicense", the fault varies depending on open-source vs non-open-source server:
	//                           this.m_faultcode == "service.UNKNOWN_DOCUMENT" or <soap:faultcode>soap:Client</soap:faultcode>
	// For "FakeHead", we expect this.m_faultcode == "service.UNKNOWN_DOCUMENT" or no response at all if the url was dodgy
	//

	if (this.is_cancelled)
		nextEvent = 'evCancel';
	else if (this.m_method == "CheckLicense" && this.m_fault_element_xml)
		nextEvent = 'evNext';
	else if (this.m_method == "FakeHead")
		nextEvent = 'evNext';
	else if (response && !this.m_fault_element_xml)
	{
		var method = (this.m_method in ZmSoapDocument.complexMethod) ? "Batch" : this.m_method;
		var node = Xpath.getOneNode(Xpath.queryFromMethod(method), response, response);

		if (node)
			nextEvent = 'evNext'; // we found a BlahResponse element - all is well
		else
		{
			// an example: sometimes a Zimbra soap server will return this:
			// <parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml">XML Parsing Error: mismatched tag.
			//  Expected: &lt;/META&gt;.
			// Location: https://zimbra.home.example.com/service/soap/
			// Line Number 5, Column 3:<sourcetext>&lt;/HEAD&gt;&lt;BODY&gt; --^</sourcetext></parsererror>

			nextEvent = 'evCancel';
			this.is_mismatched_response = true;
			msg += " - soap response isn't a fault and doesn't match our request - about to cancel";
		}
	}
	else 
	{
		msg += "\n SOAP error: method: " + this.m_method;  // note that we didn't say "fault" here - could be a sending/service error

		if (this.m_http_status_code != null && this.m_http_status_code != HTTP_STATUS_200_OK)
			msg += " m_http_status_code == " + this.m_http_status_code;

		if (this.m_fault_element_xml)
			msg += " fault fields as shown: " + this.toString();

		nextEvent = 'evCancel';
	}

	this.m_logger.debug(msg);

	return nextEvent;
}

HttpStateZm.prototype.isFailed = function()
{
	let ret = HttpState.prototype.isFailed.call(this);

	if (!ret)
		ret = this.is_mismatched_response || this.m_fault_element_xml;

	return ret;
}

function HttpStateGd(http_method, url, headers, authToken, body, on_error, log_response, logger)
{
	zinAssert(on_error == HttpStateGd.ON_ERROR_EVNEXT || on_error == HttpStateGd.ON_ERROR_EVCANCEL);

	var a_default_headers = { 'Accept':          null,
	                          'Accept-Language': null,
							  'Accept-Encoding': null,
							  'Accept-Charset':  null,
							  'User-Agent':      null,
							  'GData-Version':   String(GD_API_VERSION).substr(0,1)
							  };
	var http_headers = new Object();
	var key;

	for (key in a_default_headers)
		http_headers[key] = a_default_headers[key];

	if (headers)
		for (key in headers)
			http_headers[key] = headers[key];

	if (authToken)
		http_headers["Authorization"] = "GoogleLogin auth=" + authToken;

	HttpState.call(this, http_method, url, http_headers, logger);

	this.m_body         = body;
	this.m_on_error     = on_error;
	this.m_log_response = log_response;
}

HttpStateGd.prototype = new HttpState();

HttpStateGd.ON_ERROR_EVNEXT     = 1;
HttpStateGd.ON_ERROR_EVCANCEL   = 2;
HttpStateGd.LOG_RESPONSE_YES    = 3;
HttpStateGd.LOG_RESPONSE_NO     = 4;
HttpStateGd.AUTH_REGEXP_PATTERN = /Auth=(.+?)(\s|$)/;

HttpStateGd.prototype.toStringFiltered = function()
{
	let str = (this.m_url != eGoogleLoginUrl.kClientLogin && this.m_url != eGoogleLoginUrl.kAuthToken ) ? this.httpBody() : "";

	str = str.replace(/login=.*password.*$/,   "login-and-password-suppressed");

	return this.m_http_method + " " + this.m_url + " " + str;
}

HttpStateGd.prototype.httpBody = function()
{
	return this.m_body == null ? "" : this.m_body;
}

HttpStateGd.prototype.failCode = function()
{
	var ret;

	// don't come in here unless we've failed...
	zinAssertAndLog(this.m_xhr && this.isFailed(), function () { return "HttpState: " + this.toString();});

	if (this.is_cancelled)                                         ret = 'failon.cancel';
	else if (this.is_http_status(HTTP_STATUS_401_UNAUTHORIZED))    ret = 'failon.unauthorized';
	else if (this.is_http_status(HTTP_STATUS_5xx) ||
	         this.is_http_status(HTTP_STATUS_ON_SERVICE_FAILURE))  ret = 'failon.service';
	else                                                           ret = 'failon.unexpected';  // this really is unknown

	if (ret == 'failon.unexpected')
		this.m_logger.debug("failCode: " + ret + " and HttpStateGd: " + this.toString());

	return ret;
}

HttpStateGd.prototype.handleResponse = function()
{
	var nextEvent;
	var msg = "";

	if (this.m_log_response == HttpStateGd.LOG_RESPONSE_NO)
		msg += " response: supressed";
	else if (this.response('text'))
		msg += " response: " + this.filterOut(this.response('text'));
	else
		msg += " response: " + "empty";

	if (this.is_cancelled)
		nextEvent = 'evCancel';
	else if (this.is_http_status(HTTP_STATUS_2xx))
		nextEvent = 'evNext';
	else if (this.m_on_error == HttpStateGd.ON_ERROR_EVNEXT)
		nextEvent = 'evNext';
	else
		nextEvent = 'evCancel';

	this.m_logger.debug("HttpStateGd: nextEvent: " + nextEvent + " http status: " + this.m_http_status_code + " " + msg);

	return nextEvent;
}

HttpStateGd.prototype.filterOut = function(str)
{
	str = str.replace(HttpStateGd.AUTH_REGEXP_PATTERN, "Auth=suppressed");

	return str;
}

SyncFsm.prototype.initialise = function(id_fsm, is_attended, sfcd)
{
	var account  = sfcd.account();
	var sourceid = account.sourceid;

	this.initialiseState(id_fsm, is_attended, sourceid, sfcd);
	this.initialiseFsm();

	if (id_fsm == Maestro.FSM_ID_ZM_AUTHONLY)
	{
		this.fsm.m_transitions['stAuthLogin']['evNext'] = 'final';
		this.fsm.m_transitions['stAuthCheck']['evNext'] = 'final';
	}

	this.state.sources[sourceid]['account'] = cloneObject(account);

	var msg = "initialise: sourceid: " + sourceid + " soapURL: "  + this.account().url +
	                                                " username: " + this.account().username;

	if (this.formatPr() == FORMAT_ZM)
	{
		if (this.account().url)
			this.account().url = SyncFsm.zimbraSoapUrl(this.account().url);
		else
			; // if extension is installed but not configured, we end up in here with no preferences set - stAuth will report url is invalid

		if (this.account().url && this.account().username && is_url_free_fr(this.account().url)) {
			this.account().username = this.account().username.replace(/(@.*)$/, ""); // remove anything to the RHS of '@'
		}
	}
	else // this.formatPr() == FORMAT_GD
	{
		var prefset = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_GD_PROPERTIES);
		prefset.load();

		this.state.gd_is_sync_postal_address = (prefset.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS) == "true");

		msg += " gd_is_sync_postal_address: " + this.state.gd_is_sync_postal_address;
	}

	this.debug(msg);

	// once we know whether gd_is_sync_postal_address is going to be set, we then know which contact_converter we're using
	// so then we can give the addressbook a reference to it.
	//
	this.state.m_addressbook.contact_converter(this.contact_converter());
}

SyncFsm.zimbraSoapUrl = function(url) 
{
	url = url.replace(/^(https?:\/\/.+?\/).*$/, "$1"); // if the user provided http;//zimbra.example.com/blah ... strip off "blah"

	let ret = str_with_trailing(url, '/') + "service/soap/";

	// logger().debug("zimbraSoapUrl: returns: " + ret);

	return ret;
}

function FsmState()
{
}

FsmState.prototype.initialiseSource = function(sourceid, format)
{
	this.sources[sourceid]   = newObject('format', format, 'zfcLuid', null);
	this.aChecksum[sourceid] = new Object();
}

SyncFsm.prototype.initialiseState = function(id_fsm, is_attended, sourceid, sfcd)
{
	this.state = new FsmState();

	var state = this.state;

	state.id_fsm              = id_fsm;
	state.sourceid_pr         = sourceid;
	state.m_sfcd              = sfcd;
	state.m_logappender       = new LogAppenderHoldOpen(); // holds an output stream open - must be closed explicitly
	state.m_logger            = new Logger(singleton().logger().level(), "SyncFsm", state.m_logappender);
	state.m_debug_filter_out  = new RegExp('https?' + GOOGLE_URL_HIER_PART + 'contacts|groups/' + '.*?' + '(base|thin)/' , "mg");
	state.m_generator         = null;
	state.m_http              = null;
	state.cCallsToHttp        = 0;                       // handy for debugging the closure passed to soapCall.asyncInvoke()
	state.zfcLastSync         = null;                    // FeedCollection - maintains state re: last sync (anchors, success/fail)
	state.zfcGid              = null;                    // FeedCollection - map of gid to (sourceid, luid)
	state.zfcPreUpdateWinners = new FeedCollection();    // has the winning zfi's before they're updated to reflect their win (LS unchanged)
	state.zfcTbPreMerge       = null;                    // the thunderbird map before merging tb addressbook - used to test invariance
	state.stopwatch           = new StopWatch("SyncFsm");
	state.authToken           = null;
	state.aReverseGid         = new Object(); // reverse lookups for the gid, ie given (sourceid, luid) find the gid.
	state.aGcs                = null;         // array of Global Converged State - passed between the phases of Converge
	state.aHasChecksum        = new Object(); // used in slow sync: aHasChecksum[key][luid]   = true;
	state.aChecksum           = new Object(); // used in slow sync: aChecksum[sourceid][luid] = checksum;
	state.aSuo                = null;         // container for source update operations - populated in Converge
	state.m_suo_iterator      = null;         // iterator  for aSuo
	state.m_suo_generator     = null;         // generator for aSuo
	state.m_suo_last_in_bucket = null;        // key is bucket, value is the last SuoKey encountered when interating through the bucket
	state.aConflicts          = new Array();  // an array of strings - each one reports on a conflict
	state.stopFailCode        = null;         // if a state continues on evLackIntegrity, this is set for the observer
	state.stopFailTrailer     = null;
	state.stopFailArg         = null;
	state.m_bimap_format      = getBimapFormat('short');
	state.m_tb_card_count     = 0;
	state.m_progress_count    = 0;
	state.m_progress_yield_text = null;
	state.m_is_attended       = is_attended;

	state.a_folders_deleted        = null;    // an associative array: key is gid of folder being deleted, value is an array of contact gids
	state.remote_update_package    = null;    // maintains state between an server update request and the response
	state.m_a_remote_update_package= new Array();
	state.foreach_tb_card_functor  = null;
	state.m_folder_converter       = new FolderConverter();
	state.m_addressbook            = AddressBook.new();

	let style = sfcd.account().is_share_service() ? ContactConverter.eStyle.kZmMapsAllTbProperties : ContactConverter.eStyle.kBasic;
	state.m_contact_converter_style_basic = new ContactConverter();
	state.m_contact_converter_style_basic.setup(style);

	state.sources = new Object();

	state.initialiseSource(SOURCEID_TB, FORMAT_TB);

	state.sourceid_tb = SOURCEID_TB;
}

SyncFsmZm.prototype.initialiseState = function(id_fsm, is_attended, sourceid, sfcd)
{
	SyncFsm.prototype.initialiseState.call(this, id_fsm, is_attended, sourceid, sfcd);

	var state = this.state;

	state.zidbag                 = new ZidBag();
	state.suggestedSoapURL       = null;         // a <soapURL> response returned in GetAccountInfo
	state.a_zm_tested_soapurls   = new Array();  // soapURLs that have been tested with FakeHead - saved to lastsync.txt
	state.preauthURL             = null;
	state.preauthBody            = null;
	state.aSyncGalContact        = null;         // SyncGal
	state.mapIdSyncGalContact    = null;      
	state.SyncGalTokenInRequest  = null;
	state.SyncGalTokenInResponse = null;
	state.SyncMd                 = null;         // this gives us the time on the server
	state.SyncTokenInRequest     = null;         // the 'token' given to    <SyncRequest>
	state.isAnyChangeToFolders   = false;
	state.zimbraId               = null;         // the zimbraId for the Auth username - returned by GetAccountInfoRespose
	state.zimbraVersion          = null;         // the <version> element from GetInfoResponse
	state.aContact               = new Array();  // array of contact (zid, id) - push in SyncResponse, shift in GetContactResponse
	state.isRedoSyncRequest      = false;        // we may need to do <SyncRequest> again - the second time without a token
	state.aSyncContact           = new Object(); // each property is a ZmContact object returned in GetContactResponse
	state.is_done_get_contacts_pu = false;       // have we worked out the contacts to get from the server pre update?

	state.initialiseSource(sourceid, FORMAT_ZM);
}

SyncFsmGd.prototype.initialiseState = function(id_fsm, is_attended, sourceid, sfcd)
{
	SyncFsm.prototype.initialiseState.call(this, id_fsm, is_attended, sourceid, sfcd);

	var state = this.state;

	state.a_gd_contact                  = new Object();
	state.a_gd_group                    = new Object();
	state.a_gd_to_get                   = new Object(GoogleData.eElement.contact, null, GoogleData.eElement.group, null);;
	state.a_gd_contact_dexmlify_ids     = null;         // set to a Array() when it's in use
	state.m_gd_contact_length           = 0;
	state.gd_url_next                   = null;
	state.gd_is_dexmlify_postal_address = false;
	state.gd_sync_token                 = null;
	state.gd_updated_group              = null;
	state.gd_cc_meta                    = new ContactCollectionMeta();
	state.gd_au_group_for_add           = new Object(); // set by suoGdTweakCiOps, used by entryAction ADD code
	state.gd_au_group_for_mod           = new Object(); // set by suoGdTweakCiOps, used by entryAction MOD code
	state.a_gd_luid_ab_in_tb            = null;         // luids of the addressbooks in zfcTb that are syncing with Google
	state.gd_is_sync_postal_address     = null;         // true/false
	state.gd_is_use_cached_authtoken    = false;        // true/false
	state.gd_scheme_data_transfer       = this.getCharPref(MozillaPreferences.GD_SCHEME_DATA_TRANSFER);
	state.a_gd_contacts_deleted         = new Object();

	// this contact_converter is used when we're syncing postalAddress with Google, but the _style_basic version is still called
	// from the slow sync checksum code because we don't want to include Google postalAddress in the checksum/isTwin comparison
	//
	state.m_contact_converter_style_gd_postal = new ContactConverter();
	state.m_contact_converter_style_gd_postal.setup(ContactConverter.eStyle.kGdMapsPostalProperties);

	state.initialiseSource(sourceid, FORMAT_GD);
}

SyncFsmGd.prototype.entryActionAuth = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	var sourceid_pr = this.state.sourceid_pr;

	var url      = this.account().url;
	var username = this.account().username;
	var password = this.account().passwordlocator.getPassword();

	var a_reason = new Object();

	a_reason['url'] = Boolean(url);

	if (!isAnyValue(a_reason, false)) a_reason['username_length'] = (username.length > 0);
	if (!isAnyValue(a_reason, false)) a_reason['valid_username']  = Boolean(re_valid_email.test(username));
	if (!isAnyValue(a_reason, false)) a_reason['password']        = Boolean(password);
	if (!isAnyValue(a_reason, false)) a_reason['password_length'] = (password.length > 0);

	if (!isAnyValue(a_reason, false))
	{
		var headers = newObject("Content-type", "application/x-www-form-urlencoded");
		var body = "";
		body += "accountType=HOSTED_OR_GOOGLE"; // GOOGLE
		body += "&Email=" + encodeURIComponent(username);
		body += "&Passwd=" + encodeURIComponent(password);
		body += "&service=cp"; // gbase
		body += "&source=Toolware" + "-" + APP_NAME + "-" + APP_VERSION_NUMBER;

		this.setupHttpGd(state, 'evNext', "POST", url, headers, body, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

		nextEvent = 'evHttpRequest';
	}
	else
	{
		this.debug("a_reason: " + aToString(a_reason));

		this.state.stopFailCode = 'failon.integrity.gd.bad.credentials';
		nextEvent = 'evLackIntegrity';
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionAuth = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response('text') || event == "evCancel")
		return;

	var response = this.state.m_http.response('text');
	var aMatch   = response.match(HttpStateGd.AUTH_REGEXP_PATTERN); // a[0] is the whole pattern, a[1] is the first capture, a[2] the second

	if (aMatch && aMatch.length == 3)
	{
		this.state.authToken = aMatch[1];

		var passwordlocator = new PasswordLocator(this.account().passwordlocator);
		passwordlocator.url(eGoogleLoginUrl.kAuthToken);
		passwordlocator.username(this.account().username);

		passwordlocator.setPassword(this.state.authToken);

		this.debug("authentication: exitActionAuth caches an authToken for: " + passwordlocator.username());
	}

	this.state.m_logger.debug("authToken.length: " + (this.state.authToken ? this.state.authToken.length : "null") );
}

SyncFsm.prototype.entryActionAuthCheck = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	this.state.stopwatch.mark(state);

	if (!this.state.authToken)
	{
		this.state.stopFailCode   = 'failon.auth';
		this.state.stopFailArg  = [ AppInfo.app_name(AppInfo.firstcap) ];
		this.state.stopFailTrailer = stringBundleString("text.http.status.code", [ this.state.m_http.m_http_status_code ]);

		nextEvent = 'evLackIntegrity';  // this isn't really a lack of integrity, but it's processed in the same way
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.entryActionGetGroupsGd1 = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	let url = this.gd_url_base(GoogleData.eElement.group) + "?max-results=10000";
	
	if (!this.is_slow_sync())
		url += "&showdeleted=true";
	
	let gd_updated_group = this.state.zfcLastSync.get(this.state.sourceid_pr).getOrNull('gd_updated_group');

	if (gd_updated_group)
		url += "&updated-min=" + gd_updated_group;

	this.setupHttpGd(state, 'evNext', "GET", url, null, null, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

	continuation('evHttpRequest');
}

SyncFsmGd.prototype.entryActionGetGroupsGd2 = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	if (!this.state.m_http || !this.state.m_http.response('text'))
		nextEvent = 'evCancel';
	else if (this.state.m_http.is_http_status(HTTP_STATUS_401_UNAUTHORIZED)) {
		this.state.stopFailCode = 'failon.unauthorized';
		nextEvent = 'evLackIntegrity';
		if (this.state.gd_is_use_cached_authtoken) {
			this.state.m_sfcd.sourceid(this.state.sourceid_pr, 'is_gd_token_invalid', true);
			this.gd_remove_cached_auth_token(state);
		}
	}
	else if (this.state.m_http.is_http_status(HTTP_STATUS_403_FORBIDDEN)) {
		this.state.stopFailCode = 'failon.gd.forbidden';
		nextEvent = 'evLackIntegrity';
		this.gd_remove_cached_auth_token(state);
	}
	else if (!this.state.m_http.is_http_status(HTTP_STATUS_2xx)) {
		this.state.stopFailCode = 'failon.gd.get';
		nextEvent = 'evLackIntegrity';
	}
	else {
		let response = this.state.m_http.response();

		let warn_msg = "<updated> element is missing from <feed>!";
		Xpath.setConditionalFromSingleElement(this.state, 'gd_updated_group', "//atom:feed/atom:updated", response, warn_msg);
		this.debug("entryActionGetGroupsGd2: gd_updated_group: " + this.state.gd_updated_group);

		GoogleData.new_from_feed(this.state.m_http.m_xhr, this.state.a_gd_group);

		let self        = this;
		let zfcPr       = this.zfcPr();
		let is_gr_as_ab = (self.account().gd_gr_as_ab == 'true');

		var functor = {
			run: function(group)
			{
				let id  = group.meta.id;
				let rev = group.meta.updated;
				let msg = "";
				let is_noprefix, is_ignored, is_xgid, zfi;

				if (is_gr_as_ab) {
					is_noprefix = !group.systemGroup() && !re_gd_group.test(group.properties.title);
					is_ignored  = group.meta.deleted || is_noprefix;
					is_xgid     = false; // not relevant

					if (group.systemGroup()) {
						is_ignored  = is_ignored || !ContactGoogleStatic.systemGroups(self.account()).isPresent(group.systemGroup());
					}
				}
				else {
					is_noprefix = false; // not relevant
					is_ignored  = (group.systemGroup() != ContactGoogle.eSystemGroup.Contacts);
					is_xgid     = true;
				}

				msg += "id=" + id;
	
				if (!group.meta.deleted) {
					msg += " group: ";

					if (is_noprefix)
						msg += " doesn't have a zindus prefix: ";

					if (is_xgid)
						msg += " will be excluded from gid: ";

					msg += group.toString();
				}
				else
					msg += " group: deleted";

				if (zfcPr.isPresent(id)) {
					zinAssertAndLog(!group.systemGroup(), function () { return group.toString(); });

					zfi = zfcPr.get(id);

					zfi.set(FeedItem.ATTR_REV,  rev);
					zfi.set(FeedItem.ATTR_NAME, group.properties.title);
					zfi.set(FeedItem.ATTR_EDIT, group.meta.edit);
					zfi.set(FeedItem.ATTR_SELF, group.meta.self);
					zfi.set(FeedItem.ATTR_GGID, group.meta.id_as_url);

					msg += " updated: ";

					if (is_ignored) {
						zfi.set(FeedItem.ATTR_DEL, '1');
						msg += " marked as deleted";
					}
				}
				else if (!is_ignored) {
					zfi = self.newZfiGroup(group);

					if (group.systemGroup() && is_xgid)
						zfi.set(FeedItem.ATTR_XGID, '1');
					
					zfcPr.set(zfi);
					msg += " added: ";
				}
				else
					msg += " ignored: ";

				if (zfi)
					msg += " zfi: " + zfi.toString();

				self.debug(msg);

				return;
			}
		};

		for (var id in this.state.a_gd_group)
			functor.run(this.state.a_gd_group[id]);

		if (this.is_slow_sync()) {
			function set_zfi_for_fake_folder(name) {
				let type = (name == GD_PAB) ? FeedItem.TYPE_FL : FeedItem.TYPE_GG;

				let key = zfcPr.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

				let zfi = new FeedItem(type, FeedItem.ATTR_KEY,  key,
				                             FeedItem.ATTR_L,    1,
				                             FeedItem.ATTR_NAME, name,
				                             FeedItem.ATTR_MS,   1);

				if (name == ContactGoogle.eSystemGroup.Suggested)
					zfi.set(FeedItem.ATTR_GGSG, '1');

				zfcPr.set(zfi);
			}

			set_zfi_for_fake_folder(GD_PAB);

			if (self.account().gd_gr_as_ab == 'true')
				set_zfi_for_fake_folder(ContactGoogle.eSystemGroup.Suggested);
		}

		functor = {
			run: function(zfi) {
				if (zfi.type() == FeedItem.TYPE_FL || zfi.type() == FeedItem.TYPE_GG)
					self.state.gd_cc_meta.push(newObject('luid_gd', zfi.key(), 'name', zfi.get(FeedItem.ATTR_NAME)));
			return true;
			}
		};

		zfcPr.forEach(functor);

		// TODO remove me after release 0.8.15
		//
		let zfiStatus    = StatusBarState.toZfi();
		let data_version = zfiStatus ? zfiStatus.getOrNull('appversion') : "";

		if ((self.account().gd_gr_as_ab == 'true') && this.is_slow_sync() && data_version.match(/0\.8\.14\.20/)) {
			let re = new RegExp("^" + APP_NAME);
			let msg = "";
			functor = {
				run: function(zfi) {
					if ((zfi.type() == FeedItem.TYPE_GG) && zfi.name().match(re))
						msg += "\n" + zfi.name();
				return true;
				}
			};

			zfcPr.forEach(functor);

			if (msg.length > 0) {
				logger().debug("AMHEREX: msg: " + msg);
				this.state.stopFailCode = 'failon.z.google.groups';
				this.state.stopFailArg  = [ AppInfo.app_name(AppInfo.firstcap), msg ];
				nextEvent = 'evLackIntegrity';
			}
		}

		this.debug("gd_cc_meta: " + aToString(this.state.gd_cc_meta));
		this.debug("My Contacts group id: " + this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Contacts, 'luid_gd'));
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.gd_url_base = function(type)
{
	zinAssertAndLog(GoogleData.eElement.isPresent(type), type);

	return this.getCharPref(MozillaPreferences.GD_SCHEME_DATA_TRANSFER) + GOOGLE_URL_HIER_PART +
		             (type == GoogleData.eElement.contact ? 'contacts' : 'groups') +
		             '/' + encodeURIComponent(this.account().username) + GOOGLE_PROJECTION;
}

SyncFsmGd.prototype.entryActionGetContactGd1 = function(state, event, continuation)
{
	var url;

	if (this.state.gd_url_next)
		url = this.state.gd_url_next;
	else
	{
		let gd_contacts_per_request = preference(MozillaPreferences.GD_CONTACTS_PER_REQUEST, 'int');

		url = this.gd_url_base(GoogleData.eElement.contact) + "?max-results=" + gd_contacts_per_request;

		if (!this.is_slow_sync())
			url += "&showdeleted=true";

		let SyncToken = this.state.zfcLastSync.get(this.state.sourceid_pr).getOrNull('SyncToken');

		if (SyncToken)
			url += "&updated-min=" + SyncToken;
	}

	this.state.stopwatch.mark(state);

	this.state.m_logger.debug("entryActionGetContactGd1: url: " + url);

	this.setupHttpGd(state, 'evNext', "GET", url, null, null, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

	continuation('evHttpRequest');
}

SyncFsmGd.prototype.gd_remove_cached_auth_token = function(state)
{
	var passwordlocator = new PasswordLocator(this.account().passwordlocator);
	passwordlocator.url(eGoogleLoginUrl.kAuthToken);

	passwordlocator.delPassword();

	this.debug("authentication: " + state + " removes the cached authToken for: " + passwordlocator.username());
}

SyncFsmGd.prototype.entryActionGetContactGd2 = function(state, event, continuation)
{
	var nextEvent;

	if (!this.state.m_http || !this.state.m_http.response('text'))
		nextEvent = 'evCancel';
	else if (this.state.m_http.is_http_status(HTTP_STATUS_401_UNAUTHORIZED)) {
		this.state.stopFailCode = 'failon.unauthorized';
		nextEvent = 'evLackIntegrity';
		this.gd_remove_cached_auth_token(state);
	}
	else if (this.state.m_http.is_http_status(HTTP_STATUS_403_FORBIDDEN)) {
		this.state.stopFailCode = 'failon.gd.forbidden';
		nextEvent = 'evLackIntegrity';
		this.gd_remove_cached_auth_token(state);
	}
	else if (this.state.m_http.is_http_status(HTTP_STATUS_2xx)) {
		let response = this.state.m_http.response();
		let i;

		let warn_msg = "<updated> element is missing from <feed>!";
		Xpath.setConditionalFromSingleElement(this.state, 'gd_sync_token', "//atom:feed/atom:updated", response, warn_msg);
		this.debug("entryActionGetContactGd2: gd_sync_token: " + this.state.gd_sync_token);

		this.state.gd_url_next = null;
		Xpath.setConditional(this.state, 'gd_url_next', "//atom:feed/atom:link[@rel='next']/attribute::href", response, null);
		this.debug("entryActionGetContactGd2: next url: " + this.state.gd_url_next);

		GoogleData.new_from_feed(this.state.m_http.m_xhr, this.state.a_gd_contact, this.google_contact_mode());

		if (this.state.gd_url_next)
			nextEvent = 'evRepeat';
		else
		{
			nextEvent = 'evNext';

			// get the total number of contacts to support the progress observer
			// In the event that the contacts don't all fit in one <feed>, the <totalResults> element within each of the response
			// is the same - ie it gives the grand total, not the per-request total.
			//
			warn_msg = "<openSearch> element is missing from <feed>!";
			let xpath_query = "//atom:feed/openSearch:totalResults";
			Xpath.setConditionalFromSingleElement(this.state, 'm_gd_contact_length', xpath_query, response, warn_msg);

			this.debug("entryActionGetContactGd2: openSearch.totalResults: " + this.state.m_gd_contact_length);

			this.state.m_gd_contact_count = 0;
		}
	}
	else
		nextEvent = 'evCancel';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGetContactGd3 = function(state, event, continuation)
{
	this.state.gd_is_dexmlify_postal_address = this.is_slow_sync() && !this.state.gd_is_sync_postal_address;

	var nextEvent = this.runEntryActionGenerator(state, event, this.entryActionGetContactGd3Generator);

	if (nextEvent != 'evRepeat')
		nextEvent = this.state.gd_is_dexmlify_postal_address ? 'evNext' : 'evSkip';

	continuation(nextEvent);
}

SyncFsmGd.prototype.entryActionGetContactGd3Generator = function(state)
{
	var self        = this;
	var zfcPr       = this.zfcPr();
	var a_contact_count     = newObject('regular', 0, 'empty', 0, 'deleted', 0, 'suggested', 0);
	var a_deleted_suggested = {};
	var i, j, generator;

	this.state.stopwatch.mark(state + " enters");

	// Notes:
	// - suggested contacts are in the luid map on a slow sync so that they can be twinned with their tb contacts
	//   to allow the tb contact to be backated and removed.  The FeedItem is removed during UpdateCleanup.
	//
	var functor = {
		run: function(contact)
		{
			let id           = contact.meta.id;
			let is_ignored   = contact.meta.deleted || contact.is_empty();
			let zfi          = null;
			let msg = "";

			self.state.a_gd_contact[id] = contact;
			self.state.m_gd_contact_count++;       // count the contacts processed in total

			if (contact.meta.deleted)              // count the contacts by breakdown to match against gmail UI
				a_contact_count['deleted']++;
			else if (contact.is_empty())
				a_contact_count['empty']++;
			else
				a_contact_count['regular']++;

			msg += "id=" + id + " contact: ";

			if (false && (self.account().gd_gr_as_ab == 'true') && ContactGoogleStatic.is_google_apps(self.account())) {
				// decided that this isn't nec - we cope with contacts being members of groups we don't sync with (ie w/o zindus/ prefix)
				//
				let a_groups = [];
				let excluded_group_msg = "";
				let i;
				for (i = 0; i < contact.groups.length; i++)
					if (!zfcPr.isPresent(contact.groups[i]))
						excluded_group_msg = " " + contact.groups[i];
					else
						a_groups.push(contact.groups[i])

				if (excluded_group_msg.length > 0) {
					msg += " google apps account - ignoring membership in system groups: " + excluded_group_msg;
					contact.groups = a_groups;
				}
			}
	
			if (!is_ignored)               msg += contact.toString();
			else if (contact.meta.deleted) msg += " deleted";
			else if (contact.is_empty())   msg += " empty";
			else zinAssertAndLog(false, function() { return contact.toString(); });

			if (zfcPr.isPresent(id)) {
				zfi = zfcPr.get(id);

				zfi.set(FeedItem.ATTR_REV,  contact.meta.updated);
				zfi.set(FeedItem.ATTR_EDIT, contact.meta.edit);
				zfi.set(FeedItem.ATTR_SELF, contact.meta.self);
				zfi.set(FeedItem.ATTR_GDGP, contact.groups.toString());

				msg += " updated: ";

				if (is_ignored) {
					zfi.set(FeedItem.ATTR_DEL, '1');

					msg += " marked as deleted";
				}
			}
			else if (!is_ignored) {
				zfi = self.newZfiCnGdAu(id, contact.meta.updated, contact.meta.edit, contact.meta.self, contact.groups);
				zfcPr.set(zfi); // add new
				msg += " added: ";
			}
			else
				msg += " ignored ";

			if (zfi)
				msg += " zfi: " + zfi.toString();

			self.debug(msg);

			return;
		}
	};

	this.state.m_progress_yield_text = "parsing-google-xml";

	let id;
	let count = 0;

	for (id in this.state.a_gd_contact)
	{
		functor.run(this.state.a_gd_contact[id]);

		if (++count % chunk_size('feed') == 0)
			yield true;
	}

	this.state.stopwatch.mark(state + " finished parsing a_gd_contact");

	this.debug("entryActionGetContactGd3: contacts processed: " +
		" regular: " + a_contact_count['regular'] +
		" empty: "   + a_contact_count['empty'] +
		" deleted: " + a_contact_count['deleted'] +
		" gmail ui should match (regular + empty) after a slow sync");
		
	yield false;
}

SyncFsmGd.gdci_id_from_pair = function(cn_id, gp_id)
{
	// We use a key of cn_id#gp_id for gdci contacts because then it isn't necessary to search for any gdci zfi's by (id, group).
	// Instead, we can just set a zfi with key cn_id#gp_id and it'll overwrite an existing zfi (if present).
	//
	function part_from_id (id) {
		let a_match = String(id).match(/base\/(.+)$/);
		return (a_match && a_match.length > 0) ? a_match[1] : id;
	}

	return part_from_id(cn_id) + "#" + part_from_id(gp_id);
}

SyncFsmGd.prototype.newZfiCnGdCi = function(cn_id, gp_id)
{
	function newZfi(cn_id, gp_id, rev) {
		return new FeedItem(FeedItem.TYPE_CN,
	                          FeedItem.ATTR_KEY,  SyncFsmGd.gdci_id_from_pair(cn_id, gp_id),
	                          FeedItem.ATTR_STYP, FeedItem.eStyp.gdci,
	                          FeedItem.ATTR_GDID, cn_id,
	                          FeedItem.ATTR_REV,  rev,
	                          FeedItem.ATTR_L,    gp_id);
	}

	let zfc = this.zfcPr();
	let rev = zfc.get(cn_id).get(FeedItem.ATTR_REV);
	let zfi = newZfi(cn_id, gp_id, rev);

	if (zfc.isPresent(zfi.key())) // if the zfi already exists, preserve it's LS attribute
		zfi.set(FeedItem.ATTR_LS, zfc.get(zfi.key()).get(FeedItem.ATTR_LS));

	if (zfc.get(cn_id).isPresent(FeedItem.ATTR_DEL))
		zfi.set(FeedItem.ATTR_DEL, '1');

	zfc.set(zfi);

	// this.debug("newZfiCnGdCi: zfi: " + zfi.toString());

	return zfi;
}

SyncFsmGd.prototype.newZfiGroup = function(group)
{
	let ret = new FeedItem(FeedItem.TYPE_GG,
	                       FeedItem.ATTR_KEY,  group.meta.id,
	                       FeedItem.ATTR_REV,  group.meta.updated,
	                       FeedItem.ATTR_L,    '1',
	                       FeedItem.ATTR_GGID, group.meta.id_as_url);

	if (group.systemGroup()) {
		ret.set(FeedItem.ATTR_NAME, group.systemGroup());
		ret.set(FeedItem.ATTR_GGSG, '1');
	}
	else {
		ret.set(FeedItem.ATTR_NAME, group.properties.title);
		ret.set(FeedItem.ATTR_EDIT, group.meta.edit);
		ret.set(FeedItem.ATTR_SELF, group.meta.self);
	}

	return ret;
}

SyncFsmGd.prototype.gd_groups_in_zfi = function(zfi, is_only_groups_in_gid)
{
	zinAssertAndLog(zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdau, function () { return zfi.toString(); });

	let zfc     = this.zfcPr();
	let gps     = zfi.get(FeedItem.ATTR_GDGP);
	let a_group = (gps.length > 0) ? gps.split(",") : [];
	let ret     = new Array();
	let i;

	for (i = 0; i < a_group.length; i++) {
		let gp_id  = a_group[i];
		let is_add = zfc.isPresent(gp_id);

		if (is_only_groups_in_gid)
			is_add = is_add && !zfc.get(gp_id).isPresent(FeedItem.ATTR_XGID);

		is_add = is_add && !zfc.get(gp_id).isPresent(FeedItem.ATTR_DEL);

		if (is_add)
			ret.push(gp_id);
	}

	// this.debug("gd_groups_in_zfi: returns: " + ret.toString() + " for zfi: " + zfi.toString());

	return ret;
}

// given the zfi for a (gdau) contact, return the luids of the corresponding groups/folders in which the contact should appear
//
SyncFsmGd.prototype.gdciLuidsForGroups = function(zfi)
{
	let self    = this;
	let zfc     = this.zfcPr();
	let ret     = new Object();
	let key     = zfi.key();
	let a_group_all     = this.gd_groups_in_zfi(zfi, false);
	let a_group         = this.gd_groups_in_zfi(zfi, true);
	let id_gd_pab       = this.state.gd_cc_meta.find('name', GD_PAB,       'luid_gd')
	let id_gd_suggested = this.state.gd_cc_meta.find('name', ContactGoogle.eSystemGroup.Suggested, 'luid_gd')
	let i;

	// GD_PAB
	//
	if ((a_group_all.length != 0) ||
	    (a_group_all.length == 0 &&
	     ((self.is_slow_sync() && self.account().gd_suggested == 'ignore') || (self.account().gd_suggested != 'ignore')) &&
		  (!zfi.isPresent(FeedItem.ATTR_DEL) || zfc.isPresent(SyncFsmGd.gdci_id_from_pair(zfi.key(), id_gd_pab)))))
			ret[id_gd_pab] = true;

	// ContactGoogle.eSystemGroup.Suggested
	//
	if (self.account().gd_gr_as_ab == 'true' && a_group.length == 0 &&
	    (!zfi.isPresent(FeedItem.ATTR_DEL) || zfc.isPresent(SyncFsmGd.gdci_id_from_pair(zfi.key(), id_gd_suggested))))
		ret[id_gd_suggested] = true;

	// the groups to which the contact belongs
	//
	if (self.account().gd_gr_as_ab == 'true')
		for (i = 0; i < a_group.length; i++)
			if (zfc.isPresent(a_group[i]) && !zfc.get(a_group[i]).isPresent(FeedItem.ATTR_XGID))
				ret[a_group[i]] = true;

	// this.debug("gdciLuidsForGroups: returns: " + keysToString(ret) + " for zfi: " + zfi.toString());

	return ret;
}

SyncFsmGd.prototype.gdciExpandZfi = function(zfi)
{
	zinAssertAndLog(zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdau, function () { return zfi.toString(); });

	let self    = this;
	let ret     = new Array();
	let a_group = this.gdciLuidsForGroups(zfi);
	let gp_id;

	for (gp_id in a_group) {
		let zfi_new = self.newZfiCnGdCi(zfi.key(), gp_id);
		ret.push(zfi_new.key());
	}

	// this.debug("gdciExpandZfi: expanded zfi: " + zfi.toString() + " into the following keys: " + ret.toString());

	return ret;
}

SyncFsmGd.prototype.gdciExpand = function()
{
	let self = this;
	let zfc  = this.zfcPr();

	var functor_pass_1 = {
		run: function(zfi) {
			if (zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdau) {
				let a_keys = self.gdciExpandZfi(zfi);
				for (var i = 0; i < a_keys.length; i++) {
					let key = a_keys[i];
					zfc.get(key).set(FeedItem.ATTR_PRES, '1');
				}
			}

			return true;
		}
	};

	var functor_pass_2 = {
		run: function(zfi) {
			if (zfi.type() == FeedItem.TYPE_CN && zfi.styp() == FeedItem.eStyp.gdci) {
				if (zfi.isPresent(FeedItem.ATTR_PRES))
					zfi.del(FeedItem.ATTR_PRES);
				else
					zfi.set(FeedItem.ATTR_DEL, '1');
				zfc.set(zfi);
			}

			return true;
		}
	};

	this.debug("gdciExpand: before: zfc: " + zfc.toString());

	zfc.forEach(functor_pass_1);
	zfc.forEach(functor_pass_2);
}

SyncFsmGd.prototype.newZfiCnGdAu = function(id, rev, edit_url, self_url, groups)
{
	zinAssert(arguments.length == 5);

	return new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY,  id,
				                          FeedItem.ATTR_STYP, FeedItem.eStyp.gdau,
				                          FeedItem.ATTR_XGID, '1',
				                          FeedItem.ATTR_REV,  rev,
				                          FeedItem.ATTR_EDIT, edit_url,
				                          FeedItem.ATTR_SELF, self_url,
				                          FeedItem.ATTR_GDGP, groups.toString());
}

SyncFsmGd.prototype.entryActionGetGroupPuGd = function(state, event, continuation)
{
	return this.entryActionGetPuGd(state, event, continuation, GoogleData.eElement.group);
}

SyncFsmGd.prototype.entryActionGetContactPuGd = function(state, event, continuation)
{
	return this.entryActionGetPuGd(state, event, continuation, GoogleData.eElement.contact);
}

SyncFsmGd.prototype.entryActionGetPuGd = function(state, event, continuation, type)
{
	zinAssert(GoogleData.eElement.isPresent(type));

	var nextEvent = null;

	if (!this.state.a_gd_to_get[type])
	{
		let sourceid_pr    = this.state.sourceid_pr;
		let feed_item_type = type == GoogleData.eElement.contact ? FeedItem.TYPE_CN : FeedItem.TYPE_FL;
		let a_gd           = type == GoogleData.eElement.contact ? this.state.a_gd_contact : this.state.a_gd_group;
		let fn             = function(sourceid, bucket) { return (sourceid == sourceid_pr) && (bucket == (Suo.MOD | feed_item_type)); }
		let suo;

		this.state.a_gd_to_get[type] = new Array();

		for (suo in this.state.m_suo_iterator.iterator(fn))
		{
			let luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);

			if (type == GoogleData.eElement.contact)
				luid_target = this.zfcPr().get(luid_target).get(FeedItem.ATTR_GDID);

			if (!(luid_target in a_gd) && (this.state.a_gd_to_get[type].indexOf(luid_target) == -1))
				this.state.a_gd_to_get[type].push(luid_target);
		}

		if (type == GoogleData.eElement.contact) {
			fn = function(sourceid, bucket) { return (bucket == (Suo.ADD | feed_item_type)); }

			for (suo in this.state.m_suo_iterator.iterator(fn))
			{
				if (this.state.sources[suo.sourceid_winner]['format'] ==  FORMAT_GD) {
					let luid_winner_ci = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
					let luid_winner_au = this.zfcPr().get(luid_winner_ci).get(FeedItem.ATTR_GDID);

					if (!(luid_winner_au in a_gd)) {
						zinAssert(this.is_suggested_candidate(sourceid_pr, luid_winner_ci))
					
						if (this.state.a_gd_to_get[type].indexOf(luid_winner_au) == -1)
							this.state.a_gd_to_get[type].push(luid_winner_au);
					}
				}
			}
		}

		this.debug("entryActionGetPuGd: a_gd_to_get[" + GoogleData.eElement.keyFromValue(type) + "]: " +
		              this.state.a_gd_to_get[type].toString());
	}

	if (this.state.a_gd_to_get[type].length > 0 && !this.state.stopFailCode)
	{
		// this is one place where we GET a single <entry> and use the SELF url for that purpose.
		// According to:
		// http://groups.google.com/group/google-contacts-api/browse_thread/thread/50e9ba8955b3b18f
		// id ought to be treated as an opaque string nor does it vary by projection (always uses /base) while self does...
		//
		let id  = this.state.a_gd_to_get[type].pop();
		let zfi = this.zfcPr().get(id);
		let url = gdAdjustHttpHttps(zfi.get(FeedItem.ATTR_SELF));

		this.setupHttpGd(state, 'evRepeat', "GET", url, null, null, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);
		
		nextEvent = 'evHttpRequest'
	}
	else
	{
		this.state.m_http = null;

		nextEvent = 'evNext'
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionGetGroupPuGd = function(state, event)
{
	return this.exitActionGetPuGd(state, event, GoogleData.eElement.group);
}
SyncFsmGd.prototype.exitActionGetContactPuGd = function(state, event)
{
	return this.exitActionGetPuGd(state, event, GoogleData.eElement.contact);
}

SyncFsmGd.prototype.exitActionGetPuGd = function(state, event, type)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	// a 404 here is conceivable - a contact can get deleted on the server between the earlier GET and now.
	// FIXME?: using v1 of the API we sometimes encountered Google's "missing tombstone" bug here, see issue#: 107
	// One avenue for a workaround to Google's bug is to save some state indicating that we've encountered a 404 on a contact
	// and if we encounter it a second time then it's definitely the Google bug in which case we could force a slow sync.
	// Don't do anything util we get a bug report for v2.
	//
	if (!this.state.m_http.is_http_status(HTTP_STATUS_2xx))
	{
		this.state.stopFailCode = 'failon.gd.get';
	}
	else
	{
		let gd;

		if (type == GoogleData.eElement.contact)
			gd  = GoogleData.new(this.state.m_http.m_xhr, this.google_contact_mode());
		else
			gd = new GroupGoogle(ContactGoogleStatic.newXml(this.state.m_http.m_xhr));

		let a_gd = type == GoogleData.eElement.contact ? this.state.a_gd_contact : this.state.a_gd_group;
		let id   = gd.meta.id;

		zinAssertAndLog(!(id in a_gd), function () { return "id=" + id; });

		a_gd[id] = gd;
	}
}

SyncFsmGd.prototype.entryActionDeXmlifyAddrGd = function(state, event, continuation)
{
	var nextEvent = null;
	var bigmsg    = new BigString();
	var id, key;

	zinAssert(!this.state.gd_is_sync_postal_address);

	if (!this.state.a_gd_contact_dexmlify_ids)
	{
		this.state.a_gd_contact_dexmlify_ids = new Array();

		bigmsg.concat("DeXmlifyAddrGd: ");

		for (id in this.state.a_gd_contact)
		{
			let contact           = this.state.a_gd_contact[id];
			let is_modified       = false;
			let postal_properties = null;

			bigmsg.concat("\n testing id=" + id);

			contact.mode(ContactGoogle.ePostal.kEnabled);

			for (key in this.state.m_contact_converter_style_gd_postal.gd_certain_keys_converted()[ContactGoogleStatic.postalWord()])
				if (key in contact.properties)
				{
					if (!postal_properties)
						postal_properties = new Object();
					
					postal_properties[key] = contact.properties[key];
				}

			for (key in postal_properties)
			{
				let otheraddr = contact.postalAddressOtherAddr(key);

				bigmsg.concat(" key=" + key + " otheraddr: " + otheraddr);

				if (otheraddr != null)
				{
					is_modified = true;
					postal_properties[key] = otheraddr;
				}
			}

			if (is_modified)
			{
				let new_properties = cloneObject(contact.properties);

				for (key in postal_properties)
					new_properties[key] = postal_properties[key];

				contact.properties = new_properties;

				this.state.a_gd_contact_dexmlify_ids.push(id);
			}
		}

		this.debug(bigmsg.toString());

		this.debug("entryActionDeXmlifyAddrGd: a_gd_contact_dexmlify_ids: " + this.state.a_gd_contact_dexmlify_ids.toString());
	}

	if (this.state.a_gd_contact_dexmlify_ids.length > 0)
	{
		id          = this.state.a_gd_contact_dexmlify_ids.pop();
		let contact = this.state.a_gd_contact[id];
		let remote  = new Object();

		remote.method  = "POST";  // PUT
		remote.url     = gdAdjustHttpHttps(contact.meta.edit);
		remote.headers = newObject("Content-type", "application/atom+xml", "X-HTTP-Method-Override", "PUT");
		remote.body    = contact.toStringXml();

		this.setupHttpGd(state, 'evRepeat', remote.method, remote.url, remote.headers, remote.body, HttpStateGd.ON_ERROR_EVCANCEL,
		                  HttpStateGd.LOG_RESPONSE_YES);
		
		nextEvent = 'evHttpRequest'
	}
	else
	{
		for (id in this.state.a_gd_contact)
			this.state.a_gd_contact[id].mode(ContactGoogle.ePostal.kDisabled);

		this.state.m_http = null;

		nextEvent = 'evNext'
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionDeXmlifyAddrGd = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var contact = GoogleData.new(this.state.m_http.m_xhr);
	var id      = contact.meta.id;

	zinAssertAndLog(id in this.state.a_gd_contact, id);
	zinAssertAndLog(this.zfcPr().isPresent(id), id);

	this.state.a_gd_contact[id] = contact;

	var zfi = this.zfcPr().get(id);
	zfi.set(FeedItem.ATTR_REV,  contact.meta.updated);
	zfi.set(FeedItem.ATTR_EDIT, contact.meta.edit);
	zfi.set(FeedItem.ATTR_SELF, contact.meta.self);
	zfi.set(FeedItem.ATTR_GDGP, contact.groups.toString());

	this.debug("exitActionDeXmlifyAddrGd: id=" + id + " contact: " + contact.toString() + " updated zfi: " + zfi.toString());
}

function ContactCollectionMeta()
{
	this.m_a = new Array();
	this.m_cache = new Object();
}

ContactCollectionMeta.prototype = {
	find : function(key_to_match, value_to_match, key_to_return) {
		var key_cache = key_to_match + value_to_match + key_to_return;

		if (!(key_cache in this.m_cache))
			for (var i = 0; i < this.m_a.length; i++)
				if (this.m_a[i][key_to_match] == value_to_match) {
					zinAssert(key_to_return in this.m_a[i]);
					this.m_cache[key_cache] = this.m_a[i][key_to_return];
					break;
				}

		return (key_cache in this.m_cache) ? this.m_cache[key_cache] : null;
	},
	push : function(obj) {
		this.m_a.push(obj); // properties: luid_tb, uri, 
	}
};
