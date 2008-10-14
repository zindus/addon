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

includejs("fsm.js");
includejs("zmsoapdocument.js");
includejs("zmcontact.js");
includejs("gdcontact.js");
includejs("xpath.js");
includejs("addressbook.js");
includejs("contactconverter.js");
includejs("folderconverter.js");
includejs("feed.js");
includejs("suo.js");
includejs("zuio.js");
includejs("gcs.js");
includejs("lso.js");
includejs("zidbag.js");
includejs("passwordmanager.js");
includejs("stopwatch.js");
includejs("cookieobserver.js");

const ORDER_SOURCE_UPDATE = [
	Suo.MOD | FeedItem.TYPE_FL, Suo.MOD | FeedItem.TYPE_SF,
	Suo.ADD | FeedItem.TYPE_FL, Suo.ADD | FeedItem.TYPE_SF, 
	Suo.DEL | FeedItem.TYPE_CN,
	Suo.MOD | FeedItem.TYPE_CN,
	Suo.ADD | FeedItem.TYPE_CN,
	Suo.DEL | FeedItem.TYPE_FL, Suo.DEL | FeedItem.TYPE_SF
];

const AUTO_INCREMENT_STARTS_AT        = 256;  // the 'next' attribute of the AUTO_INCREMENT item starts at this value + 1.
const ZM_FIRST_USER_ID                = 256;
const AB_GAL                          = "GAL";
const GOOGLE_URL_HIER_PART            = "://www.google.com/m8/feeds/contacts/";
const GOOGLE_PROJECTION               = "/thin";  // use 'thin' to avoid gd:extendedProperty elements
const GOOGLE_SHOW_CONFLICTS_AT_A_TIME = 5;

function SyncFsm()
{
	this.state = null;
	this.fsm   = null;
}
function SyncFsmZm(id_fsm)   { SyncFsm.call(this); }
function SyncFsmGd(id_fsm)   { SyncFsm.call(this); }

SyncFsmZm.prototype         = new SyncFsm();
SyncFsmGd.prototype         = new SyncFsm();

SyncFsmZm.prototype.initialiseFsm = function()
{
	var transitions = {
		start:             { evCancel: 'final', evNext: 'stAuthSelect',                                     evLackIntegrity: 'final'     },
		stAuthSelect:      { evCancel: 'final', evNext: 'stAuthLogin',      evPreAuth:     'stAuthPreAuth', evLackIntegrity: 'final'     },
		stAuthLogin:       { evCancel: 'final', evNext: 'stLoad',           evHttpRequest: 'stHttpRequest'                               },
		stAuthPreAuth:     { evCancel: 'final', evNext: 'stAuthCheck',      evHttpRequest: 'stHttpRequest',                              },
		stAuthCheck:       { evCancel: 'final', evNext: 'stLoad',                                           evLackIntegrity: 'final'     },
		stLoad:            { evCancel: 'final', evNext: 'stLoadTb',                                         evLackIntegrity: 'final'     },
		stLoadTb:          { evCancel: 'final', evNext: 'stGetAccountInfo',                                 evLackIntegrity: 'final'     },
		stGetAccountInfo:  { evCancel: 'final', evNext: 'stSelectSoapUrl',  evHttpRequest: 'stHttpRequest'                               },
		stSelectSoapUrl:   { evCancel: 'final', evNext: 'stSync',           evHttpRequest: 'stHttpRequest',                              },
		stSync:            { evCancel: 'final', evNext: 'stSyncResponse',   evHttpRequest: 'stHttpRequest'                               },
		stSyncResponse:    { evCancel: 'final', evNext: 'stGetContactZm',   evRedo:        'stSync',        evDo: 'stGetAccountInfo'     },
		stGetContactZm:    { evCancel: 'final', evNext: 'stGalConsider',    evHttpRequest: 'stHttpRequest', evRepeat: 'stGetContactZm'   },
		stGalConsider:     { evCancel: 'final', evNext: 'stGalSync',        evSkip:        'stGalCommit'                                 },
		stGalSync:         { evCancel: 'final', evNext: 'stGalCommit',      evHttpRequest: 'stHttpRequest'                               },
		stGalCommit:       { evCancel: 'final', evNext: 'stConverge1'                                                                    },
		stConverge1:       { evCancel: 'final', evNext: 'stConverge2',                                      evLackIntegrity: 'final'     },
		stConverge2:       { evCancel: 'final', evNext: 'stConverge3',      evRepeat:      'stConverge2'                                 },
		stConverge3:       { evCancel: 'final', evNext: 'stConverge4',      evRepeat:      'stConverge3'                                 },
		stConverge4:       { evCancel: 'final', evNext: 'stConverge5',                                                                   },
		stConverge5:       { evCancel: 'final', evNext: 'stConverge6',                                                                   },
		stConverge6:       { evCancel: 'final', evNext: 'stConverge7',                                                                   },
		stConverge7:       { evCancel: 'final', evNext: 'stConverge8',                                      evLackIntegrity: 'final'     },
		stConverge8:       { evCancel: 'final', evNext: 'stConverge9',                                                                   },
		stConverge9:       { evCancel: 'final', evNext: 'stGetContactPuZm',                                 evLackIntegrity: 'final'     },
		stGetContactPuZm:  { evCancel: 'final', evNext: 'stUpdateTb',       evHttpRequest: 'stHttpRequest', evRepeat: 'stGetContactPuZm' },
		stUpdateTb:        { evCancel: 'final', evNext: 'stUpdateZm'                                                                     },
		stUpdateZm:        { evCancel: 'final', evNext: 'stUpdateCleanup',  evHttpRequest: 'stHttpRequest', evRepeat: 'stUpdateZm'       },
		stUpdateCleanup:   { evCancel: 'final', evNext: 'stCommit',                                         evLackIntegrity: 'final'     },

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
		stGetAccountInfo:       this.entryActionGetAccountInfo,
		stSelectSoapUrl:        this.entryActionSelectSoapUrl,
		stSync:                 this.entryActionSync,
		stSyncResponse:         this.entryActionSyncResponse,
		stGetContactZm:         this.entryActionGetContactZm,
		stGetContactPuZm:       this.entryActionGetContactPuZm,
		stGalConsider:          this.entryActionGalConsider,
		stGalSync:              this.entryActionGalSync,
		stGalCommit:            this.entryActionGalCommit,
		stConverge1:            this.entryActionConverge1,
		stConverge2:            this.entryActionConverge2,
		stConverge3:            this.entryActionConverge3,
		stConverge4:            this.entryActionConverge4,
		stConverge5:            this.entryActionConverge5,
		stConverge6:            this.entryActionConverge6,
		stConverge7:            this.entryActionConverge7,
		stConverge8:            this.entryActionConverge8,
		stConverge9:            this.entryActionConverge9,
		stUpdateTb:             this.entryActionUpdateTb,
		stUpdateZm:             this.entryActionUpdateZm,
		stUpdateCleanup:        this.entryActionUpdateCleanup,
		stCommit:               this.entryActionCommit,

		stHttpRequest:          this.entryActionHttpRequest,
		stHttpResponse:         this.entryActionHttpResponse,

		final:                  this.entryActionFinal
	};

	var a_exit = {
		stAuthLogin:            this.exitActionAuthLogin,
		stAuthPreAuth:          this.exitActionAuthPreAuth,
		stGetAccountInfo:       this.exitActionGetAccountInfo,
		stSelectSoapUrl:        this.exitActionSelectSoapUrl,
		stGetContactZm:         this.exitActionGetContactZm,
		stGetContactPuZm:       this.exitActionGetContactZm,
		stGalSync:              this.exitActionGalSync,
		stUpdateZm:             this.exitActionUpdateZm,
		stHttpResponse:         this.exitActionHttpResponse  /* this gets tweaked by setupHttpZm */
	};

	this.fsm = new Fsm(transitions, a_entry, a_exit);
}

SyncFsmGd.prototype.initialiseFsm = function()
{
	var transitions = {
		start:             { evCancel: 'final', evNext: 'stAuth',           evSkip: 'stAuthCheck',          evLackIntegrity: 'final'     },
		stAuth:            { evCancel: 'final', evNext: 'stAuthCheck',      evHttpRequest: 'stHttpRequest', evLackIntegrity: 'final'     },
		stAuthCheck:       { evCancel: 'final', evNext: 'stLoad',                                           evLackIntegrity: 'final'     },
		stLoad:            { evCancel: 'final', evNext: 'stLoadTb',                                         evLackIntegrity: 'final'     },
		stLoadTb:          { evCancel: 'final', evNext: 'stDelContactGd',                                   evLackIntegrity: 'final'     },
		stDelContactGd:    { evCancel: 'final', evNext: 'stGetContactGd1',  evHttpRequest: 'stHttpRequest', evRepeat: 'stDelContactGd'   },
		stGetContactGd1:   { evCancel: 'final', evNext: 'stGetContactGd2',  evHttpRequest: 'stHttpRequest',                              },
		stGetContactGd2:   { evCancel: 'final', evNext: 'stGetContactGd3',                                  evLackIntegrity: 'final'     },
		stGetContactGd3:   { evCancel: 'final', evNext: 'stDeXmlifyAddrGd', evSkip:        'stConverge1',   evRepeat: 'stGetContactGd3', },
		stDeXmlifyAddrGd:  { evCancel: 'final', evNext: 'stConverge1',      evHttpRequest: 'stHttpRequest', evRepeat: 'stDeXmlifyAddrGd' },
		stConverge1:       { evCancel: 'final', evNext: 'stConverge2',                                      evLackIntegrity: 'final'     },
		stConverge2:       { evCancel: 'final', evNext: 'stConverge3',      evRepeat:      'stConverge2'                                 },
		stConverge3:       { evCancel: 'final', evNext: 'stConverge4',      evRepeat:      'stConverge3'                                 },
		stConverge4:       { evCancel: 'final', evNext: 'stConverge5'                                                                    },
		stConverge5:       { evCancel: 'final', evNext: 'stConverge6',                                                                   },
		stConverge6:       { evCancel: 'final', evNext: 'stConverge7',                                                                   },
		stConverge7:       { evCancel: 'final', evNext: 'stConverge8',                                      evLackIntegrity: 'final'     },
		stConverge8:       { evCancel: 'final', evNext: 'stConverge9',                                                                   },
		stConverge9:       { evCancel: 'final', evNext: 'stGetContactPuGd',                                 evLackIntegrity: 'final'     },
		stGetContactPuGd:  { evCancel: 'final', evNext: 'stUpdateGd',       evHttpRequest: 'stHttpRequest', evRepeat: 'stGetContactPuGd' },
		stUpdateGd:        { evCancel: 'final', evNext: 'stUpdateTb',       evHttpRequest: 'stHttpRequest', evRepeat: 'stUpdateGd'       },
		stUpdateTb:        { evCancel: 'final', evNext: 'stUpdateCleanup'                                                                },
		stUpdateCleanup:   { evCancel: 'final', evNext: 'stCommit',                                         evLackIntegrity: 'final'     },

		stHttpRequest:     { evCancel: 'final', evNext: 'stHttpResponse'                                                                 },
		stHttpResponse:    { evCancel: 'final', evNext: 'final' /* evNext here is set by setupHttp */                                    },

		stCommit:          { evCancel: 'final', evNext: 'final'                                                                          },
		final:             { }
	};

	var a_entry = {
		start:                  this.entryActionStart,
		stAuth:                 this.entryActionAuth,
		stAuthCheck:            this.entryActionAuthCheck,
		stLoad:                 this.entryActionLoad,
		stLoadTb:               this.entryActionLoadTb,
		stDelContactGd:         this.entryActionDelContactGd,
		stGetContactGd1:        this.entryActionGetContactGd1,
		stGetContactGd2:        this.entryActionGetContactGd2,
		stGetContactGd3:        this.entryActionGetContactGd3,
		stDeXmlifyAddrGd:       this.entryActionDeXmlifyAddrGd,
		stConverge1:            this.entryActionConverge1,
		stConverge2:            this.entryActionConverge2,
		stConverge3:            this.entryActionConverge3,
		stConverge4:            this.entryActionConverge4,
		stConverge5:            this.entryActionConverge5,
		stConverge6:            this.entryActionConverge6,
		stConverge7:            this.entryActionConverge7,
		stConverge8:            this.entryActionConverge8,
		stConverge9:            this.entryActionConverge9,
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
		stDeXmlifyAddrGd:       this.exitActionDeXmlifyAddrGd,
		stUpdateGd:             this.exitActionUpdateGd,
		stHttpResponse:         this.exitActionHttpResponse  /* this gets tweaked by setupHttpZm */
	};

	this.fsm = new Fsm(transitions, a_entry, a_exit);
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

	this.state.stopwatch.mark(state + " 1");

	this.state.m_logger.debug("start: " + " account: "        + this.username() +
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

	if (event == 'evCancel')
		nextEvent = 'evCancel';
	else if (typeof(document.evaluate) != 'function')
	{
		this.state.stopFailCode = 'failon.no.xpath';
		nextEvent = 'evLackIntegrity';
	}
	else if (String(navigator.userAgent).match(/pre$/))
	{
		this.state.stopFailCode = 'failon.no.tbpre';
		this.state.stopFailArg  = [ url('faq-thunderbird') ];
		nextEvent = 'evLackIntegrity';
	}
	else if (this.state.m_sfcd.is_first_in_chain() && this.testForAccountsIntegrity())
	{
		nextEvent = 'evLackIntegrity';
	}
	else if (!this.state.m_addressbook.getPabName())
	{
		this.state.stopFailCode    = 'failon.no.pab';
		this.state.stopFailTrailer = stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);

		nextEvent = 'evLackIntegrity';
		this.state.m_logger.debug("entryActionStart: addressbooks: " + this.state.m_addressbook.addressbooksToString());
	}

	// if we're doing a two-way sync and we've previously cached an authToken, use that (and skip auth)
	//
	if (this.formatPr() == FORMAT_GD && this.state.id_fsm == Maestro.FSM_ID_GD_TWOWAY)
	{
		var passwordlocator = new PasswordLocator(this.state.sources[this.state.sourceid_pr][Account.passwordlocator]);
		passwordlocator.url(googleClientLoginUrl('use-authtoken'));

		this.state.authToken = passwordlocator.getPassword();

		if (this.state.authToken)
		{
			nextEvent = 'evSkip';
			this.debug("authentication: skip ClientLogin in favour of the cached authToken for: " + passwordlocator.username());
		}
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
	var url         = this.state.sources[sourceid_pr][Account.url];
	var username    = this.username();
	var password    = this.state.sources[sourceid_pr][Account.passwordlocator].getPassword();

	if (url && /^https?:\/\//.test(url) && username.length > 0 && password && password.length > 0 && isValidUrl(url))
	{
		zinAssert(this.state.zidbag.isPrimaryUser());

		this.state.zidbag.push(null);
		this.state.zidbag.set(null, Account.url, this.state.sources[sourceid_pr][Account.url]);

		var soapURL = this.state.sources[this.state.sourceid_pr][Account.url];
		var prefset = prefsetMatchWithPreAuth(soapURL);

		if (prefset)
		{
			this.state.preauthURL  = soapURL.replace(/^(https?:\/\/.+?\/).*$/, "$1") + prefset.getProperty(PrefSet.PREAUTH_URI_HIER_PART);
			this.state.preauthBody = prefset.getProperty(PrefSet.PREAUTH_POST_BODY);
			this.state.preauthBody = this.state.preauthBody.replace(/\%username\%/, username);
			this.state.preauthBody = this.state.preauthBody.replace(/\%password\%/, password);

			this.debug("entryActionAuthSelect: matched: " + soapURL + " against: " + prefset.getProperty(PrefSet.PREAUTH_REGEXP)
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

	this.setupHttpZm(state, 'evNext', this.state.zidbag.soapUrl(0), null, "Auth", this.username(),
	                                  this.state.sources[sourceid_pr][Account.passwordlocator].getPassword());

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

SyncFsm.prototype.zfcFileNameFromSourceid = function(sourceid)
{
	return hyphenate("-", sourceid) + ".txt";
}

// reset
// - test:
//   - when: is_first_in_chain() is true
//   - cond: it's a reset (or first install) when any of lastsync.txt, gid.txt, or 1-tb.txt don't exist
//   - cond: the account_signature in lastsync.txt has changed
// - do: 
//   - set sfcd.is_reset(true); ... indicates that this chain of syncfsm's started with a reset
//   - remove all data stores - this forces a slow sync of the account
//   - initialise lastsync.txt, gid.txt, zfcTb, tb addressbook
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

SyncFsm.prototype.entryActionLoad = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	var nextEvent = null;
	var sfcd      = this.state.m_sfcd;
	var is_reset  = false;
	var a_zfc     = new Object();          // associative array of zfc, key is the file name
	var a_account_independent_filenames = newObject(Filesystem.FILENAME_GID, 0,
	                                                Filesystem.FILENAME_LASTSYNC, 0,
													this.zfcFileNameFromSourceid(SOURCEID_TB), 0);
	var filename, sourceid;

	a_zfc[Filesystem.FILENAME_GID]      = this.state.zfcGid      = new FeedCollection();
	a_zfc[Filesystem.FILENAME_LASTSYNC] = this.state.zfcLastSync = new FeedCollection();

	a_zfc[Filesystem.FILENAME_GID].filename(Filesystem.FILENAME_GID);
	a_zfc[Filesystem.FILENAME_LASTSYNC].filename(Filesystem.FILENAME_LASTSYNC);

	for (sourceid in this.state.sources)
	{
		filename = this.zfcFileNameFromSourceid(sourceid);
		a_zfc[filename] = this.state.sources[sourceid]['zfcLuid'] = new FeedCollection();
		a_zfc[filename].filename(filename);
	}

	this.debug("entryActionLoad: is_first_in_chain: " + sfcd.is_first_in_chain());

	// Work out whether the user forced a reset, or whether we are going to force one
	//
	var msg_reset = "forcing a reset because: ";

	this.state.stopwatch.mark(state + " 2");

	if (sfcd.is_first_in_chain())
		for (filename in a_account_independent_filenames)
			if (!a_zfc[filename].nsifile().exists())
			{
				is_reset = true;
				msg_reset += "a file is missing: " + filename;
				break;
			}

	this.state.stopwatch.mark(state + " 3");

	a_zfc[Filesystem.FILENAME_LASTSYNC].load();

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

		sfcd.is_reset(is_reset);
	}

	this.state.stopwatch.mark(state + " 4");

	// load (or reset) the account-independent data files
	//
	if (sfcd.is_first_in_chain() && sfcd.is_reset())
	{
		this.debug("entryActionLoad: forcing a reset - removing data files and initialising maps and tb attributes...");

		RemoveDatastore.removeZfcs( newObjectWithKeys(Filesystem.FILENAME_GD_TO_BE_DELETED) );

		this.initialiseZfcLastSync();
		this.initialiseZfcAutoIncrement(this.state.zfcGid);
		this.initialiseZfcAutoIncrement(this.zfcTb());
		this.initialiseTbAddressbook();
	}
	else
	{
		a_zfc[Filesystem.FILENAME_GID].load();
		a_zfc[this.zfcFileNameFromSourceid(SOURCEID_TB)].load();
	}

	this.state.stopwatch.mark(state + " 5");

	// Work out whether we're doing a slow sync
	//
	var sourceid_pr       = this.state.sourceid_pr;
	var filename_pr       = this.zfcFileNameFromSourceid(sourceid_pr);
	var is_file_exists_pr = a_zfc[filename_pr].nsifile().exists();

	function zfitem(zfc, zfc_key, zfi_key) { return zfc.isPresent(zfc_key) ? zfc.get(zfc_key).getOrNull(zfi_key) : null; }
	function is_any_true(a) { var ret = false; for (var i in a) { if (a[i])  { ret = true; break; } }  return ret;       }

	this.debug("entryActionLoad: " +
	      " \n last sync soapURL:  "          + zfitem(zfcLastSync, sourceid_pr, Account.url) +
	      " \n last sync username: "          + zfitem(zfcLastSync, sourceid_pr, Account.username) +
	      " \n last sync account_signature: " + zfitem(zfcLastSync, FeedItem.KEY_LASTSYNC_COMMON, 'account_signature') +
	      " \n this sync soapURL:  "          + this.state.sources[sourceid_pr][Account.url] +
	      " \n this sync username: "          + this.username() +
	      " \n this sync account_signature: " + sfcd.signature() );

	if (is_file_exists_pr)
		a_zfc[filename_pr].load()

	var a_reason = new Object();

	a_reason['no-lastsync']  = !is_file_exists_pr;

	if (!is_any_true(a_reason))
		a_reason['new-source']   = !zfcLastSync.isPresent(sourceid_pr);
	if (!is_any_true(a_reason))
		a_reason['new-url']      = zfcLastSync.get(sourceid_pr).getOrNull(Account.url) != this.state.sources[sourceid_pr][Account.url];
	if (!is_any_true(a_reason))
		a_reason['new-username'] = zfcLastSync.get(sourceid_pr).getOrNull(Account.username) != this.username();

	if (this.formatPr() == FORMAT_GD && !is_any_true(a_reason))
		a_reason['gd_sync_with'] =
			zfcLastSync.get(sourceid_pr).getOrNull(Account.gd_sync_with) != this.state.gd_sync_with;
	if (this.formatPr() == FORMAT_GD && !is_any_true(a_reason))
		a_reason['gd_is_sync_postal_address'] =
			zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('gd_is_sync_postal_address') !=
			  String(this.state.gd_is_sync_postal_address);

	var is_slow_sync = is_any_true(a_reason);

	this.debug("entryActionLoad: is_slow_sync: " + is_slow_sync + " a_reason: " + aToString(a_reason));

	sfcd.sourceid(sourceid_pr, 'is_slow_sync', is_slow_sync);

	this.state.stopwatch.mark(state + " 6");

	if (is_slow_sync)
	{
		RemoveDatastore.removeZfc(filename_pr);

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

	this.state.stopwatch.mark(state + " 7");

	if (this.isConsistentDataStore(this.state.aReverseGid))
	{
		nextEvent = 'evNext';

		if (is_slow_sync && this.formatPr() == FORMAT_GD)
			this.initialiseZfcGdFakeContactsFolder(this.zfcPr());

		if (this.formatPr() == FORMAT_ZM && zfcLastSync.isPresent(FeedItem.KEY_LASTSYNC_COMMON))
		{
			var str = zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).getOrNull('zm_tested_soapurls')

			if (str)
				this.state.a_zm_tested_soapurls = str.split(",");
		}
	}
	else
	{
		nextEvent = 'evLackIntegrity';
		this.state.stopFailCode    = 'failon.integrity.data.store.in';
		this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
	}

	this.state.stopwatch.mark(state + " 8");

	// for (filename in a_zfc)
	// 	this.debug("entryActionLoad: filename: " + filename + " zfc: " + a_zfc[filename].toString());

	continuation(nextEvent);
}

// Could also (but don't) test that:
// - 'ver' attributes make sense

SyncFsm.prototype.isConsistentDataStore = function(aReverse)
{
	var ret = true;

	this.state.stopwatch.mark("isConsistentDataStore: " + " 1");
	ret = ret && this.isConsistentZfcAutoIncrement(this.state.zfcGid);
	this.state.stopwatch.mark("isConsistentDataStore: " + " 2");
	ret = ret && this.isConsistentZfcAutoIncrement(this.zfcTb());
	this.state.stopwatch.mark("isConsistentDataStore: " + " 3");
	ret = ret && this.isConsistentGid(aReverse);
	this.state.stopwatch.mark("isConsistentDataStore: " + " 4");
	ret = ret && this.isConsistentSources();
	this.state.stopwatch.mark("isConsistentDataStore: " + " 5");

	if (this.formatPr() == FORMAT_ZM)
	{
		ret = ret && this.isConsistentZfcAutoIncrement(this.zfcPr());
	this.state.stopwatch.mark("isConsistentDataStore: " + " 6");
		ret = ret && this.isConsistentSharedFolderReferences();
	this.state.stopwatch.mark("isConsistentDataStore: " + " 7");
	}
	return ret;
}

// every (sourceid, luid) in the gid must be in the corresponding source (tested by reference to aReverseGid)
//
SyncFsm.prototype.isConsistentGid = function(aReverse)
{
	var is_consistent = true;
	var sourceid;

	is_consistent = this.isConsistentGidParse(aReverse);

	if (is_consistent)
		bigloop:
			for (sourceid in this.state.aReverseGid)
				for (var luid in this.state.aReverseGid[sourceid])
					if (!isPropertyPresent(this.state.sources, sourceid) || !this.zfc(sourceid).isPresent(luid) || 
				    	(sourceid != SOURCEID_TB && !isPropertyPresent(this.state.m_sfcd.m_a_sourceid, sourceid)))
					{
						this.debug("isConsistentGid: inconsistency: sourceid: " + sourceid + " luid: " + luid);
						is_consistent = false;
						break bigloop;
					}

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
	var context       = this;
	var gid, sourceid, aReverse;

	if (aReverseOut)
		aReverse = aReverseOut;
	else
		aReverse = new Object();

	for (sourceid in this.state.sources)
		aReverse[sourceid] = new Object();

	var functor_each_gid_mapitem = {
		run: function(sourceid, luid)
		{
			if (isPropertyPresent(context.state.sources, sourceid))
				if (isPropertyPresent(aReverse[sourceid], luid))
				{
					context.debug("isConsistentGidParse: sourceid/luid " + sourceid + "/" + luid +
					              " appears in the gid twice! in this gid: " + gid + " and this gid: " + aReverse[sourceid][luid]);
					is_consistent = false;
				}
				else
					aReverse[sourceid][luid] = gid;

			return is_consistent;
		}
	};

	var functor_foreach_gid = {
		run: function(zfi)
		{
			gid = zfi.key();

			zfi.forEach(functor_each_gid_mapitem, FeedItem.ITER_GID_ITEM);

			return is_consistent;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid);

	this.debug("isConsistentGidParse: is_consistent: " + is_consistent);

	return is_consistent;
}

SyncFsm.prototype.isConsistentSources = function()
{
	var is_consistent   = true;
	var a_not_persisted = [ FeedItem.ATTR_KEEP, FeedItem.ATTR_PRES ];
	var error_msg       = "";
	var context         = this;

	var functor_foreach_luid = {
		state: this.state,

		run: function(zfi)
		{
			var luid = zfi.key();

			// all items in a source must be of interest (which basically tests that the 'l' attribute is correct)
			//
			if (is_consistent && !SyncFsm.isOfInterest(zfc, luid))
			{
				error_msg += "inconsistency: item not of interest: sourceid: " + sourceid + " luid: " + luid + " zfi: " + zfi.toString();
				is_consistent = false;
			}

			// all items in a source must be in the gid (tested via reference to aReverse)
			//
			if (is_consistent && SyncFsm.isRelevantToGid(zfc, luid) && !isPropertyPresent(this.state.aReverseGid[sourceid], luid))
			{
				error_msg += "inconsistency vs gid: sourceid: " + sourceid + " luid: " + luid;
				is_consistent = false;
			}

			if (is_consistent)
				for (var i = 0; i < a_not_persisted.length; i++)
					if (zfi.isPresent(a_not_persisted[i]))
					{
						error_msg += "inconsistency re: " + a_not_persisted[i] + ": sourceid: " + sourceid + " luid: " + luid;
						is_consistent = false;
						break;
					}

			return is_consistent;
		}
	};

	for (var sourceid in this.state.sources)
	{
		zfc = this.zfc(sourceid);
		zfc.forEach(functor_foreach_luid);
	}

	this.debug("isConsistentSources: " + is_consistent + " " + error_msg);

	return is_consistent;
}

SyncFsmZm.prototype.isConsistentSharedFolderReferences = function()
{
	var is_consistent = true;
	var error_msg     = "";

	var functor_foreach_luid = {
		state: this.state,

		run: function(zfi)
		{
			if (is_consistent && zfi.type() == FeedItem.TYPE_SF)
			{
				is_consistent = is_consistent && this.test_key_reference(zfi, FeedItem.ATTR_LKEY);
				is_consistent = is_consistent && this.test_key_reference(zfi, FeedItem.ATTR_FKEY);
			}

			if (is_consistent && zfi.type() == FeedItem.TYPE_LN)
			{
				if (is_consistent && (!zfi.isPresent(FeedItem.ATTR_RID) || !zfi.isPresent(FeedItem.ATTR_ZID) ))
				{
					error_msg += "missing required attributes: " + zfi.toString();
					is_consistent = false;
				}

				if (zfi.isPresent(FeedItem.ATTR_SKEY)) // <link> elements can be present without the foreign folder
					is_consistent = is_consistent && this.test_key_reference(zfi, FeedItem.ATTR_SKEY);
			}

			if (is_consistent && zfi.type() == FeedItem.TYPE_FL && zfi.isForeign())
			{
				is_consistent = is_consistent && this.test_key_reference(zfi, FeedItem.ATTR_SKEY);
			}

			return is_consistent;
		},
		test_key_reference: function(zfi, attr)
		{
			var ret = true;

			if (!zfi.isPresent(attr))
			{
				error_msg += "missing required attribute: " + attr + " zfi: " + zfi.toString();
				ret = false;
			}

			if (ret && !zfc.isPresent(zfi.get(attr)))
			{
				error_msg += "missing key " + zfi.get(attr) + " referenced from zfi: " + zfi.toString();
				ret = false;
			}

			return ret;
		}
	};

	for (var sourceid in this.state.sources)
	{
		zfc = this.zfc(sourceid);
		format = this.state.sources[sourceid]['format'];

		if (format == FORMAT_ZM)
			zfc.forEach(functor_foreach_luid);
	}

	this.state.m_logger.debug("isConsistentSharedFolderReferences: " + is_consistent + " " + error_msg);

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

SyncFsm.prototype.initialiseZfcGdFakeContactsFolder = function(zfc)
{
	key = zfc.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

	zfc.set(new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, key,
	                                             FeedItem.ATTR_L, 1,
	                                             FeedItem.ATTR_NAME, GD_PAB,
	                                             FeedItem.ATTR_MS, 1));
}

// remove any luid attributes in the addressbook
//
SyncFsm.prototype.initialiseTbAddressbook = function()
{
 	var functor_foreach_card = {
		state: this.state,
		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Ci.nsIAbCard);
			var mdbCard = item.QueryInterface(Ci.nsIAbMDBCard);
			var luid    = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

			if (luid && (luid > 0 || luid.length > 0)) // the TBCARD_ATTRIBUTE_LUID for GAL cards is an ldap dn hence the test for length>0
				this.state.m_addressbook.setCardAttribute(mdbCard, uri, TBCARD_ATTRIBUTE_LUID, 0);  // api doesn't have a "delete"

			return true;
		}
	};

	var functor_foreach_addressbook = {
		state: this.state,

		run: function(elem)
		{
			this.state.m_addressbook.forEachCard(this.state.m_addressbook.directoryProperty(elem, "URI"), functor_foreach_card);

			return true;
		}
	};

	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);
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


SyncFsm.prototype.entryActionGetAccountInfo = function(state, event, continuation)
{
	this.state.stopwatch.mark(state);

	var by, value;

	if (this.state.zidbag.isPrimaryUser())
	{
		by    = "name";
		value = this.username();
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
		this.state.zidbag.set(this.state.zidbag.zimbraId(), Account.url, this.state.suggestedSoapURL);

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
		//       name="Leni Mayo's ab-1" owner="leni@george.ho.moniker.net" rest="blah" view="contact"/>
	
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

				key = Zuio.key(attribute['id'], change.acct);
				msg = "entryActionSyncResponse: found a " + nodeName + ": key=" + key +" l=" + l + " name=" + name;

				if (nodeName == 'link')
					msg += " rid: " + attribute[FeedItem.ATTR_RID] + " zid: " + attribute[FeedItem.ATTR_ZID];
				msg += " :";

				attribute[FeedItem.ATTR_KEY] = key;

				zinAssert( !(change.acct && type == FeedItem.TYPE_LN)); // don't expect to see <link> elements in foreign accounts

				if (zfcZm.isPresent(key))
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

					if (!isPropertyPresent(attribute, "ms"))
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

				if (!isPropertyPresent(attribute, 'id') || !isPropertyPresent(attribute, FeedItem.ATTR_L))
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

						// When a contact is updated on the server the rev attribute returned with <ModifyContactResponse>
						// is written to the map.
						// The <cn> element returned with the next <SyncResponse> doesn't have a rev attribute -
						// perhaps the zimbra server figures it already gave the client the rev attribute with the <ModifyContactResponse>.
						// In the absence of a rev attribute on the <cn> element we use the token attribute in the <change> element
						// in the soap header to decide whether our rev of the contact is the same as that on the server.
						// Note: <SyncResponse> also has a token attribute - no idea whether this merely duplicates the one in the header
						// or whether it serves a different purpose
						//
						var rev_attr = null;
						if (isPropertyPresent(attribute, FeedItem.ATTR_REV))
							rev_attr = attribute[FeedItem.ATTR_REV];
						else if (isPropertyPresent(change, 'token'))
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
					                                                      && !isPropertyPresent(a_foreign_folder_present, zfi.key()))
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
								this.state.zidbag.set(zid, Account.url, this.m_soapurl);
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
					if (isPropertyPresent(functor.aNewLink, zid))
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

		if (isPropertyPresent(SyncResponse, 'SyncMd'))
			this.state.SyncMd = SyncResponse.SyncMd;

		if (isPropertyPresent(SyncResponse, 'SyncToken'))
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
	var sourceid, indexSuo, bucket, msg;
	var zfcGid = this.state.zfcGid;

	if (!this.state.is_done_get_contacts_pu)
	{
		zinAssert(this.state.aContact.length == 0);

		for (sourceid in this.state.sources)
		{
			var format = this.state.sources[sourceid]['format'];
			var zfc    = this.zfc(sourceid);

			if (format == FORMAT_ZM)
				for (bucket in this.state.aSuo[sourceid])
					for (indexSuo in this.state.aSuo[sourceid][bucket])
					{
						suo = this.state.aSuo[sourceid][bucket][indexSuo];

						if (zfcGid.get(suo.gid).isPresent(suo.sourceid_target))
						{
							luid_target = zfcGid.get(suo.gid).get(suo.sourceid_target);

							if (bucket == (Suo.DEL | FeedItem.TYPE_CN) && zfc.get(luid_target).isForeign())
								this.state.aContact.push(new Zuio(zfc.get(luid_target).key()));
						}
					}
		}

		this.state.is_done_get_contacts_pu = true;

		msg = "";
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
		var max_contacts_in_one_request = 50;
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
	var max_contacts_in_one_request = 50;
	var zuio = null;
	var a_ret = new Array();

	// all contacts in the request have to be using the same zid
	//
	for (var i = 0; i < max_contacts_in_one_request && i < aContact.length; i++)
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
	var nextEvent = null;
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_pr = this.state.sourceid_pr;
	var if_fewer_recheck;

	this.state.stopwatch.mark(state);

	if (!isInArray(this.state.SyncGalEnabled, [ "yes", "no", "if-fewer" ] ))
	{
		this.state.m_logger.warn("entryActionGalConsider: bad preference value for SyncGalEnabled: " + this.state.SyncGalEnabled +
		                         " - setting to 'no'");

		this.state.SyncGalEnabled = "no";
	}

	this.state.m_logger.debug("entryActionGalConsider: SyncGalEnabled: " + this.state.SyncGalEnabled);

	if (this.state.SyncGalEnabled == "no")
		nextEvent = 'evSkip';
	else
	{
		var SyncGalMdInterval = this.getIntPref(MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL);
		var SyncMd = parseInt(zfcLastSync.get(sourceid_pr).getOrNull('SyncMd'));
		var isSyncGalEnabledChanged = this.state.SyncGalEnabled != zfcLastSync.get(sourceid_pr).getOrNull('SyncGalEnabled');

		this.state.m_logger.debug("entryActionGalConsider:" +
												 " isSyncGalEnabledChanged: " + isSyncGalEnabledChanged +
	                                             " SyncMd: " + SyncMd + " this.state.SyncMd: " + this.state.SyncMd +
	                                             " SyncGalMdInterval == " + SyncGalMdInterval +
	                                             " (SyncMd + SyncGalMdInterval) == " + (SyncMd + SyncGalMdInterval) );


		if (isSyncGalEnabledChanged || SyncMd == null || (this.state.SyncMd > (SyncMd + SyncGalMdInterval)))
		{
			this.state.SyncGalTokenInRequest = null;

			this.state.m_logger.debug("entryActionGalSync: Gal expired or had no state or 'Sync Gal' preference changed - " +
			                          "this.state.SyncGalTokenInRequest set to null");
		}
		else
		{
			this.state.SyncGalTokenInRequest = zfcLastSync.get(sourceid_pr).getOrNull('SyncGalToken');

			this.state.m_logger.debug("entryActionGalSync: Gal hasn't expired - this.state.SyncGalTokenInRequest == " +
			                          this.state.SyncGalTokenInRequest);
		}

		if (this.state.SyncGalEnabled == "if-fewer")
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
	var zc, attributes, properties, isGalEnabled, element;
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_pr = this.state.sourceid_pr;

	this.state.stopwatch.mark(state);

	// work out whether the Gal is enabled by our preferences or not

	if (this.state.SyncGalEnabled == "no")
		isGalEnabled = false;
	else if (this.state.SyncGalEnabled == "yes")
		isGalEnabled = true;
	else
	{
		zinAssert(this.state.SyncGalEnabled == "if-fewer");

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

		this.state.m_logger.debug("entryActionGalCommit: this.state.SyncGalEnabled: " + this.state.SyncGalEnabled);
	}
		
	this.state.m_logger.debug("entryActionGalCommit: isGalEnabled: " + isGalEnabled +
	                          " this.state.SyncGalEnabled: " + this.state.SyncGalEnabled);

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

		for (var i in this.state.aSyncGalContact)
		{
			// First, we remove Zimbra <cn> properties that don't map to a thunderbird property because...
			// 1. background: for <cn> elements that come from an addressbook, email, email2 and email3 have corresponding
			//    fields in Zimbra's web-UI
			// 2. for <cn> elements that come from SyncGalResponse, email2, email3, email4, etc are set to the aliases for the account
			//    a. don't want Zm:email2 to map to Tb:SecondEmail
			//    b. don't want to implement regexp matching mapping Zm:email* to Tb:null
			//    c. if/when we preserve Zimbra contact fields that don't have a corresponding Thunderbird field, we won't
			//       want to do it for GAL contacts 'cos they're never written back to Zimbra.

			this.contact_converter().removeKeysNotCommonToAllFormats(FORMAT_ZM, this.state.aSyncGalContact[i].element);

			var properties = this.contact_converter().convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncGalContact[i].element);
		}

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

			for (var i in this.state.aSyncGalContact)
				aAdd.push(i);
		}
		else
		{
			this.state.m_logger.debug("entryActionGalCommit: SyncGalTokenInRequest != null - " +
			                          "looking for Tb cards to overwrite where the Tb card id matches a contact in the SyncGalResponse...");

			var context = this;

			var functor = {
				state: this.state,

				run: function(uri, item)
				{
					var abCard   = item.QueryInterface(Ci.nsIAbCard);
					var mdbCard  = item.QueryInterface(Ci.nsIAbMDBCard);
					var id       = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);
					var index    = this.state.mapIdSyncGalContact[id];

					if (id != null && typeof index != 'undefined')
					{
						zc = this.state.aSyncGalContact[index];

						attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id);
						properties = context.contact_converter().convert(FORMAT_TB, FORMAT_ZM, zc.element);

						this.state.m_addressbook.updateCard(abCard, uri, properties, attributes, FORMAT_ZM);

						this.state.aSyncGalContact[index].present = true;
					}

					return true;
				}
			}

			this.state.m_addressbook.forEachCard(uri, functor);

			for (var i in this.state.aSyncGalContact)
				if (!this.state.aSyncGalContact[i].present)
					aAdd.push(i);
		}

		for (var i in aAdd)
		{
			zc = this.state.aSyncGalContact[aAdd[i]];

			attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id);
			properties = this.contact_converter().convert(FORMAT_TB, FORMAT_ZM, zc.element);

			this.state.m_logger.debug("entryActionGalCommit: adding aSyncGalContact[" + aAdd[i] + "]: " +
			                            this.shortLabelForContactProperties(properties));

			this.state.m_addressbook.addCard(uri, properties, attributes);
		}
	}

	if (this.state.SyncGalTokenInResponse) // remember that this state is run even though SyncGalRequest wasn't called...
	{
		zfcLastSync.get(sourceid_pr).set('SyncGalToken', this.state.SyncGalTokenInResponse);
		zfcLastSync.get(sourceid_pr).set('SyncMd',       this.state.SyncMd);
	}

	if (this.state.SyncGalEnabled == "if-fewer" && this.state.SyncGalTokenInRequest == null && !isGalEnabled)
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

	if ((isGalEnabled || this.state.SyncGalEnabled != "if-fewer") && zfcLastSync.get(sourceid_pr).isPresent('SyncGalEnabledRecheck'))
		zfcLastSync.get(sourceid_pr).del('SyncGalEnabledRecheck');
		
	continuation('evNext');
}

// Notes:
// - A big decision in simplifying the loading of the tb addressbook and cards was the decision to give up convergence.
//   If there's a problem, the sync just aborts and the user has to fix it.
// - LoadTb1 and LoadTb2 aren't split for performance reasons.  They're split because LoadTb1 potentially renames an
//   addressbook (Zimbra Emailed Contacts to it's localised equivalent) and Thunderbird has some sort of race condition such that
//   *sometimes* after renaming the addressbook it subsequently loads fine but when the sync is finished there's no addressbook in the UI!
//   My guess is that this tb behaviour is related to it being unable to propagation some sort of (preference?) notification.  
//   Putting an fsm state change between the 'rename' and the 'iteration over all addressbooks' seems to
//   give the tb ab time to sort itself out.  Blech!
//
SyncFsm.prototype.entryActionLoadTb = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	var gd_ab_name_internal = null;
	var gd_ab_name_public   = null;
	var passed              = true;
	var aUri;

	this.state.zfcTbPreMerge = this.zfcTb().clone();           // 1. remember the tb luid's before merge so that we can follow changes

	// we do this when syncing non-zimbra accounts because without the correct mapping of zindus_emailed_contacts to the
	// localised name, when the localised name is encountered in loadTbAddressBooks() it'll think that the address book has
	// changed it's name
	// An alternative approach would be for loadTbAddressBooks to only mess with zindus/blah@gmail.com and pab.
	//
	if (this.formatPr() == FORMAT_ZM)
	{
		this.loadTbLocaliseEmailedContacts();                  // 2. ensure that emailed contacts is in the current locale

		if (this.is_slow_sync(this.state.sourceid_pr))
			this.loadTbDeleteReadOnlySharedAddresbooks();      // 3. ensure that we don't try to update read-only addressbooks on the server
	}
	else if (this.formatPr() == FORMAT_GD)
	{
		if (this.is_slow_sync(this.state.sourceid_pr))
			this.loadTbSetupGdAddressbook();

		gd_ab_name_internal = this.gdAddressbookName('internal');
		gd_ab_name_public   = this.gdAddressbookName('public');
	}

	if (this.formatPr() == FORMAT_GD && !this.is_slow_sync(this.state.sourceid_pr))
	{
		// performance optimisation for google accounts - only look at the addressbook specific to this account
		//
		var a_match = this.state.m_addressbook.getAddressBooksByPattern(new RegExp( "^" + gd_ab_name_public + "$" ));

		this.debug("loadTb: gd_ab_name_public: " + gd_ab_name_public + " a_match: " + aToString(a_match));

		if (!isPropertyPresent(a_match, gd_ab_name_public))
		{
			this.state.stopFailCode    = 'failon.gd.syncwith';
			this.state.stopFailArg     = [ gd_ab_name_public ];
			this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
			this.debug("loadTb: no folders named: " + gd_ab_name_public);
		}

		if (!this.state.stopFailCode && a_match[gd_ab_name_public].length > 1)
		{
			this.state.stopFailCode = 'failon.folder.name.duplicate';
			this.state.stopFailArg  = [ gd_ab_name_public ];
			this.debug("loadTb: multiple folders named: " + gd_ab_name_public);
		}

		if (!this.state.stopFailCode)
		{
			this.state.gd_luid_ab_in_gd = SyncFsm.zfcFindFirstFolder(this.zfcPr(), GD_PAB);

			zinAssert(a_match[gd_ab_name_public].length == 1);

			var uri    = a_match[gd_ab_name_public][0].uri();
			var prefid = a_match[gd_ab_name_public][0].prefid();
			var gid    = this.state.aReverseGid[this.state.sourceid_pr][this.state.gd_luid_ab_in_gd];
			var zfcGid = this.state.zfcGid;

			zinAssertAndLog(zfcGid.isPresent(gid) && zfcGid.get(gid).isPresent(this.state.sourceid_pr), gid);

			this.state.gd_luid_ab_in_tb = zfcGid.get(gid).get(this.state.sourceid_tb);

			aUri = newObject(uri, this.state.gd_luid_ab_in_tb);

			this.zfcTb().get(this.state.gd_luid_ab_in_tb).set(FeedItem.ATTR_PRES, '1');  // this drives deletion detection
		}

		if (!this.state.stopFailCode)
		{
			var tpi = this.zfcTb().get(this.state.gd_luid_ab_in_tb).get(FeedItem.ATTR_TPI);

			if (tpi != prefid)
			{
				this.state.stopFailCode    = 'failon.gd.syncwith';
				this.state.stopFailTrailer = " " + gd_ab_name_public;
				this.debug("loadTb: tpi on folder changed: " + gd_ab_name_public + " now: " + prefid + " was: " + tpi);
			}
		}

		passed = !this.state.stopFailCode;
	}
	else
		aUri = this.loadTbAddressBooks();           // 4. merge the current tb luid map with the current addressbook(s)

	if (passed && this.formatPr() == FORMAT_GD)
	{
		if (this.is_slow_sync(this.state.sourceid_pr))
		{
			this.state.gd_luid_ab_in_gd = SyncFsm.zfcFindFirstFolder(this.zfcPr(), GD_PAB);
			this.state.gd_luid_ab_in_tb = SyncFsm.zfcFindFirstFolder(this.zfcTb(), gd_ab_name_internal);
		}

		this.state.gd_ab_uri = this.state.m_addressbook.getAddressBookUriByName(gd_ab_name_public);

		zinAssertAndLog(this.state.gd_ab_uri, gd_ab_name_public);

		if (this.state.gd_sync_with == 'zg')
		{
			// Twiddling m_folder_converter here means that we can't use it in a zm sync...
			// Another option here would be to add a method in functor_foreach_luid_slow_sync
			// to do the mapping to+from abName and GD_PAB 
			//
			this.state.m_folder_converter.m_bimap_pab.delete(FORMAT_TB, null);
			this.state.m_folder_converter.m_bimap_pab.add( [ FORMAT_TB ], [ gd_ab_name_public ] );
		}

		this.debug("LoadTb: gd addressbook: " + gd_ab_name_public + " luid=" + this.state.gd_luid_ab_in_tb);
	}

	this.state.stopwatch.mark(state + " 2");

	this.state.foreach_tb_card_functor = this.get_foreach_card_functor();

	passed = passed && this.loadTbCards(aUri);                  // 5. load cards, excluding mailing lists and their cards

	this.state.stopwatch.mark(state + " 3: passed: " + passed);

	if (this.formatPr() == FORMAT_GD)
	{
		passed = passed && this.loadTbTestForGdCardsEmpty();
		passed = passed && this.loadTbTestForGdCardsUnique();
	}

	if (this.formatPr() == FORMAT_ZM)
	{
		passed = passed && this.testForLegitimateFolderNames(); // test for duplicate folder names, zimbra-reserved names, illegal chars
		passed = passed && this.testForEmptyContacts();         // test that there are no empty contacts
	}

	passed = passed && this.testForFolderPresentInZfcTb(TB_PAB);

	this.state.stopwatch.mark(state + " 4: passed: " + passed);

	if (!this.is_reset())
	{
		passed = passed && this.testForReservedFolderInvariant(TB_PAB);
	}

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.get_foreach_card_functor = function()
{
	var functor = null;
	var context = this;

	if (this.formatPr() == FORMAT_GD)
		functor = {
			m_a_email_luid:  new Object(),
			m_a_empty_contacts: new Object(),
			add_email: function(properties, key, id)
			{
				if (isPropertyPresent(properties, key))
				{
					var email = properties[key];

					if (!isPropertyPresent(this.m_a_email_luid, email))
						this.m_a_email_luid[email] = new Object();

					this.m_a_email_luid[email][id] = true;
				}

			},
			run: function(card, id, properties)
			{
				var gd_properties = context.contact_converter().convert(FORMAT_GD, FORMAT_TB, properties);

				GdContact.transformProperties(gd_properties);

				// remember the luid(s) for each (primary and secondary) email addresses
				//
				this.add_email(gd_properties, 'PrimaryEmail', id);
				this.add_email(gd_properties, 'SecondEmail',  id);

				if (this.is_empty(gd_properties))
					this.m_a_empty_contacts[id] = properties;
			}
		};
	else if (this.formatPr() == FORMAT_ZM)
		functor = {
			m_a_empty_contacts: new Object(),
			run: function(card, id, properties)
			{
				var properties = context.contact_converter().convert(FORMAT_ZM, FORMAT_TB, properties);

				if (this.is_empty(properties))
					this.m_a_empty_contacts[id] = true;
			}
		};

	functor.is_empty = function(properties)
	{
		var ret = true;

		for (var key in properties)
			if (properties[key] && properties[key].length > 0)
			{
				ret = false;
				break;
			}

		return ret;
	}

	return functor;
}

// if slow sync then...
//   if gd_sync_with == 'zg'  and there's no zindus/<email-address> folder, create it
//
SyncFsm.prototype.loadTbSetupGdAddressbook = function()
{
	var abName = this.gdAddressbookName('zg');
	var aUris  = this.state.m_addressbook.getAddressBooksByPattern(new RegExp( "^" + abName + "$" ));

	zinAssert(this.is_slow_sync(this.state.sourceid_pr));

	if (this.state.gd_sync_with == 'zg' && isObjectEmpty(aUris))
	{
		var abip = this.state.m_addressbook.newAddressBook(abName);

		this.state.m_logger.debug("loadTbSetupGdAddressbook: created: addressbook: " + abName + " uri: " + abip.uri());
	}
}

SyncFsm.prototype.gdAddressbookName = function(arg)
{
	zinAssertAndLog(this.state.gd_sync_with == 'zg' || this.state.gd_sync_with == 'pab', this.state.gd_sync_with);

	var name_when_zg = FolderConverter.PREFIX_PRIMARY_ACCOUNT + this.username();
	var ret;

	switch(arg)
	{
		case 'public':   ret = this.state.gd_sync_with == 'zg' ? name_when_zg : this.state.m_addressbook.getPabName(); break;
		case 'internal': ret = this.state.gd_sync_with == 'zg' ? name_when_zg : TB_PAB;                                break;
		case 'zg':       ret = name_when_zg;                                                                           break;
		default:         zinAssertAndLog(false, arg)
	}

	return ret;
}

SyncFsm.zfiFromName = function(name)
{
	// the convertFor routines take a zfi (because they need to cater for foreign folders
	// this routine creates zfi for a name as if it were the name of a folder in the primary account

	return new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, 123 , FeedItem.ATTR_NAME, name)
}

SyncFsm.prototype.testForFolderPresentInZfcTb = function(name)
{
	var key = SyncFsm.zfcFindFirstFolder(this.zfcTb(), name);

	if (!key || this.zfcTb().get(key).isPresent(FeedItem.ATTR_DEL))
	{
		this.state.stopFailCode = 'failon.folder.must.be.present';
		this.state.stopFailArg  = [ this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(name)) ];
	}

	ret = (this.state.stopFailCode == null);

	this.state.m_logger.debug("testForFolderPresentInZfcTb: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.testForReservedFolderInvariant = function(name)
{
	var zfcTbPre  = this.state.zfcTbPreMerge;
	var zfcTbPost = this.zfcTb();
	var ret;

	zinAssert(!this.state.stopFailCode && !this.is_reset());

	var pre_id  = SyncFsm.zfcFindFirstFolder(zfcTbPre, name);
	var post_id = SyncFsm.zfcFindFirstFolder(zfcTbPost, name);
	var pre_prefid  = pre_id  ? zfcTbPre.get(pre_id).get(FeedItem.ATTR_TPI) : null;
	var post_prefid = post_id ? zfcTbPost.get(post_id).get(FeedItem.ATTR_TPI) : null;

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + name +
		" pre_id=" + pre_id + " post_id=" + post_id + 
		" pre_prefid: " + pre_prefid + " post_prefid: " + post_prefid);

	if (!post_id || pre_prefid != post_prefid)    // no folder by this name or it changed since last sync
	{
		this.state.stopFailCode    = 'failon.folder.reserved.changed';
		this.state.stopFailArg     = [ name ];  // FIXME - this name is internal-facing ie zindus_pab
		this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
	}

	ret = (this.state.stopFailCode == null);

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + name + " returns: " + ret);

	return ret;
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
	var i, account, key;

	// test that no two accounts are the same
	//
	for (i = 0; i < sfcd.length(); i++)
	{
		account = sfcd.account(i);
		key     = account.format() + account.get(Account.url) + account.get(Account.username);

		if (account.format_xx() == FORMAT_ZM)
			cZimbra++;

		if (isPropertyPresent(a_keys, key))
			index_identical = i;
		else
			a_keys[key] = true;
	}

	if (cZimbra > 1)
	{
		this.state.stopFailCode    = 'failon.unexpected';
		this.state.stopFailTrailer = "Syncing with more than one Zimbra account isn't supported." +
		                             "  Suggest you remove all but one of the Zimbra accounts and try again." +
		                             "\n\n" + stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);
	}
	else if (index_identical)
	{
		account = sfcd.account(index_identical);

		this.state.stopFailCode    = 'failon.unexpected';
		this.state.stopFailTrailer = "You have configured two accounts with identical details.  This isn't supported." +
		                             "  Suggest you delete one of these accounts and try again:" +
		                             "\n\n" + format_xx_to_localisable_string(account.format_xx()) + ": ";

		if (account.format_xx() == FORMAT_ZM)
			this.state.stopFailTrailer += " " + account.get(Account.url);

		this.state.stopFailTrailer += " " + account.get(Account.username);
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
	else if (elem.dirName == this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS)))
		ret = TB_EMAILED_CONTACTS;
	else 
		ret = elem.dirName;

	logger().debug("getAbNameNormalised: elem.dirName: " + elem.dirName + " returns: " + ret);

	return ret;
}

SyncFsm.prototype.loadTbLocaliseEmailedContacts = function()
{
	var msg = "LocaliseEmailedContacts: is_reset: " + this.is_reset();

	if (this.state.m_sfcd.first_sourceid_of_format(FORMAT_ZM) == this.state.sourceid_pr)
	{
		var uri, old_translation, old_localised_ab;
		var translation = this.state.m_folder_converter.translate_emailed_contacts();

		this.state.m_folder_converter.localised_emailed_contacts(translation);

		this.state.zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('zm_localised_emailed_contacts', translation);

		var ab_localised = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS));

		// if there's a "zindus/Emailed Contacts" addressbook, rename it to the localised equivalent
		//
		uri = this.state.m_addressbook.getAddressBookUriByName(ab_localised);

		msg += " translate_emailed_contacts: " + translation + " ab_localised: " + ab_localised + " uri: " + uri;

		if (!uri)
		{
			for (old_translation in this.state.m_folder_converter.m_locale_names_to_migrate)
			{
				old_localised_ab = FolderConverter.PREFIX_PRIMARY_ACCOUNT + old_translation;

				uri = this.state.m_addressbook.getAddressBookUriByName(old_localised_ab);

				msg += " testing for: " + old_localised_ab + " uri: " + uri;

				if (uri)
				{
					msg += " found: " + old_localised_ab + " uri: " + uri;

					this.state.m_addressbook.renameAddressBook(uri, ab_localised);

					msg += " renamed to " + ab_localised + " uri: " + this.state.m_addressbook.getAddressBookUriByName(ab_localised);

					break;
				}
			}
		}
	}
	else
		this.state.m_folder_converter.localised_emailed_contacts(this.state.zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).get('zm_localised_emailed_contacts'));
				
	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.loadTbDeleteReadOnlySharedAddresbooks = function()
{
	zinAssert(this.is_slow_sync(this.state.sourceid_pr));

	var aUris = this.state.m_addressbook.getAddressBooksByPattern(new RegExp(FolderConverter.PREFIX_FOREIGN_READONLY));

	this.state.m_logger.debug("loadTbDeleteReadOnlySharedAddresbooks: about to delete: " + aToString(aUris));

	for (var key in aUris)
		for (var i = 0; i < aUris[key].length; i++)
			this.state.m_addressbook.deleteAddressBook(aUris[key][i].uri());
}

// When syncing with Google, only look at the gd_ab_name_public addressbook because then we don't need to have previously
// set up zimbra's Emailed Contacts mapping or refer to zfcLastSync's zm_localised_emailed_contacts key
//
SyncFsm.prototype.loadTbAddressBooks = function()
{
	var sourceid          = this.state.sourceid_tb;
	var zfcTb             = this.zfcTb();
	var context           = this;
	var format            = this.state.sources[this.state.sourceid_pr]['format'];
	var gd_ab_name_public = (format == FORMAT_GD ? this.gdAddressbookName('public') : null);
	var uri, functor_foreach_card, functor_foreach_addressbook;

	var stopwatch = this.state.stopwatch;

	stopwatch.mark("loadTbAddressBooks: 1");

	var mapTbFolderTpiToId = SyncFsm.getTopLevelFolderHash(zfcTb, FeedItem.ATTR_TPI, FeedItem.ATTR_KEY);

	stopwatch.mark("loadTbAddressBooks: 2");

	this.debug("loadTbAddressBooks: mapTbFolderTpiToId == " + aToString(mapTbFolderTpiToId));

	// do change detection for addressbooks
	// Personal Address Book is identified by isElemPab() and regardless of its localised name, the zfi's ATTR_NAME is set to TB_PAB
	//
	functor_foreach_addressbook =
	{
		m_folder_converter: this.state.m_folder_converter,
		m_addressbook: this.state.m_addressbook,

		run: function(elem)
		{
			var is_elem_pab = this.m_addressbook.isElemPab(elem);
			var uri         = this.m_addressbook.directoryProperty(elem, "URI");
			var dirname     = elem.dirName;
			var prefid      = elem.dirPrefId;
			var is_process  = is_elem_pab;

			if (format == FORMAT_ZM)
				is_process = is_elem_pab || (this.m_folder_converter.prefixClass(dirname) != FolderConverter.PREFIX_CLASS_NONE &&
				                                dirname.indexOf("/", this.m_folder_converter.m_prefix_length) == -1);
			else
				is_process = dirname == gd_ab_name_public;

			var msg = "addressbook:" +
			          " dirName: "              + dirname +
			          " dirPrefId: "            + prefid +
				      " URI: "                  + uri +
			          " isElemPab(elem): "      + (is_elem_pab ? "yes" : "no") +
			          " description: "          + elem.description +
			          " supportsMailingLists: " + elem.supportsMailingLists +
			          " is_process: "           + is_process;

			// look for zindus/<folder-name> and don't permit '/'es in <folder-name> because:
			// - we only support addressbook folders that are immediate children of the root folder - note the l='1' below.

			if (is_process)
			{
				var key;

				var name = context.getAbNameNormalised(elem);

				msg = "addressbook of interest to zindus: " + msg;

				if (!isPropertyPresent(mapTbFolderTpiToId, prefid))
				{
					key = zfcTb.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

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
					var zfi = zfcTb.get(key);

					if (zfi.name() != name)
					{
						zfi.set(FeedItem.ATTR_NAME, name);
						zfi.increment(FeedItem.ATTR_MS);

						msg += " - folder changed: " + zfi.toString();
					}
				}

				aUri[uri] = key;
				zfcTb.get(key).set(FeedItem.ATTR_PRES, '1');  // this drives deletion detection

				msg += " - elem properties: " + " dirType: "  + this.m_addressbook.directoryProperty(elem, "dirType") + " key=" + key;
			}
			else
				msg = "ignored: " + msg;

			context.state.m_logger.debug("loadTbAddressBooks: " + msg);
		
			return true;
		}
	};

	aUri = new Array();

	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);

	this.state.m_logger.debug("loadTbAddressBooks: returns aUri: " + aToString(aUri));

	stopwatch.mark("loadTbAddressBooks: 4");

	return aUri;
}

SyncFsm.prototype.loadTbCards = function(aUri)
{
	// when you iterate through cards in an addressbook, you also see cards that are members of mailing lists
	// and the only way I know of identifying such cards is to iterate to them via a mailing list uri.
	// So there's a 3-pass thing here:
	// pass 1 - iterate through the cards in the zindus folders building an associative array of mailing list uris
	//   aListUris['moz-abmdbdirectory://abook.mab/MailList3'] = moz-abmdbdirectory://abook.mab
	// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
	//   a card key is a concatenation of mdbCard. dbTableID dbRowID key == 1 797 402
	//   aListCardKey['1-797-402'] = moz-abmdbdirectory://abook.mab;
	// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aListCardKey
	//          where the uri matches the uri of the addressbook
	// The key '1-797-402' is only unique within an addressbook.
	//

	// pass 1 - iterate through the cards in the zindus folders building an associative array of mailing list uris
	//          and do some housekeeping.
	//
	var aMailListUri = new Object();
	var zfcTb        = this.zfcTb();
	var msg, functor_foreach_card;

	functor_foreach_card = {
		state: this.state,
		run: function(uri, item)
		{
			var abCard = item.QueryInterface(Ci.nsIAbCard);

			if (abCard.isMailList)
				aMailListUri[abCard.mailListURI] = uri;

			// if a sync gets cancelled somewhere between assigning+writing luid attributes to cards and saving the map,
			// we might end up with a card with an luid attribute but without the luid being in the map
			// Here, we remove any such attributes...

			var mdbCard = item.QueryInterface(Ci.nsIAbMDBCard);
			var id = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

			if (id > AUTO_INCREMENT_STARTS_AT)
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
					this.state.m_logger.debug("loadTbCards: attribute luid=" + id +
					                          " is being removed because it's not in the map.  Card: " +
			                                  this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard));

					this.state.m_addressbook.setCardAttribute(mdbCard, uri, TBCARD_ATTRIBUTE_LUID, 0);  // api doesn't have a "delete"
				}
				else if (zfcTb.get(id).type() != FeedItem.TYPE_CN)
				{
					this.state.m_logger.error("card had attribute luid=" + id + " but this luid isn't a contact!  zfi: " +
					                          zfcTb.get(id).toString() + "Card: " +
											  this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) +
											  "uri: " + uri);

					this.state.stopFailCode    = 'failon.integrity.data.store.map';
					this.state.stopFailTrailer = stringBundleString("text.file.bug", [ BUG_REPORT_URI ]) +
					                             stringBundleString("status.failon.integrity.data.store.detail") +
					                             stringBundleString("text.suggest.reset");
				}
			}

			return this.state.stopFailCode == null;
		}
	};

	for (uri in aUri)
		this.state.m_addressbook.forEachCard(uri, functor_foreach_card);

	if (this.state.stopFailCode == null)
	{
		this.state.m_logger.debug("loadTbCards pass 1: aUri: " + aToString(aUri) + " aMailListUri: " + aToString(aMailListUri));

		// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
		//
		var aCardKeysToExclude = new Object();
		msg = "loadTbCards: aCardKeysToExclude: pass 2: ";

		functor_foreach_card = {
			state: this.state,
			run: function(uri, item)
			{
				var mdbCard = item.QueryInterface(Ci.nsIAbMDBCard);
				var abCard  = item.QueryInterface(Ci.nsIAbCard);
				var key     = this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard);

				aCardKeysToExclude[key] = aMailListUri[uri];

				msg += "\nexcluding card: " + key + " " + aMailListUri[uri] + " " + this.state.m_addressbook.nsIAbCardToPrintable(abCard);

				return true;
			}
		};

		for (uri in aMailListUri)
			this.state.m_addressbook.forEachCard(uri, functor_foreach_card);

		this.state.m_logger.debug(msg);

		var context = this;

		// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aCardKeysToExclude
		//
		functor_foreach_card = {
			state: this.state,

			run: function(uri, item)
			{
				var abCard  = item.QueryInterface(Ci.nsIAbCard);
				var mdbCard = item.QueryInterface(Ci.nsIAbMDBCard);
				var key     = this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard);
				msg         = "loadTb pass 3: uri: " + uri + " card key: " + key;

				var isInTopLevelFolder = false;

				if (!abCard.isMailList && ( !isPropertyPresent(aCardKeysToExclude, key) ||
				                            (isPropertyPresent(aCardKeysToExclude, key) && aCardKeysToExclude[key] != uri)))
						isInTopLevelFolder = true;

				if (false)
				this.state.m_logger.debug("loadTbCards pass 3: blah: " + " uri: " + uri + " isInTopLevelFolder: " + isInTopLevelFolder +
				                          " key: " + this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard) +
				                          " card: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard) +
				                          " properties: " + aToString(this.state.m_addressbook.getCardProperties(abCard)) +
				                          " attributes: " + aToString(this.state.m_addressbook.getCardAttributes(abCard)) +
				                          " lastModifiedDate: " + abCard.lastModifiedDate +
				                          " checksum: " +
										   context.contact_converter().crc32(this.state.m_addressbook.getCardProperties(abCard)));

				if (isInTopLevelFolder)
				{
					var id         = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);
					var properties = this.state.m_addressbook.getCardProperties(abCard);

					// first, we do subtle transformations on cards.
					// 

					// replace \r\n with \n - issue #121 and https://bugzilla.mozilla.org/show_bug.cgi?id=456678
					// 
					if (isPropertyPresent(properties, "Notes") && properties["Notes"].match(/\r\n/))
					{
						properties["Notes"] = properties["Notes"].replace(new RegExp("\r\n", "mg"), "\n");
						abCard.setCardValue("Notes", properties["Notes"]);
						this.state.m_logger.debug("loadTbCards pass 3: transform: found a card with \\r\\n in the notes field - normalising it to \\n as per IRC discussion. Notes: " + properties["Notes"]);

						mdbCard.editCardToDatabase(uri);
					}

					// if this addressbook is being synced with google, and SecondEmail is populated and PrimaryEmail isn't,
					// move SecondEmail to PrimaryEmail
					//
					if (uri == this.state.gd_ab_uri &&
					     (!isPropertyPresent(properties, "PrimaryEmail") || properties["PrimaryEmail"].length == 0) &&
					     isPropertyPresent(properties, "SecondEmail"))
					{
						properties["PrimaryEmail"] = properties["SecondEmail"];
						properties["SecondEmail"] = "";

						abCard.setCardValue("PrimaryEmail", properties["PrimaryEmail"]);
						abCard.setCardValue("SecondEmail",  properties["SecondEmail"]);

						this.state.m_logger.debug("loadTbCards pass 3: transform: found a card with a SecondEmail and no PrimaryEmail - swapping: luid=" + id + " PrimaryEmail: " + properties["PrimaryEmail"]);

						mdbCard.editCardToDatabase(uri);
					}

					var checksum = context.contact_converter().crc32(properties);

					if (! (id > AUTO_INCREMENT_STARTS_AT)) // id might be null (not present) or zero (reset after the map was deleted)
					{
						id = zfcTb.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

						this.state.m_addressbook.setCardAttribute(mdbCard, uri, TBCARD_ATTRIBUTE_LUID, id);

						zfcTb.set(new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, id, FeedItem.ATTR_CS, checksum,
						                   FeedItem.ATTR_L, aUri[uri]));

						msg += " added:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfcTb.get(id).toString();
					}
					else
					{
						zinAssert(zfcTb.isPresent(id)); // See the validity checking in pass 1 above

						var zfi = zfcTb.get(id);

						// if things have changed, update the map...
						//
						var keyParent = zfi.keyParent();

						if (keyParent != aUri[uri] || zfi.get(FeedItem.ATTR_CS) != checksum)
						{
							var reason = " reason: ";
							if (keyParent != aUri[uri])
								reason += " parent folder changed: l:" + keyParent + " aUri[uri]: " + aUri[uri];
							if (zfi.get(FeedItem.ATTR_CS) != checksum)
								reason += " checksum changed: ATTR_CS: " + zfi.get(FeedItem.ATTR_CS) + " checksum: " + checksum;

							zfi.set(FeedItem.ATTR_CS, checksum);
							zfi.set(FeedItem.ATTR_L, aUri[uri]);

							msg += " changed: " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfi.toString();
							msg += reason;
						}
						else
							msg += " found:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfi.toString();
					}

					zfcTb.get(id).set(FeedItem.ATTR_PRES, '1');

					if (this.state.foreach_tb_card_functor && context.isInScopeTbLuid(id))
						this.state.foreach_tb_card_functor.run(abCard, id, properties);
				}
				else
					msg += " - ignored";

				this.state.m_logger.debug(msg);

				return true;
			}
		};

		for (uri in aUri)
			this.state.m_addressbook.forEachCard(uri, functor_foreach_card);

		// deletion detection works as follows.
		// 1. a FeedItem.ATTR_PRES attribute was added in pass 3 above
		// 2. iterate through the map
		//    - an item without a FeedItem.ATTR_PRES attribute is marked as deleted
		//    - remove the FeedItem.ATTR_PRES attribute so that it's not saved
		// 

		var functor_mark_deleted = {
			run: function(zfi)
			{
				if (zfi.isPresent(FeedItem.ATTR_DEL))
					; // do nothing
				else if (zfi.isPresent(FeedItem.ATTR_PRES))
					zfi.del(FeedItem.ATTR_PRES);
				else if (context.isInScopeTbLuid(zfi.key()))
				{
					zfi.set(FeedItem.ATTR_DEL, 1);
					context.debug("loadTbCards: - marking as deleted: " + zfi.toString());
				}

				return true;
			}
		};

		this.zfcTb().forEach(functor_mark_deleted, FeedCollection.ITER_NON_RESERVED);
	}

	return this.state.stopFailCode == null;
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
		this.state.stopFailArg  = [ keysToString(a_empty_folder_names) ];
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

				if (!isPropertyPresent(this.a_folder_count, name))
					this.a_folder_count[name] = true;
				else
					this.a_folder_violation[name] = 'failon.folder.name.duplicate';

				if (SyncFsm.isZmFolderReservedName(name))
					this.a_folder_violation[name] = 'failon.folder.name.reserved';

				if (SyncFsm.isZmFolderContainsInvalidCharacter(name))
					this.a_folder_violation[name] = 'failon.folder.name.invalid';

				if (isPropertyPresent(this.a_folder_violation, name))
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

SyncFsm.prototype.loadTbTestForGdCardsEmpty = function()
{
	var a_empty_contacts = this.state.foreach_tb_card_functor.m_a_empty_contacts;

	this.state.m_logger.debug("loadTbTestForGdCardsEmpty:" + " gd_sync_with: " + this.state.gd_sync_with +
	                          " gd_luid_ab_in_tb=" + this.state.gd_luid_ab_in_tb +
	                          " zfi: " + this.zfcTb().get(this.state.gd_luid_ab_in_tb) + "a_email_luid: " + aToString(a_empty_contacts));

	if (!this.is_slow_sync(this.state.sourceid_pr) && this.zfcTb().get(this.state.gd_luid_ab_in_tb).isPresent(FeedItem.ATTR_DEL))
		zinAssert(false); // this should get detected and handled earlier

	if (!isObjectEmpty(a_empty_contacts))
	{
		var grd                 = new GoogleRuleDetail(this.username());
		this.state.stopFailCode = 'failon.gd.conflict.4';
		this.state.stopFailArg  = [ grd ];

		grd.m_empty = new Object();
		
		for (var luid in a_empty_contacts)
			grd.m_empty[luid] = new GoogleRuleContactHandle(FORMAT_TB, luid, a_empty_contacts[luid], { uri: this.state.gd_ab_uri } );
	}

	return this.state.stopFailCode == null;
}

SyncFsm.prototype.loadTbTestForGdCardsUnique = function()
{
	zinAssert(this.state.stopFailCode == null);

	var a_email_luid = this.state.foreach_tb_card_functor.m_a_email_luid;
	var grd          = null;
	var i, email, luid, gd_properties, tb_properties;

	this.state.m_logger.debug("loadTbTestForGdCardsUnique: " + "a_email_luid: " + aToString(a_email_luid));

	for (email in a_email_luid)
		if (email != "" && aToLength(a_email_luid[email]) > 1)
		{
			if (!grd)
			{
				grd = new GoogleRuleDetail(this.username());
				grd.m_unique = new Object();
			}

			grd.m_unique[email] = new Object();

			for (luid in a_email_luid[email])
			{
				// because we're comparing tb with tb, we want to show all tb properties - because the difference
				// between contacts might be a property that doesn't map to google
				//
				tb_properties = this.getContactFromLuid(this.state.sourceid_tb, luid, FORMAT_TB);

				grd.m_unique[email][luid] = new GoogleRuleContactHandle(FORMAT_TB, luid, tb_properties, { uri: this.state.gd_ab_uri });
			}
		}

	if (grd)
	{
		this.state.stopFailCode = 'failon.gd.conflict.1';
		this.state.stopFailArg  = [ grd ];
	}

	return this.state.stopFailCode == null;
}

// On a slow sync, the <feed> contains all the <entry>'s so it's a good time to check
// that Google's uniqueness rule holds and if/when it doesn't then the <feed> stands up as evidence.
//
SyncFsm.prototype.testForGdServerConstraints = function()
{
	var a_gd_email = new Object();
	var email;

	zinAssert(this.is_slow_sync(this.state.sourceid_pr));

	var functor = {
		state: this.state,

		add_email: function(luid)
		{
			for (key in { 'PrimaryEmail' : null, 'SecondEmail' : null })
				if (isPropertyPresent(this.state.a_gd_contact[luid].m_properties, key))
				{
					email = GdContact.transformProperty(key, this.state.a_gd_contact[luid].m_properties[key]);

					if (!isPropertyPresent(a_gd_email, email))
						a_gd_email[email] = new Array();

					a_gd_email[email].push(luid);
				}
		},
		run: function(zfi)
		{
			var luid = zfi.key();

			if (zfi.type() == FeedItem.TYPE_CN)
				this.add_email(luid);

			return true;
		}
	};

	this.zfcPr().forEach(functor);

	this.debug("testForGdServerConstraints: a_gd_email: " + aToString(a_gd_email));

	var grd = null;

	for (email in a_gd_email)
		if (a_gd_email[email].length > 1)
		{
			if (!grd)
			{
				grd      = new GoogleRuleDetail(this.username());
				grd.m_unique = new Object();
			}

			grd.m_unique[email] = new Object();

			for (var i = 0; i < a_gd_email[email].length; i++)
			{
				luid                      = a_gd_email[email][i];
				tb_properties             = this.getContactPropertiesNormalised(this.state.sourceid_pr, luid);
				grd.m_unique[email][luid] = new GoogleRuleContactHandle(FORMAT_GD, luid, tb_properties,
				                                     { contact: this.state.a_gd_contact[luid], username: this.username() } );
			}
		}

	if (grd)
	{
		this.state.stopFailCode = 'failon.gd.conflict.3';
		this.state.stopFailArg  = [ grd ];
	}

	return this.state.stopFailCode == null;
}


// create a mapping from email address to gid for both tb and gd, then
// test that for every email address in tb and gd, it points to the same email ;
//
SyncFsm.prototype.testForGdRemoteConflictOnSlowSync = function()
{
	zinAssert(this.is_slow_sync(this.state.sourceid_pr));

	var zfcGid      = this.state.zfcGid;
	var a_gd_email  = new Object();
	var a_tb_email  = new Object();
	var a_conflict  = new Object();
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_pr = this.state.sourceid_pr;
	var email, luid;

	var functor = {
		state: this.state,
		m_email_keys: { 'PrimaryEmail' : null, 'SecondEmail' : null },

		add_email: function(luid, gid)
		{
			for (key in this.m_email_keys)
				if (isPropertyPresent(this.state.a_gd_contact[luid].m_properties, key))
					a_gd_email[GdContact.transformProperty(key, this.state.a_gd_contact[luid].m_properties[key])] = gid;
		},
		run: function(zfi)
		{
			var luid = zfi.key();

			if (zfi.type() == FeedItem.TYPE_CN)
			{
				var gid = this.state.aReverseGid[sourceid_pr][luid];

				var zfiGid = zfcGid.get(gid);

				this.add_email(luid, gid);
			}

			return true;
		}
	};

	this.zfcPr().forEach(functor);

	var a_email_luid = this.state.foreach_tb_card_functor.m_a_email_luid;
	var a_luid;

	for (email in a_email_luid)
	{
		a_luid = a_email_luid[email];
		a_tb_email[email] = this.state.aReverseGid[sourceid_tb][firstKeyInObject(a_luid)];
	}
	
	for (email in a_gd_email)
		if (isPropertyPresent(a_tb_email, email) && a_gd_email[email] != a_tb_email[email])
			a_conflict[email] = true;

	this.debug("testForGdRemoteConflictOnSlowSync:\n a_conflict: " + aToString(a_conflict) + "\n a_gd_email: " + aToString(a_gd_email) +
	                                                                                         "\n a_tb_email: " + aToString(a_tb_email) +
	                                                                                         "\n a_email_luid: " + aToString(a_email_luid));
	var grd = null;

	for (email in a_conflict)
	{
		if (!grd)
		{
			grd = new GoogleRuleDetail(this.username());
			grd.m_unique = new Object();
		}

		grd.m_unique[email] = new Object();

		for (luid in a_email_luid[email])
		{
			// Because we're comparing tb with google, we consider and show only the properties common to both tb and google.
			// This makes it less likely that we'll make the "best" decision when auto-selecting a contact, but
			// if we included all the contacts from both sides it means we'd need localised text for all google's
			// attributes - plus we'd have to parse it out of the xml - currently we only parse out what maps to tb...
			// If we included all tb and not google, it'd heavily favour selecting tb contacts...
			//
			tb_properties             = this.getContactPropertiesNormalised(sourceid_tb, luid);
			grd.m_unique[email][luid] = new GoogleRuleContactHandle(FORMAT_TB, luid, tb_properties, { uri: this.state.gd_ab_uri } );
		}

		luid          = zfcGid.get(a_gd_email[email]).get(sourceid_pr);
		tb_properties = this.getContactPropertiesNormalised(sourceid_pr, luid);

		grd.m_unique[email][luid] = new GoogleRuleContactHandle(FORMAT_GD, luid, tb_properties, { contact: this.state.a_gd_contact[luid], username: this.username() });
	}

	if (grd)
	{
		this.state.stopFailCode = 'failon.gd.conflict.2';
		this.state.stopFailArg  = [ grd ];
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

	zinAssertAndLog(isPropertyPresent(reverse[sourceid_tb], luid_tb), "sourceid_tb: " + sourceid_tb + " luid_tb: " + luid_tb);

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
	// this.resetLsoVer(gid_new, this.zfcPr().get(luid_pr));

	zfcGid.get(gid_new).del(FeedItem.ATTR_PRES);

	this.zfc(sourceid_pr).get(luid_pr).del(FeedItem.ATTR_LS);
}

// Some items on the server are supposed to be immutable (eg "Contacts" folder) but in fact the ms and md attributes may change.
// This method detects that and resets the gid's and the LS attributes in the sources to the new values so that buildGcs
// won't see any change.
// What is happening here is that the meta-data of these "immutable" folders is changing - eg colour.
//
SyncFsm.prototype.twiddleMapsForZmImmutables = function()
{
	this.twiddleMapsForZmImmutable(ZM_ID_FOLDER_CONTACTS);
	this.twiddleMapsForZmImmutable(ZM_ID_FOLDER_AUTO_CONTACTS);
}

SyncFsm.prototype.twiddleMapsForZmImmutable = function(luid_zm)
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_pr = this.state.sourceid_pr;
	var zfcGid      = this.state.zfcGid;
	var reverse     = this.state.aReverseGid; // bring it into the local namespace

	if (this.zfcPr().isPresent(luid_zm) &&
		this.zfcPr().get(luid_zm).isPresent(FeedItem.ATTR_LS))
	{
		zinAssert(isPropertyPresent(reverse[sourceid_pr], luid_zm));

		var zfiZm = this.zfcPr().get(luid_zm);
		var lso = new Lso(zfiZm.get(FeedItem.ATTR_LS));
		var gid = reverse[sourceid_pr][luid_zm];
		zinAssert(zfcGid.isPresent(gid) && zfcGid.get(gid).isPresent(sourceid_tb));
		var luid_tb = zfcGid.get(gid).get(sourceid_tb);

		if (lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER))
		{
			var res = lso.compare(zfiZm);

			if (res != 0)
			{
				// this would result in a change of note in buildGcs...
				//
				this.resetLsoVer(gid, zfiZm);                                    // set VER in gid and LS attribute in the zm luid map
				SyncFsm.setLsoToGid(zfcGid.get(gid), this.zfcTb().get(luid_tb)); // set                LS attribute in the tb luid map

				this.state.m_logger.debug("twiddleMapsForZmImmutable: Zimbra folder: " + zfiZm.name() + " changed!  sourceid: " +
				                                  sourceid_pr + " and luid=" + luid_zm);
			}
		}
	}
}

SyncFsm.prototype.updateGidDoChecksums = function(event)
{
	var context = this;

	var functor_foreach_luid_do_checksum = {
		state: this.state,

		run: function(zfi)
		{
			var luid     = zfi.key();
			var checksum = null;
			var luid_parent;
			var msg = "";

			if (!SyncFsm.isOfInterest(zfc, luid))
				foreach_msg += " luid=" + luid + " not of interest\n";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				foreach_msg += " luid=" + luid + " not relevant to gid\n";
			else if (zfi.isPresent(FeedItem.ATTR_DEL))
				foreach_msg += " luid=" + luid + " deleted - ignoring\n";
			else if (sourceid == SOURCEID_TB && !context.isInScopeTbLuid(luid))
				foreach_msg += " luid=" + luid + " not in scope - ignoring\n";
			else if (zfi.type() == FeedItem.TYPE_CN)
			{
				var a_properties    = context.getContactPropertiesNormalised(sourceid, luid, this.state.m_contact_converter_vary_none);
				var a_parent_in_map = context.getContactParentInMap(sourceid, luid);

				if (a_properties) // a card with no properties will never be part of a twin so don't bother
				{
					checksum = context.contact_converter().crc32(a_properties);
					var key = hyphenate('-', sourceid, a_parent_in_map, checksum);

					if (!isPropertyPresent(this.state.aHasChecksum, key))
						this.state.aHasChecksum[key] = new Object();

					this.state.aHasChecksum[key][luid] = true;
					this.state.aChecksum[sourceid][luid] = checksum;

					msg += strPadTo(checksum, 11) + " parent: " + a_parent_in_map;
					msg += " PrimaryEmail: " + (a_properties['PrimaryEmail'] ? a_properties['PrimaryEmail'] : "null");
				}
			}
			else if (zfi.type() == FeedItem.TYPE_FL || zfi.type() == FeedItem.TYPE_SF)
				msg += "n/a: " + zfi.name();

			var x = String(luid);
			if (x.length < 40)
				x = strPadTo(luid, 40);
			else
				x = strPadTo(x.substr(0,17) + "..." + x.substr(x.length-17), 40);

			foreach_msg += " luid: " + x + " checksum: " + msg + "\n";

			return true;
		}
	};

	if (event == 'evNext')
	{
		this.state.itSource = Iterator(this.state.sources, true);
		this.state.itSource.m_is_finished = false;
	}

	try {
		var sourceid    = this.state.itSource.next();
		var zfc         = this.zfc(sourceid);
		var foreach_msg = "about to run do_checksum functor for sourceid: " + sourceid + "\n";

		zfc.forEach(functor_foreach_luid_do_checksum);

		this.state.m_logger.debug(foreach_msg);
	}
	catch(ex if ex instanceof StopIteration) {
		this.state.itSource.m_is_finished = true;
	}

	// this.state.m_logger.debug("updateGidDoChecksums: aHasChecksum: ");
	// for (var key in this.state.aHasChecksum)
	// 	this.state.m_logger.debug("aHasChecksum  key: " + key + ": " + this.state.aHasChecksum[key]);
	// for (sourceid in this.state.sources)
	//	for (var luid in this.state.aChecksum[sourceid])
	// 		this.state.m_logger.debug("aChecksum sourceid: " + sourceid + " luid=" + luid + ": " + this.state.aChecksum[sourceid][luid]);
}

SyncFsm.prototype.updateGidFromSources = function(event)
{
	var zfcGid  = this.state.zfcGid;
	var reverse = this.state.aReverseGid; // bring it into the local namespace
	var context = this;
	var sourceid, zfc, format, foreach_msg;

	var functor_foreach_luid_fast_sync = {
		state: this.state,

		run: function(zfi)
		{
			var luid = zfi.key();
			var msg  = "fast_sync: " + sourceid + "/=" + luid;

			if (isPropertyPresent(reverse[sourceid], luid))
			{
				zfcGid.get(reverse[sourceid][luid]).set(FeedItem.ATTR_PRES, 1);
				msg += " already in gid";
			}
			else if (SyncFsm.isOfInterest(zfc, luid) && SyncFsm.isRelevantToGid(zfc, luid))
			{
				var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);

				msg += " added to gid=" + gid;
			}
			else
				msg += " not of interest - ignoring";

			foreach_msg += "\n  " + msg;

			return true;
		}
	};

	var functor_foreach_luid_slow_sync = {
		mapTbFolderNameToId: SyncFsm.getTopLevelFolderHash(this.zfcTb(), FeedItem.ATTR_NAME, FeedItem.ATTR_KEY),
		state: this.state,

		run: function(zfi)
		{
			var luid        = zfi.key();
			var msg         = "slow_sync: " + sourceid + "/=" + luid;
			var sourceid_tb = this.state.sourceid_tb;
			var luid_tb     = null;
			var gid;

			zinAssertAndLog(!isPropertyPresent(reverse[sourceid], luid), luid);
			zinAssert(sourceid != SOURCEID_TB);

			if (!SyncFsm.isOfInterest(zfc, luid))
				msg += " luid is not of interest - ignoring";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				msg += " luid is not relevant - ignoring";
			else
			{
				if (zfi.type() == FeedItem.TYPE_FL || zfi.type() == FeedItem.TYPE_SF)
				{
					zinAssertAndLog((zfi.type() != FeedItem.TYPE_FL) || !zfi.isForeign(), "foreign folder? zfi: " + zfi.toString());

					var abName = context.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfi);

					if (isPropertyPresent(this.mapTbFolderNameToId, abName))
						luid_tb = this.mapTbFolderNameToId[abName];

					if (luid_tb)
					{
						gid = context.setTwin(sourceid, luid, sourceid_tb, luid_tb, reverse)
						msg += " twin: folder with tb luid=" + luid_tb + " at gid=" + gid;
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid=" + gid;
					}
				}
				else
				{
					zinAssert(zfi.type() == FeedItem.TYPE_CN);
					zinAssert(isPropertyPresent(this.state.aChecksum, sourceid) && isPropertyPresent(this.state.aChecksum[sourceid], luid));

					var checksum    = this.state.aChecksum[sourceid][luid];
					var luid_parent = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
					var name_parent = context.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfc.get(luid_parent));

					var key = hyphenate('-', sourceid_tb, name_parent, checksum);
					// this.state.m_logger.debug("functor_foreach_luid_slow_sync: blah: testing twin key: " + key);

					if (isPropertyPresent(this.state.aHasChecksum, key) && !isObjectEmpty(this.state.aHasChecksum[key]))
						for (var luid_possible in this.state.aHasChecksum[key])
							if (this.state.aHasChecksum[key][luid_possible] &&
							    context.isTwin(sourceid_tb, sourceid, luid_possible, luid, context.state.m_contact_converter_vary_none))
							{
								luid_tb = luid_possible;
								break;
							}

					if (luid_tb)
					{
						gid = context.setTwin(sourceid, luid, sourceid_tb, luid_tb, reverse);
						msg += " twin: contact with tb luid=" + luid_tb + " at gid=" + gid + " tb contact: " + 
									context.shortLabelForLuid(sourceid_tb, luid_tb, FORMAT_TB);

						delete this.state.aHasChecksum[key][luid_tb];
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid=" + gid;
					}
				}
			}

			foreach_msg += "\n  " + msg;

			return true;
		}
	};

	if (event == 'evNext')
	{
		this.state.itSource = Iterator(this.state.sources, true);
		this.state.itSource.m_is_finished = false;
	}

	try {
		if ((event == 'evNext') || (this.state.itCollection == null) || this.state.itCollection.m_is_finished)
			this.state.itSource.m_sourceid = this.state.itSource.next();

		sourceid    = this.state.itSource.m_sourceid;
		zfc         = this.zfc(sourceid);
		format      = this.state.sources[sourceid]['format'];
		foreach_msg = "";

		if (event == 'evNext')
			zinAssert(format == FORMAT_TB); // the first time through the format has to be TB

		if ((format == FORMAT_TB) || !this.is_slow_sync(sourceid))
			zfc.forEach(functor_foreach_luid_fast_sync);
		else
		{
			if (this.state.itCollection == null || this.state.itCollection.m_is_finished)
			{
				this.state.itCollection = Iterator(zfc.m_collection, true);
				this.state.itCollection.m_is_finished = false;
				this.state.itCollection.m_count       = 0;
				this.state.itCollection.m_chunk       = 400;
			}

			zfc.forEachIterator(functor_foreach_luid_slow_sync, this.state.itCollection);
		}

		this.debug(foreach_msg);
		// if (zfc.length() < 400)
		// this.debug("slow_sync: and fast_sync: debugging suppressed because it's too large: sourceid: " + sourceid);
	}
	catch(ex if ex instanceof StopIteration) {
		this.state.itSource.m_is_finished = true;
	}
}

SyncFsm.prototype.updateGidFromSourcesSanityCheck = function()
{
	// sanity check that that all gid's have been visited
	//
	var functor_foreach_gid = {
		state: this.state,

		run: function(zfi)
		{
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

// On slow sync...
// For each thunderbird/google twin:
// if the google address doesn't have zindus xml then 
//   if thunderbird address field is not empty
//     tick the google version backwards to force Thunderbird to win
// else (the google address has zindus xml): 
//   if the google contact matches the thunderbird contact
//     do nothing - it's a twin
//   else if thunderbird address field is empty
//     tick the thunderbird version backwards to force Google to win
//   else
//     if the contacts have a email address, then
//       detwin them and (later gets reported as a conflict)
//     else
//       tick google backwards to let tb win
//

SyncFsm.prototype.twiddleMapsForGdPostalAddress = function()
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_gd = this.state.sourceid_pr;
	var msg         = "twiddleMapsForGdPostalAddress:\n";
	var context     = this;

	zinAssert(this.is_slow_sync(sourceid_gd));

	var functor_foreach_gid = {
		run: function(zfi)
		{
			if (zfi.isPresent(sourceid_tb) && zfi.isPresent(sourceid_gd) &&
			    context.zfcTb().get(zfi.get(sourceid_tb)).type() == FeedItem.TYPE_CN)
			{
				// Thunderbird and Google contact are twins
				//
				var luid_gd = zfi.get(sourceid_gd);
				var luid_tb = zfi.get(sourceid_tb);
				var contact = context.state.a_gd_contact[luid_gd];
				msg        += " zfi: " + zfi.toString();

				zinAssertAndLog(isPropertyPresent(context.state.a_gd_contact, luid_gd), "luid_gd=" + luid_gd);

				if (!contact.isAnyPostalAddressInXml())
				{
					msg += " gd doesn't have xml";

					if (this.is_tb_contact_have_an_address_field(luid_tb))
					{
						context.backdateZfcForcingItToLose(sourceid_gd, luid_gd);

						msg += " and tb has an address so backdating gd to force it to lose";
					}
					else
						msg += " and tb has no address";
				}
				else
				{
					msg += " gd has xml";

					if (context.isTwin(sourceid_tb, sourceid_gd, luid_tb, luid_gd, context.state.m_contact_converter_vary_gd_postal))
						msg += " is twin";
					else if (!this.is_tb_contact_have_an_address_field(luid_tb))
					{
						context.backdateZfcForcingItToLose(sourceid_tb, luid_tb);

						msg += " and tb doesn't have an address so backdating tb to force it to lose";
					}
					else if (isPropertyPresent(contact.m_properties, 'PrimaryEmail') ||
					         isPropertyPresent(contact.m_properties, 'SecondEmail'))
					{
						msg += " different from tb and email addresses are present so detwinning (which will lead to a conflict)";

						context.deTwin(zfi.key());
					}
					else
					{
						msg += " different from tb and no email address so backdating gd to force it to lose";

						// context.debug("blah: gd contact: " + contact.toString() + " tb properties: " + 
						//                      aToString(context.getContactFromLuid(sourceid_tb, luid_tb, FORMAT_TB)));

						context.backdateZfcForcingItToLose(sourceid_gd, luid_gd);
					}
				}

				msg += "\n";
			}

			return true;
		},
		is_tb_contact_have_an_address_field: function(luid_tb)
		{
			var ret        = false;
			var properties = context.getContactFromLuid(sourceid_tb, luid_tb, FORMAT_GD);

			for (var key in context.state.m_contact_converter_vary_gd_postal.gd_certain_keys_converted()["postalAddress"])
				if (isPropertyPresent(properties, key))
				{
					ret = true;
					break;
				}

			return ret;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid);

	context.debug(msg);

	this.debug("twiddleMapsForGdPostalAddress: zfcGid: " + this.state.zfcGid.toString());
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
	var sourceid_gd = this.state.sourceid_pr;
	var reverse     = this.state.aReverseGid;
	var zfcGid      = this.state.zfcGid;
	var msg         = "twiddleMapsToPairNewMatchingContacts:";
	var context     = this;
	var a_checksum  = {};
	var gid, old_gid, luid_gd, luid_tb;

	zinAssert(!this.is_slow_sync(sourceid_gd));

	var functor_foreach_gid = {
		state: this.state,

		run: function(zfi)
		{
			var a_luid = newObject(sourceid_tb, null, sourceid_gd, null);
			var luid, sourceid, zfc;
			var count = 0;

			for (sourceid in a_luid) 
			{
				if (zfi.isPresent(sourceid))
				{
					zfc  = context.zfc(sourceid);
					luid = zfi.get(sourceid);

					if (zfc.get(luid).type() == FeedItem.TYPE_CN)
					{
						if (zfc.get(luid).isPresent(FeedItem.ATTR_DEL))
						{
							count = 0;
							break;
						}
						else
						{
							count++;
							a_luid[sourceid] = luid;
						}

					}
				}
			}

			if (count == 1)
			{
				sourceid       = a_luid[sourceid_tb] ? sourceid_tb : sourceid_gd;
				luid           = a_luid[sourceid];
				var properties = null;

				var do_lookup = true;

				if (sourceid == sourceid_tb)
					do_lookup = do_lookup && context.isInScopeTbLuid(luid);

				do_lookup = do_lookup && SyncFsm.isOfInterest(context.zfc(sourceid), luid);
				do_lookup = do_lookup && SyncFsm.isRelevantToGid(context.zfc(sourceid), luid);

				if (do_lookup)
					properties = context.getContactPropertiesNormalised(sourceid, luid, this.state.m_contact_converter_vary_none);

				if (properties) // a contact with no properties will never be part of a twin so don't bother
					this.add_to_a_checksum(sourceid, luid, properties);
			}

			return true;
		},
		add_to_a_checksum: function(sourceid, luid, properties)
		{
			var checksum = context.contact_converter().crc32(properties);

			if (!isPropertyPresent(a_checksum, checksum))
				a_checksum[checksum] = new Object();

			a_checksum[checksum][sourceid] = luid;
		}
	};

	zfcGid.forEach(functor_foreach_gid);

	for (var checksum in a_checksum)
		if (aToLength(a_checksum[checksum]) == 2)
		{
			luid_tb = a_checksum[checksum][sourceid_tb];
			luid_gd = a_checksum[checksum][sourceid_gd];
			old_gid = reverse[sourceid_gd][luid_gd]; // setTwin uses the gid belonging to sourceid_tb

			delete reverse[sourceid_gd][luid_gd];

			zfcGid.del(old_gid);

			gid = this.setTwin(sourceid_gd, luid_gd, sourceid_tb, luid_tb, reverse);

			msg += "\n ADD by twinning: tb: " + sourceid_tb + "/=" + luid_tb + " and gd: " + sourceid_gd + "/=" + luid_gd + " gid=" + gid;
		}

	this.debug(msg);
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

// This method is mostly used in matching contacts.
// it filters out properties not common to all formats and normalises PrimaryEmail and SecondEmail to lowercase
// (via GdContact.transformProperties)
// So don't use it when updating a target source!
// 
SyncFsm.prototype.getContactPropertiesNormalised = function(sourceid, luid, contact_converter)
{
	var zfc         = this.zfc(sourceid);
	var zfi         = zfc.get(luid); zinAssert(zfi);
	var format      = this.state.sources[sourceid]['format'];
	var properties, name_parent_map;

	if (typeof(contact_converter) == 'undefined')
		contact_converter = this.contact_converter();

	zinAssert(arguments.length == 2 || arguments.length == 3);
	zinAssert(contact_converter);
	zinAssert(zfi.type() == FeedItem.TYPE_CN);

	if (format == FORMAT_TB)
	{
		zinAssert(zfi.isPresent(FeedItem.ATTR_L));

		var luid_parent        = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
		var name_parent_public = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid_parent));
		var uri                = this.state.m_addressbook.getAddressBookUriByName(name_parent_public);
		var abCard             = uri ? this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid) : null;

		if (abCard)
			properties = this.state.m_addressbook.getCardProperties(abCard);
		else
		{
			properties = { };

			this.state.m_logger.warn("getContactPropertiesNormalised: unable to retrieve properties for card: luid: " + luid +
			                         " uri: " + uri + "\n" + executionStackAsString());
		}
	}
	else if (format == FORMAT_ZM)
	{
		zinAssertAndLog(isPropertyPresent(this.state.aSyncContact, luid), luid);
		properties = contact_converter.convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncContact[luid].element);
	}
	else if (format == FORMAT_GD)
	{
		zinAssertAndLog(isPropertyPresent(this.state.a_gd_contact, luid), luid);
		properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, this.state.a_gd_contact[luid].m_properties);
	}
	else
		zinAssertAndLog(false, format);

	// This is why slow sync doesn't notice differences in _AimScreenName for example ... even though it is synced b/n tb and google
	//
	contact_converter.removeKeysNotCommonToAllFormats(FORMAT_TB, properties);

	// This is why Hello.World@example.com in Thunderbird matches hello.world@example.com in google (and vice versa)
	//
	if (this.formatPr() == FORMAT_GD)
		GdContact.transformProperties(properties);

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
			if (isPropertyPresent(b, i) && a[i] == b[i])
				cMatch++;
	}

	is_twin = length_a == cMatch;

	// this.state.m_logger.debug("isTwin: blah: returns: " + is_twin + " sourceid/luid: " + sourceid_a + "/=" + luid_a
	//                                                               + " sourceid/luid: " + sourceid_b + "/=" + luid_b);

	return is_twin;
}

SyncFsm.prototype.buildGcs = function()
{
	var aGcs          = new Object();  // an associative array where the key is a gid and the value is a Gcs object
	var aZfcCandidate = new Object();  // a copy of the luid maps updated as per this sync
	var sourceid_tb   = this.state.sourceid_tb;
	var zfcGid        = this.state.zfcGid;
	var reverse       = this.state.aReverseGid; // bring it into the local namespace
	var context       = this;

	for (var i in this.state.sources)
		aZfcCandidate[i] = this.zfc(i).clone(); // cloned because items get deleted out of this during merge

	// delete candidate mapitems in other sources once they've been compared
	//
	var functor_delete_other_candidate_mapitems = {
		run: function(key, value)
		{
			if (isPropertyPresent(context.state.sources, key) && key != FeedItem.ATTR_VER && key != sourceid)
				aZfcCandidate[key].del(value);

			return true;
		}
	};

	var buildgcs_msg;
	var functor_foreach_candidate = {
		state:   this.state,

		run: function(zfi)
		{
			var zfc = context.zfc(sourceid);
			var luid = zfi.key();

			buildgcs_msg = "";
			skip_msg = null;

			if (sourceid == this.state.sourceid_tb && !context.isInScopeTbLuid(luid))
				skip_msg = "not in scope";
			else if (!SyncFsm.isOfInterest(zfc, luid))
				skip_msg = "not of interest";
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				skip_msg = "not relevant";
			else
			{
				zinAssert(isPropertyPresent(reverse, sourceid) && isPropertyPresent(reverse[sourceid], luid));

				var gid = reverse[sourceid][luid];

				buildgcs_msg += " gid=" + gid;
				
				if (zfcGid.get(gid).isPresent(FeedItem.ATTR_VER))
					buildgcs_msg += " ver: " + zfcGid.get(gid).get(FeedItem.ATTR_VER);

				aGcs[gid] = this.compare(gid);// aZfcCandidate, reverse, zfcGid

				zfcGid.get(gid).forEach(functor_delete_other_candidate_mapitems, FeedItem.ITER_GID_ITEM);
			}

			if (skip_msg)
				context.debug("buildGcs: candidate sourceid: " + sourceid + " - " + skip_msg + " - skipped: zfi: "+ zfi.toString());
			else
				context.debug("buildGcs:\n  candidate sourceid: " + sourceid + buildgcs_msg);

			return true;
		},

		compare: function(gid)
		{
			var aNeverSynced   = new Object();
			var aChangeOfNote  = new Object();
			var aVerMatchesGid = new Object();
			var aDeletedYes    = new Object();
			var aDeletedNo     = new Object();
			var ret = null;
			var msg = "";

			var functor_each_luid_in_gid = {
				state:   this.state,

				run: function(sourceid, luid)
				{
					if (!isPropertyPresent(this.state.sources, sourceid) || sourceid == FeedItem.ATTR_VER)
						return true;

					var zfi = aZfcCandidate[sourceid].get(luid);
					var msg = "  compare:  sourceid: " + sourceid + " zfi: " + zfi.toString();

					if (!zfi.isPresent(FeedItem.ATTR_LS))
					{
						aNeverSynced[sourceid] = true;
						msg += " added to aNeverSynced";
					}
					else
					{
						var lso = new Lso(zfi.get(FeedItem.ATTR_LS));

						if (zfi.isPresent(FeedItem.ATTR_DEL))
							aDeletedYes[sourceid] = true;
						else
							aDeletedNo[sourceid] = true;

						if (lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER))
						{
							var res = lso.compare(zfi);

							if (res == 0)
							{
								aVerMatchesGid[sourceid] = true;
								msg += " added to aVerMatchesGid";
							}
							else if (res == 1)
							{
								aChangeOfNote[sourceid] = true;
								msg += " added to aChangeOfNote";

								// sanity check that the Contact folder hasn't changed - it's supposed to be immutable (isn't it?)
								//
								if (context.zfc(sourceid).get(luid).type() == FeedItem.TYPE_FL)
									zinAssert(context.shortLabelForLuid(sourceid, luid, FORMAT_TB) != TB_PAB);
							}
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

			zinAssertAndLog(cNeverSynced == 0 || cNeverSynced == 1, "gid=" + gid + " cNeverSynced: " + cNeverSynced + " " +
			                                                   buildgcs_msg + "\n" + msg);

			if (cNeverSynced == 1)
			{
				zinAssertAndLog(cVerMatchesGid == 0 && cChangeOfNote == 0, "gid=" + gid + " " + buildgcs_msg + "\n" + msg);

				ret = new Gcs(firstKeyInObject(aNeverSynced), Gcs.WIN);
			}
			else if (cChangeOfNote == 0)
			{
				if (cVerMatchesGid == 1)
					ret = new Gcs(firstKeyInObject(aVerMatchesGid), Gcs.WIN);
				else
				{
					// if this assertion fails, you want to look elsewhere for the cause eg issue #85
					//
					zinAssertAndLog(isPropertyPresent(aVerMatchesGid, sourceid_tb), buildgcs_msg + "\n" + msg);
					ret = new Gcs(sourceid_tb, Gcs.WIN);
				}
			}
			else if (cChangeOfNote == 1)
				ret = new Gcs(firstKeyInObject(aChangeOfNote), Gcs.WIN);
			else
			{
				var lowest_sourceid = null;

				for (var i in aChangeOfNote)
					if (lowest_sourceid == null || aChangeOfNote[i] < lowest_sourceid)
						lowest_sourceid = i;

				ret = new Gcs(lowest_sourceid, Gcs.CONFLICT);
			}

			msg = "  compare: gid=" + gid + " returns: " + ret.toString() + msg;

			buildgcs_msg += "\n" + msg;

			return ret;
		}
	};

	for (sourceid in this.state.sources)
		aZfcCandidate[sourceid].forEach(functor_foreach_candidate);
	
	var a_winner_tb_state_win = new Array();
	var msg = "";

	for (var gid in aGcs)
	{
		if (aGcs[gid].sourceid == SOURCEID_TB && aGcs[gid].state == Gcs.WIN)
			a_winner_tb_state_win.push(gid);
		else
			msg += "\n gid=" + gid + ": " + aGcs[gid].toString();
	}

	this.state.m_logger.debug("buildGcs: aGcs:" + msg +
	      (a_winner_tb_state_win.length > 0 ?
		  	("\n " + aGcs[a_winner_tb_state_win[0]].toString() + ": " + a_winner_tb_state_win.toString()) : ""));

	return aGcs;
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
			if (zfcGid.get(gid).isPresent(this.state.sourceid_tb))
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
		zinAssert(this.state.gd_luid_ab_in_tb);

		var zfi = this.zfcTb().get(luid_tb);
	
		if (zfi.type() == FeedItem.TYPE_CN)
			ret = (zfi.get(FeedItem.ATTR_L) == this.state.gd_luid_ab_in_tb);
		else if (zfi.type() == FeedItem.TYPE_FL)
			ret = (luid_tb == this.state.gd_luid_ab_in_tb);
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
	var msg, suo;

	for (var gid in aGcs)
		if (this.isInScopeGid(gid))
		{
			suo = null;
			msg = null;

			switch (aGcs[gid].state)
			{
				case Gcs.WIN:
				case Gcs.CONFLICT:
					var sourceid_winner = aGcs[gid].sourceid;
					var zfcWinner = this.zfc(sourceid_winner);
					var zfiWinner = zfcWinner.get(zfcGid.get(gid).get(sourceid_winner));

					if (!zfiWinner.isPresent(FeedItem.ATTR_LS)) // winner is new to gid
					{
						zinAssert(!zfcGid.get(gid).isPresent(FeedItem.ATTR_VER));

						zinAssert(zfcGid.get(gid).length() == 2); // just the id property and the winning sourceid

						msg = "is new to gid  - MDU";

						suo = new Suo(gid, aGcs[gid].sourceid, sourceid_winner, Suo.MDU);
					}
					else
					{
						var lso = new Lso(zfiWinner.get(FeedItem.ATTR_LS));
						var res = lso.compare(zfiWinner);

						zinAssert(lso.get(FeedItem.ATTR_VER) == zfcGid.get(gid).get(FeedItem.ATTR_VER));
						zinAssert(res >= 0); // winner either changed in an interesting way or stayed the same

						if (res == 1)
						{
							msg = "changed in an interesting way - MDU";
							suo = new Suo(gid, aGcs[gid].sourceid, sourceid_winner, Suo.MDU);
						}
						else
						{
							if (!isPropertyPresent(a_no_change, aGcs[gid].sourceid))
								a_no_change[aGcs[gid].sourceid] = new Array();

							a_no_change[aGcs[gid].sourceid].push(gid);

							msg = "didn't change";
						}
					}
					break;

				default:
					zinAssert(false);
			}

			if (suo != null)
			{
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
	var big_msg    = "";
	var a_winner_matches_gid = new Object();
	var msg, suo, a_sourceid;;

	for (sourceid in this.state.sources)
		aSuoResult[sourceid] = new Object();


	for (var gid in aGcs)
		for (sourceid in this.state.sources)
			if (sourceid != aGcs[gid].sourceid) // only look at losers
				if (this.isInScopeGid(gid))
	{
		suo = null;
		msg = "";

		switch (aGcs[gid].state)
		{
			case Gcs.WIN:
			case Gcs.CONFLICT:
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
					if (!isPropertyPresent(a_winner_matches_gid, sourceid))
						a_winner_matches_gid[sourceid] = new Array();

					a_winner_matches_gid[sourceid].push(gid); // msg = " winner matches gid - no change";
				}
				else if (zfiWinner.isPresent(FeedItem.ATTR_DEL))
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
				else if (zfiTarget.isPresent(FeedItem.ATTR_DEL))
				{
					msg = " winner modified but loser had been deleted - ";
					suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.ADD);
				}
				else
					suo = new Suo(gid, sourceid_winner, sourceid, Suo.MOD);

				if (aGcs[gid].state == Gcs.CONFLICT && !is_delete_pair)
				{
					zinAssert(suo);

					var context = this;
					function getSourceName(sourceid) {
						return context.state.sources[sourceid]['format'] == FORMAT_TB ?
				           		stringBundleString("brand.thunderbird").toLowerCase() :
				           		stringBundleString("brand.server").toLowerCase();
					};

					var conflict_msg       = "";
					var source_name_winner = getSourceName(sourceid_winner);
					var source_name_loser  = getSourceName(sourceid);
					var format_winner      = this.state.sources[sourceid_winner]['format'];
					var item               = (zfiWinner.type() == FeedItem.TYPE_CN ? "contact" : "addressbook");
					var short_label_winner = this.shortLabelForLuid(sourceid_winner, luid_winner, FORMAT_TB);

					conflict_msg += "conflict: " + item + ": " + short_label_winner +
									" on " + source_name_winner +
									" wins and " + item + " on " + source_name_loser +
									" is " + Suo.opcodeAsStringPastTense(suo.opcode);

					this.state.aConflicts.push(conflict_msg);

					// sanity check that PAB and it's counterpart is invariant
					//
					if (zfiWinner.type() == FeedItem.TYPE_FL)
					{
						var luid_loser         = zfcGid.get(gid).get(sourceid);
						var short_label_loser  = this.shortLabelForLuid(sourceid, luid_loser, FORMAT_TB);

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

			if (!isPropertyPresent(aSuoResult, sourceid))
				aSuoResult[sourceid] = new Object();

			if (!isPropertyPresent(aSuoResult[sourceid], bucket))
				aSuoResult[sourceid][bucket] = new Object();

			if (suo.opcode == Suo.ADD)
				aSuoResult[sourceid][bucket][indexSuo++] = suo;
			else
				aSuoResult[sourceid][bucket][this.state.zfcGid.get(gid).get(sourceid)] = suo;

			msg += " added suo: " + suo.toString();
		}

		if (msg.length > 0)
			big_msg += "\n gid=" + gid + " loser: " + sourceid + " gcs: " + aGcs[gid].toString() + " -" + msg;
	}

	for (sourceid in a_winner_matches_gid)
		if (a_winner_matches_gid[sourceid].length > 0)
			big_msg += "\n loser: " + sourceid + " gcs: " + aGcs[a_winner_matches_gid[sourceid][0]].toString() +
			           ": gids: " + a_winner_matches_gid[sourceid].toString();

	this.state.m_logger.debug("suoBuildLosers: " + big_msg);


	return aSuoResult;
}

// Background: ORDER_SOURCE_UPDATE specifies that contact delete is processed before folder delete.
// The main reason to remove Suo's that delete contacts when there is already a Suo to delete the parent folder is:
// - When we move the folder to Trash, the contacts remain in the parent folder in the trash
//   If we deleted the contacts first, we'd lose the parent-child relationship between contact and folder in the Zimbra Trash.
// Similar reasoning applies to shared folders and their contacts.
// It's also a performance optimisation.
// There's matching code in UpdateTb that mark the contacts whose DEL suo's have been removed as deleted
// UpdateZm doesn't have analoguos code because with Tb, when the folder is deleted, the contacts are really deleted,
// whereas with Zimbra, the contacts aren't deleted, they're in the Trash and get removed from the source map + gid because
// they're no longer of interest.
//
SyncFsm.prototype.removeContactDeletesWhenFolderIsBeingDeleted = function()
{
	var aFoldersBeingDeleted; // each key in this hash is the gid of a folder about to be deleted
	var aOperationsToRemove;  // each key in this hash is the indexSuo of a contact delete operation that is to be removed
	var i, suo, indexSuo, luid_target, l_target, gid_l_target, msg;
	var aBuckets = [Suo.DEL | FeedItem.TYPE_FL, Suo.DEL | FeedItem.TYPE_SF];
	var aBucket;

	this.state.a_folders_deleted = new Object();

	for (var sourceid in this.state.sources)
	{
		aOperationsToRemove  = new Object();

		for (i = 0; i < aBuckets.length; i++)
		{
			aBucket = this.state.aSuo[sourceid][aBuckets[i]];

			for (indexSuo in aBucket)
			{
				suo = aBucket[indexSuo];
				this.state.a_folders_deleted[suo.gid] = new Array();
			}
		}

		for (indexSuo in this.state.aSuo[sourceid][Suo.DEL | FeedItem.TYPE_CN])
		{
			suo         = this.state.aSuo[sourceid][Suo.DEL | FeedItem.TYPE_CN][indexSuo];
			luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
			l_target    = SyncFsm.keyParentRelevantToGid(this.zfc(sourceid), luid_target);
			gid_l_target = this.state.aReverseGid[sourceid][l_target];

			if (isPropertyPresent(this.state.a_folders_deleted, gid_l_target))
			{
				aOperationsToRemove[indexSuo] = null;
				this.state.a_folders_deleted[gid_l_target].push(suo);
			}
		}

		for (indexSuo in aOperationsToRemove)
			delete this.state.aSuo[sourceid][Suo.DEL | FeedItem.TYPE_CN][indexSuo];
	}

	if (!isObjectEmpty(this.state.a_folders_deleted))
	{
		var msg = "removeContactDeletesWhenFolderIsBeingDeleted: ";

		for (var gid in this.state.a_folders_deleted)
			msg += " \nfolder being deleted gid=" + gid + " suos of child contacts: " + this.state.a_folders_deleted[gid].toString();

		this.debug(msg);
	}

}

// Test that no folder names have both an ADD and DEL operation
//
// If there is, we have to give up convergence because:
// we apply the operations in a fixed order, namely ADD followed by DEL, and almost certainly the user did DEL followed by ADD.
// Yes, this is ugly.  The right thing to do here would be to rewrite the aSuo code into an container that can be re-ordered
// to suit it's contents.
// Giving up consistency is easier given the limitation, and after all, how often are:
// - zimbra users going to do: DEL addressbook X/flush trash/ADD addressbook X
// - tb users going to do: DEL addressbook X/ADD addressbook X
//

SyncFsm.prototype.testForConflictingUpdateOperations = function()
{
	var aName = new Object();
	var sourceid_loser;

	for (sourceid_loser in this.state.sources)
	{
		this.testForConflictingUpdateOperationsHelper(aName, sourceid_loser, Suo.ADD | FeedItem.TYPE_FL);
		this.testForConflictingUpdateOperationsHelper(aName, sourceid_loser, Suo.ADD | FeedItem.TYPE_SF);

		this.state.m_logger.debug("testForConflictingUpdateOperations: sourceid_loser: " + sourceid_loser +
		                          " folders being added: " + aToString(aName));

		this.testForConflictingUpdateOperationsHelper(aName, sourceid_loser, Suo.DEL | FeedItem.TYPE_SF);
		this.testForConflictingUpdateOperationsHelper(aName, sourceid_loser, Suo.DEL | FeedItem.TYPE_FL);

		this.state.m_logger.debug("testForConflictingUpdateOperations: sourceid_loser: " + sourceid_loser +
		                          " both added and deleted (failed if anything >= 2): " + aToString(aName));

		for (var name in aName)
			if (aName[name] >= 2)
			{
				this.state.stopFailCode    = 'failon.folder.source.update';
				this.state.stopFailArg     = [ name ];
				this.state.stopFailTrailer = stringBundleString("text.suggest.reset");
				break;
			}

		if (this.state.stopFailCode)
			break;
	}

	return this.state.stopFailCode == null;
}

SyncFsm.prototype.testForConflictingUpdateOperationsHelper = function(aName, sourceid_loser, op)
{
	var suo, sourceid, format, zfc, luid, zfi, name;

	if (isPropertyPresent(this.state.aSuo[sourceid_loser], op))
		for (var indexSuo in this.state.aSuo[sourceid_loser][op])
		{
			// - if it's an ADD, then use winner, but if it's a del, then use target because the winner's name might have changed
			//   eg when a zimbra folder gets moved into trash it may also get renamed to avoid clashes.
			// - names are normalised into thunderbird's namespace so that we match zimbra: fred with thunderbird: zindus/fred
			//
			suo      = this.state.aSuo[sourceid_loser][op][indexSuo];
			sourceid = (op & Suo.ADD) ? suo.sourceid_winner : sourceid = suo.sourceid_target;
			format   = this.state.sources[sourceid]['format'];
			zfc      = this.zfc(sourceid);
			luid     = this.state.zfcGid.get(suo.gid).get(sourceid);
			name     = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid));

			if (isPropertyPresent(aName, name))
				aName[name]++;
			else
				aName[name]=1;
		}
}

SyncFsm.prototype.shortLabelForLuid = function(sourceid, luid, target_format)
{
	var zfc    = this.zfc(sourceid);
	var format = this.state.sources[sourceid]['format'];
	var zfi    = zfc.get(luid);
	var type   = zfi.type();
	var ret    = "";
	var key;

	if (type == FeedItem.TYPE_FL || type == FeedItem.TYPE_SF)
		ret += this.state.m_folder_converter.convertForPublic(target_format, format, zfi);
	else
	{
		zinAssertAndLog(type == FeedItem.TYPE_CN, type);

		if (zfi.isPresent(FeedItem.ATTR_DEL))
			ret += "<deleted>";
		else
		{
			var properties = this.getContactFromLuid(sourceid, luid, format);
		
			if (properties)
				ret += this.shortLabelForContactProperties(properties);
			else
				ret += "contact sourceid: " + sourceid + " luid=" + luid;
		}
	}

	// this.state.m_logger.debug("shortLabelForLuid: blah: sourceid: " + sourceid + " luid=" + luid + " target_format: " + target_format +
	//                           " returns: " + ret);

	return ret;
}

SyncFsm.prototype.shortLabelForContactProperties = function(properties)
{
	var ret = "";
	var key;

	key = 'DisplayName';

	if (isPropertyPresent(properties, key))
		ret += "<" + properties[key] + "> ";

	key = 'PrimaryEmail';

	if (isPropertyPresent(properties, key))
		ret += properties[key];

	key = 'SecondEmail';

	if (ret == "" && isPropertyPresent(properties, key))
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

		if (zfi.type() == FeedItem.TYPE_FL && !zfi.isPresent(FeedItem.ATTR_DEL))
		{
			zinAssert(zfi.isPresent(FeedItem.ATTR_NAME));

			name = this.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfi);

			if (isPropertyPresent(aFolderName, name))
			{
				this.state.stopFailCode = 'failon.folder.name.clash';
				this.state.stopFailArg  = [ name ]; // FIXME - this is an internal facing name ie zindus_pab
				break;
			}
			else
				aFolderName[name] = gid;
		}
	}

	var ret = this.state.stopFailCode == null;

	if (!ret)
		this.state.m_logger.debug("testForFolderNameDuplicate:" + " returns: " + ret + " name: " + name +
						          " aFolderName: " + aToString(aFolderName) + " stopFailCode: " + this.state.stopFailCode);

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
		suo = aSuoWinners[i];

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
	var sourceid;
	var is_slow_sync = this.is_slow_sync(this.state.sourceid_pr);

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

	this.state.m_logger.debug("testForCreateSharedAddressbook: is_slow_sync(" + this.state.sourceid_pr + "): " + is_slow_sync);
	this.state.m_logger.debug("testForCreateSharedAddressbook: Tb: " + aToString(a_name[this.state.sourceid_tb]));
	this.state.m_logger.debug("testForCreateSharedAddressbook: Zm: " + aToString(a_name[this.state.sourceid_pr]));

	for (var name in a_name[this.state.sourceid_tb])
		if (!isPropertyPresent(a_name[this.state.sourceid_pr], name))
		{
			this.state.stopFailCode   = 'failon.folder.cant.create.shared';
			this.state.stopFailArg    = [ name ];
			break;
		}

	var passed = this.state.stopFailCode == null;

	this.state.m_logger.debug("testForCreateSharedAddressbook: passed: " + passed);

	return passed;
}

SyncFsm.prototype.testForEmailedContactsMatch = function()
{
	var id = ZM_ID_FOLDER_AUTO_CONTACTS;
	var passed = true;
	var msg = "testForEmailedContactsMatch:";

	if (!this.zfcPr().isPresent(id) || this.zfcPr().get(id).isPresent(FeedItem.ATTR_DEL))
		msg += " server doesn't have: " + ZM_FOLDER_EMAILED_CONTACTS;
	else if (this.is_slow_sync(this.state.sourceid_pr))
		msg += " id=" + id + " sourceid: " + this.state.sourceid_pr + " is_slow_sync: " + this.is_slow_sync(this.state.sourceid_pr);
	else
	{
		msg += " server has: " + ZM_FOLDER_EMAILED_CONTACTS;

		passed = passed && this.testForFolderPresentInZfcTb(TB_EMAILED_CONTACTS);

		msg += " present: " + passed;

		passed = passed && this.testForReservedFolderInvariant(TB_EMAILED_CONTACTS);

		msg += " invariant: " + passed;
	}

	this.state.m_logger.debug(msg + " passed: " + passed);

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

				if (isPropertyPresent(this.a_key_fl, keyFl))
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
SyncFsm.prototype.entryActionConverge1 = function(state, event, continuation)
{
	var passed = true;

	this.state.stopwatch.mark(state + " 1");

	this.debug("entryActionConverge1: zfcTb:\n" + this.zfcTb().toString());
	this.debug("entryActionConverge1: zfcPr:\n" + this.zfcPr().toString());

	if (this.formatPr() == FORMAT_ZM)
	{
		passed = passed && this.sharedFoldersUpdateZm();

		this.state.stopwatch.mark(state + " 2");

		if (passed)
			this.fakeDelOnUninterestingContacts();

		this.state.stopwatch.mark(state + " 3");

		passed = passed && this.testForEmailedContactsMatch();

		this.state.stopwatch.mark(state + " 4");

		passed = passed && this.testForCreateSharedAddressbook();
	}
	else if (this.formatPr() == FORMAT_GD && this.is_slow_sync(this.state.sourceid_pr))
		passed = passed && this.testForGdServerConstraints();

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionConverge2 = function(state, event, continuation)
{
	var nextEvent;

	this.state.stopwatch.mark(state + " 1");

	if (this.is_slow_sync(this.state.sourceid_pr))
	{
		this.updateGidDoChecksums(event);

		nextEvent = (this.state.itSource.m_is_finished ? 'evNext' : 'evRepeat');
	}
	else
		nextEvent = 'evNext';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionConverge3 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	this.updateGidFromSources(event);                    // 1. map all luids into a single namespace (the gid)

	continuation(this.state.itSource.m_is_finished ? 'evNext' : 'evRepeat');
}

SyncFsm.prototype.entryActionConverge4 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	this.updateGidFromSourcesSanityCheck();              // 2. sanity check

	continuation('evNext');
}

SyncFsm.prototype.entryActionConverge5 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	if (this.formatPr() == FORMAT_GD)
	{
		if (this.is_slow_sync(this.state.sourceid_pr) && this.state.gd_is_sync_postal_address)
			this.twiddleMapsForGdPostalAddress();

		if (!this.is_slow_sync(this.state.sourceid_pr))
			this.twiddleMapsToPairNewMatchingContacts();
	}
	else if (this.formatPr() == FORMAT_ZM)
	{
		this.twiddleMapsForZmImmutables();
	}

	continuation('evNext');
}

SyncFsm.prototype.entryActionConverge6 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	this.state.aGcs = this.buildGcs();                   // 3. reconcile the sources (via the gid) into a single truth
	                                                     //    winners and conflicts are identified here
	this.state.stopwatch.mark(state + " 2");

	this.buildPreUpdateWinners(this.state.aGcs);         // 4. save winner state before winner update to distinguish ms vs md update

	continuation('evNext');
}

SyncFsm.prototype.entryActionConverge7 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	var passed = true;
	
	passed = passed && this.testForFolderNameDuplicate(this.state.aGcs); // 4. a bit of conflict detection

	if (this.formatPr() == FORMAT_GD && this.is_slow_sync(this.state.sourceid_pr))
		passed = passed && this.testForGdRemoteConflictOnSlowSync();

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionConverge8 = function(state, event, continuation)
{
	var aSuoWinners;

	this.state.stopwatch.mark(state + " 1");

	aSuoWinners = this.suoBuildWinners(this.state.aGcs);   // 6.  generate operations required to bring meta-data for winners up to date

	this.suoRunWinners(aSuoWinners);                       // 7.  run the operations that update winner meta-data

	continuation('evNext');
}

SyncFsm.prototype.entryActionConverge9 = function(state, event, continuation)
{
	this.state.stopwatch.mark(state + " 1");

	this.state.aSuo = this.suoBuildLosers(this.state.aGcs);// 8.  generate the operations required to bring the losing sources up to date

	this.state.stopwatch.mark(state + " 2");

	this.removeContactDeletesWhenFolderIsBeingDeleted();   // 9. remove contact deletes when folder is being deleted

	passed = this.testForConflictingUpdateOperations();    // 10. abort if any update operations could lead to potential inconsistency

	this.state.stopwatch.mark(state + " 3");

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

// Add the ATTR_KEEP attribute to deleted tb mapitems when the gid has references to sources that aren't being synced.
// This drives deletion of the items in those sources when they get synced because the deleted tb item wins.
//
SyncFsm.prototype.keepCertainDeletedTbMapItems = function()
{
	var sourceid_tb = this.state.sourceid_tb;
	var aReverseGid = this.state.aReverseGid;
	var zfcGid      = this.state.zfcGid;
	var msg         = "";
	var is_a_source_in_gid_not_being_synced;

	var functor_gid = {
		state: this.state,

		run: function(sourceid, luid)
		{
			is_a_source_in_gid_not_being_synced = !isPropertyPresent(this.state.sources, sourceid)

			return !is_a_source_in_gid_not_being_synced;
		}
	};

	var functor_tb = {
		state: this.state,
		run: function(zfi)
		{
			if (zfi.isPresent(FeedItem.ATTR_DEL))
			{
				var luid = zfi.key();
				var gid  = isPropertyPresent(aReverseGid[sourceid_tb], luid) ? aReverseGid[sourceid_tb][luid] : null;

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
	var i, gid, id, type, sourceid_target, luid_winner, luid_target, zfcWinner, zfcTarget, zfcGid, zfiWinner, zfiGid;
	var zc, uri, abCard, l_winner, l_gid, l_target, l_current, properties, attributes, msg;

	this.state.stopwatch.mark(state);

	if (!this.state.is_source_update_problem)
		bigloop:
		for (var i = 0; i < ORDER_SOURCE_UPDATE.length; i++)
			if (isPropertyPresent(this.state.aSuo[this.state.sourceid_tb], ORDER_SOURCE_UPDATE[i]))
				for (var indexSuo in this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]])
	{
		suo  = this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]][indexSuo];
		gid  = suo.gid;
		type = this.feedItemTypeFromGid(gid, suo.sourceid_winner);
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
		msg = "";

		this.state.m_logger.debug("entryActionUpdateTb: acting on suo: - opcode: " + Suo.opcodeAsString(ORDER_SOURCE_UPDATE[i] & Suo.MASK)
			+ " type: " + FeedItem.typeAsString(ORDER_SOURCE_UPDATE[i] & FeedItem.TYPE_MASK)
			+ " suo: "  + this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]][indexSuo].toString());


		if (ORDER_SOURCE_UPDATE[i] & FeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
			zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

		switch(ORDER_SOURCE_UPDATE[i])
		{
			case Suo.ADD | FeedItem.TYPE_CN:
				// allocate a new luid in the source map
				// add to thunderbird addressbook
				// add the luid in the source map (zfc)
				// update the gid with the new luid
				// update the reverse map 

				luid_target = zfcTarget.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

				msg += "About to add a contact to the thunderbird addressbook, gid=" + gid + " and luid_winner=" + luid_winner;

				properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);
				zinAssertAndLog(properties, msg);
				attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);

				msg += " properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

				var checksum = this.contact_converter().crc32(properties);

				l_winner = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key()); // luid of the parent folder in the source
				                                                                       // this.state.m_logger.debug("l_winner: " +l_winner);
				l_gid    = this.state.aReverseGid[sourceid_winner][l_winner];          // gid  of the parent folder
				                                                                       // this.state.m_logger.debug("l_gid=" + l_gid);
				l_target = zfcGid.get(l_gid).get(sourceid_target);                     // luid of the parent folder in the target
				uri      = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abCard   = this.state.m_addressbook.addCard(uri, properties, attributes);

				// msg += " l_winner=" + l_winner + " l_gid=" + l_gid + " l_target=" + l_target + " parent uri: " + uri;

				zfcTarget.set(new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, luid_target ,
				                                                   FeedItem.ATTR_CS, checksum,
				                                                   FeedItem.ATTR_L, l_target));

				zfiGid.set(sourceid_target, luid_target);
				this.state.aReverseGid[sourceid_target][luid_target] = gid;
				break;

			case Suo.ADD | FeedItem.TYPE_FL:
			case Suo.ADD | FeedItem.TYPE_SF:
				var abName = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_ZM, zfiWinner);

				if (!this.state.m_addressbook.getAddressBookUriByName(abName))
				{
					msg += "About to add a thunderbird addressbook (folder), gid=" + gid + " and luid_winner=" + luid_winner + " abName: " + abName;

					var abip = this.state.m_addressbook.newAddressBook(abName);
					uri = abip.m_uri;

					if (!abip.m_uri || abip.m_uri.length < 1 || !abip.m_prefid || abip.m_prefid.length < 1) // re: issue #38
					{
						this.state.m_logger.error("bad uri or tpi after creating a tb addressbook: " + msg + " abip: " + abip.toString());
						this.state.stopFailCode    = 'failon.unable.to.update.thunderbird';
						this.state.stopFailTrailer = stringBundleString("status.failon.unable.to.update.thunderbird.detail1", [ abName ]);
						this.state.is_source_update_problem = true;
						break bigloop;
					}

					luid_target = zfcTarget.get(FeedItem.KEY_AUTO_INCREMENT).increment('next');

					var name_for_map = this.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfiWinner);

					zfcTarget.set(new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, luid_target,
					                       FeedItem.ATTR_NAME, name_for_map, FeedItem.ATTR_L, 1,
					                       FeedItem.ATTR_MS, 1, FeedItem.ATTR_TPI, abip.m_prefid));

					msg += ".  Added: luid_target=" + luid_target + " name_for_map: " + name_for_map + " uri: " + abip.m_uri + " tpi: " + abip.m_prefid;

					zfiGid.set(sourceid_target, luid_target);
					this.state.aReverseGid[sourceid_target][luid_target] = gid;
				}
				else
					this.state.m_logger.warn("Was about to create an addressbook: " + abName +
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

				msg += "About to modify a contact in the addressbook, gid=" + gid + " luid_target=" + luid_target;
				msg += " l_winner=" + l_winner + " l_gid=" + l_gid + " l_target=" + l_target + " l_current=" + l_current;

				properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);

				var is_noop_modification = false;
				var error_msg = null;
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

					uri    = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					// this.state.m_logger.debug("entryActionUpdateTb: uri: " + uri + " luid_target=" + luid_target);
					abCard = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);
					// this.state.m_logger.debug("entryActionUpdateTb: card: " + abCard);

					if (abCard)
					{
						msg += " setting card to: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						abCard = this.state.m_addressbook.updateCard(abCard, uri, properties, attributes, format_winner);
					}
					else
						error_msg = " couldn't find the card to modify by searching on luid.  It's possible that it was deleted between now and the start of sync but it may also indicate a problem.";
				}
				else
				{
					msg += " - parent folder changed"; // implement as delete+add

					var uri_from = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_current));
					var uri_to   = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					abCard       = this.state.m_addressbook.lookupCard(uri_from, TBCARD_ATTRIBUTE_LUID, luid_target);

					if (abCard)
					{

						if (format_winner == FORMAT_ZM && this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB))
						{
							properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_TB);
							attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);

							msg += " - content changed";
						}
						else
						{
							attributes = this.state.m_addressbook.getCardAttributes(abCard);
							properties = this.state.m_addressbook.getCardProperties(abCard);

							msg += " - content didn't change";
						}

						is_delete_failed = !this.state.m_addressbook.deleteCards(uri_from, [ abCard ]);

						if (!is_delete_failed)
							msg += " - card deleted - card added: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);
						else
							error_msg = "card delete failed";

						abCard = this.state.m_addressbook.addCard(uri_to, properties, attributes);
					}
				}

				if (abCard)
				{
					properties   = this.state.m_addressbook.getCardProperties(abCard);
					var checksum = this.contact_converter().crc32(properties);
					zfcTarget.set(new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, luid_target,
					                                             FeedItem.ATTR_CS,  checksum,
					                                             FeedItem.ATTR_L,   l_target));
				}
				else if (is_noop_modification)
					; // do nothing - but luid_target must remain set because the gid's ver and the target's lso gets updated below

				if (!abCard)
					error_msg = "Can't find card to modify in the addressbook: luid=" + luid_target + " - this shouldn't happen.";

				if (error_msg)
				{
					this.state.m_logger.error(error_msg);

					this.state.stopFailCode   = 'failon.unable.to.update.thunderbird';

					if (is_delete_failed)
						this.state.stopFailTrailer = stringBundleString("status.failon.unable.to.update.thunderbird.detail2")
					else
						this.state.stopFailTrailer = "\n";
						
					this.state.is_source_update_problem = true;
					break bigloop;
				}

				break;

			case Suo.MOD | FeedItem.TYPE_FL:
			case Suo.MOD | FeedItem.TYPE_SF:
				luid_target     = zfiGid.get(sourceid_target);
				var name_target = this.getTbAddressbookNameFromLuid(sourceid_target, luid_target);

				zinAssertAndLog(zfiWinner.get(FeedItem.ATTR_L) == '1', "zfiWinner: " + zfiWinner.toString());

				var name_winner_map    = this.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfiWinner);
				var name_winner_public = this.getTbAddressbookNameFromLuid(sourceid_winner, luid_winner);

				if (name_target == name_winner_public)
				{
					zfcTarget.get(luid_target).increment(FeedItem.ATTR_MS);  // don't rename an addressbook to the name it already has

					msg += "No need to an thunderbird addressbook to the name it already has: do nothing: name: " + name_winner_public +
								" gid=" + gid + " luid_winner=" + luid_winner;
				}
				else
				{
					uri = this.state.m_addressbook.getAddressBookUriByName(name_target);

					if (uri)
					{
						msg += "About to rename a thunderbird addressbook: gid=" + gid + " luid_winner=" + luid_winner;

						this.state.m_addressbook.renameAddressBook(uri, name_winner_public);

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
				uri         = this.state.m_addressbook.getAddressBookUriByName(this.getTbAddressbookNameFromLuid(sourceid_target,l_target));
				abCard      = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);
				is_deleted  = false;

				if (abCard)
				{
					msg += "Card to be deleted: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard);

					is_deleted = this.state.m_addressbook.deleteCards(uri, [ abCard ]);

					zfcTarget.get(luid_target).set(FeedItem.ATTR_DEL, 1);
				}

				var error_msg = null;

				if (!abCard)
					error_msg = "Can't find card to delete in the addressbook: luid=" + luid_target + " - this shouldn't happen.";

				if (!is_deleted)
					error_msg = "delete of cards failed."

				if (error_msg)
				{
					this.state.m_logger.error(error_msg)

					this.state.stopFailCode   = 'failon.unable.to.update.thunderbird';
					this.state.stopFailTrailer = !is_deleted ? stringBundleString("status.failon.unable.to.update.thunderbird.detail2"): "";
						
					this.state.is_source_update_problem = true;
					break bigloop;
				}

				break;

			case Suo.DEL | FeedItem.TYPE_FL:
			case Suo.DEL | FeedItem.TYPE_SF:
				luid_target     = zfiGid.get(sourceid_target);
				var name_target = this.getTbAddressbookNameFromLuid(sourceid_target, luid_target);
				uri             = this.state.m_addressbook.getAddressBookUriByName(name_target);

				if (uri)
				{
					msg += "Addressbook to be deleted: name: " + name_target + " uri: " + uri;

					this.state.m_addressbook.deleteAddressBook(uri);
					zfcTarget.get(luid_target).set(FeedItem.ATTR_DEL, 1);

					// partner with removeContactDeletesWhenFolderIsBeingDeleted...
					// mark as deleted any contacts that are children of the deleted addressbook
					// and leave the map as if the contacts were actually deleted (which they are!)
					//
					zinAssertAndLog(isPropertyPresent(this.state.a_folders_deleted, gid), gid);

					var a_suo = this.state.a_folders_deleted[gid];
					var zfi_gid_cn, luid_cn;

					if (a_suo.length > 0)
						msg += " setting DEL attribute on contact luids: ";

					for (var j = 0; j < a_suo.length; j++)
					{
						zfi_gid_cn = zfcGid.get(a_suo[j].gid);
						luid_cn    = zfi_gid_cn.get(a_suo[j].sourceid_target);
						zfcTarget.get(luid_cn).set(FeedItem.ATTR_DEL, 1);
						SyncFsm.setLsoToGid(zfi_gid_cn, zfcTarget.get(luid_cn)); 
						msg += " =" + luid_cn;
					}
				}
				else
				{
					this.state.m_logger.warn("Can't find addressbook to delete: luid=" + luid_target + " - this shouldn't happen.");

					luid_target = null;
				}

				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + ORDER_SOURCE_UPDATE[i]);
		}

		if (luid_target)
			SyncFsm.setLsoToGid(zfiGid, zfcTarget.get(luid_target));

		this.state.m_logger.debug("entryActionUpdateTb: " + msg);
	}

	continuation('evNext');
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
//	change of content:
//    <ModifyContactRequest replace="1" force="1"><cn id="600"><a n="email">blah@example.com</a><a n="fileAs">1</a></cn>
//    <ModifyContactResponse><cn md="1168231780" fileAsStr="blah-1, blah-f" l="481" id="600" rev="3032"/>
//	move only:
//    <ContactActionRequest><action id="348" op="move" l="482"/>
//    <ContactActionResponse><action op="move" id="348"/>
// folder:
//	rename:
//    <FolderActionRequest><action id="631" op="move" l="1"/>
//    <FolderActionResponse><action op="move" id="631"/>
// case Suo.DEL:
// contact: same as Suo.MOD with l=3
// folder:  same as Suo.MOD with l=3, but on response we also remove pending deletes for contained contacts
//
// note that we have no way of distinguishing between
// 1. thunderbird addressbook was deleted along with all it's contacts
// 2. a contact was deleted, then the enclosing folder
// so if we just processed the Suo operations one after another, we'd move the folder into trash,
// then subsequently move the contacts out of the folder (in the Trash) into the Trash, thereby
// losing the association between contacts and the enclosing folder
// Or we could optimise it - so that after a succesful folder move of a folder into trash, 
// we look forward through pending operations, removing those operations that are deletes of contacts in that folder.

// Notes:
// 1. this.state.remote_update_package maintains state across the soap request + response so that
//    the corresponding suo can be deleted out of aSuo
//    members are: .sourceid  .bucket  .indexSuo
// 2. ORDER_SOURCE_UPDATE
//    the sort order for zimbra is a bit different from thunderbird.  With zimbra, we delete folders first, because
//    on successful deletion of a folder, pending delete operations on that folder's contacts are removed on the
//    assumption that they weren't deleted individually but were deleted consequential to the deletion of the Tb AddressBook
//    (even though we have no way of knowing one way or the other)
//

SyncFsm.prototype.entryActionUpdateZm = function(state, event, continuation)
{
	var soap = new Object();
	var bucket  = null;
	var msg = "";
	var indexSuo = null;
	var sourceid, sourceid_winner, sourceid_target, zfcWinner, zfiWinner, l_gid, l_winner, l_target, name_winner, type, suo;
	var format_winner, zuio_target, l_zuio, properties;

	this.state.stopwatch.mark(state);

	if (!this.state.is_source_update_problem)
		for (sourceid in this.state.sources)
			if (this.state.sources[sourceid]['format'] == FORMAT_ZM)
				for (var i = 0; i < ORDER_SOURCE_UPDATE.length && !bucket; i++)
					if (isPropertyPresent(this.state.aSuo[sourceid], ORDER_SOURCE_UPDATE[i]))
						for (indexSuo in this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]])
	{
		this.state.m_logger.debug("entryActionUpdateZm: " +
				" opcode: " + Suo.opcodeAsString(ORDER_SOURCE_UPDATE[i] & Suo.MASK) +
				" type: "   + FeedItem.typeAsString(ORDER_SOURCE_UPDATE[i] & FeedItem.TYPE_MASK) +
		        " indexSuo: " + indexSuo +
				" suo: " + this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo].toString());

		suo             = this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo];
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		format_winner   = this.state.sources[sourceid_winner]['format'];
		luid_winner     = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
		zfcWinner       = this.zfc(suo.sourceid_winner);
		zfcTarget       = this.zfc(suo.sourceid_target);
		zfiWinner       = zfcWinner.get(luid_winner);

		if (ORDER_SOURCE_UPDATE[i] & FeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
			zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

		switch(ORDER_SOURCE_UPDATE[i])
		{
			case Suo.ADD | FeedItem.TYPE_FL:
				zinAssertAndLog(format_winner == FORMAT_ZM ||
				                this.state.m_folder_converter.prefixClass(zfiWinner.name()) == FolderConverter.PREFIX_CLASS_PRIMARY,
				                   "zfiWinner: " + zfiWinner.toString());
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);
				soap.method = "CreateFolder";
				soap.arg    = newObject(FeedItem.ATTR_NAME, name_winner, FeedItem.ATTR_L, '1');
				soap.zid    = null;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to add folder name: " + name_winner + " l: " + '1';
				break;

			case Suo.ADD | FeedItem.TYPE_CN:
				l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
				l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);

				if (zfcTarget.get(l_target).type() == FeedItem.TYPE_SF)
					l_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, l_target, FeedItem.TYPE_FL);

				l_zuio      = new Zuio(l_target);
				properties  = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
				soap.method = "CreateContact";
				soap.arg    = newObject('properties', properties, FeedItem.ATTR_L, l_zuio.id());
				soap.zid    = l_zuio.zid();
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to add contact: ";
				break;

			case Suo.MOD | FeedItem.TYPE_FL:
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

				if (zfcTarget.get(luid_target).type() == FeedItem.TYPE_SF)
				{
					luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, FeedItem.TYPE_LN);
					soap.luid_target = luid_target;
				}

				// sanity check that we never modify any of zimbra's immutable folders
				zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "id=" + luid_target + "folder name: " + name_winner);

				soap.method = "FolderAction";
				soap.arg    = newObject('id', luid_target, 'op', 'update', FeedItem.ATTR_NAME, name_winner);
				soap.zid    = null;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to rename folder: ";
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
				msg        += " about to modify contact: ";
				soap.zid    = zuio_target.zid();
				soap.method = null;

				if (this.state.sources[sourceid_winner]['format'] == FORMAT_TB) // always a content update in Tb2 - may not be so in Tb3.
					soap.method = "ModifyContact";
				else
				{
					// look at the pre-update zfi:
					// if rev was bumped ==> content update  ==> ModifyContactRequest ==> load content from zc
					// if ms  was bumped ==> attributes only ==> ContactActionRequest ==> load content from zc
					//
					var zfi = this.state.zfcPreUpdateWinners.get(suo.gid);
					var lso = new Lso(zfi.get(FeedItem.ATTR_LS));

					soap.method = (zfi.get(FeedItem.ATTR_REV) > lso.get(FeedItem.ATTR_REV)) ? "ModifyContact" : "ContactAction";
				}

				if (soap.method == "ModifyContact")
				{
					properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);

					// populate properties with the contact attributes that must be deleted on the server...
					//
					for (key in this.contact_converter().m_common_to[FORMAT_ZM][FORMAT_TB])
						if (!isPropertyPresent(properties, key))
							properties[key] = null;

					soap.arg   = newObject('id', zuio_target.id(), 'properties', properties, FeedItem.ATTR_L, l_zuio.id());
					bucket     = ORDER_SOURCE_UPDATE[i];
				}
				else if (soap.method == "ContactAction")
				{
					soap.arg   = newObject('id', zuio_target.id(), 'op', 'move', FeedItem.ATTR_L, l_zuio.id());
					bucket     = ORDER_SOURCE_UPDATE[i];
				}
				else
					zinAssert(false);
				break;

			case Suo.DEL | FeedItem.TYPE_FL:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);

				if (zfcTarget.get(luid_target).type() == FeedItem.TYPE_SF)
				{
					luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, FeedItem.TYPE_LN);
					soap.luid_target = luid_target;
				}

				zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "luid_target=" + luid_target);

				soap.method = "FolderAction";
				soap.zid    = null;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to move folder to trash: " + name_winner;

				// add the date to the folder's name in the Trash to avoid name clashes
				// this isn't guaranteed to work of course, but if it doesn't, the sync will abort
				// and the folder will re-appear on the next slow sync.  No drama, the user will just scratch their head and
				// then complain and/or retry.  The correct logic is "retry until success" but it's complex to code...
				// would prefer an iso8601 date but zimbra doesnt allow folder names to contain colons
				//
				var newname = "/Trash/" + name_winner + dateSuffixForFolder();

				msg += " - name of the folder in the Trash will be: " + newname;

				// op == 'move' is what we'd use if we weren't changing it's name
				// soap.arg     = newObject('id', luid_target, 'op', 'move', FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
				// with op=update, the server does the move before the rename so still fails because of folder name conflict in Trash
				// soap.arg     = newObject('id', luid_target, 'op', 'update', FeedItem.ATTR_NAME, newname, FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
				soap.arg     = newObject('id', luid_target, 'op', 'rename', FeedItem.ATTR_NAME, newname);
				break;

			case Suo.DEL | FeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

				if (zfcTarget.get(luid_target).isForeign())
				{
					zuio        = new Zuio(luid_target);
					properties  = this.getContactFromLuid(sourceid_target, luid_target, FORMAT_ZM);
					zinAssert(properties);
					soap.method = "ForeignContactDelete";
					soap.arg    = newObject('properties', properties, 'id', zuio.id(), 'zid', zuio.zid());
					soap.zid    = null;
					bucket      = ORDER_SOURCE_UPDATE[i];
					msg        += " about to copy foreign contact to trash then delete it.";
				}
				else
				{
					soap.method = "ContactAction";
					soap.arg    = newObject('id', luid_target, 'op', 'move', FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
					soap.zid    = null;
					bucket      = ORDER_SOURCE_UPDATE[i];
					msg        += " about to move contact to trash.";
				}

				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + ORDER_SOURCE_UPDATE[i]);
		}

		if (bucket)
			break;
	}

	if (msg != "")
		this.state.m_logger.debug("entryActionUpdateZm: " + msg);

	this.state.remote_update_package = null;

	if (bucket)
	{
		this.state.remote_update_package = newObject('sourceid', sourceid, 'bucket', bucket, 'indexSuo', indexSuo, 'soap', soap);

		this.state.m_logger.debug("entryActionUpdateZm: remote_update_package: " + aToString(this.state.remote_update_package));

		this.setupHttpZm(state, 'evRepeat', this.state.zidbag.soapUrl(soap.zid), soap.zid, soap.method, soap.arg);

		continuation('evHttpRequest');
	}
	else
	{
		this.state.m_http = null;
		continuation('evNext');
	}
}

SyncFsm.prototype.exitActionUpdateZm = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var response               = this.state.m_http.response();
	var change                 = newObject('acct', null);
	var remote_update_package  = this.state.remote_update_package;
	var is_response_understood = false;
	var context                = this;
	var msg = "exitActionUpdateZm: ";
	var suo = this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];
	var msg, xpath_query, functor;

	this.debug("exitActionUpdateZm: remote_update_package: " +  aToString(remote_update_package));

	var functor_create_blah_response = {
		state: this.state,
		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var l    = attribute[FeedItem.ATTR_L];
			var id   = attribute[FeedItem.ATTR_ID];
			var type = remote_update_package.bucket & FeedItem.TYPE_MASK;

			is_response_understood = true;

			if (remote_update_package.soap.method == "CreateFolder")
				msg += "created: <folder id=" + id + " l=" + l + " name='" + attribute['name'] + "'>";
			else if (remote_update_package.soap.method == "CreateContact")
				msg += "created: <cn id=" + id +" l=" + l + ">";
			else if (remote_update_package.soap.method == "ModifyContact")
				msg += "modified: <cn id=" + id + ">";

			if (change.acct)
				msg += " in acct zid: " + change.acct;

			if (!isPropertyPresent(attribute, FeedItem.ATTR_ID) || !isPropertyPresent(attribute, FeedItem.ATTR_L))
				this.state.m_logger.error("<folder> element received seems to be missing an 'id' or 'l' attribute - ignoring: " + aToString(attribute));
			else
			{
				delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];

				var zfiGid = this.state.zfcGid.get(suo.gid);
				zfcTarget = context.zfc(suo.sourceid_target);
				var key = Zuio.key(id, change.acct);
				var zfi;

				attribute[FeedItem.ATTR_KEY] = key;

				if (remote_update_package.soap.method == "ModifyContact")
				{
					zfi = zfcTarget.get(key);
					zfi.set(attribute)
					zfi.set(FeedItem.ATTR_MS, change.token);
					SyncFsm.setLsoToGid(zfiGid, zfi);
					msg += " - updated luid and gid"; 
				}
				else
				{
					zfi = new FeedItem(type, attribute);
					zfi.set(FeedItem.ATTR_MS, change.token);
					SyncFsm.setLsoToGid(zfiGid, zfi);

					zfcTarget.set(zfi);

					zfiGid.set(suo.sourceid_target, key);
					this.state.aReverseGid[suo.sourceid_target][key] = suo.gid;
					msg += " - added luid and gid"; 
				}

			}
		}
	};

	var functor_action_response = {
		state: this.state,
		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var id   = attribute['id'];
			var type = remote_update_package.bucket & FeedItem.TYPE_MASK;

			msg += " recieved: <action id=" + id + ">";

			is_response_understood = true;

			if (!isPropertyPresent(attribute, 'id'))
				this.state.m_logger.error("<action> element received seems to be missing an 'id' attribute - ignoring: " + aToString(attribute));
			else
			{
				delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];

				var zfcTarget   = context.zfc(suo.sourceid_target);
				var luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
				var zfiTarget   = zfcTarget.get(luid_target);
				var key         = Zuio.key(id, change.acct);
				var zfiRelevantToGid;

				if (isPropertyPresent(remote_update_package.soap, 'luid_target'))
					zfiTarget = zfcTarget.get(remote_update_package.soap.luid_target);  // used in MOD | TYPE_FL

				if (remote_update_package.bucket == (Suo.DEL | FeedItem.TYPE_FL) ||
				   (remote_update_package.bucket == (Suo.DEL | FeedItem.TYPE_LN) ))
					zfiTarget.set(FeedItem.ATTR_L, ZM_ID_FOLDER_TRASH); // the folder got "renamed" into trash so fake the l attribute
				else
				{
					remote_update_package.soap.arg[FeedItem.ATTR_KEY] = key;
					zfiTarget.set(remote_update_package.soap.arg);
				}

				zfiTarget.set(FeedItem.ATTR_MS, change.token);

				if (zfiTarget.type() == FeedItem.TYPE_LN)
				{
					SyncFsm.sharedFoldersUpdateAttributes(zfcTarget, key);
					zfiRelevantToGid = zfcTarget.get(zfiTarget.get(FeedItem.ATTR_SKEY));
				}
				else
					zfiRelevantToGid = zfiTarget;

				SyncFsm.setLsoToGid(this.state.zfcGid.get(suo.gid), zfiRelevantToGid);

				msg += " - luid map updated - new zfi: " + zfcTarget.get(luid_target);
			}
		}
	};

	var functor_foreign_contact_delete_response = {
		state: this.state,
		run: function(doc, node)
		{
			var zfcTarget = context.zfc(suo.sourceid_target);
			var key       = Zuio.key(remote_update_package.soap.arg.id, remote_update_package.soap.arg.zid);

			zfcTarget.get(key).set(FeedItem.ATTR_DEL, 1);

			msg += " recieved: BatchResponse - marking as deleted: key: " + key;

			is_response_understood = true;

			delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];
		}
	};

	Xpath.setConditional(change, 'token', "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);
	Xpath.setConditional(change, 'acct',  "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

	if (!isPropertyPresent(change, 'token'))
	{
		// for safety's sake, we could also check that change.acct matches the zid in remote_update_package - don't bother at the mo...
		this.state.m_logger.error("No change token found.  This shouldn't happen.  Ignoring soap response.");

		// drastic, but it ensures we don't end up in a loop
		delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket];
	}
	else
	{
		msg += " change.token: " + change.token + " change.acct: " + change.acct;

		switch(remote_update_package.bucket)
		{
			case Suo.ADD | FeedItem.TYPE_FL:
				xpath_query = "/soap:Envelope/soap:Body/zm:CreateFolderResponse/zm:folder";
				functor = functor_create_blah_response;
				break;
			case Suo.ADD | FeedItem.TYPE_CN:
				xpath_query = "/soap:Envelope/soap:Body/zm:CreateContactResponse/zm:cn";
				functor = functor_create_blah_response;
				break;
			case Suo.MOD | FeedItem.TYPE_FL:
				xpath_query = "/soap:Envelope/soap:Body/zm:FolderActionResponse/zm:action";
				functor = functor_action_response;
				break;
			case Suo.MOD | FeedItem.TYPE_CN:
				if (remote_update_package.soap.method == "ModifyContact")
				{
					xpath_query = "/soap:Envelope/soap:Body/zm:ModifyContactResponse/zm:cn";
					functor = functor_create_blah_response;
				}
				else if (remote_update_package.soap.method == "ContactAction")
				{
					xpath_query = "/soap:Envelope/soap:Body/zm:ContactActionResponse/zm:action";
					functor = functor_action_response;
				}
				else
					zinAssert(false);
				break;
			case Suo.DEL | FeedItem.TYPE_FL:
				xpath_query = "/soap:Envelope/soap:Body/zm:FolderActionResponse/zm:action";
				functor = functor_action_response;
				break;
			case Suo.DEL | FeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);

				if (zfcTarget.get(luid_target).isForeign())
				{
					xpath_query = "/soap:Envelope/soap:Body/z:BatchResponse";
					functor = functor_foreign_contact_delete_response;
				}
				else
				{
					xpath_query = "/soap:Envelope/soap:Body/zm:ContactActionResponse/zm:action";
					functor = functor_action_response;
				}
				break;
			default:
				zinAssert(false);
		}

		Xpath.runFunctor(functor, xpath_query, this.state.m_http.response());
	}

	if (!is_response_understood)
	{
		msg += " - soap response didn't match xpath query: " + xpath_query;

		this.state.stopFailCode    = 'failon.unable.to.update.server';
		this.state.stopFailTrailer = stringBundleString("text.zm.soap.method",
								     [ remote_update_package.soap.method + " " + aToString(remote_update_package.soap.arg) ] );

		this.state.is_source_update_problem = true;
	}

	this.state.m_logger.debug(msg);

	if (isObjectEmpty(this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket]))
	{
		delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket];  // delete empty buckets
		this.state.m_logger.debug("deleted aSuo sourceid: " + sourceid + " bucket: " + remote_update_package.bucket);
	}
}

SyncFsm.prototype.entryActionUpdateGd = function(state, event, continuation)
{
	var remote    = new Object();
	var bucket    = null;
	var indexSuo  = null;
	var nextEvent = 'evNext';
	var msg       = "";
	var is_noop   = false;
	var sourceid, sourceid_winner, sourceid_target, suo, luid_winner, properties, contact, zfcTarget, zfiTarget, zfiGid;

	this.state.stopwatch.mark(state);

	if (!this.state.is_source_update_problem)
		for (sourceid in this.state.sources)
			if (this.state.sources[sourceid]['format'] == FORMAT_GD)
				for (var i = 0; i < ORDER_SOURCE_UPDATE.length && !bucket; i++)
					if (isPropertyPresent(this.state.aSuo[sourceid], ORDER_SOURCE_UPDATE[i]))
						for (indexSuo in this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]])
	{
		this.state.m_logger.debug("entryActionUpdateGd: " +
				" opcode: " + Suo.opcodeAsString(ORDER_SOURCE_UPDATE[i] & Suo.MASK) +
				" type: "   + FeedItem.typeAsString(ORDER_SOURCE_UPDATE[i] & FeedItem.TYPE_MASK) +
		        " indexSuo: " + indexSuo +
				" suo: " + this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo].toString());

		suo             = this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo];
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		zfcTarget       = this.zfc(suo.sourceid_target);
		zfiGid          = this.state.zfcGid.get(suo.gid);
		luid_winner     = zfiGid.get(suo.sourceid_winner);

		switch(ORDER_SOURCE_UPDATE[i])
		{
			case Suo.ADD | FeedItem.TYPE_CN:
				msg           += " about to add contact: ";
				properties     = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_GD);

				contact = new GdContact(this.contact_converter());

				if (this.state.gd_is_sync_postal_address)
					properties = contact.addWhitespaceToPostalProperties(properties);

				contact.updateFromProperties(properties);

				remote.method  = "POST";
				remote.url     = this.state.gd_url_base;
				remote.headers = newObject("Content-type", "application/atom+xml");
				remote.body    = contact.toStringXml();
				remote.contact = contact;
				remote.sourceid_winner = sourceid_winner;
				remote.luid_winner     = luid_winner;
				bucket         = ORDER_SOURCE_UPDATE[i];
				break;

			case Suo.MOD | FeedItem.TYPE_CN:
				msg           += " about to modify contact: ";
				luid_target    = zfiGid.get(sourceid_target);
				properties     = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_GD);

				zinAssertAndLog(isPropertyPresent(this.state.a_gd_contact, luid_target), "luid_target=" + luid_target);

				contact = this.state.a_gd_contact[luid_target];

				var properties_pre_update = contact.m_properties;

				// convert the properties to a gd contact so that transformations apply before the identity test
				//
				if (this.state.gd_is_sync_postal_address)
					properties = contact.addWhitespaceToPostalProperties(properties);

				contact.updateFromProperties(properties);

				if (isMatchObjects(properties_pre_update, contact.m_properties))
				{
					zfiTarget  = zfcTarget.get(luid_target);
					msg       += " the local mod doesn't affect the remote contact - skip remote update: " + aToString(properties_pre_update);
					SyncFsm.setLsoToGid(zfiGid, zfiTarget);
					delete this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo];
					nextEvent = 'evRepeat';
					is_noop   = true;
				}
				else
				{
					remote.method  = "POST";  // POST // PUT
					remote.url     = gdAdjustHttpHttps(contact.m_meta[GdContact.edit]);
					remote.headers = newObject("Content-type", "application/atom+xml", "X-HTTP-Method-Override", "PUT");
					remote.body    = contact.toStringXml();
					remote.contact = contact;
					remote.sourceid_winner = sourceid_winner;
					remote.luid_winner     = luid_winner;
					bucket         = ORDER_SOURCE_UPDATE[i];
				}
				break;

			case Suo.DEL | FeedItem.TYPE_CN:
				msg           += " about to delete contact: ";
				luid_target    = zfiGid.get(sourceid_target);
				zfiTarget      = zfcTarget.get(luid_target);

				remote.method  = "POST"; // POST DELETE
				remote.url     = gdAdjustHttpHttps(zfiTarget.get(FeedItem.ATTR_EDIT));
				remote.headers = newObject("X-HTTP-Method-Override", "DELETE");
				remote.body    = null;
				bucket         = ORDER_SOURCE_UPDATE[i];
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + ORDER_SOURCE_UPDATE[i]);
		}

		if (bucket || is_noop)
			break;
	}

	if (msg != "")
		this.state.m_logger.debug("entryActionUpdateGd: " + msg);

	this.state.remote_update_package = null;

	if (bucket && !is_noop)
	{
		this.state.remote_update_package = newObject('sourceid', sourceid, 'bucket', bucket, 'indexSuo', indexSuo, 'remote', remote);

		this.state.m_logger.debug("entryActionUpdateGd: remote_update_package: " +
		                          " sourceid: " + sourceid + " bucket: " + bucket + " indexSuo: " + indexSuo +
								  " remote.method: " + remote.method + " remote.url: " + remote.url);


		this.setupHttpGd(state, 'evRepeat', remote.method, remote.url, remote.headers, remote.body, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

		nextEvent = 'evHttpRequest';
	}
	else
	{
		this.state.m_http = null;
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionUpdateGd = function(state, event)
{
	if (!this.state.m_http || event == "evCancel")
		return;

	var remote_update_package = this.state.remote_update_package;
	var is_response_processed = false;
	var suo       = this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];
	var zfiGid    = this.state.zfcGid.get(suo.gid);
	var zfcTarget = this.zfc(suo.sourceid_target);
	var response  = this.state.m_http.response();
	var msg       = "exitActionUpdateGd: ";

	this.state.m_logger.debug("exitActionUpdateGd: " + remote_update_package.remote.method + " " + remote_update_package.remote.url);

	if (this.state.m_http.is_http_status(HTTP_STATUS_2xx))
		switch (remote_update_package.bucket)
		{
			case Suo.ADD | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_201_CREATED))
				{
					var a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), response, "/atom:entry");

					if (aToLength(a_gd_contact) == 1)
					{
						var id = firstKeyInObject(a_gd_contact);
						var contact = a_gd_contact[id];
						zinAssert(id == contact.m_meta[GdContact.id]);

						msg += " created: contact id=" + id;

						var zfi = this.newZfiCnGd(id, contact.m_meta[GdContact.updated], contact.m_meta[GdContact.edit],
						                              contact.m_meta[GdContact.self], this.state.gd_luid_ab_in_gd);

						SyncFsm.setLsoToGid(zfiGid, zfi);

						zfcTarget.set(zfi);

						zfiGid.set(suo.sourceid_target, id);
						this.state.aReverseGid[suo.sourceid_target][id] = suo.gid;

						msg += " added luid and gid"; 

						is_response_processed = true;
					}
				}
				break;

			case Suo.MOD | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_200_OK))
				{
					var luid_target  = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
					var zfiTarget    = zfcTarget.get(luid_target);
					var a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), response, "/atom:entry");

					if (aToLength(a_gd_contact) == 1)
					{
						var id = firstKeyInObject(a_gd_contact);
						var contact = a_gd_contact[id];

						zinAssert(id == contact.m_meta[GdContact.id]);
						zinAssert(luid_target == contact.m_meta[GdContact.id]);

						zfiTarget.set(FeedItem.ATTR_REV,  contact.m_meta[GdContact.updated]);
						zfiTarget.set(FeedItem.ATTR_EDIT, contact.m_meta[GdContact.edit]);
						zfiTarget.set(FeedItem.ATTR_SELF, contact.m_meta[GdContact.self]);
						SyncFsm.setLsoToGid(this.state.zfcGid.get(suo.gid), zfiTarget);

						msg += " map updated: zfi: " + zfcTarget.get(luid_target);

						is_response_processed = true;
					}
				}
				break;

			case Suo.DEL | FeedItem.TYPE_CN:
				if (this.state.m_http.is_http_status(HTTP_STATUS_200_OK))
				{
					var luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
					var zfiTarget   = zfcTarget.get(luid_target);

					zfiTarget.set(FeedItem.ATTR_DEL, 1);

					msg += " marking as deleted: id=" + luid_target;

					is_response_processed = true;
				}
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + remote_update_package.bucket);
		}

	if (!is_response_processed)
	{
		if (this.state.m_http.is_http_status(HTTP_STATUS_409_CONFLICT))
		{
			var contact = null;

			if (this.state.m_http.response('text').match(/\<\/entry\>/))
			{
				var a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), this.state.m_http.response(), "/atom:entry");

				if (!isObjectEmpty(a_gd_contact))
					contact = a_gd_contact[firstKeyInObject(a_gd_contact)];
			}

			// if the conflict is in response to a MOD or DEL request and the contact in the response has a different edit url
			// then Google is reporting a MOD/MOD or MOD/DEL conflict.  We fail to converge, (and try again next time).
			//
			if (contact && 
			    ((remote_update_package.bucket & Suo.MOD) || (remote_update_package.bucket & Suo.DEL)) &&
			    (remote_update_package.remote.url != contact.m_meta[GdContact.edit]))
			{
				this.state.m_logger.debug("MOD/MOD or MOD/DEL conflict (edit url changed).  We'll retain our record of the winner and try again on the next sync...");
				var zfcWinner   = this.zfc(suo.sourceid_winner);
				var luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
				var zfiWinner   = zfcWinner.get(luid_winner);

				zfiWinner.set(FeedItem.ATTR_KEEP, 1);

				is_response_processed = true;
			}
			else
			{
				// this conflict is encountered when contacts that reference the same email address are added to both tb and Google
				// Google returns a contact with the 409 so we can do some conflict resolution.
				// On the google-contacts developer list, one of the google developers said that 409's would include the contact
				// and in practice that's what is observed.  But it's not guaranteed as per the doco in which case 
				// someone will report an assertion failure and we'll cater for no contact.
				//
				zinAssert(contact);

				var grd = new GoogleRuleDetail(this.username());
				grd.m_unique = new Object();

				// find the email address that caused the conflict
				//
				zinAssert(remote_update_package.remote.sourceid_winner == this.state.sourceid_tb);

				var luid_tb       = remote_update_package.remote.luid_winner;
				var tb_properties = this.getContactPropertiesNormalised(this.state.sourceid_tb, luid_tb);
				var a_match       = keysForMatchingValues(tb_properties, contact.m_properties);

				if (isPropertyPresent(a_match, 'PrimaryEmail'))
					email = a_match['PrimaryEmail'];
				else if (isPropertyPresent(a_match, 'SecondEmail'))
					email = a_match['SecondEmail'];
				else
					zinAssertAndLog(false, "tb_properties: " + aToString(tb_properties) + " google contact: " + contact.toString());

				grd.m_unique[email] = new Object();
				grd.m_unique[email][luid_tb] = new GoogleRuleContactHandle(FORMAT_TB, luid_tb, tb_properties, { uri: this.state.gd_ab_uri});

				luid = contact.m_meta[GdContact.id];
				GdContact.transformProperties(contact.m_properties);
				tb_properties = this.contact_converter().convert(FORMAT_TB, FORMAT_GD, contact.m_properties);

				grd.m_unique[email][luid] = new GoogleRuleContactHandle(FORMAT_GD, luid, tb_properties, { contact: contact, username: this.username() } );

				this.state.stopFailCode = 'failon.gd.conflict.2';
				this.state.stopFailArg  = [ grd ];
			}
		}
		else
		{
			this.state.stopFailCode    = 'failon.unable.to.update.server';
			this.state.stopFailTrailer = stringBundleString("text.zm.soap.method", [ remote_update_package.remote.method ] ) + " " +
				                         stringBundleString("status.failon.unable.to.update.server.response",
					                        [ this.state.m_http.m_http_status_code,
						                      ((this.state.m_http.response('text') && this.state.m_http.response('text').length > 0) ?
							                    this.state.m_http.response('text') : "") ] );
		}
	}

	if (is_response_processed)
		delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket][remote_update_package.indexSuo];
	else
	{
		msg += " the update operation wasn't successful";

		this.state.is_source_update_problem = true;
	}

	this.state.m_logger.debug(msg);

	if (isObjectEmpty(this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket]))
	{
		delete this.state.aSuo[remote_update_package.sourceid][remote_update_package.bucket];  // delete empty buckets
		this.state.m_logger.debug("deleted aSuo sourceid: " + sourceid + " bucket: " + remote_update_package.bucket);
	}
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

	zinAssertAndLog(zfi && zfi.type() == FeedItem.TYPE_CN, "sourceid: " + sourceid + " luid=" + luid);
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
			else
				this.state.m_logger.warn("can't find contact for to sourceid: " + sourceid + " and luid=" + luid +
				                         " in thunderbird addressbook uri: " + uri + " - this shouldn't happen.");
			break;

		case FORMAT_ZM:
			if (isPropertyPresent(this.state.aSyncContact, luid))
				ret = this.contact_converter().convert(format_to, FORMAT_ZM, this.state.aSyncContact[luid].element);

			break;

		case FORMAT_GD:
			if (isPropertyPresent(this.state.a_gd_contact, luid))
				ret = this.contact_converter().convert(format_to, FORMAT_GD, this.state.a_gd_contact[luid].m_properties);
			break;

		default:
			zinAssertAndLog(false, "unmatched case: format_from: " + format_from);
	};

	return ret;
}

SyncFsm.prototype.entryActionUpdateCleanup = function(state, event, continuation)
{
	var nextEvent = 'evNext';
	var context = this;

	this.state.stopwatch.mark(state + " 1");

	if (!this.state.is_source_update_problem)
	{
		var gid;
		var aGidsToDelete = new Array();
		var msg = "UpdateCleanup: ";

		this.keepCertainDeletedTbMapItems();

		this.state.stopwatch.mark(state + " 2");

		this.debug("UpdateCleanup: zfcTb:\n" + this.zfcTb().toString());
		this.debug("UpdateCleanup: zfcPr:\n" + this.zfcPr().toString());
		this.debug("UpdateCleanup: zfcGid: " + this.state.zfcGid.toString());

		this.state.stopwatch.mark(state + " 3");

		//  delete the luid item if it has a DEL attribute (or zimbra: it's not of interest)
		//  delete the mapping between a gid and an luid when the luid is not of interest
		//
		var functor_foreach_luid = {
			state: this.state,
			run: function(zfi)
			{
				var luid = zfi.key();
				var zfc  = context.zfc(sourceid);
				gid      = isPropertyPresent(this.state.aReverseGid[sourceid], luid) ? this.state.aReverseGid[sourceid][luid] : null;
				msg     += "\n gid=" + gid + " " + sourceid + "/=" + luid;

				if (zfi.isPresent(FeedItem.ATTR_KEEP))
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
						var luid_in_gid = this.state.zfcGid.get(gid).get(sourceid);

						if (luid_in_gid == luid)
						{
							msg += " and deleted gid's reference to sourceid";
							this.state.zfcGid.get(gid).del(sourceid);
						}
						else
						{
							// This happens when there is a mod/del conflict
							// The losing source has both a del and an add and when the add got processed it wrote a new luid
							// into the gid.  So we don't want to remove it.
							//
							msg += " but didn't delete gid reference to sourceid because it had changed to luid=" + luid_in_gid;
						}

						delete this.state.aReverseGid[sourceid][luid];
					}
				}

				return true;
			}
		};

		for (sourceid in this.state.sources)
			this.zfc(sourceid).forEach(functor_foreach_luid);

		context.debug(msg);
		this.state.stopwatch.mark(state + " 4");

		msg = "UpdateCleanup: ";

		// delete the gid when all the mapitems source maps have a FeedItem.ATTR_DEL attribute
		//
		var functor_count_luids_in_gid = {
			count: 0,
			run: function(sourceid, luid)
			{
				this.count++;

				return true;
			}
		};

		var functor_foreach_gid = {
			state: this.state,
			run: function(zfi)
			{
				functor_count_luids_in_gid.count = 0;

				zfi.forEach(functor_count_luids_in_gid, FeedItem.ITER_GID_ITEM);

				msg += "\n gid: " + zfi.toString() + " count: " + functor_count_luids_in_gid.count;

				if (functor_count_luids_in_gid.count == 0)
				{
					msg += " had no luid properties - deleted.";
					this.state.zfcGid.del(zfi.key());
				}

				return true;
			}
		};

		this.state.zfcGid.forEach(functor_foreach_gid, FeedCollection.ITER_NON_RESERVED);

		this.debug(msg);
		this.state.stopwatch.mark(state + " 5");

		if (!this.isConsistentDataStore())
		{
			this.state.stopFailCode    = 'failon.integrity.data.store.out'; // this indicates a bug in our code
			this.state.stopFailTrailer = stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);
		}
	}

	if (this.state.stopFailCode != null)
		nextEvent = 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionCommit = function(state, event, continuation)
{
	var sourceid_pr = this.state.sourceid_pr;
	var zfcLastSync = this.state.zfcLastSync;
	var sfcd        = this.state.m_sfcd;
	var sourceid;

	this.state.stopwatch.mark(state);

	if (this.formatPr() == FORMAT_ZM)
	{
		for (zid in this.state.zidbag.m_properties)
			zfcLastSync.get(sourceid_pr).set(Zuio.key('SyncToken', zid), this.state.zidbag.get(zid, 'SyncToken'));

		zfcLastSync.get(sourceid_pr).set('SyncGalEnabled', this.state.SyncGalEnabled);

		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('zm_tested_soapurls', hyphenate(",", this.state.a_zm_tested_soapurls));
	}
	else if (this.formatPr() == FORMAT_GD)
	{
		zfcLastSync.get(sourceid_pr).set('SyncToken',                 this.state.gd_sync_token);
		zfcLastSync.get(sourceid_pr).set(Account.gd_sync_with,        this.state.gd_sync_with);
	}

	if (sfcd.first_sourceid_of_format(FORMAT_ZM) == this.state.sourceid_pr) // if this is the first ZM source...
	{
	}
	else if (sfcd.first_sourceid_of_format(FORMAT_GD) == this.state.sourceid_pr) // if this is the first GD source...
	{
		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('gd_is_sync_postal_address', String(this.state.gd_is_sync_postal_address));
	}

	if (sfcd.is_first_in_chain())
	{
		zfcLastSync.get(FeedItem.KEY_LASTSYNC_COMMON).set('account_signature', sfcd.signature());
	}

	if (sfcd.is_last_in_chain())
	{
		RemoveDatastore.removeZfc(Filesystem.FILENAME_GD_TO_BE_DELETED);
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

	zfcLastSync.get(sourceid_pr).set(Account.url,   this.state.sources[sourceid_pr][Account.url]);
	zfcLastSync.get(sourceid_pr).set(Account.username,  this.username());

	this.state.m_logger.debug("entryActionCommit: url: " + this.state.sources[sourceid_pr][Account.url] +
	                                       " username: " + this.username() +
	                                      " SyncToken: " + zfcLastSync.get(sourceid_pr).get('SyncToken') +
	                              " account_signature: " + sfcd.signature());

	zfcLastSync.save();

	this.state.zfcGid.save();

	for (sourceid in this.state.sources)
		this.zfc(sourceid).save();

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

SyncFsm.prototype.zfcTb        = function()         { return this.zfc(this.state.sourceid_tb);                             }
SyncFsm.prototype.zfcPr        = function()         { return this.zfc(this.state.sourceid_pr);                             }
SyncFsm.prototype.formatPr     = function()         { return this.state.sources[this.state.sourceid_pr]['format'];         }
SyncFsm.prototype.username     = function()         { return this.state.sources[this.state.sourceid_pr][Account.username]; }
SyncFsm.prototype.getIntPref   = function(key)      { var p = preferences(); return p.getIntPref(  p.branch(), key);       }
SyncFsm.prototype.getCharPref  = function(key)      { var p = preferences(); return p.getCharPref( p.branch(), key);       }
SyncFsm.prototype.is_slow_sync = function(sourceid) { return this.state.m_sfcd.sourceid(sourceid, 'is_slow_sync');         }
SyncFsm.prototype.is_reset     = function(sourceid) { return this.state.m_sfcd.is_reset();                                 }

SyncFsm.prototype.zfc = function(sourceid)
{
	zinAssertAndLog(isPropertyPresent(this.state.sources, sourceid), sourceid);

	return this.state.sources[sourceid]['zfcLuid'];
}

SyncFsm.prototype.debug = function(str)
{
	zinAssert(arguments.length == 1);

	if (this.state.m_debug_filter_out)
		str = str.replace(this.state.m_debug_filter_out, "~");

	this.state.m_logger.debug(str);
}

SyncFsm.prototype.contact_converter = function()
{
	var ret;

	if (this.formatPr() == FORMAT_GD && this.state.gd_is_sync_postal_address)
		ret = this.state.m_contact_converter_vary_gd_postal;
	else
		ret = this.state.m_contact_converter_vary_none;

	zinAssert(ret);

	return ret;
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
	return this.state.sources[sourceid]['zfcLuid'].get(luid).type();
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
	var result = new Object();

	var functor =
	{
		type_fl:  FeedItem.typeAsString(FeedItem.TYPE_FL),

		run: function(zfi)
		{
			if (zfi.get(FeedItem.ATTR_TYPE) == this.type_fl && zfi.get(FeedItem.ATTR_L) == '1')
				result[zfi.get(attr_key)] = zfi.get(attr_value);

			return true;
		}
	};

	zfc.forEach(functor);

	return result;
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

SyncFsm.keyParentRelevantToGid = function(zfc, key)
{
	zinAssert(zfc.get(key).type() == FeedItem.TYPE_CN);

	var ret = zfc.get(key).keyParent();

	if (zfc.isPresent(ret))
	{
		var zfi = zfc.get(ret);

		if (zfi.isForeign())
		{
			if (zfi.type() == FeedItem.TYPE_FL)
				ret = zfi.get(FeedItem.ATTR_SKEY);
			else
				zinAssertAndLog(false, function () { return "something is wrong: zfi: " + zfi.toString() + " key: " + key; });
		}
	}

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

// TYPE_SF elements are always of interest
// TYPE_LN elements are of interest if the 'l' attribute is '1'
// TYPE_CN elements are of interest if the 'l' attribute is '1'
// TYPE_FL is of interest if:
// - when the folder is in the primary account, the 'l' attribute is '1'
// - when the folder is in a   foreign account, there's a link element whose rid and zid attributes point to it and
//                                              the folder's perm indicates that the user has access
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
					ret = (zmPermFromZfi(zfi) != ZM_PERM_NONE);

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
				zinAssert(zfc.isPresent(key));
				ret = (zfi.get(FeedItem.ATTR_L) == 1) ? false : SyncFsm.isOfInterest(zfc, SyncFsm.keyParentRelevantToGid(zfc, key));
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

	logger().debug("newSyncFsm: account: " + account.toString() + " account_index: " + sfcd.m_account_index);

	if      (format == FORMAT_ZM && type == "twoway")    { syncfsm = new SyncFsmZm(); id_fsm = Maestro.FSM_ID_ZM_TWOWAY;   }
	else if (format == FORMAT_GD && type == "twoway")    { syncfsm = new SyncFsmGd(); id_fsm = Maestro.FSM_ID_GD_TWOWAY;   }
	else if (format == FORMAT_ZM && type == "authonly")  { syncfsm = new SyncFsmZm(); id_fsm = Maestro.FSM_ID_ZM_AUTHONLY; }
	else if (format == FORMAT_GD && type == "authonly")  { syncfsm = new SyncFsmGd(); id_fsm = Maestro.FSM_ID_GD_AUTHONLY; }
	else zinAssertAndLog(false, "mismatched case: format: " + format + " type: " + type);

	var prefset_server = new PrefSet(PrefSet.ACCOUNT,  PrefSet.ACCOUNT_PROPERTIES);
	prefset_server.setProperty(PrefSet.ACCOUNT_URL,      account.get(Account.url));
	prefset_server.setProperty(PrefSet.ACCOUNT_USERNAME, account.get(Account.username));

	syncfsm.initialise(id_fsm, sfcd);

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
	// this.state.m_logger.debug("setupHttpZm: blah: " +
	//                           " state: " + state + " eventOnResponse: " + eventOnResponse + " url: " + url +
	//                           " method: " + method + " evNext will be: " + this.fsm.m_transitions[state][eventOnResponse]);

	zinAssert(url != null);

	this.state.m_http = new HttpStateZm(url, this.state.m_logger);
	this.state.m_http.m_method = method;
	this.state.m_http.m_zsd.context(this.state.authToken, zid, (method != "ForeignContactDelete"));
	this.state.m_http.m_zsd[method].apply(this.state.m_http.m_zsd, arrayfromArguments(arguments, SyncFsm.prototype.setupHttpZm.length));

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
	var context  = this;
	var http = this.state.m_http;
	var httpBody;

	zinAssert(!http.is_cancelled);
	zinAssert(http.isPreResponse());
	zinAssert(!http.isPostResponse());

	this.state.cCallsToHttp++;

	this.state.m_logger.debug("http request: #" + this.state.cCallsToHttp + ": " + http.toStringFiltered());

	http.m_xhr = new XMLHttpRequest();
	http.m_xhr.onreadystatechange = closureToHandleXmlHttpResponse(context, continuation);

	http.m_xhr.open(http.m_http_method, http.m_url, true);

	if (http.m_http_headers)
		for (var key in http.m_http_headers)
			http.m_xhr.setRequestHeader(key,  http.m_http_headers[key]);

	http.m_xhr.send(http.httpBody());
}

function closureToHandleXmlHttpResponse(context, continuation)
{
	var ret = function()
	{
		// zinSleep(1000); // used to test that cancel works when an http request is pending
		// context.debug("am here: readyState: " + context.state.m_http.m_xhr.readyState);

		if (context.state.m_http.m_xhr.readyState == 4)
			context.handleXmlHttpResponse(continuation, context);
	}

	return ret;
}

SyncFsm.prototype.handleXmlHttpResponse = function (continuation, context)
{
	var msg  = "handleXmlHttpResponse: ";
	var http = context.state.m_http;
	var nextEvent = null;

	if (http.is_cancelled)
	{
		http.m_http_status_code = HTTP_STATUS_ON_CANCEL;

		msg += " cancelled - set m_http_status_code to: " + http.m_http_status_code;

		nextEvent = 'evCancel';
	}
	else
	{
		try {
			http.m_http_status_code = http.m_xhr.status;
			msg += " http status: " + http.m_http_status_code;
		}
		catch(e) {
			http.m_http_status_code = HTTP_STATUS_ON_SERVICE_FAILURE;
			msg += " http status faked: " + http.m_http_status_code + " after http.m_xhr.status threw an exception: " + e;
		}

		nextEvent = 'evNext';
	}

	zinAssert(http.m_http_status_code != null); // status should always be set to something when we leave here

	context.state.m_logger.debug(msg);

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
	zinAssertAndLog(arguments.length == 1);
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
		var method = (this.m_method == "ForeignContactDelete") ? "Batch" : this.m_method;
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
		msg += " - SOAP error: method: " + this.m_method;  // note that we didn't say "fault" here - could be a sending/service error

		if (this.m_http_status_code != null && this.m_http_status_code != HTTP_STATUS_200_OK)
			msg += " m_http_status_code == " + this.m_http_status_code;

		if (this.m_fault_element_xml)
			msg += " fault fields as shown: " + this.toString();

		nextEvent = 'evCancel';
	}

	this.m_logger.debug(msg);

	return nextEvent;
}

function HttpStateGd(http_method, url, headers, authToken, body, on_error, log_response, logger)
{
	zinAssert(on_error == HttpStateGd.ON_ERROR_EVNEXT || on_error == HttpStateGd.ON_ERROR_EVCANCEL);

	var a_default_headers = { 'Accept':          null,
	                          'Accept-Language': null,
							  'Accept-Encoding': null,
							  'Accept-Charset':  null,
							  'User-Agent':      null
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
	return this.m_http_method + " " + this.m_url;
	// for debugging: return this.m_http_method + " " + this.m_url + this.httpBody();;
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

SyncFsm.prototype.initialise = function(id_fsm, sfcd)
{
	var account  = sfcd.account();
	var sourceid = account.sourceid();

	this.initialiseState(id_fsm, sourceid, sfcd);
	this.initialiseFsm();

	if (id_fsm == Maestro.FSM_ID_ZM_AUTHONLY)
	{
		this.fsm.m_transitions['stAuthLogin']['evNext'] = 'final';
		this.fsm.m_transitions['stAuthCheck']['evNext'] = 'final';
	}
	else if (id_fsm == Maestro.FSM_ID_GD_AUTHONLY)
		this.fsm.m_transitions['stAuthCheck']['evNext'] = 'final';

	this.state.sources[sourceid][Account.url]             = account.get(Account.url);
	this.state.sources[sourceid][Account.username]        = account.get(Account.username);
	this.state.sources[sourceid][Account.passwordlocator] = account.get(Account.passwordlocator);
 
	var msg = "initialise: sourceid: " + sourceid + " soapURL: "  + this.state.sources[sourceid][Account.url] +
	                                                " username: " + this.username();

	if (this.formatPr() == FORMAT_ZM)
	{
		if (this.state.sources[sourceid][Account.url])
		{
			if (this.state.sources[sourceid][Account.url].charAt(this.state.sources[sourceid][Account.url].length - 1) != '/')
				this.state.sources[sourceid][Account.url] += '/';

			this.state.sources[sourceid][Account.url] += "service/soap/";
		}
		else
			; // if extension is installed but not configured, we end up in here with no preferences set - stAuth will report url is invalid

		this.state.SyncGalEnabled = account.get(Account.zm_sync_gal_enabled);

		msg += " SyncGalEnabled: " + this.state.SyncGalEnabled;
	}
	else // this.formatPr() == FORMAT_GD
	{
		var prefset = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_GD_PROPERTIES);
		prefset.load();

		this.state.gd_is_sync_postal_address = (prefset.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS) == "true");
		this.state.gd_sync_with              = account.get(Account.gd_sync_with);

		msg += " gd_sync_with: " + this.state.gd_sync_with + " gd_is_sync_postal_address: " + this.state.gd_is_sync_postal_address;
	}

	this.debug(msg);

	// once we know whether gd_is_sync_postal_address is going to be set, we then know which contact_converter we're using
	// so then we can give the addressbook a reference to it.
	//
	this.state.m_addressbook.contact_converter(this.contact_converter());
}

function FsmState()
{
}

FsmState.prototype.initialiseSource = function(sourceid, format)
{
	this.sources[sourceid]   = newObject('format', format, 'zfcLuid', null);
	this.aChecksum[sourceid] = new Object();
}

SyncFsm.prototype.initialiseState = function(id_fsm, sourceid, sfcd)
{
	this.state = new FsmState();

	var state = this.state;

	state.id_fsm              = id_fsm;
	state.sourceid_pr         = sourceid;
	state.m_sfcd              = sfcd;
	state.m_logappender       = new LogAppenderHoldOpen(); // holds an output stream open - must be closed explicitly
	state.m_logger            = new Logger(Singleton.instance().logger().level(), "SyncFsm", state.m_logappender);
	state.m_debug_filter_out  = new RegExp('https?' + GOOGLE_URL_HIER_PART + '|' + GOOGLE_PROJECTION, "mg");
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
	state.itSource            = null;         // iterator across sourceids
	state.itCollection        = null;         // iterator across a FeedCollection
	state.aHasChecksum        = new Object(); // used in slow sync: aHasChecksum[key][luid]   = true;
	state.aChecksum           = new Object(); // used in slow sync: aChecksum[sourceid][luid] = checksum;
	state.aSuo                = null;         // container for source update operations - populated in Converge
	state.aConflicts          = new Array();  // an array of strings - each one reports on a conflict
	state.stopFailCode        = null;         // if a state continues on evLackIntegrity, this is set for the observer
	state.stopFailTrailer     = null;
	state.stopFailArg         = null;
	state.m_bimap_format      = getBimapFormat('short');

	state.a_folders_deleted        = null;    // an associative array: key is gid of folder being deleted, value is an array of contact gids
	state.is_done_get_contacts_pu  = false;   // have we worked out the contacts to get from the server pre update?
	state.is_source_update_problem = false;   // true iff an update operation on a source had a problem (eg soap response 404)
	state.remote_update_package    = null;    // maintains state between an server update request and the response
	state.foreach_tb_card_functor  = null;
	state.m_folder_converter       = new FolderConverter();
	state.m_addressbook            = AddressBook.new();

	state.m_contact_converter_vary_none = new ContactConverter();
	state.m_contact_converter_vary_none.setup(ContactConverter.VARY_NONE);

	state.sources = new Object();

	state.initialiseSource(SOURCEID_TB, FORMAT_TB);

	state.sourceid_tb = SOURCEID_TB;
}

SyncFsmZm.prototype.initialiseState = function(id_fsm, sourceid, sfcd)
{
	SyncFsm.prototype.initialiseState.call(this, id_fsm, sourceid, sfcd);

	var state = this.state;

	state.zidbag                 = new ZidBag();
	state.suggestedSoapURL       = null;         // a <soapURL> response returned in GetAccountInfo
	state.a_zm_tested_soapurls   = new Array();  // soapURLs that have been tested with FakeHead - saved to lastsync.txt
	state.preauthURL             = null;
	state.preauthBody            = null;
	state.aSyncGalContact        = null;         // SyncGal
	state.mapIdSyncGalContact    = null;      
	state.SyncGalEnabled         = null;         // From the preference of the same name.  Possible values: yes, no, if-fewer
	state.SyncGalTokenInRequest  = null;
	state.SyncGalTokenInResponse = null;
	state.SyncMd                 = null;         // this gives us the time on the server
	state.SyncTokenInRequest     = null;         // the 'token' given to    <SyncRequest>
	state.isAnyChangeToFolders   = false;
	state.zimbraId               = null;         // the zimbraId for the Auth username - returned by GetAccountInfoRespose
	state.aContact               = new Array();  // array of contact (zid, id) - push in SyncResponse, shift in GetContactResponse
	state.isRedoSyncRequest      = false;        // we may need to do <SyncRequest> again - the second time without a token
	state.aSyncContact           = new Object(); // each property is a ZmContact object returned in GetContactResponse

	state.initialiseSource(sourceid, FORMAT_ZM);
}

SyncFsmGd.prototype.initialiseState = function(id_fsm, sourceid, sfcd)
{
	SyncFsm.prototype.initialiseState.call(this, id_fsm, sourceid, sfcd);

	var state = this.state;

	state.a_gd_contact                  = null;
	state.a_gd_contact_iterator         = null;
	state.a_gd_contact_dexmlify         = null;
	state.a_gd_contact_to_get           = new Array();
	state.a_gd_contact_to_del           = null;
	state.a_gd_contact_dexmlify_ids     = null;         // set to a Array() when it's in use
	state.gd_url_base                   = null;
	state.gd_is_dexmlify_postal_address = false;
	state.gd_sync_token                 = null;
	state.gd_luid_ab_in_gd              = null;         // luid of the parent addressbook in this.zfcPr()
	state.gd_luid_ab_in_tb              = null;         // luid of the parent addressbook in this.zfcTb()
	state.gd_ab_uri                     = null;         // uri of the thunderbird addressbook being synced with google
	state.gd_sync_with                  = null;         // pab or zg
	state.gd_is_sync_postal_address     = null;         // true/false
	state.gd_scheme_data_transfer       = this.getCharPref(MozillaPreferences.GD_SCHEME_DATA_TRANSFER);

	// this contact_converter is used when we're syncing postalAddress with Google, but the _vary_none version is still called
	// from the slow sync checksum code because we don't want to include Google postalAddress in the checksum/isTwin comparison
	//
	state.m_contact_converter_vary_gd_postal = new ContactConverter();
	state.m_contact_converter_vary_gd_postal.setup(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);

	state.initialiseSource(sourceid, FORMAT_GD);
}

SyncFsmGd.prototype.entryActionAuth = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	var sourceid_pr = this.state.sourceid_pr;

	var url      = this.state.sources[sourceid_pr][Account.url];
	var username = this.username();
	var password = this.state.sources[sourceid_pr][Account.passwordlocator].getPassword();

	// See RFC 2821 and http://en.wikipedia.org/wiki/E-mail_address
	// Thank goodness Gmail doesn't support email addresses where the local-part is a quoted string :-)
	//
	var valid_email_re = /^([A-Z0-9\.\!\#\$\%\*\/\?\|\^\{\}\`\~\&\'\+\-\=]+@[A-Z0-9.-]+\.[A-Z]+)$/i;

	if (url && username.length > 0 && valid_email_re.test(username) && password && password.length > 0)
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

		var passwordlocator = new PasswordLocator(this.state.sources[this.state.sourceid_pr][Account.passwordlocator]);
		passwordlocator.url(googleClientLoginUrl('use-authtoken'));

		passwordlocator.setPassword(this.state.authToken);

		this.debug("authentication: exitActionAuth caches an authToken for: " + passwordlocator.username());
	}

	this.state.m_logger.debug("authToken.length: " + (this.state.authToken ? this.state.authToken.length : "null") );
}

SyncFsm.prototype.entryActionAuthCheck = function(state, event, continuation)
{
	nextEvent = 'evNext';

	this.state.stopwatch.mark(state);

	if (!this.state.authToken)
	{
		this.state.stopFailCode   = 'failon.auth';
		this.state.stopFailTrailer = stringBundleString("text.http.status.code", [ this.state.m_http.m_http_status_code ]);

		nextEvent = 'evLackIntegrity';  // this isn't really a lack of integrity, but it's processed in the same way
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.entryActionDelContactGd = function(state, event, continuation)
{
	var nextEvent = null;

	if (!this.state.a_gd_contact_to_del)
	{
		this.state.a_gd_contact_to_del = new Array();

		var context = this;
		var functor_foreach_item = {
			run: function(edit_uri, value)
			{
				context.state.a_gd_contact_to_del.push(edit_uri);

				return true;
			}
		};

		var zfc = new FeedCollection();
		zfc.filename(Filesystem.FILENAME_GD_TO_BE_DELETED);

		if (zfc.nsifile().exists())
		{
			zfc.load();

			if (zfc.isPresent(this.username()))
			{
				zfc.get(this.username()).forEach(functor_foreach_item, FeedItem.ITER_GID_ITEM);
				zfc.del(this.username());
			}

			zfc.save();

			if (zfc.length() == 0)
				RemoveDatastore.removeZfc(Filesystem.FILENAME_GD_TO_BE_DELETED);
		}

		this.state.m_logger.debug("entryActionDelContactGd: a_gd_contact_to_del: " + this.state.a_gd_contact_to_del.toString());
	}

	if (this.state.a_gd_contact_to_del.length > 0)
	{
		var url = gdAdjustHttpHttps(this.state.a_gd_contact_to_del.pop());

		this.setupHttpGd(state, 'evRepeat', "POST", url, { "X-HTTP-Method-Override" : "DELETE"}, null,
		                  HttpStateGd.ON_ERROR_EVCANCEL, HttpStateGd.LOG_RESPONSE_YES);
		
		nextEvent = 'evHttpRequest'
	}
	else
	{
		this.state.m_http = null;

		nextEvent = 'evNext'
	}

	continuation(nextEvent);
}


SyncFsmGd.prototype.entryActionGetContactGd1 = function(state, event, continuation)
{
	this.state.gd_url_base = this.getCharPref(MozillaPreferences.GD_SCHEME_DATA_TRANSFER) + GOOGLE_URL_HIER_PART + 
	                         encodeURIComponent(this.username()) + GOOGLE_PROJECTION;

	var SyncToken = this.state.zfcLastSync.get(this.state.sourceid_pr).getOrNull('SyncToken');
	var url       = this.state.gd_url_base + "?showdeleted=true";

	this.state.stopwatch.mark(state);

	if (SyncToken)
		url += "&updated-min=" + SyncToken;

	url += "&max-results=10000";

	this.state.m_logger.debug("entryActionGetContactGd1: url: " + url);

	this.setupHttpGd(state, 'evNext', "GET", url, null, null, HttpStateGd.ON_ERROR_EVNEXT, HttpStateGd.LOG_RESPONSE_YES);

	continuation('evHttpRequest');
}

SyncFsmGd.prototype.entryActionGetContactGd2 = function(state, event, continuation)
{
	var nextEvent;
	var response;

	if (!this.state.m_http || !this.state.m_http.response('text'))
		nextEvent = 'evCancel';
	else if (this.state.m_http.is_http_status(HTTP_STATUS_403_FORBIDDEN))
	{
		this.state.stopFailCode = 'failon.gd.forbidden';

		nextEvent = 'evLackIntegrity';

		var passwordlocator = new PasswordLocator(this.state.sources[this.state.sourceid_pr][Account.passwordlocator]);
		passwordlocator.url(googleClientLoginUrl('use-authtoken'));

		passwordlocator.delPassword();

		this.debug("authentication: entryActionGetContactGd2 removes the cached authToken for: " + passwordlocator.username());
	}
	else if (this.state.m_http.is_http_status(HTTP_STATUS_2xx))
	{
		response = this.state.m_http.response();

		// set the sync token
		//
		var warn_msg = "<updated> element is missing from <feed>!";
		Xpath.setConditionalFromSingleElement(this.state, 'gd_sync_token', "//atom:feed/atom:updated", response, warn_msg);
		this.debug("entryActionGetContactGd2: gd_sync_token: " + this.state.gd_sync_token);

		this.state.a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), response, "/atom:feed/atom:entry");
		this.state.a_gd_contact_iterator = Iterator(this.state.a_gd_contact, true);
		this.state.a_gd_contact_iterator.m_zindus_contact_count = 1; // used to show progress
		this.state.a_gd_contact_iterator.a_zindus_contact_count = newObject('regular', 0, 'deleted', 0, 'empty', 0);
		this.state.a_gd_contact_iterator.m_zindus_contact_chunk = 100;

		this.state.gd_is_dexmlify_postal_address = this.is_slow_sync(this.state.sourceid_pr) && !this.state.gd_is_sync_postal_address;

		if (this.state.gd_is_dexmlify_postal_address)
			this.state.a_gd_contact_dexmlify = GdContact.arrayFromXpath(this.state.m_contact_converter_vary_gd_postal,
		                                                                response, "/atom:feed/atom:entry");
		nextEvent = 'evNext';
	}
	else
		nextEvent = 'evCancel';

	continuation(nextEvent);
}

SyncFsmGd.prototype.entryActionGetContactGd3 = function(state, event, continuation)
{
	var is_finished = false;
	var count       = 0;
	var msg         = "";
	var contact, id;

	this.state.stopwatch.mark(state);

	msg += "entryActionGetContactGd3:\n";

	try {
		while (count < this.state.a_gd_contact_iterator.m_zindus_contact_chunk)
		{
			id = this.state.a_gd_contact_iterator.next();

			var zfi                 = null;
			var contact             = this.state.a_gd_contact[id];
			var rev                 = contact.m_meta[GdContact.updated];
			var edit_url            = contact.m_meta[GdContact.edit];
			var self_url            = contact.m_meta[GdContact.self];
			var is_deleted_or_empty = contact.is_deleted() || contact.is_empty();

			count++;                                                   // count the contacts processed this iteration
			this.state.a_gd_contact_iterator.m_zindus_contact_count++; // count the contacts processed in total

			if (contact.is_deleted())                                  // count the contacts by breakdown to match against gmail UI
				this.state.a_gd_contact_iterator.a_zindus_contact_count['deleted']++;
			else if (contact.is_empty())
				this.state.a_gd_contact_iterator.a_zindus_contact_count['empty']++;
			else
				this.state.a_gd_contact_iterator.a_zindus_contact_count['regular']++;

			msg += "id=" + id;
			
			if (!is_deleted_or_empty)
				msg += " properties: " + contact.toString();

			if (this.zfcPr().isPresent(id))
			{
				zfi = this.zfcPr().get(id);

				zfi.set(FeedItem.ATTR_REV,  rev);
				zfi.set(FeedItem.ATTR_EDIT, edit_url);
				zfi.set(FeedItem.ATTR_SELF, self_url);

				msg += " updated: ";

				if (is_deleted_or_empty)
				{
					this.zfcPr().get(id).set(FeedItem.ATTR_DEL, '1');

					msg += " marked as deleted" + (contact.is_deleted() ? "" : " (because it is empty)") + ": ";
				}

				msg += " zfi: " + zfi.toString();
			}
			else if (!is_deleted_or_empty)
			{
				zfi = this.newZfiCnGd(id, rev, edit_url, self_url, this.state.gd_luid_ab_in_gd);
				this.zfcPr().set(zfi); // add new
				msg += " added: " + zfi.toString();
			}
			else
				msg += " ignored " + (contact.is_deleted() ? "deleted" : "empty") + " contact";

			msg += "\n";
		}
	}
	catch (ex if ex instanceof StopIteration) {
		is_finished = true;

	} catch (ex) {
		this.state.m_logger.error(ex);
		zinAssert(false);
	}

	this.debug(msg);

	if (is_finished)
		this.debug("entryActionGetContactGd3: contacts processed: " +
			" regular: " + this.state.a_gd_contact_iterator.a_zindus_contact_count['regular'] +
			" empty: "   + this.state.a_gd_contact_iterator.a_zindus_contact_count['empty'] +
			" deleted: " + this.state.a_gd_contact_iterator.a_zindus_contact_count['deleted'] +
			" gmail ui should match (regular + empty) after a slow sync");
		
	var nextEvent;

	if (!is_finished)
		nextEvent = 'evRepeat';
	else if (this.state.gd_is_dexmlify_postal_address)
		nextEvent = 'evNext';
	else
		nextEvent = 'evSkip';

	continuation(nextEvent);
}

SyncFsmGd.prototype.newZfiCnGd = function(id, rev, edit_url, self_url, gd_luid_ab_in_gd)
{
	zinAssert(arguments.length == 5);

	return new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY,  id,
				                          FeedItem.ATTR_REV,  rev,
				                          FeedItem.ATTR_EDIT, edit_url,
				                          FeedItem.ATTR_SELF, self_url,
										  FeedItem.ATTR_L,    gd_luid_ab_in_gd);
}

SyncFsmGd.prototype.entryActionGetContactPuGd = function(state, event, continuation)
{
	var sourceid_pr = this.state.sourceid_pr;
	var nextEvent = null;

	if (!this.state.is_done_get_contacts_pu)
	{
		for (indexSuo in this.state.aSuo[sourceid_pr][Suo.MOD | FeedItem.TYPE_CN])
		{
			suo         = this.state.aSuo[sourceid_pr][Suo.MOD | FeedItem.TYPE_CN][indexSuo];
			luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);

			if (!isPropertyPresent(this.state.a_gd_contact, luid_target))
				this.state.a_gd_contact_to_get.push(luid_target);
		}

		this.state.is_done_get_contacts_pu = true;

		this.debug("entryActionGetContactPuGd: a_gd_contact_to_get: " + this.state.a_gd_contact_to_get.toString());
	}

	if (this.state.a_gd_contact_to_get.length > 0 && !this.state.is_source_update_problem)
	{
		// this is one place where we GET a single contact and use the SELF url for that purpose.
		// According to:
		// http://groups.google.com/group/google-contacts-api/browse_thread/thread/50e9ba8955b3b18f
		// id ought to be treated as an opaque string nor does it vary by projection (always uses /base) while self does...
		//
		var id  = this.state.a_gd_contact_to_get.pop();
		var url = gdAdjustHttpHttps(this.zfcPr().get(id).get(FeedItem.ATTR_SELF));

		this.setupHttpGd(state, 'evRepeat', "GET", url, null, null, HttpStateGd.ON_ERROR_EVCANCEL, HttpStateGd.LOG_RESPONSE_YES);
		
		nextEvent = 'evHttpRequest'
	}
	else
	{
		this.state.m_http = null;

		nextEvent = 'evNext'
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionGetContactPuGd = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	// a 404 here is conceivable - a contact can get deleted on the server between the earlier GET and now.
	//
	if (!this.state.m_http.is_http_status(HTTP_STATUS_2xx))
	{
		this.state.stopFailCode = 'failon.gd.get';
		this.state.is_source_update_problem = true;
	}

	var a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), this.state.m_http.response(), "/atom:entry");

	zinAssertAndLog(aToLength(a_gd_contact) ==  1, "length: " + aToLength(a_gd_contact));

	var id = firstKeyInObject(a_gd_contact);

	zinAssertAndLog(!isPropertyPresent(this.state.a_gd_contact, id), "id=" + id);

	this.state.a_gd_contact[id] = a_gd_contact[id];
}

SyncFsmGd.prototype.entryActionDeXmlifyAddrGd = function(state, event, continuation)
{
	var sourceid_pr = this.state.sourceid_pr;
	var key, contact, is_modified, new_properties;
	var nextEvent = null;

	if (!this.state.a_gd_contact_dexmlify_ids)
	{
		this.state.a_gd_contact_dexmlify_ids = new Array();

		for (var id in this.state.a_gd_contact_dexmlify)
		{
			contact        = this.state.a_gd_contact_dexmlify[id];
			is_modified    = false;
			new_properties = cloneObject(contact.m_properties);

			msg = "DeXmlifyAddrGd: testing id=" + id;

			for (var key in this.state.m_contact_converter_vary_gd_postal.gd_certain_keys_converted()["postalAddress"])
				if (isPropertyPresent(new_properties, key))
				{
					var otheraddr = contact.postalAddressOtherAddr(key);

					msg + " key=" + key + " otheraddr: " + otheraddr;

					if (otheraddr != null)
					{
						is_modified = true;
						new_properties[key] = otheraddr;
					}
				}

			if (is_modified)
			{
				this.state.a_gd_contact_dexmlify[id].updateFromProperties(new_properties);
				this.state.a_gd_contact_dexmlify_ids.push(id);
			}

			this.debug(msg);
		}

		this.state.m_logger.debug("entryActionDeXmlifyAddrGd: a_gd_contact_dexmlify_ids: "+this.state.a_gd_contact_dexmlify_ids.toString());
	}

	if (this.state.a_gd_contact_dexmlify_ids.length > 0)
	{
		var id = this.state.a_gd_contact_dexmlify_ids.pop();
		var url = id;
		contact = this.state.a_gd_contact_dexmlify[id];

		var remote = new Object();
		remote.method  = "POST";  // POST // PUT
		remote.url     = gdAdjustHttpHttps(contact.m_meta[GdContact.edit]);
		remote.headers = newObject("Content-type", "application/atom+xml", "X-HTTP-Method-Override", "PUT");
		remote.body    = contact.toStringXml();

		this.setupHttpGd(state, 'evRepeat', remote.method, remote.url, remote.headers, remote.body, HttpStateGd.ON_ERROR_EVCANCEL,
		                  HttpStateGd.LOG_RESPONSE_YES);
		
		nextEvent = 'evHttpRequest'
	}
	else
	{
		this.state.m_http = null;

		nextEvent = 'evNext'
	}

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionDeXmlifyAddrGd = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response() || event == "evCancel")
		return;

	var a_gd_contact = GdContact.arrayFromXpath(this.contact_converter(), this.state.m_http.response(), "/atom:entry");
	var length = aToLength(a_gd_contact);

	zinAssertAndLog(length ==  1, length);

	var id = firstKeyInObject(a_gd_contact);

	zinAssertAndLog(isPropertyPresent(this.state.a_gd_contact, id), id);
	zinAssertAndLog(this.zfcPr().isPresent(id), id);

	this.state.a_gd_contact[id] = a_gd_contact[id];

	var contact = this.state.a_gd_contact[id];

	zfi = this.zfcPr().get(id);
	zfi.set(FeedItem.ATTR_REV,  contact.m_meta[GdContact.updated]);
	zfi.set(FeedItem.ATTR_EDIT, contact.m_meta[GdContact.edit]);
	zfi.set(FeedItem.ATTR_SELF, contact.m_meta[GdContact.self]);

	var msg = "";
	msg += " updated: ";
	msg += " zfi: " + zfi.toString();

	this.state.m_logger.debug("exitActionDeXmlifyAddrGd: id=" + id + " properties: " + contact.toString() + msg);
}
