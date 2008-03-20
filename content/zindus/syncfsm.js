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

include("chrome://zindus/content/fsm.js");
include("chrome://zindus/content/soapdocument.js");
include("chrome://zindus/content/xpath.js");
include("chrome://zindus/content/contact.js");
include("chrome://zindus/content/addressbook.js");
include("chrome://zindus/content/contactconverter.js");
include("chrome://zindus/content/folderconverter.js");
include("chrome://zindus/content/feed.js");
include("chrome://zindus/content/suo.js");
include("chrome://zindus/content/zuio.js");
include("chrome://zindus/content/gcs.js");
include("chrome://zindus/content/lso.js");
include("chrome://zindus/content/removedatastore.js");
include("chrome://zindus/content/zidbag.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/passwordmanager.js");
include("chrome://zindus/content/stopwatch.js");

const AB_GAL = "GAL";

const ORDER_SOURCE_UPDATE = [
	Suo.MOD | ZinFeedItem.TYPE_FL, Suo.MOD | ZinFeedItem.TYPE_SF,
	Suo.ADD | ZinFeedItem.TYPE_FL, Suo.ADD | ZinFeedItem.TYPE_SF, 
	Suo.DEL | ZinFeedItem.TYPE_CN,
	Suo.MOD | ZinFeedItem.TYPE_CN,
	Suo.ADD | ZinFeedItem.TYPE_CN,
	Suo.DEL | ZinFeedItem.TYPE_FL, Suo.DEL | ZinFeedItem.TYPE_SF
];

const AUTO_INCREMENT_STARTS_AT = 256;  // the 'next' attribute of the AUTO_INCREMENT item starts at this value + 1.

const ZM_FIRST_USER_ID = 256;

function SyncFsm(state)
{
	this.state   = state;
	this.fsm     = new Object();
}

SyncFsm.getFsm = function(context)
{
	var transitions = {
		start:             { evCancel: 'final', evNext: 'stAuth',                                           evLackIntegrity: 'final' },
		stAuth:            { evCancel: 'final', evNext: 'stLoad',           evSoapRequest: 'stSoapRequest'                           },
		stLoad:            { evCancel: 'final', evNext: 'stLoadTb',         evSoapRequest: 'stSoapRequest', evLackIntegrity: 'final' },
		stLoadTb:          { evCancel: 'final', evNext: 'stGetAccountInfo',                                 evLackIntegrity: 'final' },
		stGetAccountInfo:  { evCancel: 'final', evNext: 'stSelectSoapUrl',  evSoapRequest: 'stSoapRequest'                           },
		stSelectSoapUrl:   { evCancel: 'final', evNext: 'stGetInfo',        evSoapRequest: 'stSoapRequest', evSkip: 'stSync'         },
		stGetInfo:         { evCancel: 'final', evNext: 'stCheckLicense',   evSoapRequest: 'stSoapRequest'                           },
		stCheckLicense:    { evCancel: 'final', evNext: 'stSync',           evSoapRequest: 'stSoapRequest'                           },
		stSync:            { evCancel: 'final', evNext: 'stSyncResult',     evSoapRequest: 'stSoapRequest'                           },
		stSyncResult:      { evCancel: 'final', evNext: 'stGetContact',     evRedo:        'stSync',        evDo: 'stGetAccountInfo' },
		stGetContact:      { evCancel: 'final', evNext: 'stGalConsider',    evSoapRequest: 'stSoapRequest', evRepeat: 'stGetContact' },
		stGalConsider:     { evCancel: 'final', evNext: 'stGalSync',        evSkip:        'stGalCommit'                             },
		stGalSync:         { evCancel: 'final', evNext: 'stGalCommit',      evSoapRequest: 'stSoapRequest'                           },
		stGalCommit:       { evCancel: 'final', evNext: 'stConverge1'                                                                },
		stConverge1:       { evCancel: 'final', evNext: 'stConverge2',                                      evLackIntegrity: 'final' },
		stConverge2:       { evCancel: 'final', evNext: 'stConverge3',                                                               },
		stConverge3:       { evCancel: 'final', evNext: 'stGetContactsDel',                                 evLackIntegrity: 'final' },
		stGetContactsDel:  { evCancel: 'final', evNext: 'stUpdateTb',       evSoapRequest: 'stSoapRequest', evRepeat: 'stGetContactsDel' },
		stUpdateTb:        { evCancel: 'final', evNext: 'stUpdateZm'                                                                 },
		stUpdateZm:        { evCancel: 'final', evNext: 'stUpdateCleanup',  evSoapRequest: 'stSoapRequest', evRepeat: 'stUpdateZm'   },
		stUpdateCleanup:   { evCancel: 'final', evNext: 'stCommit',                                         evLackIntegrity: 'final' },

		stSoapRequest:     { evCancel: 'final', evNext: 'stSoapResponse'                                                             },
		stSoapResponse:    { evCancel: 'final', evNext: 'final' /* evNext here is set by setupHttpSoap */                            },

		stCommit:          { evCancel: 'final', evNext: 'final'                                                                      },
		final:             { }
	};

	var a_entry = {
		start:                  context.entryActionStart,
		stAuth:                 context.entryActionAuth,
		stLoad:                 context.entryActionLoad,
		stLoadTb:               context.entryActionLoadTb,
		stGetAccountInfo:       context.entryActionGetAccountInfo,
		stSelectSoapUrl:        context.entryActionSelectSoapUrl,
		stGetInfo:              context.entryActionGetInfo,
		stCheckLicense:         context.entryActionCheckLicense,
		stSync:                 context.entryActionSync,
		stSyncResult:           context.entryActionSyncResult,
		stGetContact:           context.entryActionGetContact,
		stGetContactsDel:       context.entryActionGetContact,
		stGalConsider:          context.entryActionGalConsider,
		stGalSync:              context.entryActionGalSync,
		stGalCommit:            context.entryActionGalCommit,
		stConverge1:            context.entryActionConverge1,
		stConverge2:            context.entryActionConverge2,
		stConverge3:            context.entryActionConverge3,
		stUpdateTb:             context.entryActionUpdateTb,
		stUpdateZm:             context.entryActionUpdateZm,
		stUpdateCleanup:        context.entryActionUpdateCleanup,
		stCommit:               context.entryActionCommit,

		stSoapRequest:          context.entryActionSoapRequest,
		stSoapResponse:         context.entryActionSoapResponse,

		final:                  context.entryActionFinal
	};

	var a_exit = {
		stAuth:                 context.exitActionAuth,
		stGetAccountInfo:       context.exitActionGetAccountInfo,
		stSelectSoapUrl:        context.exitActionSelectSoapUrl,
		stGetInfo:              context.exitActionGetInfo,
		stCheckLicense:         context.exitActionCheckLicense,
		stGetContact:           context.exitActionGetContact,
		stGetContactsDel:       context.exitActionGetContact,
		stGalSync:              context.exitActionGalSync,
		stUpdateZm:             context.exitActionUpdateZm,
		stSoapResponse:         context.exitActionSoapResponse  /* this gets tweaked by setupHttpSoap */
	};

	var fsm = new Fsm(transitions, a_entry, a_exit);

	return fsm;
}

SyncFsm.prototype.start = function(win)
{
	this.fsm.m_window = win;
	fsmTransitionSchedule(this.state.id_fsm, null, 'start', 'evNext', this);
}

SyncFsm.prototype.cancel = function(timeoutID)
{
	if (this.state.m_soap_state != null && this.state.m_soap_state.m_xhr && this.state.m_soap_state.m_xhr.readyState != 4)
	{
		this.state.m_soap_state.is_cancelled = true

		this.state.m_logger.debug("cancel: about to call: m_xhr.abort()");

		this.state.m_soap_state.m_xhr.abort();
	}
	else
	{
		this.fsm.m_window.clearTimeout(timeoutID);

		this.state.m_logger.debug("cancel: cleared timeoutID: " + timeoutID);

		if (!this.fsm.m_continuation)
		{
			// the fsm hasn't had a transition yet so there's no continuation
			// so we just enter the start state and give it a cancel event
			//
			this.state.m_logger.debug("cancel: fsm was about to enter start state - now it does that on evCancel");
			fsmTransitionSchedule(this.state.id_fsm, null, 'start', 'evCancel', this);
		}
		else
		{
			this.state.m_logger.debug("cancel: continuing on evCancel");

			this.fsm.m_continuation('evCancel');
		}
	}
}

SyncFsm.prototype.entryActionStart = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark("entryActionStart");

	if (event == 'evCancel')
	{
		nextEvent = 'evCancel';
	}
	else if (typeof(document.evaluate) != 'function')
	{
		this.state.stopFailCode = 'FailOnNoXpath';
		nextEvent = 'evLackIntegrity';
	}
	else
	{
		var sourceid_zm = this.state.sourceid_zm;

		var url      = this.state.sources[sourceid_zm]['soapURL'];
		var username = this.state.sources[sourceid_zm]['username'];
		var password = this.state.sources[sourceid_zm]['password'];

		if (/^https?:\/\//.test(url) && username.length > 0 && password.length > 0 && isValidUrl(url))
		{
			zinAssert(this.state.zidbag.isPrimaryUser());

			this.state.zidbag.push(null);
			this.state.zidbag.set(null, 'soapURL', this.state.sources[sourceid_zm]['soapURL']);

			nextEvent = 'evNext';
		}
		else
		{
			this.state.stopFailCode = 'FailOnIntegrityBadCredentials';
			nextEvent = 'evLackIntegrity';
		}
	}

	this.state.m_logger.debug("entryActionStart: nextEvent: " + nextEvent);

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionAuth = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionAuth");

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(0), null, "Auth", 
	                          this.state.sources[this.state.sourceid_zm]['username'],
	                          this.state.sources[this.state.sourceid_zm]['password']);

	continuation('evSoapRequest');
}

SyncFsm.prototype.exitActionAuth = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	var response = this.state.m_soap_state.m_response;

	if (response)
	{
		conditionalGetElementByTagNameNS(response, ZimbraSoapDocument.NS_ACCOUNT, "authToken", this.state, 'authToken');

		// ignore lifetime - in doing so we assume that no sync will take longer than the default lifetime of an hour.
		// conditionalGetElementByTagNameNS(response, ZimbraSoapDocument.NS_ACCOUNT, "lifetime",  this.state, 'lifetime');
	}
}

SyncFsm.prototype.loadZfcs = function(a_zfc)
{
	var cExist = 0;

	a_zfc[Filesystem.FILENAME_GID]      = this.state.zfcGid      = new ZinFeedCollection();
	a_zfc[Filesystem.FILENAME_LASTSYNC] = this.state.zfcLastSync = new ZinFeedCollection();

	for (var sourceid in this.state.sources)
	{
		var key = hyphenate("-", sourceid, this.state.m_bimap_format.lookup(this.state.sources[sourceid]['format'], null)) + ".txt";
		a_zfc[key] = this.state.sources[sourceid]['zfcLuid'] = new ZinFeedCollection();
	}

	for (var i in a_zfc)
	{
		a_zfc[i].filename(i);

		if (a_zfc[i].nsifile().exists())
			cExist++;

		a_zfc[i].load();
	}

	this.state.aReverseGid = this.getGidInReverse();

	return cExist;
}

SyncFsm.prototype.entryActionLoad = function(state, event, continuation)
{
	// Here is (one of the places) where we pay for not having a real data store.
	// Even though data is stored in at least four separate files: 1-tb.txt, 2-zm.txt, gid.txt, lastsync.txt 
	// as far as integrity is concerned they are a single unit.
	//
	// Three cases are identified:
	// 1. clean slate (ie post install or reset)          ==> initialise and nextEvent == evNext
	// 2. all the files exist and have integrity          ==> continue   and nextEvent == evNext
	// 3. some files don't exist or don't have integrity  ==> continue   and nextEvent == evLackIntegrity (user is notified)
	//
	this.state.stopwatch.mark("entryActionLoad");

	var nextEvent = null;
	var cExist;

	var a_zfc = new Object(); // associative array of zfc, key is the file name

	cExist = this.loadZfcs(a_zfc);

	this.state.m_logger.debug("entryActionLoad: number of file load attempts: " + aToLength(a_zfc) +
	                                          " number of file load actual: "   + cExist);

	var sourceid_zm = this.state.sourceid_zm;

	this.state.m_logger.debug("entryActionLoad: last sync soapURL: "  +
	   ( this.state.zfcLastSync.isPresent(sourceid_zm) ? this.state.zfcLastSync.get(sourceid_zm).getOrNull('soapURL') : "not present"));
	this.state.m_logger.debug("entryActionLoad: last sync username: "  +
	   ( this.state.zfcLastSync.isPresent(sourceid_zm) ? this.state.zfcLastSync.get(sourceid_zm).getOrNull('username') : "not present"));
	this.state.m_logger.debug("entryActionLoad: this sync soapURL:  " + this.state.sources[sourceid_zm]['soapURL']);
	this.state.m_logger.debug("entryActionLoad: this sync username: " + this.state.sources[sourceid_zm]['username']);


	if (cExist != 0 && (this.state.zfcLastSync.get(sourceid_zm).getOrNull('soapURL')  != this.state.sources[sourceid_zm]['soapURL'] ||
	                    this.state.zfcLastSync.get(sourceid_zm).getOrNull('username') != this.state.sources[sourceid_zm]['username']))
	{
		this.state.m_logger.debug("entryActionLoad: server url or username changed since last sync - doing a reset to force slow sync");

		RemoveDatastore.removeZfcs();

		cExist = this.loadZfcs(a_zfc);
	}

	if (cExist == 0)
	{
		this.state.m_logger.debug("entryActionLoad: data files didn't exist - initialising maps and tb attributes...");

		this.state.isSlowSync = true;

		this.initialiseZfcLastSync();
		this.initialiseZfcAutoIncrement(this.state.zfcGid);
		this.initialiseZfcAutoIncrement(this.zfcTb());
		this.initialiseZfcAutoIncrement(this.zfcZm());
		this.initialiseTbAddressbook();

		nextEvent = 'evNext';
	}
	else if (cExist == aToLength(a_zfc) && this.isConsistentDataStore())
		nextEvent = 'evNext';
	else
		nextEvent = 'evLackIntegrity';

	this.state.m_logger.debug("entryActionLoad: isSlowSync: " + this.state.isSlowSync);

	continuation(nextEvent);
}

// Could also (but don't) test that:
// - 'ver' attributes make sense

SyncFsm.prototype.isConsistentDataStore = function()
{
	var ret = true;

	ret = ret && this.isConsistentZfcAutoIncrement(this.state.zfcGid);
	ret = ret && this.isConsistentZfcAutoIncrement(this.zfcTb());
	ret = ret && this.isConsistentZfcAutoIncrement(this.zfcZm());
	ret = ret && this.isConsistentGid();
	ret = ret && this.isConsistentSources();
	ret = ret && this.isConsistentSharedFolderReferences();

	return ret;
}

// every (sourceid, luid) in the gid must be in the corresponding source (tested by reference to aReverseGid)
//
SyncFsm.prototype.isConsistentGid = function()
{
	var is_consistent = true;

	bigloop:
		for (var sourceid in this.state.aReverseGid)
			for (var luid in this.state.aReverseGid[sourceid])
				if (!isPropertyPresent(this.state.sources, sourceid) || !this.state.sources[sourceid]['zfcLuid'].isPresent(luid))
				{
					this.state.m_logger.debug("isConsistentGid: inconsistency: sourceid: " + sourceid + " luid: " + luid);
					is_consistent = false;
					break bigloop;
				}

	this.state.m_logger.debug("isConsistentGid: " + is_consistent);

	return is_consistent;
}

SyncFsm.prototype.isConsistentSources = function()
{
	var is_consistent = true;
	var error_msg = "";

	var functor_foreach_luid = {
		state: this.state,

		run: function(zfi)
		{
			var luid = zfi.key();

			// all items in a source must be of interest (which basically tests that the 'l' attribute is correct)
			//
			if (is_consistent && !SyncFsm.isOfInterest(zfc, luid))
			{
				error_msg += "inconsistency re: item not of interest: sourceid: " + sourceid + " luid: " + luid + " zfi: " + zfi.toString();
				is_consistent = false;
			}

			// all items in a source must be in the gid (tested via reference to aReverse)
			//
			if (is_consistent && SyncFsm.isRelevantToGid(zfc, luid) && !isPropertyPresent(this.state.aReverseGid[sourceid], luid))
			{
				error_msg += "inconsistency vs gid: sourceid: " + sourceid + " luid: " + luid;
				is_consistent = false;
			}

			// These items shouldn't be persisted in a source map.
			// No items should be marked as deleted because if we were unable to update a zimbra server because of
			// a network outage, we wouldn't have saved the source map.
			//
			var a = [ ZinFeedItem.ATTR_DEL, ZinFeedItem.ATTR_PRES ];

			for (var i = 0; is_consistent && i < a.length; i++)
				if (zfi.isPresent(a[i]))
				{
					error_msg += "inconsistency re: " + a[i] + ": sourceid: " + sourceid + " luid: " + luid;
					is_consistent = false;
					break;
				}

			return is_consistent;
		}
	};

	for (var sourceid in this.state.sources)
	{
		zfc = this.state.sources[sourceid]['zfcLuid'];
		zfc.forEach(functor_foreach_luid);
	}

	this.state.m_logger.debug("isConsistentSources: " + is_consistent + " " + error_msg);

	return is_consistent;
}

SyncFsm.prototype.isConsistentSharedFolderReferences = function()
{
	var is_consistent = true;
	var error_msg = "";

	var functor_foreach_luid = {
		state: this.state,

		run: function(zfi)
		{
			if (is_consistent && zfi.type() == ZinFeedItem.TYPE_SF)
			{
				is_consistent = is_consistent && this.test_key_reference(zfi, ZinFeedItem.ATTR_LKEY);
				is_consistent = is_consistent && this.test_key_reference(zfi, ZinFeedItem.ATTR_FKEY);
			}

			if (is_consistent && zfi.type() == ZinFeedItem.TYPE_LN)
			{
				if (is_consistent && (!zfi.isPresent(ZinFeedItem.ATTR_RID) || !zfi.isPresent(ZinFeedItem.ATTR_ZID) ))
				{
					error_msg += "missing required attributes: " + zfi.toString();
					is_consistent = false;
				}

				if (is_consistent && !zfc.isPresent(Zuio.key(zfi.get(ZinFeedItem.ATTR_RID), zfi.get(ZinFeedItem.ATTR_ZID))))
				{
					error_msg += "<link> refers to non-existent foreign folder: " + zfi.toString();
					is_consistent = false;
				}

				is_consistent = is_consistent && this.test_key_reference(zfi, ZinFeedItem.ATTR_SKEY);
			}

			if (is_consistent && zfi.type() == ZinFeedItem.TYPE_FL && zfi.isForeign())
			{
				is_consistent = is_consistent && this.test_key_reference(zfi, ZinFeedItem.ATTR_SKEY);
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
		zfc = this.state.sources[sourceid]['zfcLuid'];
		format = this.state.sources[sourceid]['format'];

		if (format == FORMAT_ZM)
			zfc.forEach(functor_foreach_luid);
	}

	this.state.m_logger.debug("isConsistentSharedFolderReferences: " + is_consistent + " " + error_msg);

	return is_consistent;
}

SyncFsm.prototype.isConsistentZfcAutoIncrement = function(zfc)
{
	return zfc.isPresent(ZinFeedItem.KEY_AUTO_INCREMENT) &&
	       zfc.get(ZinFeedItem.KEY_AUTO_INCREMENT).isPresent('next') &&
		   parseInt(zfc.get(ZinFeedItem.KEY_AUTO_INCREMENT).get('next')) > AUTO_INCREMENT_STARTS_AT;
}

SyncFsm.prototype.initialiseZfcLastSync = function()
{
	var zfcLastSync = this.state.zfcLastSync;

	for (var sourceid in this.state.sources)
		if (this.state.sources[sourceid]['format'] == FORMAT_ZM && !zfcLastSync.isPresent(sourceid))
			zfcLastSync.set(new ZinFeedItem(null, ZinFeedItem.ATTR_KEY, sourceid));
}

SyncFsm.prototype.initialiseZfcAutoIncrement = function(zfc)
{
	zinAssert(zfc.length() == 0);

	zfc.set( new ZinFeedItem(null, ZinFeedItem.ATTR_KEY, ZinFeedItem.KEY_AUTO_INCREMENT, 'next', AUTO_INCREMENT_STARTS_AT + 1));
}

// remove any luid attributes in the addressbook
//
SyncFsm.prototype.initialiseTbAddressbook = function()
{
 	var functor_foreach_card = {
		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);

			var luid =  mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

			if (luid && (luid > 0 || luid.length > 0)) // the TBCARD_ATTRIBUTE_LUID for GAL cards is an ldap dn hence the test for length>0
			{
				mdbCard.setStringAttribute(TBCARD_ATTRIBUTE_LUID, 0); // delete would be more natural but not supported by api
				mdbCard.editCardToDatabase(uri);
			}

			return true;
		}
	};

	var functor_foreach_addressbook = {
		functor: null,
		state: this.state,

		run: function(elem)
		{
			this.state.m_addressbook.forEachCard(elem.directoryProperties.URI, this.functor);

			return true;
		}
	};

	functor_foreach_addressbook.functor = functor_foreach_card;
	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);
}

// build a two dimensional associative array for reverse lookups - meaning given a sourceid and luid, find the gid.
// For example: reverse.1.4 == 7 means that sourceid == 1, luid == 4, gid == 7
// forward lookups are done via zfcGid: zfcGid.get(7).get(1) == 4
//
SyncFsm.prototype.getGidInReverse = function()
{
	var reverse = new Object();
	var sourceid;

	for (sourceid in this.state.sources)
		reverse[sourceid] = new Object();

	var functor_each_gid_mapitem = {
		state: this.state,

		run: function(sourceid, luid)
		{
			reverse[sourceid][luid] = this.gid;

			return true;
		}
	};

	var functor_foreach_gid = {
		run: function(zfi)
		{
			var gid = zfi.key();

			functor_each_gid_mapitem.gid = gid;
			zfi.forEach(functor_each_gid_mapitem, ZinFeedItem.ITER_GID_ITEM);

			return true;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_NON_RESERVED);

	this.state.m_logger.debug("getGidInReverse returns: " + aToString(reverse));

	return reverse;
}

SyncFsm.prototype.entryActionGetAccountInfo = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionGetAccountInfo");
	var by, value;

	if (this.state.zidbag.isPrimaryUser())
	{
		by    = "name";
		value = this.state.sources[this.state.sourceid_zm]['username'];
	}
	else
	{
		by    = "id";
		value = this.state.zidbag.zimbraId();
	}

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(), this.state.zidbag.zimbraId(), "GetAccountInfo", by, value);

	continuation('evSoapRequest');
}

// if the url that the user entered in the server settings is returned by the server, use that
// otherwise, prefer a url of type preferSchemeForSoapUrl (http or https)
// otherwise, use the first one
//
SyncFsm.prototype.exitActionGetAccountInfo = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	var obj = new Object();
	var xpath_query;

	xpath_query = "/soap:Envelope/soap:Body/za:GetAccountInfoResponse/za:attr[@name='zimbraId']";
	ZinXpath.setConditionalFromSingleElement(this.state, 'zimbraId', xpath_query, this.state.m_soap_state.m_response, null);

	if (this.state.zimbraId)
		this.state.m_logger.debug("exitActionGetAccountInfo: zimbraId: " + this.state.zimbraId);
	else
		this.state.m_logger.error("exitActionGetAccountInfo: cannot continue without zimbraId in response");

	var xpath_query = "/soap:Envelope/soap:Body/za:GetAccountInfoResponse/za:soapURL";
	var functor     = new FunctorArrayOfTextNodeValue();
	var scheme_url  = null;
	var newSoapURL;

	ZinXpath.runFunctor(functor, xpath_query, this.state.m_soap_state.m_response);

	// if multiple urls are returned, we look for one that matches the preference preferSchemeForSoapUrl
	// otherwise, we don't have any basis for selecting one and choose the first
	//
	if (functor.a.length > 1)
	{
		var scheme = this.state.m_preferences.getCharPref(this.state.m_preferences.branch(), "system.preferSchemeForSoapUrl");
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
		this.state.suggestedSoapURL = newSoapURL;

	this.state.m_logger.debug("exitActionGetAccountInfo: suggestedSoapURL: " + this.state.suggestedSoapURL);
}

// In a non-trivial number of Zimbra installations, the soapURL returned via GetAccountInfo doesn't work -
// mostly because it uses a domain name that's not in the public dns.  This is often seen in SOHO installations.
// OTOH, enterprises/Universities really want clients to respect GetAccountInfo's soapURL because their accounts are partitioned
// across multiple servers.  HTTP HEAD would be the most lightweight way of testing the soapURL returned in GetAccountInfoResponse.
// But as at Zimbra 5.0.1_GA_1902, the server doesn't support HTTP HEAD, so a SOAP document is sent that should be unknown to the server.

SyncFsm.prototype.entryActionSelectSoapUrl = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark("entryActionSelectSoapUrl");

	if (this.state.suggestedSoapURL)
	{
		this.setupHttpSoap(state, 'evNext', this.state.suggestedSoapURL, null, 'FakeHead');
		nextEvent = 'evSoapRequest';
	}
	else if (this.state.zidbag.isPrimaryUser())
		nextEvent = 'evNext';
	else
		nextEvent = 'evSkip';

	continuation(nextEvent);
}

SyncFsm.prototype.exitActionSelectSoapUrl = function(state, event)
{
	if (!this.state.suggestedSoapURL || event == "evCancel")
		return;

	var msg = "exitActionSelectSoapUrl: ";

	if (this.state.m_soap_state.m_faultcode == "service.UNKNOWN_DOCUMENT")
	{
		this.state.zidbag.set(this.state.zidbag.zimbraId(), 'soapURL', this.state.suggestedSoapURL);

		msg += " suggestedSoapURL works, switching to it: " + this.state.zidbag.soapUrl();
	}
	else
		msg += " suggestedSoapURL doesn't work, continuing with the one used for Auth: " + this.state.zidbag.soapUrl();

	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.entryActionGetInfo = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionGetInfo");

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(), null, "GetInfo");

	continuation('evSoapRequest');
}

SyncFsm.prototype.exitActionGetInfo = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	if (0)
	{
		var xpath_query = "/soap:Envelope/soap:Body/za:GetInfoResponse/za:attrs/za:attr[@name='zimbraPrefLocale']";
		ZinXpath.setConditionalFromSingleElement(this.state, 'zimbraPrefLocale', xpath_query, this.state.m_soap_state.m_response, warn_msg);

		if (this.state.zimbraPrefLocale)
			this.state.m_logger.debug("exitActionGetInfo: zimbraPrefLocale: " + this.state.zimbraPrefLocale);
		else
			this.state.m_logger.debug("exitActionGetInfo: zimbraPrefLocale: not present");
	}
}

SyncFsm.prototype.entryActionCheckLicense = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionCheckLicense");

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(), null, "CheckLicense");

	continuation('evSoapRequest');
}

SyncFsm.prototype.exitActionCheckLicense = function(state, event)
{
	if (event == "evCancel")
		return;

	if (this.state.m_soap_state.m_fault_element_xml && this.state.m_soap_state.m_faultcode == "service.UNKNOWN_DOCUMENT")
		this.state.mapiStatus = "CheckLicense not supported by server - probably open source edition";
	else if (this.state.m_soap_state.m_response)
	{
		var xpath_query = "/soap:Envelope/soap:Body/za:CheckLicenseResponse/attribute::status";
		var warn_msg    = "warning - expected to find 'status' attribute in <CheckLicenseResponse>";

		ZinXpath.setConditional(this.state, 'mapiStatus', xpath_query, this.state.m_soap_state.m_response, warn_msg);
	}
}

SyncFsm.prototype.entryActionSync = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionSync");

	var msg = "";

	if (this.state.isRedoSyncRequest)
	{
		this.state.SyncTokenInRequest = null;
		msg += "isRedoSyncRequest:";
	}
	else if (this.state.zidbag.isPrimaryUser())
	{
		this.state.SyncTokenInRequest = this.state.zfcLastSync.get(this.state.sourceid_zm).getOrNull(Zuio.key('SyncToken', null));
		msg += "isPrimaryUser:";
	}
	else
	{
		this.state.SyncTokenInRequest = this.state.zidbag.get(this.state.zidbag.zimbraId(), 'SyncToken');
		msg += "zimbraId:";
	}

	this.state.m_logger.debug("entryActionSync: " + msg + " zimbraId: " + this.state.zidbag.zimbraId() +
	                                                      " SyncTokenInRequest: " + this.state.SyncTokenInRequest);
	this.state.m_logger.debug("entryActionSync: blah: zidbag: " + this.state.zidbag.toString());

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(), this.state.zidbag.zimbraId(), "Sync", this.state.SyncTokenInRequest);

	continuation('evSoapRequest');
}

SyncFsm.prototype.entryActionSyncResult = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark("entryActionSyncResult");

	if (!this.state.m_soap_state.m_response)
		nextEvent = 'evCancel';
	else
	{
		var response = this.state.m_soap_state.m_response;
		var zfcZm    = this.zfcZm();
		var key, id, functor, xpath_query, msg;
		var sourceid_zm = this.state.sourceid_zm;
		var change = newObject('acct', null);

		ZinXpath.setConditional(change,       'token',    "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);
		ZinXpath.setConditional(change,       'acct',     "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

		// Hm ... what if the sync token went backwards (eg if the server had to restore from backups) ??

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
				var l    = attribute[ZinFeedItem.ATTR_L];
				var name = attribute[ZinFeedItem.ATTR_NAME];
				var type = nodeName == 'folder' ? ZinFeedItem.TYPE_FL : ZinFeedItem.TYPE_LN;

				key  = Zuio.key(attribute['id'], change.acct);

				msg = "entryActionSyncResult: found a " + nodeName + ": key=" + key +" l=" + l + " name=" + name + " ";

				if (nodeName == 'link')
					msg += " rid: " + attribute[ZinFeedItem.ATTR_RID] + " zid: " + attribute[ZinFeedItem.ATTR_ZID];
				msg += ": ";

				attribute[ZinFeedItem.ATTR_KEY] = key;

				if (change.acct && type == ZinFeedItem.TYPE_LN)
					; // ignore <link> elements that don't belong to the primary user because only an owner can share a folder
				else if (zfcZm.isPresent(key))
				{
					zfcZm.get(key).set(attribute);  // update existing item

					this.state.isAnyChangeToFolders = true;  // relevant to link too

					msg += "updated in map";

					is_processed = true;
				}
				else if (l == '1')
				{
					if (nodeName == 'folder' && this.state.SyncTokenInRequest)
					{
						// Do another SyncRequest to get the child contacts of this folder
						this.state.isRedoSyncRequest = true;
						msg += "new: need to do another <SyncRequest>";
					}

					zfcZm.set(new ZinFeedItem(type, attribute));
					msg += "adding to map";

					is_processed = true;
				}

				if (!is_processed)
					msg += "ignoring: not of interest";

				this.state.m_logger.debug(msg);
			}
		};

		ZinXpath.runFunctor(functor, xpath_query, response);

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
				var id  = attribute[ZinFeedItem.ATTR_ID];
				var l   = attribute[ZinFeedItem.ATTR_L];

				key = Zuio.key(id, change.acct);

				msg = "entryActionSyncResult: found a <cn key='" + key +"' l='" + l + "'>";
				
				// if the rev attribute is different from that in the map, it means a content change is pending so add the id to the queue,
				// otherwise just add it to the map
				//

				if (!isPropertyPresent(attribute, 'id') || !isPropertyPresent(attribute, ZinFeedItem.ATTR_L))
					this.state.m_logger.error("<cn> element received from server without an 'id' or 'l' attribute.  Unexpected.  Ignoring: " + aToString(attribute));
				else
				{
					var fAddToTheQueue = false;

					if (!zfcZm.isPresent(key))
					{
						if (SyncFsm.isOfInterest(zfcZm, l))
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
						if (isPropertyPresent(attribute, ZinFeedItem.ATTR_REV))
							rev_attr = attribute[ZinFeedItem.ATTR_REV];
						else if (isPropertyPresent(change, 'token'))
							rev_attr = change['token'];

						var isRevChange = !rev_attr ||
						                  !zfcZm.get(key).isPresent(ZinFeedItem.ATTR_REV)  ||
						                   rev_attr != zfcZm.get(key).get(ZinFeedItem.ATTR_REV);

						attribute[ZinFeedItem.ATTR_KEY] = key;

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

		ZinXpath.runFunctor(functor, xpath_query, response);

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

				// this.state.m_logger.debug("blah: parent_folder_key: " + parent_folder_key);

				if (SyncFsm.isOfInterest(zfcZm, parent_folder_key))
					for each (var id in attribute['ids'].split(','))
						this.ids[id] = true;
				else
					this.state.m_logger.debug("ignored <cn ids='" + attribute['ids'] +
					                             "'> - because parent folder id='" + parent_folder_attribute['id'] + "' isn't of interest");
			}
		};

		ZinXpath.runFunctor(functor_folder_ids, xpath_query, response);

		for (id in functor_folder_ids.ids)
			this.state.aContact.push(new Zuio(id, change.acct));

		// <deleted ids="561,542"/>
		//   ==> set the ZinFeedItem.ATTR_DEL flag in the map
		// Some of the deleted ids might not relate to contacts at all
		// So we may never have seen them and no map entry exists.
		// The ZinFeedItem.ATTR_DEL flag is set only on items already in the map.
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

		ZinXpath.runFunctor(functor_deleted_ids, xpath_query, response);

		for (id in functor_deleted_ids.ids)
		{
			key = Zuio.key(id, change.acct);

			if (zfcZm.isPresent(key))
			{
				zfcZm.get(key).set(ZinFeedItem.ATTR_DEL, 1);
				this.state.m_logger.debug("marked a key as deleted: " + key + " zfi: " + zfcZm.get(key).toString());
			}
		}

		// At the end of all this:
		// - our map points to subset of items on the server - basically all top-level folders with @view='contact' and their contacts
		// - this.state.aContact is populated with the ids of:
		//   - contacts that are in the parent folders of interest, and
		//   - contacts whose content has changed (indicated by the rev attribute being bumped)
		//
		msg = "entryActionSyncResult: aContact:";
		for (var i = 0; i < this.state.aContact.length; i++)
			msg += " " + i + ": " + this.state.aContact[i].toString();
		this.state.m_logger.debug(msg);

		if (this.state.isRedoSyncRequest)
		{
			nextEvent = 'evRedo';
			this.state.m_logger.debug("entryActionSyncResult: forcing a second <SyncRequest>");
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
						if (zfi.type() == ZinFeedItem.TYPE_LN)
						{
							zinAssert(zfi.isPresent(ZinFeedItem.ATTR_ZID));

							var zid = zfi.get(ZinFeedItem.ATTR_ZID);

							if (!this.state.zidbag.isPresent(zid))
							{
								this.state.zidbag.push(zid);
								this.state.zidbag.set(zid, 'soapURL', this.m_soapurl);
							}

							if (!zfi.isPresent(ZinFeedItem.ATTR_SKEY))
								this.aNewLink[zid] = null;
						}

						return true;
					}
				};

				zfcZm.forEach(functor, ZinFeedCollection.ITER_NON_RESERVED);

				msg = "SyncTokens:";

				for (var zid in this.state.zidbag.m_properties)
					if (isPropertyPresent(functor.aNewLink, zid))
					{
						this.state.zidbag.set(zid, 'SyncToken', null);
						msg += "\n " + zid + ": null (because a new link element was found)";
					}
					else
					{
						key = Zuio.key('SyncToken', zid);
						this.state.zidbag.set(zid, 'SyncToken', this.state.zfcLastSync.get(sourceid_zm).getOrNull(key));
						msg += "\n " + zid + ": " + this.state.zidbag.get(zid, 'SyncToken');
					}

				this.state.m_logger.debug(msg);
			}
		}

		var SyncResponse = new Object();

		ZinXpath.setConditional(SyncResponse, 'SyncMd',   "/soap:Envelope/soap:Body/zm:SyncResponse/attribute::md",         response, null);
		ZinXpath.setConditional(SyncResponse, 'SyncToken',"/soap:Envelope/soap:Body/zm:SyncResponse/attribute::token",      response, null);

		if (isPropertyPresent(SyncResponse, 'SyncMd'))
			this.state.SyncMd = SyncResponse.SyncMd;

		if (isPropertyPresent(SyncResponse, 'SyncToken'))
			this.state.zidbag.set(change.acct, 'SyncToken', SyncResponse.SyncToken);

		if (this.state.SyncMd == null)
		{
			this.state.m_logger.debug("Can't proceed with sync because (for some reason) <SyncResponse> didn't have an 'md' attribute");

			nextEvent = 'evCancel';
		}
		else if ((this.state.zidbag.a_zid.length - 1) > this.state.zidbag.m_index)
		{
			nextEvent = 'evDo';
			this.state.zidbag.m_index++;
		}
		else
			nextEvent = 'evNext';

		this.state.m_logger.debug("entryActionSyncResult: zidbag: " + this.state.zidbag.toString());
	}

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGetContact = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark("entryActionGetContact");

	if (this.state.aContact.length == 0)
	{
		this.state.m_soap_state.m_response = null;

		nextEvent = 'evNext';
	}
	else
	{
		var zuio = this.state.aContact[0];

		this.state.m_logger.debug("entryActionGetContact: calling GetContactsRequest " + zuio.toString() );

		this.setupHttpSoap(state, 'evRepeat', this.state.zidbag.soapUrl(zuio.zid), zuio.zid, "GetContacts", zuio.id);

		nextEvent = 'evSoapRequest';
	}

	continuation(nextEvent);
}

SyncFsm.prototype.exitActionGetContact = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	var xpath_query = "/soap:Envelope/soap:Body/zm:GetContactsResponse/zm:cn";
	var functor     = new FunctorArrayOfContactsFromNodes(ZimbraSoapDocument.nsResolver("zm")); // see <cn> above
	var response    = this.state.m_soap_state.m_response;

	ZinXpath.runFunctor(functor, xpath_query, response);

	var change = newObject('acct', null);
	ZinXpath.setConditional(change, 'acct', "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

	if (functor.a.length != 1)
		this.state.m_logger.warn("GetContactsResponse recieved without exactly one <cn> element - unable to process");
	else
	{
		var key = Zuio.key(functor.a[0].attribute['id'], change.acct);

		if (this.state.aContact[0].key() == key)
		{
			if (functor.a[0].isMailList())
				this.state.m_logger.debug("exitActionGetContact: ignore mailing lists for the moment");
			else
			{
				this.state.aSyncContact[key] = functor.a[0];

				functor.a[0].attribute[ZinFeedItem.ATTR_KEY] = key;

				if (this.zfcZm().isPresent(key))
					this.zfcZm().get(key).set(functor.a[0].attribute);                               // update existing item
				else
					this.zfcZm().set(new ZinFeedItem(ZinFeedItem.TYPE_CN, functor.a[0].attribute));  // add new item

				// this.state.m_logger.debug("exitActionGetContact: blah: added aSyncContact[" + key +"]: " + this.state.aSyncContact[key]);
			}

			this.state.aContact.shift();
		}
		else
			this.state.m_logger.warn("GetContactsResponse recieved a contact that wasn't one we requested!  Ignored.");
	}
}

SyncFsm.prototype.entryActionGalConsider = function(state, event, continuation)
{
	var nextEvent = null;
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_zm = this.state.sourceid_zm;
	var if_fewer_recheck;

	this.state.stopwatch.mark("entryActionGalConsider");

	this.state.SyncGalEnabled = this.state.m_preferences.getCharPrefOrNull(prefs.branch(), "general.SyncGalEnabled");

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
		var SyncGalMdInterval = this.state.m_preferences.getIntPref(this.state.m_preferences.branch(), "system.SyncGalMdInterval");
		var SyncMd = parseInt(zfcLastSync.get(sourceid_zm).getOrNull('SyncMd'));
		var isSyncGalEnabledChanged = this.state.SyncGalEnabled != zfcLastSync.get(sourceid_zm).getOrNull('SyncGalEnabled')

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
			this.state.SyncGalTokenInRequest = zfcLastSync.get(sourceid_zm).getOrNull('SyncGalToken');

			this.state.m_logger.debug("entryActionGalSync: Gal hasn't expired - this.state.SyncGalTokenInRequest == " +
			                          this.state.SyncGalTokenInRequest);
		}

		if (this.state.SyncGalEnabled == "if-fewer")
			nextEvent = (zfcLastSync.get(sourceid_zm).isPresent('SyncGalEnabledRecheck') &&
			             parseInt(zfcLastSync.get(sourceid_zm).get('SyncGalEnabledRecheck')) > 0) ? 'evSkip' : 'evNext';
		else
			nextEvent = 'evNext';
	}

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionGalSync = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionGalSync");

	this.setupHttpSoap(state, 'evNext', this.state.zidbag.soapUrl(0), null, "SyncGal", this.state.SyncGalTokenInRequest);

	continuation('evSoapRequest');
}

SyncFsm.prototype.exitActionGalSync = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	var xpath_query = "/soap:Envelope/soap:Body/za:SyncGalResponse/attribute::token";
	var warn_msg    = "SyncGalResponse received without a token attribute - don't know how to handle so ignoring it...";

	ZinXpath.setConditional(this.state, 'SyncGalTokenInResponse', xpath_query, this.state.m_soap_state.m_response, warn_msg);

	// zimbra server versions 4.0.x and 4.5 does some caching thing whereby it returns <cn> elements
	// in the SyncGalResponse even though the token is unchanged vs the previous response.
	//
	// Here, aSyncGalContact gets populated with the <cn> child elements of <SyncGalResponse> only when
	// the token attribute is present and different from the previous response.
	//
	if (this.state.SyncGalTokenInResponse != null && this.state.SyncGalTokenInRequest != this.state.SyncGalTokenInResponse)
	{
		var functor = new FunctorArrayOfContactsFromNodes(ZimbraSoapDocument.nsResolver("za")); // see SyncGalResponse below

		ZinXpath.runFunctor(functor, "/soap:Envelope/soap:Body/za:SyncGalResponse/za:cn", this.state.m_soap_state.m_response);

		this.state.aSyncGalContact     = functor.a;
		this.state.mapIdSyncGalContact = functor.mapId;

		if (0)
		{
			this.state.m_logger.debug("exitActionGalSync: SyncGalTokenInRequest: "  + this.state.SyncGalTokenInRequest +
		                          	                    " SyncGalTokenInResponse: " + this.state.SyncGalTokenInResponse );

			for (var i in this.state.aSyncGalContact)
				this.state.m_logger.debug("11443378: aSyncGalContact[" + i + "] == \n" + this.state.aSyncGalContact[i].toString());

			for (var id in this.state.mapIdSyncGalContact)
				this.state.m_logger.debug("11443378: mapIdSyncGalContact." + id + " == " + this.state.mapIdSyncGalContact[id]);
		}
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
	var uri    = this.state.m_addressbook.getAddressBookUri(abName);
	var zc, attributes, properties, isGalEnabled;
	var zfcLastSync = this.state.zfcLastSync;
	var sourceid_zm = this.state.sourceid_zm;

	this.state.stopwatch.mark("entryActionGalCommit");

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
			// reconsider...
			//
			var if_fewer = this.state.m_preferences.getIntPref(this.state.m_preferences.branch(), "system.SyncGalEnabledIfFewer");

			this.state.m_logger.debug("entryActionGalCommit: if_fewer: " + if_fewer + " this.state.aSyncGalContact.length: " +
			                          (this.state.aSyncGalContact != null ? this.state.aSyncGalContact.length : "null"));

			isGalEnabled = (this.state.aSyncGalContact == null || this.state.aSyncGalContact.length < if_fewer);
		}
		else
			isGalEnabled = !zfcLastSync.get(sourceid_zm).isPresent('SyncGalEnabledRecheck'); // stay as we are

		this.state.m_logger.debug("entryActionGalCommit: this.state.SyncGalEnabled: " + this.state.SyncGalEnabled);
	}
		
	this.state.m_logger.debug("entryActionGalCommit: isGalEnabled: " + isGalEnabled +
	                          " this.state.SyncGalEnabled: " + this.state.SyncGalEnabled);

	if (isGalEnabled && uri == null)
		uri = this.state.m_addressbook.newAddressBook(abName);

	if (!isGalEnabled)
	{
		if (uri)
			this.state.m_addressbook.deleteAddressBook(uri);

		if (zfcLastSync.get(sourceid_zm).isPresent('SyncGalToken'))
			zfcLastSync.get(sourceid_zm).del('SyncGalToken');
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

		var element;

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

			ZinContactConverter.instance().removeKeysNotCommonToBothFormats(FORMAT_ZM, this.state.aSyncGalContact[i].element);

			var properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncGalContact[i].element);

			this.state.aSyncGalContact[i].checksum = ZinContactConverter.instance().crc32(properties);
		}

		// Here, the logic is:
		// 1. if SyncGalTokenInRequest was null, then we 
		//    - flush cards out of the GAL address book that don't match cards in the contacts received from zimbra and
		//      if there's a match, mark the corresponding zimbra contact so that it doesn't get added again below
		//      ... by "match", we mean the id and the checksum are the same
		//    else (SyncGalTokenInRequest != null)
		//    - any cards in Tb with the same id as cards in the SyncGalResponse are overwritten
		// 2. any new cards in the response that aren't in Tb are added

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
			// to me once too.  I could never reproduce it.  This approach avoids using deleteCards() entirely.
			// deleteCards() also gets called by UpdateTb but it never seems to hang when called from there, perhaps
			// because the array only ever contains a single element when called from there - but this is only speculation.
			// I notice that the interface to deleteCards() has changed in Tbv3 - perhaps some bugs have been cleaned up
			// or perhaps it was a mork garbage-collection issue - it's impossible to tell.
			// leni - Wed Feb 27 11:30:36 AUSEDT 2008

			this.state.m_addressbook.deleteAddressBook(uri);

			uri = this.state.m_addressbook.newAddressBook(abName);

			for (var i in this.state.aSyncGalContact)
				aAdd.push(i);
		}
		else
		{
			this.state.m_logger.debug("entryActionGalCommit: SyncGalTokenInRequest != null - " +
			                          "looking for Tb cards to overwrite where the Tb card id matches a contact in the SyncGalResponse...");

			var functor = {
				state: this.state,

				run: function(uri, item)
				{
					var abCard   = item.QueryInterface(Components.interfaces.nsIAbCard);
					var mdbCard  = item.QueryInterface(Components.interfaces.nsIAbMDBCard);
					var id       = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);
					var index    = this.state.mapIdSyncGalContact[id];

					if (id != null && typeof index != 'undefined')
					{
						zc = this.state.aSyncGalContact[index];

						attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id, TBCARD_ATTRIBUTE_CHECKSUM, zc.checksum);
						properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

						this.state.m_addressbook.updateCard(abCard, uri, FORMAT_TB, properties, attributes);

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

			attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id, TBCARD_ATTRIBUTE_CHECKSUM, zc.checksum);
			properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

			this.state.m_logger.debug("entryActionGalCommit: adding aSyncGalContact[" + aAdd[i] + "]: " +
			                            this.shortLabelForContactProperties(FORMAT_TB, properties));

			this.state.m_addressbook.addCard(uri, FORMAT_TB, properties, attributes);
		}
	}

	if (this.state.SyncGalTokenInResponse) // remember that this state is run even though SyncGalRequest wasn't called...
	{
		zfcLastSync.get(sourceid_zm).set('SyncGalToken', this.state.SyncGalTokenInResponse);
		zfcLastSync.get(sourceid_zm).set('SyncMd',         this.state.SyncMd);
	}

	zfcLastSync.get(sourceid_zm).set('SyncGalEnabled', this.state.SyncGalEnabled);

	if (this.state.SyncGalEnabled == "if-fewer" && this.state.SyncGalTokenInRequest == null && !isGalEnabled)
	{
		if (!zfcLastSync.get(sourceid_zm).isPresent('SyncGalEnabledRecheck'))
		{
			zfcLastSync.get(sourceid_zm).set('SyncGalEnabledRecheck',
			                 this.state.m_preferences.getIntPref(this.state.m_preferences.branch(), "system.SyncGalEnabledRecheck"));
		}
		else
		{
			if (zfcLastSync.get(sourceid_zm).get('SyncGalEnabledRecheck') <= 1)
				zfcLastSync.get(sourceid_zm).del('SyncGalEnabledRecheck');
			else
				zfcLastSync.get(sourceid_zm).decrement('SyncGalEnabledRecheck');
		}
	}

	if ((isGalEnabled || this.state.SyncGalEnabled != "if-fewer") && zfcLastSync.get(sourceid_zm).isPresent('SyncGalEnabledRecheck'))
		zfcLastSync.get(sourceid_zm).del('SyncGalEnabledRecheck');
		
	continuation('evNext');
}

SyncFsm.prototype.entryActionLoadTb = function(state, event, continuation)
{
	// A big decision in simplifying this code was the decision to give up convergence
	// Now, if there's a problem we just abort the sync and the user has to fix it.
	//

	this.state.stopwatch.mark("entryActionLoadTb: 1");

	this.state.zfcTbPreMerge = this.zfcTb().clone();           // 1. remember the tb luid's before merge so that we can follow changes

	this.loadTbLocaliseEmailedContacts();                      // 2. ensure that emailed contacts is in the current locale

	if (this.state.isSlowSync)
		this.loadTbDeleteReadOnlySharedAddresbooks();          // 3. ensure that we don't try to update read-only addressbooks on the server

	var aUri = this.loadTbMergeZfcWithAddressBook();           // 4. merge the current tb luid map with the current addressbook(s)

	this.state.stopwatch.mark("entryActionLoadTb: 2");

	this.loadTbExcludeMailingListsAndDeletionDetection(aUri);  // 5. exclude mailing lists and their cards

	this.state.stopwatch.mark("entryActionLoadTb: 3");

	var passed = this.testForLegitimateFolderNames();          // 6. test for duplicate folder names, reserved names, illegal chars

	this.state.stopwatch.mark("entryActionLoadTb: 4: passed: " + passed);

	passed = passed && this.testForFolderPresentInZfcTb(TB_PAB);

	this.state.stopwatch.mark("entryActionLoadTb: 5: passed: " + passed);

	if (!this.state.isSlowSync)
	{
		passed = passed && this.testForReservedFolderInvariant(TB_PAB);

		this.state.stopwatch.mark("entryActionLoadTb: 6: passed: " + passed);
	}

	var nextEvent = 'evNext';

	if (!passed)
		nextEvent = 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.zfiFromName = function(name)
{
	// the convertFor routines take a zfi (because they need to cater for foreign folders
	// this routine creates zfi for a name as if it were the name of a folder in the primary account

	return new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_KEY, 123 , ZinFeedItem.ATTR_NAME, name)
}

SyncFsm.prototype.testForFolderPresentInZfcTb = function(name)
{
	var key = SyncFsm.zfcFindFirstFolder(this.zfcTb(), name);

	if (!key || this.zfcTb().get(key).isPresent(ZinFeedItem.ATTR_DEL))
	{
		this.state.stopFailCode   = 'FailOnFolderMustBePresent';
		this.state.stopFailDetail = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(name));
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

	zinAssert(!this.state.stopFailCode && !this.state.isSlowSync);

	var pre_id  = SyncFsm.zfcFindFirstFolder(zfcTbPre, name);
	var post_id = SyncFsm.zfcFindFirstFolder(zfcTbPost, name);
	var pre_prefid  = pre_id  ? zfcTbPre.get(pre_id).get(ZinFeedItem.ATTR_TPI) : null;
	var post_prefid = post_id ? zfcTbPost.get(post_id).get(ZinFeedItem.ATTR_TPI) : null;

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + name +
		" pre_id: " + pre_id + " post_id: " + post_id + 
		" pre_prefid: " + pre_prefid + " post_prefid: " + post_prefid);

	if (!post_id || pre_prefid != post_prefid)    // no folder by this name or it changed since last sync
	{
		this.state.stopFailCode   = 'FailOnFolderReservedChanged';
		this.state.stopFailDetail = name;
	}

	ret = (this.state.stopFailCode == null);

	this.state.m_logger.debug("testForReservedFolderInvariant: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstFolder = function(zfc, name)
{
	var f = function(zfi) {
		return zfi.type() == ZinFeedItem.TYPE_FL && zfi.getOrNull(ZinFeedItem.ATTR_NAME) == name;
	};

	var ret = zfc.findFirst(f, name);

	gLogger.debug("zfcFindFirstFolder: blah: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstSharedFolder = function(zfc, key)
{
	var f = function(zfi, key) {
		return (zfi.type() == ZinFeedItem.TYPE_SF) && (zfi.getOrNull(ZinFeedItem.ATTR_FKEY) == key);
	};

	var ret = zfc.findFirst(f, key);

	gLogger.debug("zfcFindFirstSharedFolder: blah: key: " + key + " returns: " + ret);

	return ret;
}

SyncFsm.zfcFindFirstLink = function(zfc, key)
{
	var zuio = new Zuio(key);

	var f = function(zfi) {
		return zfi.type() == ZinFeedItem.TYPE_LN && zfi.getOrNull(ZinFeedItem.ATTR_RID) == zuio.id &&
		                                            zfi.getOrNull(ZinFeedItem.ATTR_ZID) == zuio.zid;
	};

	var ret = zfc.findFirst(f);

	gLogger.debug("lookupInZfc: blah: zfcFindFirstLink: key: " + key + " returns: " + ret);

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

	// gLogger.debug("isZmFolderReservedName: blah: name: " + name + " returns: " + ret);

	return ret;
}

SyncFsm.isZmFolderContainsInvalidCharacter = function(name)
{
	var reInvalidCharacter = /[:/\"\t\r\n]/;
	var ret = name.match(reInvalidCharacter) != null;

	// gLogger.debug("isZmFolderContainsInvalidCharacter: blah: name: " + name + " returns: " + ret);

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

	return ret;
}

SyncFsm.prototype.loadTbLocaliseEmailedContacts = function()
{
	var msg = "LocaliseEmailedContacts: isSlowSync: " + this.state.isSlowSync;

	if (this.state.isSlowSync)
	{
		var uri, old_translation, old_localised_ab;
		var translation = this.state.m_folder_converter.translate_emailed_contacts();

		this.state.m_folder_converter.localised_emailed_contacts(translation);

		this.state.zfcLastSync.get(this.state.sourceid_zm).set('EmailedContacts', translation);

		var ab_localised = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS));

		// if there's a "zindus/Emailed Contacts" addressbook, rename it to the localised equivalent
		//
		uri = this.state.m_addressbook.getAddressBookUri(ab_localised);

		msg += " translate_emailed_contacts: " + translation + " ab_localised: " + ab_localised + " uri: " + uri;

		if (!uri)
		{
			for (old_translation in this.state.m_folder_converter.m_locale_names_to_migrate)
			{
				old_localised_ab = this.state.m_folder_converter.m_prefix_primary_account + old_translation;

				uri = this.state.m_addressbook.getAddressBookUri(old_localised_ab);

				if (uri)
				{
					msg += " renaming " + old_localised_ab + " to " + ab_localised + " uri: " + uri;

					this.state.m_addressbook.renameAddressBook(uri, ab_localised);
					break;
				}
			}
		}
	}
	else
		this.state.m_folder_converter.localised_emailed_contacts(this.state.zfcLastSync.get(this.state.sourceid_zm).get('EmailedContacts'));
				
	this.state.m_logger.debug(msg);
}

SyncFsm.prototype.loadTbDeleteReadOnlySharedAddresbooks = function()
{
	zinAssert(this.state.isSlowSync);

	var aUrisToDelete = new Object();

	var functor_foreach_addressbook =
	{
		state: this.state,
		run: function(elem)
		{
			if (elem.dirName.substring(0, this.state.m_folder_converter.m_prefix_length) ==
			        this.state.m_folder_converter.m_prefix_foreign_readonly)
				aUrisToDelete[elem.directoryProperties.URI] = elem.dirName;
		
			return true;
		}
	}

	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);

	this.state.m_logger.debug("loadTbDeleteReadOnlySharedAddresbooks: about to delete: " + aToString(aUrisToDelete));

	for (var uri in aUrisToDelete)
		this.state.m_addressbook.deleteAddressBook(uri);
}

SyncFsm.prototype.loadTbMergeZfcWithAddressBook = function()
{
	var functor_foreach_card, functor_foreach_addressbook;
	var uri;
	var sourceid = this.state.sourceid_tb;
	var zfcTb = this.state.sources[sourceid]['zfcLuid'];

	var stopwatch = new ZinStopWatch("loadTbMergeZfcWithAddressBook");

	stopwatch.mark("1");

	var mapTbFolderTpiToId = SyncFsm.getTopLevelFolderHash(zfcTb, ZinFeedItem.ATTR_TPI, ZinFeedItem.ATTR_KEY,
	                                                             ZinFeedCollection.ITER_NON_RESERVED);

	stopwatch.mark("2");

	this.state.m_logger.debug("loadTbMergeZfcWithAddressBook: mapTbFolderTpiToId == " + aToString(mapTbFolderTpiToId));

	// identify the zimbra addressbooks
	// PAB is identified by isElemPab() and then regardless of its localised name, the zfc's ATTR_NAME attribute is set to TB_PAB
	//
	functor_foreach_addressbook =
	{
		context: this,
		converter: this.state.m_folder_converter,

		run: function(elem)
		{
			stopwatch.mark("3");

			var msg = "addressbook:" +
			          " dirName: " + elem.dirName +
			          " dirPrefId: " + elem.dirPrefId +
				      " URI: "      + elem.directoryProperties.URI +
			          " isElemPab(elem): " + (this.context.state.m_addressbook.isElemPab(elem) ? "yes" : "no") +
			          " lastModifiedDate: " + elem.lastModifiedDate +
			          " description: " + elem.description +
			          " supportsMailingLists: " + elem.supportsMailingLists;

			// look for zindus/<folder-name> but don't permit '/'es in <folder-name> because:
			// - we only support addressbook folders that are immediate children of the root folder - note the l='1' below.

			// this.context.state.m_logger.debug("TbAddressBook: blah: dirName: " + elem.dirName);

			if ((this.converter.prefixClass(elem.dirName) != ZinFolderConverter.PREFIX_CLASS_NONE &&
			        elem.dirName.indexOf("/", this.converter.m_prefix_length) == -1) ||
			     this.context.state.m_addressbook.isElemPab(elem) )
			{
				var key;

				var name = this.context.getAbNameNormalised(elem);

				msg = "addressbook of interest to zindus: " + msg;

				if (!isPropertyPresent(mapTbFolderTpiToId, elem.dirPrefId))
				{
					key = zfcTb.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next');

					zfcTb.set(new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_KEY, key , ZinFeedItem.ATTR_L, 1,
					    ZinFeedItem.ATTR_NAME, name,
					    ZinFeedItem.ATTR_MS, 1,
						ZinFeedItem.ATTR_TPI, elem.dirPrefId));
					
					msg = "added to the map: " + msg + " : " + zfcTb.get(key).toString();
				}
				else
				{
					key = mapTbFolderTpiToId[elem.dirPrefId];

					// the mozilla addressbook doesn't offer anything useful for change detection for addressbooks so we do our own...
					// 
					var zfi = zfcTb.get(key);

					if (zfi.name() != name)
					{
						zfi.set(ZinFeedItem.ATTR_NAME, name);
						zfi.increment(ZinFeedItem.ATTR_MS);

						msg += " - folder changed: " + zfi.toString();
					}
				}

				aUri[elem.directoryProperties.URI] = key;
				zfcTb.get(key).set(ZinFeedItem.ATTR_PRES, '1');  // this drives deletion detection

				msg += " - elem.directoryProperties." +
				       " dirType: "  + elem.directoryProperties.dirType +
				       " position: " + elem.directoryProperties.position;
				msg += " key: " + key;

			}
			else
				msg = "ignored: " + msg;

			this.context.state.m_logger.debug("loadTbMergeZfcWithAddressBook: " + msg);
		
			return true;
		}
	};

	aUri = new Array();

	stopwatch.mark("2");
	this.state.m_addressbook.forEachAddressBook(functor_foreach_addressbook);
	stopwatch.mark("4");

	return aUri;
}

SyncFsm.prototype.loadTbExcludeMailingListsAndDeletionDetection = function(aUri)
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
	//
	var aMailListUri = new Object();
	var functor_foreach_card;
	var zfcTb = this.zfcTb();

	functor_foreach_card = {
		state: this.state, // for logger only
		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);

			if (abCard.isMailList)
				aMailListUri[abCard.mailListURI] = uri;

			// if a sync gets cancelled somewhere between assigning+writing luid attributes to cards and saving the map,
			// we might end up with a card with an luid attribute but without the luid being in the map
			// Here, we remove any such attributes...

			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);
			var id = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

			if (id > AUTO_INCREMENT_STARTS_AT && !zfcTb.isPresent(id))
			{
				this.state.m_logger.debug("loadTbExclude : card had attribute luid: " + id + " that wasn't in the map - removed");
				mdbCard.setStringAttribute(TBCARD_ATTRIBUTE_LUID, 0); // delete would be more natural but not supported by api
				mdbCard.editCardToDatabase(uri);
			}

			return true;
		}
	};

	for (uri in aUri)
		this.state.m_addressbook.forEachCard(uri, functor_foreach_card);

	this.state.m_logger.debug("loadTbExclude pass 1 - aMailListUri == " + aToString(aMailListUri));

	// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
	//
	var aCardKeysToExclude = new Object();

	functor_foreach_card = {
		state: this.state,
		run: function(uri, item)
		{
			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);

			aCardKeysToExclude[this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard)] = aMailListUri[uri];

			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
			this.state.m_logger.debug("loadTbExclude pass 2: adding to aCardKeysToExclude: " +
			                                 this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard));

			return true;
		}
	};

	for (uri in aMailListUri)
		this.state.m_addressbook.forEachCard(uri, functor_foreach_card);

	this.state.m_logger.debug("loadTbExclude pass 2 - aCardKeysToExclude == " + aToString(aCardKeysToExclude));

	// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aCardKeysToExclude
	//
	functor_foreach_card = {
		state: this.state,

		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);
			var key = this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard);
			var msg = "loadTbExclude pass 3: uri: " + uri + " card key: " + key;

			var isInTopLevelFolder = false;

			if (!abCard.isMailList && ( !isPropertyPresent(aCardKeysToExclude, key) ||
			                            (isPropertyPresent(aCardKeysToExclude, key) && aCardKeysToExclude[key] != uri)))
					isInTopLevelFolder = true;

			// this.state.m_logger.debug("loadTbExclude pass 3: blah: " + " uri: " + uri + " isInTopLevelFolder: " + isInTopLevelFolder +
			//                           " key: " + this.state.m_addressbook.nsIAbMDBCardToKey(mdbCard) +
			//                           " card: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard) +
			//                           " properties: " + aToString(this.state.m_addressbook.getCardProperties(abCard)) +
			//                           " checksum: " + ZinContactConverter.instance().crc32(this.state.m_addressbook.getCardProperties(abCard)));

			if (isInTopLevelFolder)
			{
				var id = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);
				var properties  = this.state.m_addressbook.getCardProperties(abCard);
				var checksum    = ZinContactConverter.instance().crc32(properties);

				if (! (id > AUTO_INCREMENT_STARTS_AT)) // id might be null (not present) or zero (reset after the map was deleted)
				{
					id = zfcTb.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next');

					mdbCard.setStringAttribute(TBCARD_ATTRIBUTE_LUID, id);
					mdbCard.editCardToDatabase(uri);

					zfcTb.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, id, ZinFeedItem.ATTR_CS, checksum,
					                   ZinFeedItem.ATTR_L, aUri[uri]));

					msg += " added:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfcTb.get(id).toString();
				}
				else
				{
					zinAssert(zfcTb.isPresent(id)); // See the validity checking in pass 1 above

					var zfi = zfcTb.get(id);

					// if things have changed, update the map...
					//
					var keyParent = zfi.keyParent();

					if (keyParent != aUri[uri] || zfi.get(ZinFeedItem.ATTR_CS) != checksum)
					{
						var reason = " reason: ";
						if (keyParent != aUri[uri])
							reason += " parent folder changed: l:" + keyParent + " aUri[uri]: " + aUri[uri];
						if (zfi.get(ZinFeedItem.ATTR_CS) != checksum)
							reason += " checksum changed: cs: " + zfi.get(ZinFeedItem.ATTR_CS) + " checksum: " + checksum;

						zfi.set(ZinFeedItem.ATTR_CS, checksum);
						zfi.set(ZinFeedItem.ATTR_L, aUri[uri]);

						msg += " changed: " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfi.toString();
						msg += reason;
					}
					else
						msg += " found:   " + this.state.m_addressbook.nsIAbCardToPrintableVerbose(abCard) + " - map: " + zfi.toString();

				}

				zfcTb.get(id).set(ZinFeedItem.ATTR_PRES, '1');
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
	// 1. a ZinFeedItem.ATTR_PRES attribute was added in pass 3 above
	// 2. iterate through the map
	//    - an item without a ZinFeedItem.ATTR_PRES attribute is marked as deleted
	//    - remove the ZinFeedItem.ATTR_PRES attribute so that it's not saved
	// 

	var functor_mark_deleted = {
		state: this.state,

		run: function(zfi)
		{
			if (zfi.isPresent(ZinFeedItem.ATTR_DEL))
				; // do nothing
			else if (zfi.isPresent(ZinFeedItem.ATTR_PRES))
				zfi.del(ZinFeedItem.ATTR_PRES);
			else
			{
				zfi.set(ZinFeedItem.ATTR_DEL, 1);
				this.state.m_logger.debug("loadTbExclude - marking as deleted: " + zfi.toString());
			}

			return true;
		}
	};

	this.zfcTb().forEach(functor_mark_deleted, ZinFeedCollection.ITER_NON_RESERVED);
}

SyncFsm.prototype.testForLegitimateFolderNames = function()
{
	var functor = {
		a_folder_count:     new Object(),
		a_folder_violation: new Object(),
		m_folder_converter: this.state.m_folder_converter,
		state: this.state,

		run: function(zfi)
		{
			var ret = true;

			if (zfi.type() == ZinFeedItem.TYPE_FL && !zfi.isPresent(ZinFeedItem.ATTR_DEL))
			{
				zinAssert(zfi.isPresent(ZinFeedItem.ATTR_NAME));
				var name = this.m_folder_converter.convertForMap(FORMAT_ZM, FORMAT_TB, zfi);

				if (!isPropertyPresent(this.a_folder_count, name))
					this.a_folder_count[name] = true;
				else
					this.a_folder_violation[name] = 'FailOnFolderNameDuplicate';

				if (SyncFsm.isZmFolderReservedName(name))
					this.a_folder_violation[name] = 'FailOnFolderNameReserved';

				if (SyncFsm.isZmFolderContainsInvalidCharacter(name))
					this.a_folder_violation[name] = 'FailOnFolderNameInvalid';

				if (isPropertyPresent(this.a_folder_violation, name))
					ret = false; // stop at the first violation

				// this.state.m_logger.debug("testForLegitimateFolderNames: zfi: " + zfi + " name: " + name + " " +
				//                                      (ret ? "" : this.a_folder_violation[name])); 
			}

			return ret;
		}
	};

	this.zfcTb().forEach(functor, ZinFeedCollection.ITER_NON_RESERVED);

	if (aToLength(functor.a_folder_violation) > 0)
	{
		var name = propertyFromObject(functor.a_folder_violation);
		this.state.stopFailCode   = functor.a_folder_violation[name];
		this.state.stopFailDetail = name;
	}

	var ret = this.state.stopFailCode == null;

	this.state.m_logger.debug("testForLegitimateFolderNames: returns: " + ret);

	return ret;
}

SyncFsm.addToGid = function(zfcGid, sourceid, luid, reverse)
{
	var gid = zfcGid.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next');

	zfcGid.set(new ZinFeedItem(null, ZinFeedItem.ATTR_KEY, gid, ZinFeedItem.ATTR_PRES, 1, sourceid, luid));

	reverse[sourceid][luid] = gid;

	return gid;
}

SyncFsm.prototype.twinInGid = function(sourceid, luid, sourceid_tb, luid_tb, reverse)
{
	var zfcGid  = this.state.zfcGid;

	zinAssertAndLog(isPropertyPresent(reverse[sourceid_tb], luid_tb), "sourceid_tb: " + sourceid_tb + " luid_tb: " + luid_tb);

	var gid = reverse[sourceid_tb][luid_tb];
	zfcGid.get(gid).set(sourceid, luid);
	reverse[sourceid][luid] = gid;

	// set the VER attribute in the gid and the LS attributes in the luid maps
	// so that the compare algorithm can decide that there's no change.
	//
	this.resetLsoVer(gid, this.zfcTb().get(luid_tb));             // set VER in gid and LS attribute in the tb luid map
	SyncFsm.setLsoToGid(zfcGid.get(gid), this.zfcZm().get(luid)); // set                LS attribute in the zm luid map

	return gid;
}

// Some items on the server are supposed to be immutable (eg "Contacts" folder) but in fact the ms and md attributes may change.
// This method detects that and resets the gid's and the LS attributes in the sources to the new values so that buildGcs
// won't see any change.
// Query: what happens on the server to cause these supposedly immutable folders to change?
//
SyncFsm.prototype.workaroundForImmutables = function()
{
	this.workaroundForImmutable(ZM_ID_FOLDER_CONTACTS);
	this.workaroundForImmutable(ZM_ID_FOLDER_AUTO_CONTACTS);
}

SyncFsm.prototype.workaroundForImmutable = function(luid_zm)
{
	var sourceid_tb = this.state.sourceid_tb;
	var sourceid_zm = this.state.sourceid_zm;
	var zfcGid      = this.state.zfcGid;
	var reverse     = this.state.aReverseGid; // bring it into the local namespace

	if (this.zfcZm().isPresent(luid_zm) &&
		this.zfcZm().get(luid_zm).isPresent(ZinFeedItem.ATTR_LS))
	{
		zinAssert(isPropertyPresent(reverse[sourceid_zm], luid_zm));

		var zfiZm = this.zfcZm().get(luid_zm);
		var lso = new Lso(zfiZm.get(ZinFeedItem.ATTR_LS));
		var gid = reverse[sourceid_zm][luid_zm];
		zinAssert(zfcGid.isPresent(gid) && zfcGid.get(gid).isPresent(sourceid_tb));
		var luid_tb = zfcGid.get(gid).get(sourceid_tb);

		if (lso.get(ZinFeedItem.ATTR_VER) == zfcGid.get(gid).get(ZinFeedItem.ATTR_VER))
		{
			var res = lso.compare(zfiZm);

			if (res != 0)
			{
				// this would result in a change of note in buildGcs...
				//
				this.resetLsoVer(gid, zfiZm);                                    // set VER in gid and LS attribute in the zm luid map
				SyncFsm.setLsoToGid(zfcGid.get(gid), this.zfcTb().get(luid_tb)); // set                LS attribute in the tb luid map

				this.state.m_logger.debug("workaroundForImmutable: Zimbra folder: " + zfiZm.name() + " changed!  sourceid: " +
				                                  sourceid_zm + " and luid: " + luid_zm);
			}
		}
	}
}

SyncFsm.prototype.updateGidFromSources = function()
{
	var zfcGid  = this.state.zfcGid;
	var reverse = this.state.aReverseGid; // bring it into the local namespace
	var zfc, format;
	var foreach_msg;

	var functor_foreach_luid_fast_sync = {
		state: this.state,

		run: function(zfi)
		{
			var luid = zfi.key();
			var msg  = "fast_sync: sourceid: " + sourceid + " and luid: " + luid;

			if (isPropertyPresent(reverse[sourceid], luid))
			{
				zfcGid.get(reverse[sourceid][luid]).set(ZinFeedItem.ATTR_PRES, 1);
				msg += " - already in gid";
			}
			else if (SyncFsm.isOfInterest(zfc, luid))
			{
				var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);

				msg += " - added to gid: " + gid;
			}
			else
				msg += " - luid is not of interest - ignoring";

			foreach_msg += "\n  " + msg;

			return true;
		}
	};

	var functor_foreach_luid_slow_sync = {
		state: this.state,
		context: this,

		run: function(zfi)
		{
			var luid = zfi.key();
			var msg  = "slow_sync: sourceid: " + sourceid + " and luid: " + strPadTo(luid, 5);
			var luid_tb = null;
			var gid;

			zinAssert(!isPropertyPresent(reverse[sourceid], luid));

			if (SyncFsm.isOfInterest(zfc, luid) && SyncFsm.isRelevantToGid(zfc, luid))
			{
				if (zfi.type() == ZinFeedItem.TYPE_FL || zfi.type() == ZinFeedItem.TYPE_SF)
				{
					zinAssertAndLog((zfi.type() != ZinFeedItem.TYPE_FL) || !zfi.isForeign(), "foreign folder? zfi: " + zfi.toString());

					var abName = this.context.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfi);

					if (isPropertyPresent(mapTbFolderNameToId, abName))
					{
						luid_tb = mapTbFolderNameToId[abName];
						gid = this.context.twinInGid(sourceid, luid, this.state.sourceid_tb, luid_tb, reverse)
						msg += " twin: folder with tb luid: " + luid_tb + " at gid: " + gid;
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid: " + gid;
					}
				}
				else
				{
					zinAssert(zfi.type() == ZinFeedItem.TYPE_CN);
					zinAssert(isPropertyPresent(aChecksum, sourceid) && isPropertyPresent(aChecksum[sourceid], luid));

					var checksum    = aChecksum[sourceid][luid];
					var luid_parent = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
					var name_parent = this.context.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfc.get(luid_parent));

					var key = hyphenate('-', this.state.sourceid_tb, name_parent, checksum);
					// this.state.m_logger.debug("functor_foreach_luid_slow_sync: testing twin key: " + key);

					if (isPropertyPresent(aHasChecksum, key) && aToLength(aHasChecksum[key]) > 0)
						for (var luid_possible in aHasChecksum[key])
							if (aHasChecksum[key][luid_possible] && this.context.isTwin(this.state.sourceid_tb, sourceid, luid_possible, luid))
							{
								luid_tb = luid_possible;
								break;
							}

					if (luid_tb)
					{
						gid = this.context.twinInGid(sourceid, luid, this.state.sourceid_tb, luid_tb, reverse);
						msg += " twin: contact with tb luid: " + luid_tb + " at gid: " + gid;

						delete aHasChecksum[key][luid_tb];
					}
					else
					{
						var gid = SyncFsm.addToGid(zfcGid, sourceid, luid, reverse);
						msg += " added to gid: " + gid;
					}
				}
			}
			else
				msg += " - luid is not of interest - ignoring";

			foreach_msg += "\n  " + msg;

			return true;
		}
	};

	var functor_foreach_luid_do_checksum = {
		state: this.state,
		context: this,

		run: function(zfi)
		{
			var luid     = zfi.key();
			var checksum = null;
			var luid_parent;
			var msg = "";

			if (!SyncFsm.isOfInterest(zfc, luid))
				this.state.m_logger.debug("do_checksum: sourceid: " + sourceid + " luid: " + luid + " - not of interest");
			else if (!SyncFsm.isRelevantToGid(zfc, luid))
				this.state.m_logger.debug("do_checksum: sourceid: " + sourceid + " luid: " + luid + " - not relevant to gid");
			else if (zfi.type() == ZinFeedItem.TYPE_CN)
			{
				var a = this.context.getPropertiesAndParentNameFromSource(sourceid, luid);
				var properties  = a[0];
				var name_parent = a[1];

				if (properties) // a card with no properties will never be part of a twin so don't bother
				{
					checksum = ZinContactConverter.instance().crc32(properties);
					var key = hyphenate('-', sourceid, name_parent, checksum);

					if (!isPropertyPresent(aHasChecksum, key))
						aHasChecksum[key] = new Object();

					aHasChecksum[key][luid] = true;
					aChecksum[sourceid][luid] = checksum;

					msg += strPadTo(checksum, 11) + " parent: " + name_parent;
				}
			}
			else if (zfi.type() == ZinFeedItem.TYPE_FL || zfi.type() == ZinFeedItem.TYPE_SF)
				msg += "n/a: " + zfi.name();

			foreach_msg += " luid: " + strPadTo(luid, 40) + " checksum: " + msg + "\n";

			return true;
		}
	};

	var mapTbFolderNameToId = SyncFsm.getTopLevelFolderHash(this.zfcTb(),
		                                   ZinFeedItem.ATTR_NAME, ZinFeedItem.ATTR_KEY, ZinFeedCollection.ITER_NON_RESERVED);

	if (this.state.isSlowSync)
	{
		var aHasChecksum = new Object(); // aHasChecksum[key][luid]   = true;
		var aChecksum = new Object();    // aChecksum[sourceid][luid] = checksum;

		for (sourceid in this.state.sources)
		{
			zfc = this.state.sources[sourceid]['zfcLuid'];
			aChecksum[sourceid] = new Object();

			foreach_msg = "about to run do_checksum functor for sourceid: " + sourceid + "\n";

			zfc.forEach(functor_foreach_luid_do_checksum);

			this.state.m_logger.debug(foreach_msg);
		}

		// this.state.m_logger.debug("updateGidFromSources: aHasChecksum: ");
		// for (var key in aHasChecksum)
		// 	this.state.m_logger.debug("aHasChecksum  key: " + key + ": " + aHasChecksum[key]);
		// for (sourceid in this.state.sources)
		//	for (var luid in aChecksum[sourceid])
		// 		this.state.m_logger.debug("aChecksum sourceid: " + sourceid + " luid: " + luid + ": " + aChecksum[sourceid][luid]);
	}

	for (sourceid in this.state.sources)
	{
		zfc    = this.state.sources[sourceid]['zfcLuid'];
		format = this.state.sources[sourceid]['format'];

		foreach_msg = "";

		if (format == FORMAT_TB || !this.state.isSlowSync)
			zfc.forEach(functor_foreach_luid_fast_sync);
		else
			zfc.forEach(functor_foreach_luid_slow_sync);

		this.state.m_logger.debug(foreach_msg);
	}

	// sanity check - ensure that all gid's have been visited
	//
	var functor_foreach_gid = {
		state: this.state,

		run: function(zfi)
		{
			if (zfi.isPresent(ZinFeedItem.ATTR_PRES))
				zfi.del(ZinFeedItem.ATTR_PRES);
			else
			{
				this.state.m_logger.warn("Found a gid unreferenced by any sourceid/luid.  This shouldn't happen.  Deleting...");
				zfcGid.del(zfi.key());
			}

			return true;
		}
	};

	zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_NON_RESERVED);

	this.state.m_logger.debug("updateGidFromSources: zfcGid:\n"  + zfcGid.toString());
	this.state.m_logger.debug("updateGidFromSources: reverse: " + aToString(this.state.aReverseGid));
}

SyncFsm.prototype.getPropertiesAndParentNameFromSource = function(sourceid, luid)
{
	var properties, name_parent_map;
	var zfc = this.state.sources[sourceid]['zfcLuid'];
	var zfi = zfc.get(luid);
	var luid_parent = SyncFsm.keyParentRelevantToGid(zfc, zfi.key());
	var format = this.state.sources[sourceid]['format'];

	zinAssert(zfi.type() == ZinFeedItem.TYPE_CN);

	if (format == FORMAT_TB)
	{
		zinAssert(zfi.isPresent(ZinFeedItem.ATTR_L));

		var name_parent_public = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid_parent));
		var uri     = this.state.m_addressbook.getAddressBookUri(name_parent_public);
		var abCard  = uri ? this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid) : null;
		properties  = abCard ? this.state.m_addressbook.getCardProperties(abCard) : null;

		if (properties)
			ZinContactConverter.instance().removeKeysNotCommonToBothFormats(FORMAT_TB, properties);
		else
			this.state.m_logger.warn("getPropertiesAndParentNameFromSource: unable to retrieve properties for card: " +
									 " sourceid: " + sourceid + " luid: " + luid + " uri: " + uri);
	}
	else
	{
		zinAssert(isPropertyPresent(this.state.aSyncContact, luid));
		properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncContact[luid].element);
	}

	name_parent_map = this.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfc.get(luid_parent));

	return [ properties, name_parent_map ];
}

// return true iff all the fields (that are common to both data formats) exactly match
//
SyncFsm.prototype.isTwin = function(sourceid_a, sourceid_b, luid_a, luid_b)
{
	var a, properties_a, properties_b;
	var count_match = 0;

	a = this.getPropertiesAndParentNameFromSource(sourceid_a, luid_a);
	properties_a = a[0];
	a = this.getPropertiesAndParentNameFromSource(sourceid_b, luid_b);
	properties_b = a[0];

	var length_a = aToLength(properties_a);
	var length_b = aToLength(properties_b);

	var is_twin = (length_a == length_b);

	if (is_twin)
		for (var i in properties_a)
			if (isPropertyPresent(properties_b, i) && properties_a[i] == properties_b[i])
				count_match++;

	is_twin = length_a == count_match;

	// this.state.m_logger.debug("isTwin: returns: " + is_twin + " sourceid/luid: " + sourceid_a + "/" + luid_a
	//                                                         + " sourceid/luid: " + sourceid_b + "/" + luid_b);

	return is_twin;
}

SyncFsm.prototype.buildGcs = function()
{
	var aGcs          = new Object();  // an associative array where the key is a gid and the value is a Gcs object
	var aZfcCandidate = new Object();  // a copy of the luid maps updated as per this sync
	var sourceid_tb   = this.state.sourceid_tb;
	var zfcGid        = this.state.zfcGid;
	var reverse       = this.state.aReverseGid; // bring it into the local namespace

	for (var i in this.state.sources)
		aZfcCandidate[i] = this.state.sources[i]['zfcLuid'].clone(); // cloned because items get deleted out of this during merge

	// delete candidate mapitems in other sources once they've been compared
	//
	var functor_delete_other_candidate_mapitems = {
		run: function(key, value)
		{
			if (key != ZinFeedItem.ATTR_VER && key != sourceid)
				aZfcCandidate[key].del(value);

			return true;
		}
	};

	var buildgcs_msg;
	var functor_foreach_candidate = {
		context: this,
		state:   this.state,

		run: function(zfi)
		{
			var zfc = this.state.sources[sourceid]['zfcLuid'];
			var luid = zfi.key();

			buildgcs_msg = "\n  buildGcs: candidate sourceid: " + sourceid;

			if (SyncFsm.isOfInterest(zfc, luid) && SyncFsm.isRelevantToGid(zfc, luid))
			{
				zinAssert(isPropertyPresent(reverse, sourceid) && isPropertyPresent(reverse[sourceid], luid));

				var gid = reverse[sourceid][luid];

				aGcs[gid] = this.compare(gid);// aZfcCandidate, reverse, zfcGid

				zfcGid.get(gid).forEach(functor_delete_other_candidate_mapitems, ZinFeedItem.ITER_GID_ITEM);
			}
			else
				buildgcs_msg += " - not of interest or not relevant - compare skipped: zfi: " + zfi.toString();

			this.state.m_logger.debug(buildgcs_msg);

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
				context: this.context,
				state:   this.state,

				run: function(sourceid, luid)
				{
					if (sourceid == ZinFeedItem.ATTR_VER)
						return true;

					var zfi = aZfcCandidate[sourceid].get(luid);
					var msg = "  buildGcs: compare:  sourceid: " + sourceid + " zfi: " + zfi.toString();

					if (!zfi.isPresent(ZinFeedItem.ATTR_LS))
					{
						aNeverSynced[sourceid] = true;
						msg += " added to aNeverSynced";
					}
					else
					{
						var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));
						var gid = reverse[sourceid][luid];

						if (lso.get(ZinFeedItem.ATTR_VER) == zfcGid.get(gid).get(ZinFeedItem.ATTR_VER))
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
								if (this.state.sources[sourceid]['zfcLuid'].get(luid).type() == ZinFeedItem.TYPE_FL)
									zinAssert(this.context.shortLabelForLuid(sourceid, luid, FORMAT_TB) != TB_PAB);
							}
						}

						msg += " gid: " + gid + " gid's ver: " + zfcGid.get(gid).get(ZinFeedItem.ATTR_VER) +
							                    " lso: " + lso.toString() + " lso.compare == " + lso.compare(zfi);
					}

					buildgcs_msg += "\n" + msg;

					return true;
				}
			};

			zfcGid.get(gid).forEach(functor_each_luid_in_gid, ZinFeedItem.ITER_GID_ITEM);

			var cNeverSynced   = aToLength(aNeverSynced);
			var cVerMatchesGid = aToLength(aVerMatchesGid);
			var cChangeOfNote  = aToLength(aChangeOfNote);

			msg += " aNeverSynced: "   + aToString(aNeverSynced) +
			       " aVerMatchesGid: " + aToString(aVerMatchesGid) +
			       " aChangeOfNote: "  + aToString(aChangeOfNote);

			zinAssertAndLog(cNeverSynced == 0 || cNeverSynced == 1, "gid: " + gid + " cNeverSynced: " + cNeverSynced + " " +
			                                                   buildgcs_msg + "\n" + msg);

			if (cNeverSynced == 1)
			{
				zinAssertAndLog(cVerMatchesGid == 0 && cChangeOfNote == 0, "gid: " + gid + " " + buildgcs_msg + "\n" + msg);

				ret = new Gcs(propertyFromObject(aNeverSynced), Gcs.WIN);
			}
			else if (cChangeOfNote == 0)
			{
				zinAssertAndLog(isPropertyPresent(aVerMatchesGid, sourceid_tb), buildgcs_msg + "\n" + msg);
				ret = new Gcs(sourceid_tb, Gcs.WIN);
			}
			else if (cChangeOfNote == 1)
				ret = new Gcs(propertyFromObject(aChangeOfNote), Gcs.WIN);
			else
			{
				var lowest_sourceid = null;

				for (var i in aChangeOfNote)
					if (lowest_sourceid == null || aChangeOfNote[i] < lowest_sourceid)
						lowest_sourceid = i;

				ret = new Gcs(lowest_sourceid, Gcs.CONFLICT);
			}

			msg = "  buildGcs: compare: " + gid + " returns: " + ret.toString() + msg;

			buildgcs_msg += "\n" + msg;

			return ret;
		}
	};

	for (sourceid in this.state.sources)
		aZfcCandidate[sourceid].forEach(functor_foreach_candidate);
	
	var msg = "";
	for (var gid in aGcs)
		msg += "\n aGcs[" + gid + "]: " + aGcs[gid].toString();

	this.state.m_logger.debug("buildGcs: " + msg);

	return aGcs;
}

// This method builds the list of (MDU) operations required to update the meta-data for winners.
// - if a winning item is new to the gid, generate an MDU operation (which will create the version)
// - if a winning item was already in the gid and changed, generate an MDU operation (which will bump it's version)
// - if a winning item was already in the gid but didn't change, do nothing
//
SyncFsm.prototype.suoBuildWinners = function(aGcs)
{
	var zfcGid     = this.state.zfcGid;
	var aSuoResult = new Array();
	var suo;

	for (var gid in aGcs)
	{
		suo = null;

		var msg = "suoBuildWinners: gid: " + gid + " winning sourceid: " + aGcs[gid].sourceid;

		switch (aGcs[gid].state)
		{
			case Gcs.WIN:
			case Gcs.CONFLICT:
				var winner    = aGcs[gid].sourceid;
				var sourceid  = winner;
				var zfcWinner = this.state.sources[winner]['zfcLuid']; // this.getZfc(winner) 
				var zfiWinner = zfcWinner.get(zfcGid.get(gid).get(winner)); // this.getLuid(collection, sourceid)

				if (!zfiWinner.isPresent(ZinFeedItem.ATTR_LS)) // winner is new to gid
				{
					zinAssert(!zfcGid.get(gid).isPresent(ZinFeedItem.ATTR_VER));

					zinAssert(zfcGid.get(gid).length() == 2); // just the id property and the winning sourceid

					msg += " - winner is new to gid  - MDU";

					suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.MDU);
				}
				else
				{
					var lso = new Lso(zfiWinner.get(ZinFeedItem.ATTR_LS));
					var res = lso.compare(zfiWinner);

					zinAssert(lso.get(ZinFeedItem.ATTR_VER) == zfcGid.get(gid).get(ZinFeedItem.ATTR_VER));
					zinAssert(res >= 0); // winner either changed in an interesting way or stayed the same

					if (res == 1)
					{
						msg += " - winner changed in an interesting way - MDU";
						suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.MDU);
					}
					else
						msg += " - winner didn't change - do nothing";
				}
				break;

			default:
				zinAssert(false);
		}

		this.state.m_logger.debug(msg);

		if (suo != null)
			aSuoResult.push(suo);
	}

	return aSuoResult;
}

// The suo's returned by this method are organised into buckets to suit later processing (by source, by operation, by content type):
// - aSuo[sourceid][Suo.ADD | ZinFeedItem.TYPE_FL][id] = suo
// - for Suo.MOD and Suo.DEL, id is the target luid (so that the zimbra response can easily find the the corresponding suo,
// - for Suo.ADD, id is just an autoincremented number.
//

SyncFsm.prototype.suoBuildLosers = function(aGcs)
{
	var zfcGid     = this.state.zfcGid;
	var aSuoResult = new Object();
	var indexSuo   = 0;
	var suo;

	for (sourceid in this.state.sources)
		aSuoResult[sourceid] = new Object();

	for (var gid in aGcs)
		for (sourceid in this.state.sources)
			if (sourceid != aGcs[gid].sourceid) // only look at losers
	{
		suo = null;

		var msg = "suoBuildLosers:  gid: " + gid + " losing  sourceid: " + sourceid + " gcs: " + aGcs[gid].toString();

		switch (aGcs[gid].state)
		{
			case Gcs.WIN:
			case Gcs.CONFLICT:
			{
				var sourceid_winner = aGcs[gid].sourceid;
				var zfcWinner       = this.state.sources[sourceid_winner]['zfcLuid'];
				var zfcTarget       = this.state.sources[sourceid]['zfcLuid'];
				var luid_winner     = zfcGid.get(gid).get(sourceid_winner);
				var zfiWinner       = zfcWinner.get(luid_winner);
				var zfiTarget       = zfcGid.get(gid).isPresent(sourceid) ? zfcTarget.get(zfcGid.get(gid).get(sourceid)) : null;
				var is_delete_pair  = false;

				if (!zfcGid.get(gid).isPresent(sourceid))
				{
					// when we delete, we actually move to trash on zimbra
					// when zimbra's trash gets emptied, we see the deletes, by which time the item is long gone from the original source
					// so here, we only add items to the gid if the winner is of interest (and not deleted)
					//
					if (!zfiWinner.isPresent(ZinFeedItem.ATTR_DEL) && SyncFsm.isOfInterest(zfcWinner, zfiWinner.key()))
					{
						msg += " - source not in gid";
						suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.ADD);
					}
				}
				else if (this.isLsoVerMatch(gid, zfcTarget.get(zfcGid.get(gid).get(sourceid))))
					msg += " winner matches gid - do nothing";
				else if (zfiWinner.isPresent(ZinFeedItem.ATTR_DEL))
				{
					if (!zfiTarget.isPresent(ZinFeedItem.ATTR_DEL))
						suo = new Suo(gid, sourceid_winner, sourceid, Suo.DEL);
					else
					{
						is_delete_pair = true;
						msg += " - both winner and loser deleted - do nothing";
					}
				}
				else if (!SyncFsm.isOfInterest(zfcWinner, zfiWinner.key()))
					suo = new Suo(gid, sourceid_winner, sourceid, Suo.DEL);
				else if (zfiTarget.isPresent(ZinFeedItem.ATTR_DEL))
				{
					msg += " - winner modified but loser had been deleted - ";
					suo = new Suo(gid, aGcs[gid].sourceid, sourceid, Suo.ADD);
				}
				else
					suo = new Suo(gid, sourceid_winner, sourceid, Suo.MOD);

				if (aGcs[gid].state == Gcs.CONFLICT && !is_delete_pair)
				{
					zinAssert(suo);

					var conflict_msg = "";
					
					var source_name_winner = this.state.sources[sourceid_winner]['name'];
					var source_name_loser  = this.state.sources[sourceid]['name'];
					var format_winner      = this.state.sources[sourceid_winner]['format'];
					var item               = (zfiWinner.type() == ZinFeedItem.TYPE_CN ? "contact" : "addressbook");
					var short_label_winner = this.shortLabelForLuid(sourceid_winner, luid_winner, FORMAT_TB);

					conflict_msg += "conflict: " + item + ": " + short_label_winner +
									" on " + source_name_winner +
									" wins and " + item + " on " + source_name_loser +
									" is " + Suo.opcodeAsStringPastTense(suo.opcode);

					this.state.aConflicts.push(conflict_msg);

					// sanity check that PAB and Contacts are never in conflict
					//
					if (zfiWinner.type() == ZinFeedItem.TYPE_FL)
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

			if (!isPropertyPresent(aSuoResult[sourceid], bucket))
				aSuoResult[sourceid][bucket] = new Object();

			if (suo.opcode == Suo.ADD)
				aSuoResult[sourceid][bucket][indexSuo++] = suo;
			else
				aSuoResult[sourceid][bucket][this.state.zfcGid.get(gid).get(sourceid)] = suo;

			msg += " added suo: " + suo.toString();
		}

		this.state.m_logger.debug(msg);
	}

	return aSuoResult;
}

SyncFsm.prototype.identifyForeignContactsToBeDeleted = function()
{
	var sourceid, indexSuo, msg;

	zinAssert(this.state.aContact.length == 0);

	for (sourceid in this.state.sources)
	{
		var format = this.state.sources[sourceid]['format'];
		var zfc    = this.state.sources[sourceid]['zfcLuid'];

		if (format == FORMAT_ZM)
			for (indexSuo in this.state.aSuo[sourceid][Suo.DEL | ZinFeedItem.TYPE_CN])
			{
				suo         = this.state.aSuo[sourceid][Suo.DEL | ZinFeedItem.TYPE_CN][indexSuo];
				luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);

				if (zfc.get(luid_target).isForeign())
					this.state.aContact.push(new Zuio(zfc.get(luid_target).key()));
			}
	}

	msg = "identifyForeignContactsToBeDeleted: aContact:";
	for (var i = 0; i < this.state.aContact.length; i++)
		msg += " " + i + ": " + this.state.aContact[i].toString();
	this.state.m_logger.debug(msg);
}

// Background: ORDER_SOURCE_UPDATE specifies that contact delete is processed before folder delete.
// The main reason to remove Suo's that delete contacts when there is already a Suo to delete the parent folder is:
// 1. When we move the folder to Trash, the contacts remain in the parent folder in the trash
//    If we deleted the contacts first, we'd lose the parent-child relationship between contact and folder in the trash
//    Similar problems would apply to shared folders and their contacts.
// It's also a performance optimisation.
//
SyncFsm.prototype.removeContactDeletesWhenFolderIsBeingDeleted = function()
{
	var aFoldersBeingDeleted; // each key in this hash is the gid of a folder about to be deleted
	var aOperationsToRemove;  // each key in this hash is the indexSuo of a contact delete operation that is to be removed
	var i, suo, indexSuo, luid_target, l_target, gid_l_target, msg;
	var aBuckets = [Suo.DEL | ZinFeedItem.TYPE_FL, Suo.DEL | ZinFeedItem.TYPE_SF];
	var aBucket;

	for (var sourceid in this.state.sources)
	{
		aFoldersBeingDeleted = new Object();
		aOperationsToRemove  = new Object();

		for (i = 0; i < aBuckets.length; i++)
		{
			aBucket = this.state.aSuo[sourceid][aBuckets[i]];

			for (indexSuo in aBucket)
			{
				suo = aBucket[indexSuo];
				aFoldersBeingDeleted[suo.gid] = null;
			}
		}

		for (indexSuo in this.state.aSuo[sourceid][Suo.DEL | ZinFeedItem.TYPE_CN])
		{
			suo         = this.state.aSuo[sourceid][Suo.DEL | ZinFeedItem.TYPE_CN][indexSuo];
			luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
			l_target    = SyncFsm.keyParentRelevantToGid(this.state.sources[sourceid]['zfcLuid'], luid_target);
			gid_l_target = this.state.aReverseGid[sourceid][l_target];

			if (isPropertyPresent(aFoldersBeingDeleted, gid_l_target))
				aOperationsToRemove[indexSuo] = null;
		}


		if (aToLength(aFoldersBeingDeleted) > 0)
			this.state.m_logger.debug("removeContactDeletesWhenFolderIsBeingDeleted: sourceid: " + sourceid +
			                             " folders being deleted (gids): " +
			                             aToString(aFoldersBeingDeleted) + " and contacts deletes being removed: " +
										 aToString(aOperationsToRemove));

		for (indexSuo in aOperationsToRemove)
			delete this.state.aSuo[sourceid][Suo.DEL | ZinFeedItem.TYPE_CN][indexSuo];
	}
}

// Test that no folder names have both an ADD and DEL operation
//
// If there is, we have to give up convergence because:
// we apply the operations in a fixed order, namely ADD followed by DEL, and almost certainly the user did DEL followed by ADD.
// Yes, this is ugly.  The right thing to do here would be to rewrite the aSuo code into an container that can be re-ordered
// to suit it's contents.
// Giving up consistency is easier - and after all, how often are users going to do: DEL addressbook X/flush trash/ADD addressbook X
//
SyncFsm.prototype.testForConflictingUpdateOperations = function()
{
	var aName = new Object();

	this.testForConflictingUpdateOperationsHelper(aName, Suo.ADD | ZinFeedItem.TYPE_FL);
	this.testForConflictingUpdateOperationsHelper(aName, Suo.ADD | ZinFeedItem.TYPE_SF);

	this.state.m_logger.debug("testForConflictingUpdateOperations: folders being added: " + aToString(aName));

	this.testForConflictingUpdateOperationsHelper(aName, Suo.DEL | ZinFeedItem.TYPE_SF);
	this.testForConflictingUpdateOperationsHelper(aName, Suo.DEL | ZinFeedItem.TYPE_FL);

	this.state.m_logger.debug("testForConflictingUpdateOperations: both added and deleted (look for >= 2): " + aToString(aName));

	for (var i in aName)
		if (aName[i] >= 2)
		{
			this.state.stopFailCode   = 'FailOnFolderSourceUpdate';
			this.state.stopFailDetail = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(i));
			break;
		}

	return this.state.stopFailCode == null;
}

SyncFsm.prototype.testForConflictingUpdateOperationsHelper = function(aName, op)
{
	var suo, zfcWinner, luid_winner, zfiWinner, name;

	if (isPropertyPresent(this.state.aSuo[this.state.sourceid_tb], op))
		for (var indexSuo in this.state.aSuo[this.state.sourceid_tb][op])
	{
		suo = this.state.aSuo[this.state.sourceid_tb][op][indexSuo];
		zfcWinner   = this.state.sources[suo.sourceid_winner]['zfcLuid'];
		luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
		zfiWinner   = zfcWinner.get(luid_winner);
		name        = zfiWinner.name();

		if (isPropertyPresent(aName, name))
			aName[name]++;
		else
			aName[name]=1;
	}
}

SyncFsm.prototype.shortLabelForLuid = function(sourceid, luid, target_format)
{
	var zfc    = this.state.sources[sourceid]['zfcLuid'];
	var format = this.state.sources[sourceid]['format'];
	var zfi    = zfc.get(luid);
	var ret    = "";
	var key;

	if (zfi.type() == ZinFeedItem.TYPE_FL)
		ret += this.state.m_folder_converter.convertForPublic(target_format, format, zfi);
	else
	{
		zinAssert(zfi.type() == ZinFeedItem.TYPE_CN);

		if (zfi.isPresent(ZinFeedItem.ATTR_DEL))
			ret += "<deleted>";
		else
		{
			var properties = this.getContactFromLuid(sourceid, luid, format);
		
			ret += this.shortLabelForContactProperties(format, properties);
		}
	}

	// this.state.m_logger.debug("shortLabelForLuid: blah: sourceid: " + sourceid + " luid: " + luid + " target_format: " + target_format +
	//                           " returns: " + ret);

	return ret;
}

SyncFsm.prototype.shortLabelForContactProperties = function(format, properties)
{
	var ret = "";
	var key;

	key = (format == FORMAT_TB) ? 'DisplayName' : 'fullName';

	if (isPropertyPresent(properties, key))
		ret += "<" + properties[key] + "> ";

	key = (format == FORMAT_TB) ? "PrimaryEmail" : "email";

	if (isPropertyPresent(properties, key))
		ret += properties[key];

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
		var zfc      = this.state.sources[sourceid]['zfcLuid'];
		var format   = this.state.sources[sourceid]['format'];
		var luid     = this.state.zfcGid.get(gid).get(sourceid);
		var zfi      = zfc.get(luid);

		if (zfi.type() == ZinFeedItem.TYPE_FL && !zfi.isPresent(ZinFeedItem.ATTR_DEL))
		{
			zinAssert(zfi.isPresent(ZinFeedItem.ATTR_NAME));

			name = this.state.m_folder_converter.convertForMap(FORMAT_TB, format, zfi);

			if (isPropertyPresent(aFolderName, name))
			{
				this.state.stopFailCode   = 'FailOnFolderNameClash';
				this.state.stopFailDetail = name;
				break;
			}
			else
				aFolderName[name] = gid;
		}
	}

	var ret = this.state.stopFailCode == null;

	if (!ret)
		this.state.m_logger.debug("testForFolderNameDuplicate:" + " returns: " + ret +
						          " aFolderName: " + aToString(aFolderName) + " stopFailCode: " + this.state.stopFailCode);

	return ret;
}

SyncFsm.prototype.buildPreUpdateWinners = function(aGcs)
{
	for (var gid in aGcs)
	{
		var sourceid = aGcs[gid].sourceid;
		var zfc      = this.state.sources[sourceid]['zfcLuid'];
		var luid     = this.state.zfcGid.get(gid).get(sourceid);
		var zfi      = zinCloneObject(zfc.get(luid));

		zfi.set(ZinFeedItem.ATTR_KEY, gid);

		this.state.zfcPreUpdateWinners.set(zfi);
	}
}

SyncFsm.prototype.suoRunWinners = function(aSuoWinners)
{
	var msg = "suoRunWinners:\n";

	for (var i = 0; i < aSuoWinners.length; i++)
	{
		suo = aSuoWinners[i];

		msg += " suo: "  + suo.toString() + "\n";

		var zfcWinner   = this.state.sources[suo.sourceid_winner]['zfcLuid'];
		var luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);

		this.resetLsoVer(suo.gid, zfcWinner.get(luid_winner));
	}

	this.state.m_logger.debug(msg);
}

// Test that we're not going to try to create a shared addressbook in Zimbra
// Slow Sync ==> test that for all the zindus+ and zindus- addressbooks in zfcTb, there's a TYPE_SF item in zfcZm with the same name
// Fast Sync ==> test that     all the zindus+ and zindus- addressbooks in zfcTb have an entry in the gid
// This method therefore has to be called *before* the gid is updated from the sources.
//
SyncFsm.prototype.testForCreateSharedAddressbook = function()
{
	var sourceid;

	var functor = {
		converter: this.state.m_folder_converter,
		state: this.state,
		run: function(zfi)
		{
			// var msg = "testForCreateSharedAddressbook: countName: zfi: " + zfi.toString();
			// if (zfi.type() == ZinFeedItem.TYPE_FL)
			//	msg += " folder name: " + zfi.name() + " prefixClass: " + this.converter.prefixClass(zfi.name());
			// else
			// 	msg += " not a folder";
			// this.state.m_logger.debug(msg);

			if (format == FORMAT_TB && zfi.type() == ZinFeedItem.TYPE_FL
			                        && this.converter.prefixClass(zfi.name()) == ZinFolderConverter.PREFIX_CLASS_SHARED
			                        && (this.state.isSlowSync || !this.state.aReverseGid[sourceid][zfi.key()]) )
				this.countName(zfi.name());
			else if (format == FORMAT_ZM && this.state.isSlowSync && zfi.type() == ZinFeedItem.TYPE_SF)
				this.countName(this.converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfi));

			return true;
		},
		countName: function(name)
		{
			// this.state.m_logger.debug("blah: countName: name: " + name);
			a_name[sourceid][name] = true;
		}
	};

	var a_name = new Object();

	for (sourceid in this.state.sources)
	{
		zfc    = this.state.sources[sourceid]['zfcLuid'];
		format = this.state.sources[sourceid]['format'];
		a_name[sourceid] = new Object();

		zfc.forEach(functor);
	}

	this.state.m_logger.debug("testForCreateSharedAddressbook: Tb: " + aToString(a_name[this.state.sourceid_tb]));
	this.state.m_logger.debug("testForCreateSharedAddressbook: Zm: " + aToString(a_name[this.state.sourceid_zm]));

	for (var name in a_name[this.state.sourceid_tb])
		if (!isPropertyPresent(a_name[this.state.sourceid_zm], name))
		{
			this.state.stopFailCode   = 'FailOnFolderCantCreateShared';
			this.state.stopFailDetail = name;
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

	if (!this.zfcZm().isPresent(id) || this.zfcZm().get(id).isPresent(ZinFeedItem.ATTR_DEL))
		msg += " server doesn't have: " + ZM_FOLDER_EMAILED_CONTACTS;
	else if (this.state.isSlowSync)
		msg += " id: " + id + " isSlowSync: " + this.state.isSlowSync;
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
	var zfcZm = this.zfcZm();

	// Iterate through contacts and add an ATTR_DEL to any contact that's
	// no longer of interest (eg because it's folder moved to Trash)

	var functor_fakeDelOnUninterestingContacts = {
		state: this.state,

		run: function(zfi)
		{
			if (zfi.type() == ZinFeedItem.TYPE_CN)
			{
				var luid = zfi.key();

				if (!SyncFsm.isOfInterest(zfcZm, luid))
				{
					zfcZm.get(luid).set(ZinFeedItem.ATTR_DEL, 1);
					this.state.m_logger.debug("faking a delete on a contact that's no longer of interest: luid: " + luid);
				}
			}

			return true;
		}
	};

	if (this.state.isAnyChangeToFolders)
		zfcZm.forEach(functor_fakeDelOnUninterestingContacts);
}

// In zfcZm:
// - create/update the TYPE_SF items
// - remove TYPE_LN items for which there is no corresponding foreign folder
//
SyncFsm.prototype.updateSharedFolders = function()
{
	var zfcZm = this.zfcZm();
	var functor;
	var msg = "updateSharedFolders: ";

	functor = {
		run: function(zfi)
		{
			if (zfi.type() == ZinFeedItem.TYPE_LN)
			{
				var keyForeignFolder = Zuio.key(zfi.get(ZinFeedItem.ATTR_RID), zfi.get(ZinFeedItem.ATTR_ZID));

				if (zfcZm.isPresent(keyForeignFolder))
				{
					var keyLink          = zfi.key();
					var zfiLink          = zfi;
					var zfiForeignFolder = zfcZm.get(keyForeignFolder);
					var zfiSharedFolder;
					var keySharedFolder;

					if (!zfiForeignFolder.isPresent(ZinFeedItem.ATTR_SKEY))
					{
						keySharedFolder = Zuio.key(zfcZm.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next'), "zindus-sf");

						zinAssertAndLog(!zfcZm.isPresent(keySharedFolder), "auto-incrememented key shouldn't exist: " + keySharedFolder);

						zfiSharedFolder = new ZinFeedItem(ZinFeedItem.TYPE_SF,
		 				                                  ZinFeedItem.ATTR_KEY,  keySharedFolder,
						                                  ZinFeedItem.ATTR_LKEY, keyLink,
						                                  ZinFeedItem.ATTR_FKEY, keyForeignFolder );
						                                  // for ATTR_L, ATTR_NAME, ATTR_MS, ATTR_PERM see updateSharedFolderItem()
						zfcZm.set(zfiSharedFolder);

						// these reverse-links make it easy to find the shared folder given either the <link> or foreign <folder>
						//
						zfcZm.get(keyLink).set(ZinFeedItem.ATTR_SKEY, keySharedFolder);
						zfcZm.get(keyForeignFolder).set(ZinFeedItem.ATTR_SKEY, keySharedFolder);

						msg += "\n added to map: " + zfiSharedFolder.toString();
					}

					SyncFsm.updateSharedFolderItem(zfcZm, zfiLink.key());
				}
				else
				{
					zfi.set(ZinFeedItem.ATTR_DEL, 1);
					msg += "\n marking as deleted: " + zfi.toString();
				}
			}

			return true;
		}
	};

	zfcZm.forEach(functor);

	functor = {
		run: function(zfi)
		{
			if (zfi.type() == ZinFeedItem.TYPE_FL && zfi.isForeign() && !zfi.isPresent(ZinFeedItem.ATTR_SKEY))
			{
				zfi.set(ZinFeedItem.ATTR_DEL, 1);
				msg += "\n marking as deleted: " + zfi.toString();
			}

			return true;
		}
	};

	zfcZm.forEach(functor);

	this.state.m_logger.debug(msg);
}

SyncFsm.updateSharedFolderItem = function(zfc, luid_link)
{
	var zfiLink, zfiSharedFolder, zfiForeignFolder;
	var msg = "updateSharedFolderItem: blah: ";

	zfiLink = zfc.get(luid_link);

	zinAssertAndLog(zfiLink.isPresent(ZinFeedItem.ATTR_SKEY), "luid_link: " + luid_link);

	zfiSharedFolder = zfc.get(zfiLink.get(ZinFeedItem.ATTR_SKEY));

	zinAssertAndLog(zfiSharedFolder.isPresent(ZinFeedItem.ATTR_FKEY), "zfiSharedFolder: " + zfiSharedFolder.toString());

	zfiForeignFolder = zfc.get(zfiSharedFolder.get(ZinFeedItem.ATTR_FKEY));

	msg += "\n before: "+ "\n ln: " + zfiLink.toString() + "\n sf: " + zfiSharedFolder.toString() + "\n fl: " + zfiForeignFolder.toString();

	zfiSharedFolder.set( ZinFeedItem.ATTR_L,    zfiLink.get(ZinFeedItem.ATTR_L));
	zfiSharedFolder.set( ZinFeedItem.ATTR_NAME, zfiLink.name());
	zfiSharedFolder.set( ZinFeedItem.ATTR_MS,   ((zfiLink.get(ZinFeedItem.ATTR_MS) + 1) * (zfiForeignFolder.get(ZinFeedItem.ATTR_MS) + 1)));
	zfiSharedFolder.set( ZinFeedItem.ATTR_PERM, zfiForeignFolder.get(ZinFeedItem.ATTR_PERM));

	if (zfiLink.isPresent(ZinFeedItem.ATTR_DEL) || zfiForeignFolder.isPresent(ZinFeedItem.ATTR_DEL))
	{
		zfiSharedFolder.set( ZinFeedItem.ATTR_DEL, '1');
		zfiLink.set(         ZinFeedItem.ATTR_DEL, '1');
		zfiForeignFolder.set(ZinFeedItem.ATTR_DEL, '1');
		msg += "\n marking all as deleted";
	}

	msg += "\n after: " + "\n ln: " + zfiLink.toString() + "\n sf: " + zfiSharedFolder.toString() + "\n fl: " + zfiForeignFolder.toString();

	gLogger.debug(msg);
}

// Converge is slow when "verbose logging" is turned on so it is broken up into three states.  This means:
// - mozilla's failsafe stop/continue javascript dialog is less likely to pop up
// - the user gets to see a little bit of movement in the progress bar between each state
//
SyncFsm.prototype.entryActionConverge1 = function(state, event, continuation)
{
	var passed = true;

	this.state.stopwatch.mark("entryActionConverge1: 1");

	this.state.m_logger.debug("entryActionConverge1: blah: zfcTb:\n" + this.zfcTb().toString()); // TODO remove me
	this.state.m_logger.debug("entryActionConverge1: blah: zfcZm:\n" + this.zfcZm().toString()); // TODO remove me

	this.updateSharedFolders();

	this.state.stopwatch.mark("entryActionConverge1: 2");

	this.fakeDelOnUninterestingContacts();

	this.state.stopwatch.mark("entryActionConverge1: 3");

	this.state.m_logger.debug("entryActionConverge1: zfcTb:\n" + this.zfcTb().toString());
	this.state.m_logger.debug("entryActionConverge1: zfcZm:\n" + this.zfcZm().toString());

	this.state.stopwatch.mark("entryActionConverge1: 4");

	passed = passed && this.testForEmailedContactsMatch();

	this.state.stopwatch.mark("entryActionConverge1: 4.1");

	passed = passed && this.testForCreateSharedAddressbook();

	if (passed)
	{
		this.updateGidFromSources();                         // 1. map all luids into a single namespace (the gid)
		this.state.stopwatch.mark("entryActionConverge1: 5");

		this.workaroundForImmutables();

		this.aGcs = this.buildGcs();                         // 2. reconcile the sources (via the gid) into a single truth
		                                                     //    this is the sse output array - winners and conflicts are selected here
		this.state.stopwatch.mark("entryActionConverge1: 6");

		this.buildPreUpdateWinners(this.aGcs);               // 3. save winner state before winner update to distinguish ms vs md update
		this.state.stopwatch.mark("entryActionConverge1: 7");

		passed = this.testForFolderNameDuplicate(this.aGcs); // 4. a bit of conflict detection
	}

	this.state.stopwatch.mark("entryActionConverge1: 8");

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionConverge2 = function(state, event, continuation)
{
	var aSuoWinners;

	this.state.stopwatch.mark("entryActionConverge2: 1");

	aSuoWinners = this.suoBuildWinners(this.aGcs);         // 5.  generate operations required to bring meta-data for winners up to date
	this.state.stopwatch.mark("entryActionConverge2: 2");

	this.suoRunWinners(aSuoWinners);                       // 6.  run the operations that update winner meta-data
	this.state.stopwatch.mark("entryActionConverge2: 3");

	continuation('evNext');
}

SyncFsm.prototype.entryActionConverge3 = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionConverge3: 1");

	this.state.aSuo = this.suoBuildLosers(this.aGcs);      // 7.  generate the operations required to bring the losing sources up to date

	this.state.stopwatch.mark("entryActionConverge3: 2");

	this.removeContactDeletesWhenFolderIsBeingDeleted();   // 8. remove contact deletes when folder is being deleted

	this.state.stopwatch.mark("entryActionConverge3: 3");

	passed = this.testForConflictingUpdateOperations();    // 9. abort if any of the update operations could lead to potential inconsistency

	this.state.stopwatch.mark("entryActionConverge3: 4");

	this.identifyForeignContactsToBeDeleted();

	this.state.stopwatch.mark("entryActionConverge3: 5");

	var nextEvent = passed ? 'evNext' : 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionUpdateTb = function(state, event, continuation)
{
	var i, gid, id, type, sourceid_target, luid_winner, luid_target, zfcWinner, zfcTarget, zfcGid, zfiWinner, zfiGid;
	var zc, uri, abCard, l_winner, l_gid, l_target, l_current, properties, attributes, msg;

	this.state.stopwatch.mark("entryActionUpdateTb");

	for (var i = 0; i < ORDER_SOURCE_UPDATE.length; i++)
		if (isPropertyPresent(this.state.aSuo[this.state.sourceid_tb], ORDER_SOURCE_UPDATE[i]))
			for (var indexSuo in this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]])
	{
		suo = this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]][indexSuo];
		gid  = suo.gid;
		type = this.feedItemTypeFromGid(gid, suo.sourceid_winner);
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		zfcWinner   = this.state.sources[sourceid_winner]['zfcLuid'];
		zfcTarget   = this.state.sources[sourceid_target]['zfcLuid'];
		zfcGid      = this.state.zfcGid;
		luid_winner = zfcGid.get(gid).get(sourceid_winner);
		zfiGid      = zfcGid.get(gid);
		zfiWinner   = zfcWinner.get(luid_winner);
		luid_target = null;  // if non-null at the bottom of loop, it means that a change was made
		properties  = null;
		msg = "";

		this.state.m_logger.debug("entryActionUpdateTb: acting on suo: - opcode: " + Suo.opcodeAsString(ORDER_SOURCE_UPDATE[i] & Suo.MASK)
			+ " type: " + ZinFeedItem.typeAsString(ORDER_SOURCE_UPDATE[i] & ZinFeedItem.TYPE_MASK)
			+ " suo: "  + this.state.aSuo[this.state.sourceid_tb][ORDER_SOURCE_UPDATE[i]][indexSuo].toString());


		if (ORDER_SOURCE_UPDATE[i] & ZinFeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
			zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

		switch(ORDER_SOURCE_UPDATE[i])
		{
			case Suo.ADD | ZinFeedItem.TYPE_CN:
				// allocate a new luid in the source map
				// add to thunderbird addressbook
				// add the luid in the source map (zfc)
				// update the gid with the new luid
				// update the reverse array 

				luid_target = zfcTarget.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next');

				zinAssert(isPropertyPresent(this.state.aSyncContact, luid_winner));
				zc = this.state.aSyncContact[luid_winner]; // the ZimbraContact object that arrived via GetContactResponse

				msg += "About to add a contact to the thunderbird addressbook, gid: " + gid + " and luid_winner: " + luid_winner;

				zinAssert(typeof(zc != 'undefined'));

				attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
				properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);
				var checksum    = ZinContactConverter.instance().crc32(properties);

				msg += " properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

				l_winner = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key()); // luid of the parent folder in the source
				                                                                       // this.state.m_logger.debug("l_winner: " +l_winner);
				l_gid    = this.state.aReverseGid[sourceid_winner][l_winner];          // gid  of the parent folder
				                                                                       // this.state.m_logger.debug("l_gid: " + l_gid);
				l_target = zfcGid.get(l_gid).get(sourceid_target);                     // luid of the parent folder in the target
				uri      = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abCard   = this.state.m_addressbook.addCard(uri, FORMAT_TB, properties, attributes);

				// msg += " l_winner: " + l_winner + " l_gid: " + l_gid + " l_target: " + l_target + " parent uri: " + uri;

				zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, luid_target ,
				                                                   ZinFeedItem.ATTR_CS, checksum,
				                                                   ZinFeedItem.ATTR_L, l_target));

				zfiGid.set(sourceid_target, luid_target);
				this.state.aReverseGid[sourceid_target][luid_target] = gid;
				break;

			case Suo.ADD | ZinFeedItem.TYPE_FL:
			case Suo.ADD | ZinFeedItem.TYPE_SF:
				var abName = this.state.m_folder_converter.convertForPublic(FORMAT_TB, FORMAT_ZM, zfiWinner);
				var tpi;

				if (!this.state.m_addressbook.getAddressBookUri(abName))
				{
					msg += "About to add a thunderbird addressbook (folder), gid: " + gid + " and luid_winner: " + luid_winner;

					uri = this.state.m_addressbook.newAddressBook(abName);
					tpi = this.state.m_addressbook.getAddressBookPrefId(uri);

					luid_target = zfcTarget.get(ZinFeedItem.KEY_AUTO_INCREMENT).increment('next');

					var name_for_map = this.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfiWinner);

					zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_KEY, luid_target,
					                       ZinFeedItem.ATTR_NAME, name_for_map, ZinFeedItem.ATTR_L, 1,
					                       ZinFeedItem.ATTR_MS, 1, ZinFeedItem.ATTR_TPI, tpi));

					msg += ".  Added: luid_target: " + luid_target + " name_for_map: " + name_for_map + " tpi: " + tpi;

					zfiGid.set(sourceid_target, luid_target);
					this.state.aReverseGid[sourceid_target][luid_target] = gid;
				}
				else
					this.state.m_logger.warn("Was about to create an addressbook: " + abName +
					                         " but it already exists.  This shouldn't happen.");

				break;

			case Suo.MOD | ZinFeedItem.TYPE_CN:
				// there are two scenarios here:
				// 1. the contact's content didn't change, it just got moved from one folder to another (l attribute in the map changed)
				// 2. the contact's content changed (might have changed folders as well)
				// These scenarios are distinguished by whether the zimbra server bumped the rev attribute or not.
				// See: http://wiki/index.php/LedapZimbraSynchronisation#rev_attribute
				// A content change bumps the rev attribute in which case we would have issued a GetContactRequest
				// So in the event of a content change, the source is this.state.aSyncContact[luid_winner],
				// otherwise it's the contact in the thunderbird addressbook.
				//
				luid_target = zfiGid.get(sourceid_target);
				l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key()); // luid of the parent folder in the winner
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];          // gid  of the parent folder
				l_target    = zfcGid.get(l_gid).get(sourceid_target);                     // luid of the winner's parent in the target
				l_current   = zfcTarget.get(luid_target).keyParent();                     // luid of the target's parent before changes

				msg += "About to modify a contact in the addressbook, gid: " + gid;
				msg += " l_winner: " + l_winner + " l_gid: " + l_gid + " l_target: " + l_target + " l_current: " + l_current;

				if (l_target == l_current)
				{
					// if the parent folder hasn't changed, there must have been a content change on the server
					// in which case rev was bumped and we issued a GetContactRequest
					// Now, overwrite the card...
					//
					msg += " - parent folder hasn't changed";

					zinAssertAndLog(isPropertyPresent(this.state.aSyncContact, luid_winner), "luid_winner: " + luid_winner);

					uri    = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					// this.state.m_logger.debug("entryActionUpdateTb: uri: " + uri + " luid_target: " + luid_target);
					abCard = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);
					// this.state.m_logger.debug("entryActionUpdateTb: card: " + abCard);

					if (abCard)
					{
						zc = this.state.aSyncContact[luid_winner];

						attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
						properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

						msg += " setting card to: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						this.state.m_addressbook.updateCard(abCard, uri, FORMAT_TB, properties, attributes);
					}
				}
				else
				{
					msg += " - parent folder changed"; // implement as delete+add

					var uri_from= this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_current));
					var uri_to  = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					abCard      = this.state.m_addressbook.lookupCard(uri_from, TBCARD_ATTRIBUTE_LUID, luid_target);

					if (abCard)
					{
						if (isPropertyPresent(this.state.aSyncContact, luid_winner))
						{
							zc         = this.state.aSyncContact[luid_winner];
							attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
							properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

							msg += " - content changed";
						}
						else
						{
							attributes = this.state.m_addressbook.getCardAttributes(abCard);
							properties = this.state.m_addressbook.getCardProperties(abCard);

							msg += " - content didn't change";
						}

						this.state.m_addressbook.deleteCards(uri_from, [ abCard ]);

						msg += " - card deleted - card added: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						this.state.m_addressbook.addCard(uri_to, FORMAT_TB, properties, attributes);
					}
				}

				if (abCard)
				{
					zinAssert(properties);
					var checksum    = ZinContactConverter.instance().crc32(properties);
					zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, luid_target ,
					                       ZinFeedItem.ATTR_CS, checksum, ZinFeedItem.ATTR_L, l_target));
				}
				else
				{
					luid_target = null;
					this.state.m_logger.warn("Can't find card to modify in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");
				}

				break;

			case Suo.MOD | ZinFeedItem.TYPE_FL:
			case Suo.MOD | ZinFeedItem.TYPE_SF:
				luid_target = zfiGid.get(sourceid_target);
				uri         = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, luid_target));

				if (uri)
				{
					msg += "About to rename a thunderbird addressbook (folder), gid: " + gid + " and luid_winner: " + luid_winner;

					zinAssert(zfiWinner.keyParent() == '1'); // luid of the parent folder in the winner == 1

					var name_winner_public = this.getTbAddressbookNameFromLuid(sourceid_winner, luid_winner);
					var name_winner_map    = this.state.m_folder_converter.convertForMap(FORMAT_TB, FORMAT_ZM, zfiWinner);

					this.state.m_addressbook.renameAddressBook(uri, name_winner_public);

					zfcTarget.get(luid_target).set(ZinFeedItem.ATTR_NAME, name_winner_map);
					zfcTarget.get(luid_target).increment(ZinFeedItem.ATTR_MS);
				}
				else
				{
					this.state.m_logger.warn("Was about to rename an addressbook: " +
					                         this.getTbAddressbookNameFromLuid(sourceid_target, luid_target) +
											 " but it didn't exist.  This shouldn't happen.");

					luid_target = null
				}

				break;

			case Suo.DEL | ZinFeedItem.TYPE_CN:
				luid_target = zfiGid.get(sourceid_target);
				l_target    = zfcTarget.get(luid_target).keyParent();
				uri         = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abCard      = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);

				if (abCard)
				{
					msg += "Card to be deleted: " + this.state.m_addressbook.nsIAbCardToPrintable(abCard);

					this.state.m_addressbook.deleteCards(uri, [ abCard ]);

					zfcTarget.get(luid_target).set(ZinFeedItem.ATTR_DEL, 1);
				}
				else
				{
					this.state.m_logger.warn("Can't find card to delete in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");

					luid_target = null;
				}

				break;

			case Suo.DEL | ZinFeedItem.TYPE_FL:
			case Suo.DEL | ZinFeedItem.TYPE_SF:
				luid_target     = zfiGid.get(sourceid_target);
				var name_target = this.getTbAddressbookNameFromLuid(sourceid_target, luid_target);
				uri             = this.state.m_addressbook.getAddressBookUri(name_target);

				if (uri)
				{
					msg += "Addressbook to be deleted: name: " + name_target + " uri: " + uri;

					this.state.m_addressbook.deleteAddressBook(uri);
					zfcTarget.get(luid_target).set(ZinFeedItem.ATTR_DEL, 1);
				}
				else
				{
					this.state.m_logger.warn("Can't find addressbook to delete in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");

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
// 1. this.state.updateZmPackage maintains state across the soap request + response so that
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
	var sourceid, sourceid_winner, sourceid_target, uri, zfcWinner, zfcWinner, zfiWinner, l_gid, l_winner, l_target, name_winner, type;
	var zuio_target, l_zuio, properties;

	this.state.stopwatch.mark("entryActionUpdateZm");

	if (!this.state.isUpdateZmFailed)
		for (sourceid in this.state.sources)
			if (this.state.sources[sourceid]['format'] == FORMAT_ZM)
				for (var i = 0; i < ORDER_SOURCE_UPDATE.length && !bucket; i++)
					if (isPropertyPresent(this.state.aSuo[sourceid], ORDER_SOURCE_UPDATE[i]))
						for (indexSuo in this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]])
	{
		this.state.m_logger.debug("entryActionUpdateZm: " +
				" opcode: " + Suo.opcodeAsString(ORDER_SOURCE_UPDATE[i] & Suo.MASK) +
				" type: "   + ZinFeedItem.typeAsString(ORDER_SOURCE_UPDATE[i] & ZinFeedItem.TYPE_MASK) +
		        " indexSuo: " + indexSuo +
				" suo: " + this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo].toString());

		suo             = this.state.aSuo[sourceid][ORDER_SOURCE_UPDATE[i]][indexSuo];
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		format_winner   = this.state.sources[sourceid_winner]['format'];
		luid_winner     = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
		zfcWinner       = this.state.sources[suo.sourceid_winner]['zfcLuid'];
		zfcTarget       = this.state.sources[suo.sourceid_target]['zfcLuid'];
		zfiWinner       = zfcWinner.get(luid_winner);

		if (ORDER_SOURCE_UPDATE[i] & ZinFeedItem.TYPE_FL)  // sanity check that we never add/mod/del these folders
			zinAssert(zfiWinner.name() != TB_PAB && zfiWinner.name() != ZM_FOLDER_CONTACTS);

		switch(ORDER_SOURCE_UPDATE[i])
		{
			case Suo.ADD | ZinFeedItem.TYPE_FL:
				zinAssertAndLog(format_winner == FORMAT_ZM ||
				                this.state.m_folder_converter.prefixClass(zfiWinner.name()) ==
				                                                ZinFolderConverter.PREFIX_CLASS_PRIMARY,
				                   "zfiWinner: " + zfiWinner.toString());
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);
				soap.method = "CreateFolder";
				soap.arg    = newObject(ZinFeedItem.ATTR_NAME, name_winner, ZinFeedItem.ATTR_L, '1');
				soap.zid    = null;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to add folder name: " + name_winner + " l: " + '1';
				break;

			case Suo.ADD | ZinFeedItem.TYPE_CN:
				l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
				l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);

				if (zfcTarget.get(l_target).type() == ZinFeedItem.TYPE_SF)
					l_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, l_target, ZinFeedItem.TYPE_FL);

				l_zuio      = new Zuio(l_target);
				properties  = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
				soap.method = "CreateContact";
				soap.arg    = newObject('properties', properties, ZinFeedItem.ATTR_L, l_zuio.id);
				soap.zid    = l_zuio.zid;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to add contact: ";
				break;

			case Suo.MOD | ZinFeedItem.TYPE_FL:
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

				if (zfcTarget.get(luid_target).type() == ZinFeedItem.TYPE_SF)
				{
					luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, ZinFeedItem.TYPE_LN);
					soap.luid_target = luid_target;
				}

				// sanity check that we never modify any of zimbra's immutable folders
				zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "id: " + luid_target + "folder name: " + name_winner);

				soap.method = "FolderAction";
				soap.arg    = newObject('id', luid_target, 'op', 'update', ZinFeedItem.ATTR_NAME, name_winner);
				soap.zid    = null;
				bucket      = ORDER_SOURCE_UPDATE[i];
				msg        += " about to rename folder: ";
				break;

			case Suo.MOD | ZinFeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				l_winner    = SyncFsm.keyParentRelevantToGid(zfcWinner, zfiWinner.key());
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
				l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);

				if (zfcTarget.get(l_target).type() == ZinFeedItem.TYPE_SF)
					l_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, l_target, ZinFeedItem.TYPE_FL);

				zuio_target = new Zuio(luid_target);
				l_zuio      = new Zuio(l_target);
				msg        += " about to modify contact: ";
				soap.zid    = zuio_target.zid;
				soap.method = null;


				if (this.state.sources[sourceid_winner]['format'] == FORMAT_TB) // always a content update 
					soap.method = "ModifyContact";
				else
				{
					// look at the pre-update zfi:
					// if rev was bumped ==> content update  ==> ModifyContactRequest ==> load content from zc
					// if ms  was bumped ==> attributes only ==> ContactActionRequest ==> load content from zc
					//
					var zfi = this.state.zfcPreUpdateWinners.get(suo.gid);
					var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));

					soap.method = (zfi.get(ZinFeedItem.ATTR_REV) > lso.get(ZinFeedItem.ATTR_REV)) ? "ModifyContact" : "ContactAction";
				}

				if (soap.method == "ModifyContact")
				{
					properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
					soap.arg   = newObject('id', zuio_target.id, 'properties', properties, ZinFeedItem.ATTR_L, l_zuio.id);
					bucket     = ORDER_SOURCE_UPDATE[i];
				}
				else if (soap.method == "ContactAction")
				{
					soap.arg   = newObject('id', zuio_target.id, 'op', 'move', ZinFeedItem.ATTR_L, l_zuio.id);
					bucket     = ORDER_SOURCE_UPDATE[i];
				}
				else
					zinAssert(false);
				break;

			case Suo.DEL | ZinFeedItem.TYPE_FL:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				name_winner = this.state.m_folder_converter.convertForPublic(FORMAT_ZM, format_winner, zfiWinner);

				if (zfcTarget.get(luid_target).type() == ZinFeedItem.TYPE_SF)
				{
					luid_target = SyncFsm.luidFromLuidTypeSf(zfcTarget, luid_target, ZinFeedItem.TYPE_LN);
					soap.luid_target = luid_target;
				}

				zinAssertAndLog(luid_target >= ZM_FIRST_USER_ID, "luid_target: " + luid_target);

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
				// soap.arg     = newObject('id', luid_target, 'op', 'move', ZinFeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
				// with op=update, the server does the move before the rename so still fails because of folder name conflict in Trash
				// soap.arg     = newObject('id', luid_target, 'op', 'update', ZinFeedItem.ATTR_NAME, newname, ZinFeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
				soap.arg     = newObject('id', luid_target, 'op', 'rename', ZinFeedItem.ATTR_NAME, newname);
				break;

			case Suo.DEL | ZinFeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);

				if (zfcTarget.get(luid_target).isForeign())
				{
					zuio        = new Zuio(luid_target);
					zc = this.state.aSyncContact[luid_target]; // the ZimbraContact object that arrived via GetContactResponse
					zinAssert(typeof(zc != 'undefined'));
					properties = ZinContactConverter.instance().convert(FORMAT_ZM, FORMAT_ZM, zc.element);
					soap.method = "ForeignContactDelete";
					soap.arg    = newObject('properties', properties, 'id', zuio.id, 'zid', zuio.zid);
					soap.zid    = null;
					bucket      = ORDER_SOURCE_UPDATE[i];
					msg        += " about to copy foreign contact to trash then delete it.";
				}
				else
				{
					soap.method = "ContactAction";
					soap.arg    = newObject('id', luid_target, 'op', 'move', ZinFeedItem.ATTR_L, ZM_ID_FOLDER_TRASH);
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

	this.state.updateZmPackage = null;

	if (bucket)
	{
		this.state.updateZmPackage = newObject('sourceid', sourceid, 'bucket', bucket, 'indexSuo', indexSuo, 'soap', soap);

		this.state.m_logger.debug("entryActionUpdateZm: updateZmPackage: " + aToString(this.state.updateZmPackage));

		this.setupHttpSoap(state, 'evRepeat', this.state.zidbag.soapUrl(soap.zid), soap.zid, soap.method, soap.arg);

		continuation('evSoapRequest');
	}
	else
	{
		this.state.m_soap_state.m_response = null;
		continuation('evNext');
	}
}

SyncFsm.prototype.exitActionUpdateZm = function(state, event)
{
	if (!this.state.m_soap_state.m_response || event == "evCancel")
		return;

	var msg, xpath_query, functor;
	var response = this.state.m_soap_state.m_response;
	var change = newObject('acct', null);
	var updateZmPackage = this.state.updateZmPackage;
	var msg = "exitActionUpdateZm: ";
	var suo = this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

	var is_response_understood = false;

	ZinXpath.setConditional(change, 'token', "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);
	ZinXpath.setConditional(change, 'acct',  "/soap:Envelope/soap:Header/z:context/z:change/attribute::acct",  response, null);

	// TODO check that change.acct matches the zid in updateZmPackage

	if (!isPropertyPresent(change, 'token'))
	{
		this.state.m_logger.error("No change token found.  This shouldn't happen.  Ignoring soap response.");

		delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket];  // drastic, but it ensures we don't end up in a loop

		return;
	}

	this.state.m_logger.debug("exitActionUpdateZm: " + aToString(updateZmPackage) + " change.token: " + change.token + " change.acct: " + change.acct) ;

	var functor_create_blah_response = {
		state: this.state,

		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var l    = attribute[ZinFeedItem.ATTR_L];
			var id   = attribute[ZinFeedItem.ATTR_ID];
			var type = updateZmPackage.bucket & ZinFeedItem.TYPE_MASK;

			is_response_understood = true;

			if (updateZmPackage.soap.method == "CreateFolder")
				msg += "created: <folder id='" + id + "' l='" + l + "' name='" + attribute['name'] + "'>";
			else if (updateZmPackage.soap.method == "CreateContact")
				msg += "created: <cn id='" + id +"' l='" + l + "'>";
			else if (updateZmPackage.soap.method == "ModifyContact")
				msg += "modified: <cn id='" + id + "'>";

			if (change.acct)
				msg += " in acct zid: " + change.acct;

			if (!isPropertyPresent(attribute, ZinFeedItem.ATTR_ID) || !isPropertyPresent(attribute, ZinFeedItem.ATTR_L))
				this.state.m_logger.error("<folder> element received seems to be missing an 'id' or 'l' attribute - ignoring: " + aToString(attribute));
			else
			{
				delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				var zfiGid = this.state.zfcGid.get(suo.gid);
				zfcTarget = this.state.sources[suo.sourceid_target]['zfcLuid'];
				var key = Zuio.key(id, change.acct);
				var zfi;

				attribute[ZinFeedItem.ATTR_KEY] = key;

				if (updateZmPackage.soap.method == "ModifyContact")
				{
					zfi = zfcTarget.get(key);
					zfi.set(attribute)
					zfi.set(ZinFeedItem.ATTR_MS, change.token);
					SyncFsm.setLsoToGid(zfiGid, zfi);
					msg += " - updated luid and gid"; 
				}
				else
				{
					zfi = new ZinFeedItem(type, attribute);
					zfi.set(ZinFeedItem.ATTR_MS, change.token);
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
			var type = updateZmPackage.bucket & ZinFeedItem.TYPE_MASK;

			msg += " recieved: <action id='" + id + "'>";

			is_response_understood = true;

			if (!isPropertyPresent(attribute, 'id'))
				this.state.m_logger.error("<action> element received seems to be missing an 'id' attribute - ignoring: " + aToString(attribute));
			else
			{
				delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				var zfcTarget   = this.state.sources[suo.sourceid_target]['zfcLuid'];
				var luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
				var zfiTarget   = zfcTarget.get(luid_target);
				var key         = Zuio.key(id, change.acct);
				var zfiRelevantToGid;

				if (isPropertyPresent(updateZmPackage.soap, 'luid_target'))
					zfiTarget = zfcTarget.get(updateZmPackage.soap.luid_target);  // used in MOD | TYPE_FL

				if (updateZmPackage.bucket == (Suo.DEL | ZinFeedItem.TYPE_FL) ||
				   (updateZmPackage.bucket == (Suo.DEL | ZinFeedItem.TYPE_LN) ))
					zfiTarget.set(ZinFeedItem.ATTR_L, ZM_ID_FOLDER_TRASH); // the folder got "renamed" into trash so fake the l attribute
				else
				{
					updateZmPackage.soap.arg[ZinFeedItem.ATTR_KEY] = key;
					zfiTarget.set(updateZmPackage.soap.arg);
				}

				zfiTarget.set(ZinFeedItem.ATTR_MS, change.token);

				if (zfiTarget.type() == ZinFeedItem.TYPE_LN)
				{
					SyncFsm.updateSharedFolderItem(zfcTarget, key);
					zfiRelevantToGid = zfcTarget.get(zfiTarget.get(ZinFeedItem.ATTR_SKEY));
				}
				else
					zfiRelevantToGid = zfiTarget;

				SyncFsm.setLsoToGid(this.state.zfcGid.get(suo.gid), zfiRelevantToGid);

				if (updateZmPackage.bucket == Suo.DEL | ZinFeedItem.TYPE_FL)
				{
					// iterate through aSuo, and remove operations that delete child contacts of this folder (now in Trash)
					//
					var aSuoDelContacts = this.state.aSuo[suo.sourceid_target][Suo.DEL | ZinFeedItem.TYPE_CN];

					for (var indexSuo in aSuoDelContacts)
					{
						suo         = aSuoDelContacts[indexSuo];
						luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
						l_target    = SyncFsm.keyParentRelevantToGid(zfcTarget, luid_target);

						if (key == l_target)
						{
							msg += " - removing operation to delete child contact: " + indexSuo;
							delete aSuoDelContacts[indexSuo]; // no need to update maps - the contacts haven't changed
						}
					}
				}

				msg += " - luid map updated - new zfi: " + zfcTarget.get(luid_target);
			}
		}
	};

	var functor_foreign_contact_delete_response = {
		state: this.state,
		run: function(doc, node)
		{
			var zfcTarget = this.state.sources[suo.sourceid_target]['zfcLuid'];
			var key       = Zuio.key(updateZmPackage.soap.arg.id, updateZmPackage.soap.arg.zid);

			zfcTarget.get(key).set(ZinFeedItem.ATTR_DEL, 1);

			msg += " recieved: BatchResponse - marking as deleted: key: " + key;

			is_response_understood = true;

			delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];
		}
	};

	switch(updateZmPackage.bucket)
	{
		case Suo.ADD | ZinFeedItem.TYPE_FL:
			xpath_query = "/soap:Envelope/soap:Body/zm:CreateFolderResponse/zm:folder";
			functor = functor_create_blah_response;
			break;
		case Suo.ADD | ZinFeedItem.TYPE_CN:
			xpath_query = "/soap:Envelope/soap:Body/zm:CreateContactResponse/zm:cn";
			functor = functor_create_blah_response;
			break;
		case Suo.MOD | ZinFeedItem.TYPE_FL:
			xpath_query = "/soap:Envelope/soap:Body/zm:FolderActionResponse/zm:action";
			functor = functor_action_response;
			break;
		case Suo.MOD | ZinFeedItem.TYPE_CN:
			if (updateZmPackage.soap.method == "ModifyContact")
			{
				xpath_query = "/soap:Envelope/soap:Body/zm:ModifyContactResponse/zm:cn";
				functor = functor_create_blah_response;
			}
			else if (updateZmPackage.soap.method == "ContactAction")
			{
				xpath_query = "/soap:Envelope/soap:Body/zm:ContactActionResponse/zm:action";
				functor = functor_action_response;
			}
			else
				zinAssert(false);
			break;
		case Suo.DEL | ZinFeedItem.TYPE_FL:
			xpath_query = "/soap:Envelope/soap:Body/zm:FolderActionResponse/zm:action";
			functor = functor_action_response;
			break;
		case Suo.DEL | ZinFeedItem.TYPE_CN:
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

	ZinXpath.runFunctor(functor, xpath_query, this.state.m_soap_state.m_response);

	if (!is_response_understood)
	{
		msg += " - soap response didn't match xpath query: " + xpath_query;

		this.state.stopFailCode   = 'FailOnUnableToUpdateZm';

		this.state.stopFailDetail = stringBundleString("statusFailOnUnableToUpdateZmDetail");
		this.state.stopFailDetail += " " + updateZmPackage.soap.method + " " + aToString(updateZmPackage.soap.arg);

		this.state.isUpdateZmFailed = true;
	}

	this.state.m_logger.debug(msg);

	if (aToLength(this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket]) == 0)
	{
		delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket];  // delete empty buckets
		this.state.m_logger.debug("deleted aSuo sourceid: " + sourceid + " bucket: " + updateZmPackage.bucket);
	}
}

SyncFsm.luidFromLuidTypeSf = function(zfcTarget, luid_target, item_type)
{
	zinAssertAndLog(item_type == ZinFeedItem.TYPE_FL || item_type == ZinFeedItem.TYPE_LN, "invalid argument: item_type: " + item_type);

	var sf_attribute = (item_type == ZinFeedItem.TYPE_FL) ? ZinFeedItem.ATTR_FKEY : ZinFeedItem.ATTR_LKEY;

	zinAssertAndLog(zfcTarget.get(luid_target).isPresent(sf_attribute), "luid_target: " + luid_target);

	luid_target = zfcTarget.get(luid_target).get(sf_attribute); // the TYPE_LN item - ie the <link> element

	zinAssertAndLog(zfcTarget.get(luid_target).type() == item_type, "luid_target: " + luid_target);

	if (item_type == ZinFeedItem.TYPE_LN)
		zinAssertAndLog(!zfcTarget.get(luid_target).isForeign(), "luid_target: " + luid_target);

	return luid_target;
}

SyncFsm.prototype.getContactFromLuid = function(sourceid, luid, format_to)
{
	var zfc = this.state.sources[sourceid]['zfcLuid'];
	var zfi = zfc.get(luid);
	var ret = null;

	zinAssert(zfi.type() == ZinFeedItem.TYPE_CN);

	if (this.state.sources[sourceid]['format'] == FORMAT_TB)
	{
		var l   = zfi.keyParent();
		var uri = this.state.m_addressbook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid, l));

		// this.state.m_logger.debug("getContactFromLuid: sourceid: " + sourceid + " luid: " + luid + "uri: " + uri +
		//                               "l: " + l + " abName: " + this.getTbAddressbookNameFromLuid(sourceid, l) );

		var abCard = this.state.m_addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

		if (abCard)
		{
			ret = this.state.m_addressbook.getCardProperties(abCard);
			ret = ZinContactConverter.instance().convert(format_to, FORMAT_TB, ret);
		}
		else
			this.state.m_logger.warn("can't find contact for to sourceid: " + sourceid + " and luid: " + luid + " in thunderbird addressbook uri: " + uri + " - this shouldn't happen.");
	}
	else
	{
		if (isPropertyPresent(this.state.aSyncContact, luid))
		{
			var zc = this.state.aSyncContact[luid]; // the ZimbraContact object that arrived via GetContactResponse
			ret = ZinContactConverter.instance().convert(format_to, FORMAT_ZM, zc.element);
		}
		else
			ret = "contact sourceid: " + sourceid + " luid: " + luid;
	}

	return ret;
}

SyncFsm.prototype.entryActionUpdateCleanup = function(state, event, continuation)
{
	var nextEvent = 'evNext';

	this.state.stopwatch.mark("entryActionUpdateCleanup");

	if (!this.state.isUpdateZmFailed)
	{
		var gid;
		var aGidsToDelete = new Array();

		this.state.m_logger.debug("UpdateCleanup: zfcTb:\n" + this.zfcTb().toString());
		this.state.m_logger.debug("UpdateCleanup: zfcZm:\n" + this.zfcZm().toString());

		// this.state.m_logger.debug("UpdateCleanup: zfcGid: " + this.state.zfcGid.toString());

		//  delete the luid item if it has a DEL attribute or (zimbra: it's not of interest)
		//  delete the mapping between a gid and an luid when the luid is not of interest
		//
		var functor_foreach_luid = {
			state: this.state,
			run: function(zfi)
			{
				var luid = zfi.key();
				var gid = isPropertyPresent(this.state.aReverseGid[sourceid], luid) ? this.state.aReverseGid[sourceid][luid] : null;
				var zfc = this.state.sources[sourceid]['zfcLuid'];

				// delete luids and their link to the gid when ZinFeedItem.ATTR_DEL is set or when the item is no longer of interest
				// eg because a contact's parent folder got deleted and we removed the Suo's there were going to delete the child contacts
				//
				if (zfi.isPresent(ZinFeedItem.ATTR_DEL) || !SyncFsm.isOfInterest(zfc, luid))
				{
					zfc.del(luid);
					this.state.m_logger.debug("UpdateCleanup: sourceid: " + sourceid + " - deleted luid: " + luid);

					if (gid)
					{
						this.state.zfcGid.get(gid).del(sourceid);
						delete this.state.aReverseGid[sourceid][luid];

						this.state.m_logger.debug("UpdateCleanup: gid: " + gid + " - deleted reference to sourceid: " + sourceid);
					}
				}

				return true;
			}
		};

		for (sourceid in this.state.sources)
			this.state.sources[sourceid]['zfcLuid'].forEach(functor_foreach_luid);

		// delete the gid when all the mapitems source maps have a ZinFeedItem.ATTR_DEL attribute
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

				zfi.forEach(functor_count_luids_in_gid, ZinFeedItem.ITER_GID_ITEM);

				this.state.m_logger.debug("UpdateCleanup: zfi: " + zfi.toString() + " count: " + functor_count_luids_in_gid.count);

				if (functor_count_luids_in_gid.count == 0)
				{
					this.state.m_logger.debug("UpdateCleanup: gid: " + zfi.key() + " had no luid properties - deleted.");
					this.state.zfcGid.del(zfi.key());
				}

				return true;
			}
		};

		this.state.zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_NON_RESERVED);

		if (!this.isConsistentDataStore())
			this.state.stopFailCode   = 'FailOnIntegrityDataStoreOut'; // this indicates a bug in our code
	}

	if (this.state.stopFailCode != null)
		nextEvent = 'evLackIntegrity';

	continuation(nextEvent);
}

SyncFsm.prototype.entryActionCommit = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionCommit");

	this.state.m_logger.debug("entryActionCommit: soapURL: "  + this.state.sources[this.state.sourceid_zm]['soapURL']);
	this.state.m_logger.debug("entryActionCommit: username: " + this.state.sources[this.state.sourceid_zm]['username']);

	this.state.zfcLastSync.get(this.state.sourceid_zm).set('soapURL',   this.state.sources[this.state.sourceid_zm]['soapURL']);
	this.state.zfcLastSync.get(this.state.sourceid_zm).set('username',  this.state.sources[this.state.sourceid_zm]['username']);

	for (zid in this.state.zidbag.m_properties)
		this.state.zfcLastSync.get(this.state.sourceid_zm).set(Zuio.key('SyncToken', zid), this.state.zidbag.get(zid, 'SyncToken'));

	this.state.zfcLastSync.save();

	this.state.zfcGid.save();

	for (var sourceid in this.state.sources)
		this.state.sources[sourceid]['zfcLuid'].save();

	continuation('evNext');
}

SyncFsm.prototype.entryActionFinal = function(state, event, continuation)
{
	this.state.stopwatch.mark("entryActionFinal");

	this.state.m_logappender.close();
}

SyncFsm.prototype.suoOpcode = function(suo)
{
	var type = this.feedItemTypeFromGid(suo.gid, suo.sourceid_winner);

	return (type | suo.opcode);
}

SyncFsm.prototype.zfcTb = function() { return this.state.sources[this.state.sourceid_tb]['zfcLuid']; }
SyncFsm.prototype.zfcZm = function() { return this.state.sources[this.state.sourceid_zm]['zfcLuid']; }

// if there's no ver in the gid, add it and reset the zfi ls
// else if the zfi ls doesn't match either the zfi or the gid attributes, bump the gid's ver and reset the zfi's ls
// otherwise do nothing
//
SyncFsm.prototype.resetLsoVer = function(gid, zfi)
{
	var lsoFromZfiAttributes = new Lso(zfi);
	var lsoFromLsAttribute   = zfi.isPresent(ZinFeedItem.ATTR_LS) ? new Lso(zfi.get(ZinFeedItem.ATTR_LS)) : null;
	var zfiGid = this.state.zfcGid.get(gid);
	var ver    = null;

	if (!zfiGid.isPresent(ZinFeedItem.ATTR_VER))
	{
		ver = 1;
		zfiGid.set(ZinFeedItem.ATTR_VER, ver);
	}
	else if (lsoFromLsAttribute == null ||
	        lsoFromLsAttribute.get(ZinFeedItem.ATTR_VER) != zfiGid.get(ZinFeedItem.ATTR_VER) ||
			lsoFromLsAttribute.compare(zfi) != 0 )
	{
		this.state.zfcGid.get(gid).increment(ZinFeedItem.ATTR_VER);
		ver = zfiGid.get(ZinFeedItem.ATTR_VER);
	}

	if (ver)
	{
		lsoFromZfiAttributes.set(ZinFeedItem.ATTR_VER, ver);
		zfi.set(ZinFeedItem.ATTR_LS, lsoFromZfiAttributes.toString());
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

	zinAssertAndLog(zfc.isPresent(luid), "sourceid: " + sourceid + " luid: " + luid);

	var ret  = this.state.m_folder_converter.convertForPublic(FORMAT_TB, format, zfc.get(luid));

	return ret;
}

SyncFsm.prototype.isLsoVerMatch = function(gid, zfi)
{
	var ret = false;

	if (zfi.isPresent(ZinFeedItem.ATTR_LS))
	{
		var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));

		if (lso.get(ZinFeedItem.ATTR_VER) == this.state.zfcGid.get(gid).get(ZinFeedItem.ATTR_VER))
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
	var ver = zfiGid.get(ZinFeedItem.ATTR_VER);

	lso.set(ZinFeedItem.ATTR_VER, ver);

	zfiTarget.set(ZinFeedItem.ATTR_LS, lso.toString());
}

SyncFsm.getTopLevelFolderHash = function(zfc, attr_key, attr_value, iter_flavour)
{
	var result = new Object();

	var functor =
	{
		type_fl:  ZinFeedItem.typeAsString(ZinFeedItem.TYPE_FL),

		run: function(zfi)
		{
			if (zfi.get(ZinFeedItem.ATTR_TYPE) == this.type_fl && zfi.get(ZinFeedItem.ATTR_L) == '1')
				result[zfi.get(attr_key)] = zfi.get(attr_value);

			return true;
		}
	};

	zfc.forEach(functor, iter_flavour);

	return result;
}

SyncFsm.keyParentRelevantToGid = function(zfc, key)
{
	zinAssert(zfc.get(key).type() == ZinFeedItem.TYPE_CN);

	var ret = zfc.get(key).keyParent();

	if (zfc.isPresent(ret))
	{
		var zfi = zfc.get(ret);

		if (zfi.isForeign())
		{
			if (zfi.type() == ZinFeedItem.TYPE_FL)
				ret = zfi.get(ZinFeedItem.ATTR_SKEY);
			else
				zinAssertAndLog(false, "something is wrong: zfi: " + zfi.toString() + " key: " + key);
		}
	}

	return ret;
}

// <link> elements (ie TYPE_LN) and foreign <folder> elements (ie TYPE_FL with a zid component in it's key)
// are represented in the gid by a facade element: TYPE_SF.
//
SyncFsm.isRelevantToGid = function(zfc, key)
{
	var ret;

	zinAssertAndLog(SyncFsm.isOfInterest(zfc, key), "key not of interest: " + key);

	var zfi = zfc.get(key);

	switch (zfi.type())
	{
		case ZinFeedItem.TYPE_LN: ret = false;            break;
		case ZinFeedItem.TYPE_SF: ret = true;             break;
		case ZinFeedItem.TYPE_CN: ret = true;             break;
		case ZinFeedItem.TYPE_FL: ret = !zfi.isForeign(); break;
		default:
			zinAssertAndLog(false, "unmatched case: " + zfi.type());
	}

	// gLogger.debug("isRelevantToGid: blah: zfi: " + zfi.toString() + " returns: " + ret);

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
	// gLogger.debug("SyncFsm.isOfInterest: blah: key: " + key + " arguments.length: " + arguments.length +
	//               " zfc: " + (zfc ? "non-null" : "null") + " zfc.isPresent(key): " + zfc.isPresent(key));

	zinAssertAndLog(arguments.length == 2 && zfc && key, "arguments.length: " + arguments.length + " key: " + key);

	var ret = null;

	if (!zfc.isPresent(key))
		ret = false;
	else
	{
		var zfi = zfc.get(key);

		switch (zfi.type())
		{
			case ZinFeedItem.TYPE_SF:
			case ZinFeedItem.TYPE_LN:
				ret = (zfi.get(ZinFeedItem.ATTR_L) == 1); // if present, must be a top-level folder
				break;

			case ZinFeedItem.TYPE_FL:
				if (!zfi.isForeign())
					ret = (zfi.get(ZinFeedItem.ATTR_L) == 1);
				else
				{
					// would like to only use ATTR_SKEY to find the TYPE_SF item but if ATTR_SKEY isn't present, we have to
					// linear search through the map for the TYPE_SF because this function is called from SyncResponse processing
					// in which the ATTR_SKEY attributes haven't yet been added
					//
					ret = (zmPermFromZfi(zfi) != ZM_PERM_NONE);

					if (ret)
						if (zfi.isPresent(ZinFeedItem.ATTR_SKEY))
							ret = SyncFsm.isOfInterest(zfc, zfi.get(ZinFeedItem.ATTR_SKEY));
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

			case ZinFeedItem.TYPE_CN:
				// not sure how a contact could end up at the very top level but it might be possible!
				zinAssert(zfc.isPresent(key));
				ret = (zfi.get(ZinFeedItem.ATTR_L) == 1) ? false : SyncFsm.isOfInterest(zfc, SyncFsm.keyParentRelevantToGid(zfc, key));
				break;

			default:
				zinAssertAndLog(false, "unmatched case: " + zfi.type());
		}
	}

	// gLogger.debug("SyncFsm.isOfInterest: blah: key: " + key + " returns: " + ret);

	return ret;
}

// note: this function takes a variable number of arguments following the "method" parameter
// Function.length below returns the number of formal arguments
//
SyncFsm.prototype.setupHttpSoap = function(state, eventOnResponse, url, zid, method)
{
	// this.state.m_logger.debug("setupHttpSoap: blah: " +
	//                           " state: " + state + " eventOnResponse: " + eventOnResponse + " url: " + url +
	//                           " method: " + method + " evNext will be: " + this.fsm.m_transitions[state][eventOnResponse]);

	zinAssert(url != null);

	var args = new Array();
	for (var i = SyncFsm.prototype.setupHttpSoap.length; i < arguments.length; i++)
		args.push(arguments[i]);

	this.state.m_soap_state = new SoapState();
	this.state.m_soap_state.m_url    = url;
	this.state.m_soap_state.m_method = method;
	this.state.m_soap_state.m_zsd.context(this.state.authToken, zid, (method != "ForeignContactDelete"));
	this.state.m_soap_state.m_zsd[method].apply(this.state.m_soap_state.m_zsd, args);

	this.setupHttpCommon(state, eventOnResponse);
}

SyncFsm.prototype.setupHttpHead = function(state, eventOnResponse, url)
{
	this.state.m_soap_state = new SoapState();
	this.state.m_soap_state.m_method = 'HEAD';

	this.setupHttpCommon(state, eventOnResponse);
}

SyncFsm.prototype.setupHttpCommon = function(state, eventOnResponse)
{
	this.fsm.m_transitions['stSoapResponse']['evNext'] = this.fsm.m_transitions[state][eventOnResponse];

	if (this.fsm.m_a_exit[state])
	{
		this.fsm.m_a_exit['stSoapResponse'] = this.fsm.m_a_exit[state];

		this.state.m_soap_state.m_restore_exit_function = this.fsm.m_a_exit[state]
		this.state.m_soap_state.m_restore_exit_state  = state;

		this.fsm.m_a_exit[state] = null;
	}
	else
		this.fsm.m_a_exit['stSoapResponse'] = this.exitActionSoapResponse;
}

SyncFsm.prototype.entryActionSoapRequest = function(state, event, continuation)
{
	var context  = this;
	var soapstate = this.state.m_soap_state;
	var httpBody;

	zinAssert(!soapstate.is_cancelled);
	zinAssert(soapstate.isPreResponse());
	zinAssert(!soapstate.isPostResponse());
	zinAssert(soapstate.isStateConsistent());

	soapstate.m_xhr = new XMLHttpRequest();
	soapstate.m_xhr.onreadystatechange = closureToHandleXmlHttpResponse(context, continuation);

	this.state.cCallsToSoap++;

	this.state.m_logger.debug("soap request: #" + this.state.cCallsToSoap + ": " + soapstate.m_zsd.toStringFiltered());

	if (soapstate.m_method == 'HEAD')
	{
		// this code works, it's just never used because the Zimbra server doesn't support http HEAD requests
		// keeping this code because but the server might support HEAD in the future, see:
		// http://bugzilla.zimbra.com/show_bug.cgi?id=22277
		//
		soapstate.m_xhr.open('HEAD', soapstate.m_url, true);
		httpBody = null;
	}
	else
	{
		soapstate.m_xhr.open("POST", soapstate.m_url, true);

		httpBody = soapstate.m_zsd.doc;
	}

	soapstate.m_xhr.send(httpBody);
}

function closureToHandleXmlHttpResponse(context, continuation)
{
	var ret = function()
	{
		if (context.state.m_soap_state.m_xhr.readyState == 4)
			context.handleXmlHttpResponse(continuation, context);
	}

	return ret;
}

SyncFsm.prototype.handleXmlHttpResponse = function (continuation, context)
{
	var soapstate = context.state.m_soap_state;
	var response = soapstate.m_xhr.responseXML;
	var msg = "handleXmlHttpResponse: ";

	if (soapstate.is_cancelled)
	{
		soapstate.m_http_status_code = HTTP_STATUS_ON_CANCEL;
		msg += " cancelled - set m_http_status_code to: " + soapstate.m_http_status_code;
	}
	else
	{
		try {
			soapstate.m_http_status_code = soapstate.m_xhr.status;
			msg += " http status: " + soapstate.m_http_status_code;
		}
		catch(e) {
			soapstate.m_http_status_code = HTTP_STATUS_ON_SERVICE_FAILURE;
			msg += " http status faked: " + soapstate.m_http_status_code + " after soapstate.m_xhr.status threw an exception: " + e;
		}

		if (response)
		{
			var nodelist = response.getElementsByTagNameNS(ZimbraSoapDocument.NS_SOAP_ENVELOPE, "Fault");

			if (nodelist.length > 0)
			{
				soapstate.faultLoadFromXml(response);
				msg += " fault xml: " + soapstate.m_fault_element_xml;
			}
			else if (soapstate.m_http_status_code == HTTP_STATUS_200_OK)
			{
				soapstate.m_response = response;

				msg += " response: " + xmlDocumentToString(response);
			}
		}
	}

	context.state.m_logger.debug(msg);

	continuation('evNext');
}

SyncFsm.prototype.entryActionSoapResponse = function(state, event, continuation)
{
	var soapstate = this.state.m_soap_state;
	var nextEvent = null;

	zinAssertAndLog(soapstate.isPostResponse(), soapstate.toString());
	zinAssertAndLog(soapstate.isStateConsistent(), soapstate.toString());

	if (soapstate.m_restore_exit_function) // if setupHttpSoap zapped the exit method of the state that called it, restore it...
		this.fsm.m_a_exit[soapstate.m_restore_exit_state] = soapstate.m_restore_exit_function;

	// For "CheckLicense", the fault varies depending on open-source vs non-open-source server:
	//                           soapstate.m_faultcode == "service.UNKNOWN_DOCUMENT" or <soap:faultcode>soap:Client</soap:faultcode>
	// For "FakeHead", we expect soapstate.m_faultcode == "service.UNKNOWN_DOCUMENT" or no response at all if the url was dodgy
	//

	if (soapstate.is_cancelled)
		nextEvent = 'evCancel';
	else if (soapstate.m_method == "CheckLicense" && soapstate.m_fault_element_xml)
		nextEvent = 'evNext';
	else if (soapstate.m_method == "FakeHead")
		nextEvent = 'evNext';
	else if (soapstate.m_response && !soapstate.m_fault_element_xml)
	{
		var method = (soapstate.m_method == "ForeignContactDelete") ? "Batch" : soapstate.m_method;
		var node = ZinXpath.getSingleValue(ZinXpath.queryFromMethod(method), soapstate.m_response, soapstate.m_response);

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
			soapstate.is_mismatched_response = true;
			this.state.m_logger.error("soap response isn't a fault and doesn't match our request - about to cancel");
		}
	}
	else 
	{
		var msg = "SOAP error: method: " + soapstate.m_method;  // note that we didn't say "fault" here - could be a sending/service error

		if (soapstate.m_http_status_code != null && soapstate.m_http_status_code != HTTP_STATUS_200_OK)
			msg += " m_http_status_code == " + soapstate.m_http_status_code;

		if (soapstate.m_fault_element_xml)
			msg += " fault fields as shown: " + soapstate.toString();

		this.state.m_logger.debug(msg);

		nextEvent = 'evCancel';
	}

	// this.state.m_logger.debug("entryActionSoapResponse: calls continuation with: " + nextEvent);

	continuation(nextEvent); // the state that this corresponds to in the transitions table was set by setupHttpSoap()
}

SyncFsm.prototype.exitActionSoapResponse = function(state, event)
{
	// this method's entry in the m_a_exit table may be overwritten by setupHttpSoap
	// otherwise, do nothing...
}

function SoapState()
{
	this.m_zsd                   = new ZimbraSoapDocument();
	this.m_url                   = null;  // the url used in the HTTP POST
	this.m_method                = null;  // the prefix of the soap method, eg: "Auth" or "GetContacts"
	this.m_xhr                   = null;  // the XMLHttpRequest object

	this.m_response              = null;  // SOAPResponse.message - the xml soap message response
	this.m_http_status_code      = null;
	this.m_faultcode             = null;  // These are derived from the soap fault element
	this.m_fault_element_xml     = null;  // the soap:Fault element as string xml
	this.m_fault_detail          = null;
	this.m_faultstring           = null;
	this.m_restore_exit_function = null;  // the exit action to be restored
	this.m_restore_exit_state    = null;  // the state that the restored exit action belongs to
	this.is_cancelled            = false;
	this.is_mismatched_response  = false;

	zinAssert(this.isStateConsistent());
	zinAssert(this.isPreResponse());
	zinAssert(!this.is_cancelled);
	zinAssert(!this.isPostResponse());
}

SoapState.prototype.failCode = function()
{
	var ret;

	zinAssertAndLog(this.m_xhr && this.isFailed(), "SoapState: " + this.toString()); // don't come in here unless we've failed...

	if (this.is_cancelled)                                              ret = 'FailOnCancel';
	else if (this.is_mismatched_response)                               ret = 'FailOnMismatchedResponse';
	else if (this.m_fault_element_xml != null)                          ret = 'FailOnFault';
	else if (this.m_http_status_code == HTTP_STATUS_ON_SERVICE_FAILURE) ret = 'FailOnService';
	else                                                                ret = 'FailOnUnknown';  // this really is unknown

	if (ret == 'FailOnUnknown')
		newZinLogger("SoapState").debug("failCode: " + ret + " and this: " + this.toString());

	return ret;
}

SoapState.prototype.isFailed = function()
{
	return this.isPostResponse() && (this.m_http_status_code != HTTP_STATUS_200_OK);
}

SoapState.prototype.isStateConsistent = function()
{
	return this.isPreResponse() || this.isPostResponse();
}

SoapState.prototype.isPostResponse = function()
{
	return (this.m_http_status_code != null);
}

// pre-request would be m_xhr == null
//
SoapState.prototype.isPreResponse = function()
{
	return (this.m_response == null) && (this.m_http_status_code == null) && (this.m_faultcode == null) &&
	       (this.m_fault_element_xml == null) && (this.m_fault_detail == null) && (this.m_faultstring == null);
}

// load from xml - a SOAPResponse.message or SOAPFault.element
//
SoapState.prototype.faultLoadFromXml = function(doc)
{
	var nodelist;
	
	this.m_fault_element_xml = xmlDocumentToString(doc);

	conditionalGetElementByTagNameNS(doc, ZimbraSoapDocument.NS_SOAP_ENVELOPE, "faultstring", this, 'm_faultstring');
	conditionalGetElementByTagNameNS(doc, "urn:zimbra",                        "Trace",       this, 'm_fault_detail');
	conditionalGetElementByTagNameNS(doc, "urn:zimbra",                        "Code",        this, 'm_faultcode');
}

// load from a SOAPFault object - http://www.xulplanet.com/references/objref/SOAPFault.html
//
SoapState.prototype.faultLoadFromSoapFault = function(fault)
{
	if (fault.element)
		this.m_fault_element_xml = xmlDocumentToString(fault.element);
		
	if (fault.faultString)
		this.m_faultstring = fault.faultString;

	if (fault.detail)
		this.m_fault_detail = fault.detail;

	if (fault.faultcode)
		this.m_faultcode = fault.faultcode;
}

SoapState.prototype.toString = function()
{
	var ret = "\n xhr          = "        + (this.m_xhr ? this.m_xhr.readyState : "null") +
	          "\n cancelled    = "        + this.is_cancelled +
	          "\n mismatched_response = " + this.is_mismatched_response +
	          "\n http status code = "    + this.m_http_status_code +
	          "\n fault code = "          + this.m_faultcode +
	          "\n fault string = "        + this.m_faultstring +
	          "\n fault detail = "        + this.m_fault_detail +
	          "\n fault elementxml = "    + this.m_fault_element_xml +
	          "\n response = "            + (this.m_response ? xmlDocumentToString(this.m_response) : "null");

	return ret;
}

SoapState.prototype.toHtml = function()
{
	return this.toString().replace(/\n/g, "<html:br>");
}

function AuthOnlyFsm(state) { this.SyncFsm(state); this.setFsm(); }
function TwoWayFsm(state)   { this.SyncFsm(state); this.setFsm(); }

copyPrototype(AuthOnlyFsm, SyncFsm);
copyPrototype(TwoWayFsm,   SyncFsm);

AuthOnlyFsm.prototype.setFsm = function()
{
	this.fsm = SyncFsm.getFsm(this);

	this.fsm.m_transitions['stAuth']['evNext'] = 'final';
}

TwoWayFsm.prototype.setFsm = function()
{
	this.fsm = SyncFsm.getFsm(this);
}

function SyncFsmState(id_fsm)
{
	this.id_fsm              = id_fsm;
	this.m_logappender       = new ZinLogAppenderHoldOpen(); // holds an output stream open - must be closed explicitly
	this.m_logger            = new ZinLogger(loggingLevel, "SyncFsm", this.m_logappender);
	this.m_soap_state        = null;
	this.cCallsToSoap        = 0;                       // handy for debugging the closure passed to soapCall.asyncInvoke()
	this.zfcLastSync         = null;                    // ZinFeedCollection - maintains state re: last sync (anchors, success/fail)
	this.zfcGid              = null;                    // ZinFeedCollection - map of gid to (sourceid, luid)
	this.zfcPreUpdateWinners = new ZinFeedCollection(); // has the winning zfi's before they are updated to reflect their win (LS unchanged)
	this.stopwatch           = new ZinStopWatch("SyncFsm");

	this.zidbag              = new ZidBag();
	this.authToken           = null;         // AuthResponse
	this.suggestedSoapURL    = null;         // a <soapURL> response returned in GetAccountInfo
	this.aReverseGid         = new Object(); // reverse lookups for the gid, ie given (sourceid, luid) find the gid.
	this.isSlowSync          = false;        // true iff no data files
	this.mapiStatus          = null;         // CheckLicenseStatus
	this.aSyncGalContact     = null;         // SyncGal
	this.mapIdSyncGalContact = null;      
	this.SyncGalEnabled      = null;         // From the preference of the same name.  Possible values: yes, no, if-fewer
	this.SyncGalTokenInRequest  = null;
	this.SyncGalTokenInResponse = null;
	this.SyncMd              = null;         // this gives us the time on the server
	this.SyncTokenInRequest  = null;         // the 'token' given to    <SyncRequest>
	this.isAnyChangeToFolders = false;
	this.zimbraId            = null;         // the zimbraId for the Auth username - returned by GetAccountInfoRespose
	this.aContact            = new Array();  // array of contact (zid, id) - push in SyncResponse, shift in GetContactResponse
	this.isRedoSyncRequest   = false;        // we may need to do <SyncRequest> again - the second time without a token
	this.aSyncContact        = new Object(); // each property is a ZimbraContact object returned in GetContactResponse
	this.stopFailCode        = null;         // if stLoadTb or stConverge continue on evLackIntegrity, these values are set for the observer
	this.stopFailDetail      = null;
	this.zfcTbPreMerge       = null;         // the thunderbird map before iterating through the tb addressbook - used to test invariance
	this.aGcs                = null;         // array of Global Converged State - passed between the phases of Converge
	this.aSuo                = null;         // container for source update operations - populated in Converge
	this.aConflicts          = new Array();  // an array of strings - each one reports on a conflict
	this.updateZmPackage     = null;         // maintains state between an zimbra server update request and the response
	this.isUpdateZmFailed    = false;        // true iff a soap response couldn't be understood

	this.m_preferences       = new MozillaPreferences();
	this.m_folder_converter  = new ZinFolderConverter();

	this.m_addressbook       = new ZinAddressBook();
	this.m_folder_converter.localised_pab(this.m_addressbook.getPabName());

	this.m_bimap_format = new BiMap(
		[FORMAT_TB, FORMAT_ZM],
		['tb',      'zm'     ]);

	this.sources = new Object();
	this.sources[SOURCEID_TB] = new Object();
	this.sources[SOURCEID_ZM] = new Object();

	this.sources[SOURCEID_TB]['format'] = FORMAT_TB;
	this.sources[SOURCEID_TB]['name']   = stringBundleString("sourceThunderbird");

	this.sources[SOURCEID_ZM]['format'] = FORMAT_ZM;
	this.sources[SOURCEID_ZM]['name']   = stringBundleString("sourceServer");

	for (var i in this.sources)
		this.sources[i]['zfcLuid'] = null;  // ZinFeedCollection - updated during sync and persisted at the end

	this.sourceid_tb = SOURCEID_TB;
	this.sourceid_zm = SOURCEID_ZM;
}

SyncFsmState.prototype.setCredentials = function()
{
	if (arguments.length == 3)
	{
		this.sources[SOURCEID_ZM]['soapURL']  = arguments[0];
		this.sources[SOURCEID_ZM]['username'] = arguments[1];
		this.sources[SOURCEID_ZM]['password'] = arguments[2];
	}
	else
	{
		// load credentials from preferences and the password manager
		//
		var prefset = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
		prefset.load(SOURCEID_ZM);

		var credentials = PrefSetHelper.getUserUrlPw(prefset, PrefSet.SERVER_USERNAME, PrefSet.SERVER_URL);

		this.sources[SOURCEID_ZM]['username'] = credentials[0];
		this.sources[SOURCEID_ZM]['soapURL']  = credentials[1];
		this.sources[SOURCEID_ZM]['password'] = credentials[2];
	}

	if (this.sources[SOURCEID_ZM]['soapURL'].charAt(this.sources[SOURCEID_ZM]['soapURL'].length - 1) != '/')
		this.sources[SOURCEID_ZM]['soapURL'] += '/';

	this.sources[SOURCEID_ZM]['soapURL'] += "service/soap/";

	this.m_logger.debug("setCredentials: this.sources[zm][soapURL]: " + this.sources[SOURCEID_ZM]['soapURL']);
}

function AuthOnlyFsmState() { this.SyncFsmState(ZinMaestro.FSM_ID_AUTHONLY); }
function TwoWayFsmState()   { this.SyncFsmState(ZinMaestro.FSM_ID_TWOWAY);   }

copyPrototype(AuthOnlyFsmState, SyncFsmState);
copyPrototype(TwoWayFsmState,   SyncFsmState);
