include("chrome://zindus/content/fsm.js");
include("chrome://zindus/content/bimap.js");
include("chrome://zindus/content/soapdocument.js");
include("chrome://zindus/content/xpath.js");
include("chrome://zindus/content/contact.js");
include("chrome://zindus/content/addressbook.js");
include("chrome://zindus/content/feed.js");
include("chrome://zindus/content/suo.js");
include("chrome://zindus/content/gcs.js");
include("chrome://zindus/content/lso.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/passwordmanager.js");

// TODO - GetInfo for zimbraFeatureGalEnabled 
// TODO - look for gLogger.error messages and perhaps implement an "orderly exit" flag that's tested before each continuation

ZimbraFsm.FILE_LASTSYNC = "lastsync";
ZimbraFsm.FILE_GID      = "gid";

function ZimbraFsm(state)
{
	this.state   = state;
	this.soapfsm = new SoapFsm();
	this.fsm     = new Object();
}

ZimbraFsm.prototype.start = function()
{
	fsmFireTransition(this.state.id_fsm, null, 'start', 'evStart', this);
}

ZimbraFsm.prototype.cancel = function(newstate, syncfsm_timeoutID, soapfsm_timeoutID)
{
	window.clearTimeout(syncfsm_timeoutID);

	gLogger.debug("ZimbraFsm.cancel: cleared timeoutID: " + syncfsm_timeoutID);

	this.soapfsm.cancel(soapfsm_timeoutID);

	if (newstate == 'start')
	{
		// the fsm hasn't had a transition yet so there's no continuation
		// so the new transition just enters the start state on a cancel event
		//
		gLogger.debug("ZimbraFsm.cancel: fsm was about to enter start state - now it does that on evCancel");
		fsmFireTransition(this.state.id_fsm, null, 'start', 'evCancel', this);
	}
	else
	{
		if (typeof this.fsm.continuation != 'function')
			gLogger.error("about to throw an exception because this.fsm.continuation is not a function")

		gLogger.debug("ZimbraFsm.cancel: continuing on evCancel");

		this.fsm.continuation('evCancel');
	}
}

// note: this function takes a variable number of arguments following the "method" parameter
// Function.length below returns the number of formal arguments
//
ZimbraFsm.prototype.callSoapFsm = function(continuation, f, eventOnResponse, method)
{
	var zsd = new ZimbraSoapDocument();
	zsd.context(this.state.authToken, this.state.sessionId);

	var args = new Array();
	for (var i = ZimbraFsm.prototype.callSoapFsm.length; i < arguments.length; i++)
		args.push(arguments[i]);

	zsd[method].apply(zsd, args);

	// setting the final action on the soap fsm each time ensures that the continuation object passed to
	// to the starter of the fsm is the one called on exit of the fsm
	//
	// this.soapfsm.fsm.aActionEntry['final'] = generate_next(continuation, f, eventOnResponse, method);
	var context = this;
	this.soapfsm.fsm.aActionEntry['final'] = function()
		{
			var event = f.call(context, eventOnResponse, method);
			continuation(event);
		}

	this.soapfsm.start(this.state.soapURL, zsd);
}

// This routine tests for:
// - unexpected response ==> evCancel (eg <parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml">...</parsererror>

ZimbraFsm.prototype.eventFromSoapDefault = function(eventOnResponse, method)
{
	var soapfsmstate = this.soapfsm.state;
	var event = null;

	// After a response, exactly one of these things is true:
	// - this.response != null
	// - this.serviceCode != 0
	// - this.faultElementXml != null
	// That's what SoapFsmState.prototype.sanityCheck tests for...
	//

	soapfsmstate.sanityCheck();

	if (soapfsmstate.response)
	{
		var node = ZinXpath.getSingleValue(ZinXpath.queryFromMethod(method), soapfsmstate.response, soapfsmstate.response);

		if (node)
			event = eventOnResponse; // we found a BlahResponse element - all is well
		else
		{
			// otherwise assume that the response is something that we can't do anything with - so just cancel
			// perhaps set a flag to indicate how/why we cancelled
			event = 'evCancel';
		}
	}
	else 
	{
		var msg = "onSoapFsmExit: soap error - ";  // note that we didn't say "fault" here - it could be a sending/service error

		if (soapfsmstate.serviceCode != 0 && soapfsmstate.serviceCode != null)
			msg += "serviceCode == " + soapfsmstate.serviceCode;
		else if (soapfsmstate.faultElementXml)
			msg += "fault fields as shown: " + soapfsmstate.toString();
		else
			cnsAssert(false);

		gLogger.debug(msg);

		event = 'evCancel';
	}

	return event;
}

ZimbraFsm.prototype.eventFromSoapCheckLicense = function(eventOnResponse, method)
{
	// the fault varies depending on open-source vs non-open-source server:
	// this.soapfsm.state.faultCode == "service.UNKNOWN_DOCUMENT" or <soap:faultcode>soap:Client</soap:faultcode>
	//
	if (this.soapfsm.state.faultElementXml)
		event = eventOnResponse;
	else
		event = this.eventFromSoapDefault(eventOnResponse, method)

	return event;
}

ZimbraFsm.prototype.entryActionStart = function(state, event, continuation)
{
	var nextEvent = null;

	if (event == 'evCancel')
	{
		nextEvent = 'evCancel';
	}
	else
	{
		this.state.soapURL = this.state.sources[this.state.sourceid_zm]['soapURL'];

		this.state.zfcLastSync.load(ZinFeedCollection.fileName(ZimbraFsm.FILE_LASTSYNC));

		for (var i in this.state.sources)
			if (this.state.sources[i]['format'] == FORMAT_ZM && !this.state.zfcLastSync.isPresent(i))
				this.state.zfcLastSync.set(new ZinFeedItem(null, ZinFeedItem.ATTR_ID, i)); // either a new source or the map was zapped

		nextEvent = 'evStart';

		gLogger.debug("89347523: entryActionStart: starting normally: SoapFsmState: " + this.soapfsm.state.summaryCode() + " nextEvent: " + nextEvent);
	}

	continuation(nextEvent);
}

ZimbraFsm.prototype.entryActionAuth = function(state, event, continuation)
{
	this.callSoapFsm(continuation, ZimbraFsm.prototype.eventFromSoapDefault, "evNext", "Auth",
					 this.state.sources[this.state.sourceid_zm]['username'],
					 this.state.sources[this.state.sourceid_zm]['password']);
}

ZimbraFsm.prototype.exitActionAuth = function(state, event)
{
	if (this.soapfsm.state.response)
	{
		conditionalGetElementByTagNameNS(this.soapfsm.state.response, ZimbraSoapDocument.NS_ACCOUNT, "authToken", this.state, 'authToken');
		conditionalGetElementByTagNameNS(this.soapfsm.state.response, ZimbraSoapDocument.NS_ACCOUNT, "lifetime",  this.state, 'lifetime');
		conditionalGetElementByTagNameNS(this.soapfsm.state.response, ZimbraSoapDocument.NS_ACCOUNT, "sessionId", this.state, 'sessionId');
	}
}

ZimbraFsm.prototype.entryActionLoad = function(state, event, continuation)
{
	this.state.zfcGid.load(ZinFeedCollection.fileName(ZimbraFsm.FILE_GID));

	var sources = this.state.sources;

	for (var i in sources)
		sources[i]['zfcLuid'].load(ZinFeedCollection.fileName(i, this.state.m_bimap_format.lookup(sources[i]['format'], null)));

	continuation('evNext');
}

ZimbraFsm.prototype.entryActionGetAccountInfo = function(state, event, continuation)
{
	this.callSoapFsm(continuation, this.eventFromSoapDefault, "evNext", "GetAccountInfo", this.state.sources[this.state.sourceid_zm]['username']);
}

ZimbraFsm.prototype.exitActionGetAccountInfo = function(state, event)
{
	if (!this.soapfsm.state.response)
		return;

	// this.zimbraId    = null; // set by GetAccountInfo
	// this.soapURL     = null;

	var xpath_query = "/soap:Envelope/soap:Body/za:GetAccountInfoResponse/za:soapURL";
	var functor     = new FunctorArrayOfTextNodeValue();

	ZinXpath.runFunctor(functor, xpath_query, this.soapfsm.state.response);

	var soapURL = null;

	if (functor.a.length == 1)
		soapURL = functor.a[0];
	else if (functor.a.length > 1)
	{
		var scheme = this.state.m_preferences.getCharPref(this.state.m_preferences.branch(), "system.preferSchemeForSoapUrl");
		var scheme_length = scheme.length;

		for (var i = 0; i < functor.a.length && (soapURL == null); i++)
			if (functor.a[i].substr(0, scheme_length) == scheme)
				soapURL = functor.a[i];

		if (!soapURL)
			gLogger.warn("Unexpected soap response - multiple soapURL's returned and none are https");
	}

	if (soapURL)
		this.state.soapURL = soapURL;

	// gLogger.debug("887788: soapURL == " + soapURL);
	// gLogger.debug("887788: this.state.soapURL == " + this.state.soapURL);
}

ZimbraFsm.prototype.entryActionCheckLicense = function(state, event, continuation)
{
	this.callSoapFsm(continuation, this.eventFromSoapCheckLicense, "evNext", "CheckLicense");
}

ZimbraFsm.prototype.exitActionCheckLicense = function(state, event)
{
	if (this.soapfsm.state.faultElementXml && this.soapfsm.state.faultCode == "service.UNKNOWN_DOCUMENT")
		this.state.mapiStatus = "CheckLicense not supported by server - service is probably open source edition";
	else if (this.soapfsm.state.response)
	{
		var xpath_query = "/soap:Envelope/soap:Body/za:CheckLicenseResponse/attribute::status";
		var warn_msg    = "warning - expected to find 'status' attribute in <CheckLicenseResponse>";

		ZinXpath.setConditional(this.state, 'mapiStatus', xpath_query, this.soapfsm.state.response, warn_msg);
	}
}

ZimbraFsm.prototype.entryActionSync = function(state, event, continuation)
{
	this.callSoapFsm(continuation, this.eventFromSoapDefault, "evNext", "Sync",
	                              this.state.zfcLastSync.get(this.state.sourceid_zm).getOrNull('SyncToken'));
}

ZimbraFsm.prototype.exitActionSync = function(state, event)
{
	if (!this.soapfsm.state.response)
		return;

	var response  = this.soapfsm.state.response;
	var sourceid = this.state.sourceid_zm;
	var zfcServer = this.state.sources[sourceid]['zfcLuid'];
	var id, functor, xpath_query;

	ZinXpath.setConditional(this.state, 'SyncMd',    "/soap:Envelope/soap:Body/zm:SyncResponse/attribute::md",    response, null);
	ZinXpath.setConditional(this.state, 'SyncToken', "/soap:Envelope/soap:Body/zm:SyncResponse/attribute::token", response, null);

	// TODO - what if the sync token went backwards (eg if the server had to restore from backups) ??

	// Things we're expecting:
	// <folder view="contact" ms="2713" md="1169690090" l="1" name="address-book-3" id="563"><acl/></folder>
	// <cn ids="567,480,501"/>
	// <cn d="1169685098000" ms="2708" md="1169685098" email="a.b@example.com" fileAsStr="a b" l="7" id="561" rev="2708"/>
	// <deleted ids="561"/>
	//   ==> set the ZinFeedItem.ATTR_DEL flag in the map
	//
	
	// <folder view="contact" ms="2713" md="1169690090" l="1" name="address-book-3" id="563"><acl/></folder>
	//  ==> add the id to the map
	//
	var xpath_query_folders = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder[@view='contact' or @id='" + ZIMBRA_ID_TRASH + "']";
	xpath_query = xpath_query_folders;

	functor = {
		aQueue: this.state.aQueue,
		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var id = attribute['id'];
			var l  = attribute['l'];
			var msg = "111113 - found a <folder id='" + id +"' l='" + l + "'>";

			if (!isPropertyPresent(attribute, 'id') || !isPropertyPresent(attribute, 'l'))
				gLogger.error("<folder> element received seems to be missing an 'id' or 'l' attribute - ignoring: " + aToString(attribute));
			else
			{
				if (zfcServer.isPresent(id))
				{
					var isInterestingPreUpdate = ZimbraFsm.isOfInterest(zfcServer, id);

					zfcServer.get(id).set(attribute);  // update existing item

					msg += " - updated id in map";

					var isInterestingPostUpdate = ZimbraFsm.isOfInterest(zfcServer, id);

					if (!isInterestingPreUpdate && isInterestingPostUpdate)
					{
						// a folder has become of interest (eg it moved out of trash), we need to get it's contacts
						//
						aContactIds = ZinFeed.getContactIdsForParent(zfc, id);

						for (var i = 0; i < aContactIds.length; i++)
							this.aQueue[aContactIds[i]] = true;

						msg += " - folder has become of interest - adding children to queue: " + aContactIds.toString();
					}
				}
				else
				{
					zfcServer.set(new ZinFeedItem(ZinFeedItem.TYPE_FL, attribute));  // add new item
					msg += " - adding folder to map";
				}
			}
		}
	};

	ZinXpath.runFunctor(functor, xpath_query, response);

	// <cn d="1169685098000" ms="2708" md="1169685098" email="a.b@example.com" fileAsStr="a b" l="7" id="561" rev="2708"/>
	//   This element appears as a child of a <SyncResponse> element
	//   and only ever relates to ids that we've previously seen via a <cn ids="blah"> element (so the id already exists in the map)
	//
	//   update the attributes in the map
	//   if the rev attribute is unchanged and the item became of interest or
	//      the rev attribute changed and it's a contact we're interested in
	//           ==> add the id to the queue for GetContactRequest,
	//               in which case the id get added to the map in GetContactResponse
	//

	xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:cn[not(@ids) and not(@type='group')]";

	functor = {
		aQueue: this.state.aQueue,

		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var id = attribute['id'];
			var l  = attribute['l'];
			var msg = "11113 - found a <cn id='" + id +"' l='" + l + "'>";
			
			// if the rev attribute is different from that in the map, it means a content change is pending so add the id to the queue,
			// otherwise just add it to the map
			//

			if (!isPropertyPresent(attribute, 'id') || !isPropertyPresent(attribute, 'l'))
				gLogger.error("<cn> element received from server without an 'id' or 'l' attribute.  Unexpected.  Ignoring: " + aToString(attribute));
			else
			{
				var fAddToTheQueue = false;

				cnsAssert(zfcServer.isPresent(id));

				var isInterestingPreUpdate = ZimbraFsm.isOfInterest(zfcServer, id);

				var isRevChange = !isPropertyPresent(attribute, ZinFeedItem.ATTR_REV) ||
				                  !zfcServer.get(id).isPresent(ZinFeedItem.ATTR_REV)  ||
				                  attribute[ZinFeedItem.ATTR_REV] != zfcServer.get(id).get(ZinFeedItem.ATTR_REV);

				zfcServer.get(id).set(attribute);

				msg += " - updated id in map";

				var isInterestingPostUpdate = ZimbraFsm.isOfInterest(zfcServer, id);

				if (!isRevChange && isInterestingPostUpdate && !isInterestingPreUpdate)
				{
					fAddToTheQueue = true;
					msg += " - rev didn't change but the id become of interest";
				}
				else if (isRevChange && isInterestingPostUpdate)
				{
					fAddToTheQueue = true;
					msg += " - rev changed and the item is of interest";
				}

				if (fAddToTheQueue)
				{
					msg += " - add to the queue for GetContactRequest";
					this.aQueue[id] = true;
				}
			}

			gLogger.debug(msg);
		}
	};

	ZinXpath.runFunctor(functor, xpath_query, response);

	functor = {
		ids: new Object(),

		run: function(doc, node)
		{
			cnsAssert(node.nodeType == Node.ATTRIBUTE_NODE);
			
			var ids = node.nodeValue;

			for each (var id in ids.split(","))
				this.ids[id] = true;
		}
	};

	// <cn ids="567,480,501"/>
	//   This element appears as a child of a <folder> element
	//     ==> add each id to the queue for GetContactRequest
	//     ==> the id is added to the map in GetContactResponse
	//
	// xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:folder[@l='1' and (@view='contact' or @name='Trash')]/zm:cn/@ids";
	//
	xpath_query = xpath_query_folders + "/zm:cn/@ids";

	ZinXpath.runFunctor(functor, xpath_query, response);

	for (id in functor.ids)
		this.state.aQueue[id] = true;

	// <deleted ids="561,542"/>
	//   ==> set the ZinFeedItem.ATTR_DEL flag in the map
	// Some of the deleted ids might not relate to contacts at all
	// So we may never have seen them and no map entry exists.
	// So the ZinFeedItem.ATTR_DEL flag is set only on items already in the map.
	//
	//
	xpath_query = "/soap:Envelope/soap:Body/zm:SyncResponse//zm:deleted/@ids";
	functor.ids = new Object();

	ZinXpath.runFunctor(functor, xpath_query, response);

	for (id in functor.ids)
		if (zfcServer.isPresent(id))
			zfcServer.get(id).set(ZinFeedItem.ATTR_DEL, 1);

	// At the end of all this:
	// - our map points to subset of items on the server - basically all folders with @view='contact' and their contacts
	// - this.state.aQueue is populated with the ids of:
	//   - contacts that are in the parent folders of interest, and
	//   - contacts whose content has changed (indicated by the rev attribute being bumped)

	gLogger.debug("11113 - aQueue: " + aToString(this.state.aQueue));
}

ZimbraFsm.prototype.entryActionGetContact = function(state, event, continuation)
{
	// gLogger.debug("11116: entryActionGetContact, aQueue == " + aToString(this.state.aQueue) );

	if (this.state.SyncMd == null)
	{
		gLogger.debug("Can't proceed with sync because (for some reason) <SyncResponse> didn't have an 'md' attribute");
		continuation('evCancel')
	}

	var id;
	for (id in this.state.aQueue)
		break;

	if (typeof(id) != 'undefined')
	{
		gLogger.debug("11116: calling GetContactsRequest with id == " + id );
		this.callSoapFsm(continuation, this.eventFromSoapDefault, "evRepeat", "GetContacts", id);
	}
	else
	{
		this.soapfsm.state.response = null;
		continuation('evNext');
	}
}

ZimbraFsm.prototype.exitActionGetContact = function(state, event)
{
	if (!this.soapfsm.state.response)
		return;

	var xpath_query = "/soap:Envelope/soap:Body/zm:GetContactsResponse/zm:cn";
	var functor     = new FunctorArrayOfContactsFromNodes(ZinXpath.nsResolver("zm")); // see <cn> above
	var zfcServer   = this.state.sources[this.state.sourceid_zm]['zfcLuid'];

	ZinXpath.runFunctor(functor, xpath_query, this.soapfsm.state.response);

	// gLogger.debug("111118 - functor.a.length == " + functor.a.length);

	if (functor.a.length <= 0)
		gLogger.warn("GetContactsResponse recieved without containing a <cn> entry");
	else
	{
		for (var i = 0; i < functor.a.length; i++)
		{
			var id = functor.a[i].attribute['id'];

			// gLogger.debug("111119: i == " + i + " and id == " + id);

			if (this.state.aQueue[id])
			{
				if (functor.a[i].isMailList())
					; // zfcServer.set(new ZinFeedItem(FEED_ITEM_TYPE_DL, functor.a[i].attribute)); // ignore mailing lists (for the moment)
				else
				{
					this.state.aSyncContact[id] = functor.a[i];

					if (zfcServer.isPresent(id))
						zfcServer.get(id).set(functor.a[i].attribute);                                // update existing item
					else
						zfcServer.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, functor.a[i].attribute));  // add new item

					// gLogger.debug("111119: added this.state.aSyncContact[" + id + "] == " + this.state.aSyncContact[id]);
				}

				delete this.state.aQueue[id];
			}
			else
				gLogger.warn("GetContactsResponse recieved contact id == " + id + " but it was not in our queue!  Ignored.");
		}
	}
}

ZimbraFsm.prototype.entryActionSyncGal = function(state, event, continuation)
{
	var SyncGalMdInterval = parseInt(this.state.m_preferences.getIntPref(this.state.m_preferences.branch(), "system.SyncGalMdInterval"));
	var SyncMd = this.state.zfcLastSync.get(this.state.sourceid_zm).getOrNull('SyncMd');

	gLogger.debug("11443322: SyncGalMdInterval == " + SyncGalMdInterval);
	gLogger.debug("11443322: SyncMdStored      == " + SyncMd);
	gLogger.debug("11443322: SyncMd            == " + this.state.SyncMd );

	if (SyncMd == null || (this.state.SyncMd > (SyncMd + SyncGalMdInterval)))
	{
		this.state.SyncGalToken = null;

		gLogger.debug("11443322: Gal either expired or had no state - this.state.SyncGalToken set to null to force replacement of GAL");

		// When this.state.SyncGalToken is set to null:
		// - we don't supply a token attribute to <SyncGalRequest>, which means the entire gal is returned with the response, and
		// - when we get the response, we entirely replace the local copy of the GAL
	}
	else
	{
		this.state.SyncGalToken = this.state.zfcLastSync.get(this.state.sourceid_zm).getOrNull('SyncGalToken');

		gLogger.debug("11443322: Gal hasn't expired - this.state.SyncGalToken == " + this.state.SyncGalToken);
	}

	this.callSoapFsm(continuation, this.eventFromSoapDefault, "evNext", "SyncGal", this.state.SyncGalToken);
}

ZimbraFsm.prototype.exitActionSyncGal = function(state, event)
{
	var SyncGalToken = null;

	if (!this.soapfsm.state.response)
		return;

	var functor = new FunctorArrayOfContactsFromNodes(xpathNsResolver("za")); // see SyncGalResponse below
	var response = this.soapfsm.state.response;

	var node = ZinXpath.getSingleValue("/soap:Envelope/soap:Body/za:SyncGalResponse/@token", response, response);

	if (node && node.nodeValue)
		SyncGalToken = node.nodeValue;
	else
		gLogger.warn("SyncGalResponse received without a token attribute - don't know how to handle so ignoring it...");

	// zimbra server versions 4.0.x and 4.5 does some caching thing whereby it returns <cn> elements
	// in the SyncGalResponse even though the token is unchanged vs the previous response.
	//
	// Here, aSyncGalContact gets populated with the <cn> child elements of <SyncGalResponse> only when
	// the token attribute is present and different from the previous response.
	//
	if (SyncGalToken != null && SyncGalToken != this.state.SyncGalToken)
	{
		ZinXpath.runFunctor(functor, "/soap:Envelope/soap:Body/za:SyncGalResponse/za:cn", this.soapfsm.state.response);

		this.state.SyncGalToken        = SyncGalToken;
		this.state.SyncGalTokenChanged = true;

		this.state.aSyncGalContact     = functor.a;
		this.state.mapIdSyncGalContact = functor.mapId;

		if (0)
		{
		gLogger.debug("11443378: SyncGalToken            == " + SyncGalToken );
		gLogger.debug("11443378: this.state.SyncGalToken == " + this.state.SyncGalToken );

		for (var i in this.state.aSyncGalContact)
			gLogger.debug("11443378: aSyncGalContact[" + i + "] == \n" + this.state.aSyncGalContact[i].toString());

		for (var id in this.state.mapIdSyncGalContact)
			gLogger.debug("11443378: mapIdSyncGalContact." + id + " == " + this.state.mapIdSyncGalContact[id]);
		}
	}
	else
		gLogger.debug("11443378: SyncGalResponse: token is unchanged - ignoring any <cn> elements in the response");
}

// the reference to this.state.SyncMd here is why SyncGalCommit must come *after* SyncResponse
//
ZimbraFsm.prototype.entryActionSyncGal = function(state, event, continuation)
{
	// It would be nice if the gal token and SyncMd could be stored as user-defined properties of an addressbook
	// rather than as preferences.  Then we wouldn't need to worry about the prefs somehow getting out of sync with the addressbooks.
	// But the addressbook api doesn't support user-defined properties.
	//

	var abName = this.getAddressBookName() + ">" + ABSPECIAL_GAL;
	var uri    = ZimbraAddressBook.getAddressBookUri(abName);
	var aAdd   = new Array(); // each element in the array is an index into aSyncGalContact

	if (uri == null) // create the gal address book if it doesn't exist
	{
		ZimbraAddressBook.newAddressBook(abName);

		uri = ZimbraAddressBook.getAddressBookUri(abName);
	}

	if (!uri)
		gLogger.error("Unable to find or create the GAL addresbook - skipping GAL sync");
	else if (this.state.aSyncGalContact != null)
	{
		// since aSyncGalContact is only populated if there's a change in token, it seems reasonable to assert that length is > 0
		//
		cnsAssert(this.state.aSyncGalContact.length > 0 && this.state.SyncGalTokenChanged);

		for (var i in this.state.aSyncGalContact)
		{
			var properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, this.state.aSyncGalContact[i].element);
			this.state.aSyncGalContact[i].checksum = ZimbraAddressBook.contactPropertyChecksum(properties);
		}

		if (this.state.SyncGalTokenChanged) // wipe all contacts
		{
			// flush cards out of the GAL address book that don't match cards in the contacts received from zimbra and
			// if there's a match, mark the corresponding zimbra contact so that it doesn't get added again below
			gLogger.debug("this.state.SyncGalTokenChanged == true so wiping contacts that aren't in the SyncGalResponse");
			var context = this;

			var functor = {
				run: function(uri, item)
				{
					var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
					var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);

					var id =  mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);
					var checksum =  mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_CHECKSUM);

					var index = context.state.mapIdSyncGalContact[id];

					gLogger.debug("forEachCard() functor abCard.mailListURI == " + abCard.mailListURI);

					if (id != null && typeof index != 'undefined' && checksum == context.state.aSyncGalContact[index].checksum)
					{
						context.state.aSyncGalContact[index].present = true;
						gLogger.debug("GAL card present in SyncGalResponse: " + ZimbraAddressBook.nsIAbCardToPrintable(abCard));
					}
					else
					{
						this.cardsToBeDeletedArray.AppendElement(abCard);
						gLogger.debug("GAL card marked for deletion: " + ZimbraAddressBook.nsIAbCardToPrintable(abCard));
					}

					return true;
				}
			};

			functor.cardsToBeDeletedArray = Components.classes["@mozilla.org/supports-array;1"].createInstance().
		                     QueryInterface(Components.interfaces.nsISupportsArray);

			ZimbraAddressBook.forEachCard(uri, functor);

			ZimbraAddressBook.deleteCards(uri, functor.cardsToBeDeletedArray);

			for (var i in this.state.aSyncGalContact)
				if (!this.state.aSyncGalContact[i].present)
					aAdd.push(i);
		}
		else
		{
			for (var i in this.state.aSyncGalContact)
				aAdd.push(i);
		}

		for (var i in aAdd)
		{
			var zc = this.state.aSyncGalContact[aAdd[i]];

			gLogger.debug("844324: about to write aSyncGalContact[" + aAdd[i] + "] == \n" + zc.toString());

			var attributes = newObject(TBCARD_ATTRIBUTE_LUID, zc.attribute.id, TBCARD_ATTRIBUTE_CHECKSUM, zc.checksum);
			var properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

			ZimbraAddressBook.addCard(uri, FORMAT_TB, properties, attributes);
		}

		this.state.zfcLastSync.get(this.state.sourceid_zm).set('SyncMd', this.state.SyncMd);
		this.state.zfcLastSync.get(this.state.sourceid_zm).set('SyncGalToken', this.state.SyncGalToken);
	}
	else
		gLogger.debug("entryActionSyncGal: - nothing to commit - SyncGalToken == " + this.state.SyncGalToken);
		
	continuation('evNext');
}

// if the local map has been zapped:
// - add the max property
// - zero out all the attributes that have been added to thunderbird cards...
//
// TODO - change this so that if any of the maps have been zapped that they are all zapped... call resetAll()
//

ZimbraFsm.prototype.initialiseMapsIfRequired = function()
{
	var zfcLocal = this.state.sources[this.state.sourceid_tb]['zfcLuid']; // bring these variables into the local namespace
	var zfcGid   = this.state.zfcGid;

	if (!zfcLocal.isPresent(ZinFeedItem.ID_AUTO_INCREMENT) || !zfcLocal.get(ZinFeedItem.ID_AUTO_INCREMENT).isPresent('next'))
	{
		cnsAssert(zfcLocal.length() == 0);

		gLogger.debug("11770 - thunderbird and/or gid map was zapped - initialising...");

		zfcLocal.set(new ZinFeedItem(null, ZinFeedItem.ATTR_ID, ZinFeedItem.ID_AUTO_INCREMENT, 'next', ZinFeedItem.ID_MAX_RESERVED + 1));
		zfcGid.set(  new ZinFeedItem(null, ZinFeedItem.ATTR_ID, ZinFeedItem.ID_AUTO_INCREMENT, 'next', ZinFeedItem.ID_MAX_RESERVED + 1));

	 	var functor_foreach_card = {
			run: function(uri, item)
			{
				var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
				var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);

				var id =  mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

				if (id > 0)
					mdbCard.setStringAttribute(TBCARD_ATTRIBUTE_LUID, 0); // delete would be more natural but not supported by api

				return true;
			}
		};

		var functor_foreach_addressbook = {
			run: function(elem)
			{
				ZimbraAddressBook.forEachCard(elem.directoryProperties.URI, functor_foreach_card);

				return true;
			}
		};

		ZimbraAddressBook.forEachAddressBook(functor_foreach_addressbook);
	}
}

ZimbraFsm.prototype.updateTbLuidMap = function()
{
	var functor_foreach_card, functor_foreach_addressbook;
	var uri;
	var sourceid = this.state.sourceid_tb;
	var zfcLocal = this.state.sources[sourceid]['zfcLuid'];

	bimapFolderLuid = ZinFeed.getTopLevelFolderLuidBimap(zfcLocal, ZinFeedItem.ATTR_TPI, ZinFeedCollection.ITER_UNRESERVED);

	gLogger.debug("1177 - bimapFolderLuid == " + bimapFolderLuid.toString());

	// identify the zimbra addressbooks
	//
	functor_foreach_addressbook =
	{
		state:  this.state,
		prefix: ZimbraFsm.getAddressBookName(""),

		run: function(elem)
		{
			var msg = "1177 - considering addressbook:" +
			          " dirName: " + elem.dirName +
			          " dirPrefId: " + elem.dirPrefId +
			          " isRemote: " + elem.isRemote +
			          " lastModifiedDate: " + elem.lastModifiedDate +
			          " description: " + elem.description +
			          " supportsMailingLists: " + elem.supportsMailingLists +
			          " dirName: " + elem.dirName;

			// look for zindus/<folder-name> but don't permit '/'es in <folder-name> because:
			// (1) currently we only support addressbook folders that are immediate children of the root folder
			//     note the l='1' below.
			// (2) and we also want to exclude zindus/<server-name>/<folder-name>

			if (elem.directoryProperties.dirType == ZimbraAddressBook.kPABDirectory &&
			    elem.dirName.substring(0, this.prefix.length) == this.prefix &&
			    elem.dirName.indexOf("/", this.prefix.length) == -1)
			{
				var id;

				var name = elem.dirName.substring(this.prefix.length);
				msg += " - a zindus addressbook";

				if (!bimapFolderLuid.isPresent(null, elem.dirPrefId))
				{
					id = ZinFeed.autoIncrement(zfcLocal.get(ZinFeedItem.ID_AUTO_INCREMENT), 'next');

					zfcLocal.set(new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_ID, id , 'l', 1, 'name', name,
					    ZinFeedItem.ATTR_MS, 1,
						ZinFeedItem.ATTR_TPI, elem.dirPrefId));
					
					msg += " - added to the map: " + zfcLocal.get(id).toString();
				}
				else
				{
					id = bimapFolderLuid.lookup(null, elem.dirPrefId);

					// the mozilla addressbook hasn't implemented elem.lastModifiedDate (for folders)
					// so we do our own change detection

					var zfi = zfcLocal.get(id);

					if (zfi.get('name') != name)
					{
						zfi.set('name', name);
						ZinFeed.autoIncrement(zfi, ZinFeedItem.ATTR_MS);

						msg += " - folder changed: " + zfi.toString();
					}
				}

				aUri[elem.directoryProperties.URI] = id;
				zfcLocal.get(id).set('present', '1');  // this drives deletion detection

				msg += " - elem.directoryProperties." +
				       " URI: "      + elem.directoryProperties.URI +
				       " dirType: "  + elem.directoryProperties.dirType +
				       " position: " + elem.directoryProperties.position;
				msg += " id: " + id;

			}
			else
				msg += " - ignored";

			gLogger.debug(msg);
		
			return true;
		}
	};

	aUri = new Array();

	ZimbraAddressBook.forEachAddressBook(functor_foreach_addressbook);

	// when you iterate through cards in an addressbook, you also see cards that are members of mailing lists
	// and the only way I know of identifying such cards is to iterate to them via a mailing list uri.
	// So there's a 3-pass thing here:
	// pass 1 - iterate through the cards in the zindus folders building an associative array of mailing list uris
	//   aListUris['moz-abmdbdirectory://abook.mab/MailList3'] = true
	// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
	//   a card key is a concatenation of mdbCard. dbTableID dbRowID key == 1 797 402
	//   aListCardKey['1-797-402'] = true;
	// pass 3 - iterate through the cards in the zindus folders excluding mailing list uris and cards with keys in aListCardKey
	//

	// pass 1 - iterate through the cards in the zindus folders building an associative array of mailing list uris
	//
	var aMailListUri = new Object();
	functor_foreach_card = {
		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);

			if (abCard.isMailList)
				aMailListUri[abCard.mailListURI] = true;

			return true;
		}
	};

	for (uri in aUri)
		ZimbraAddressBook.forEachCard(uri, functor_foreach_card);

	gLogger.debug("1177 - pass 1 - aMailListUri == " + aToString(aMailListUri));

	// pass 2 - iterate through the cards in the mailing list uris building an associative array of card keys
	//
	var aCardKeysToExclude = new Object();

	functor_foreach_card = {
		run: function(uri, item)
		{
			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);

			aCardKeysToExclude[ZimbraAddressBook.nsIAbMDBCardToKey(uri, mdbCard)] = true;

			return true;
		}
	};

	for (uri in aMailListUri)
		ZimbraAddressBook.forEachCard(uri, functor_foreach_card);

	gLogger.debug("1177 - pass 2 - aCardKeysToExclude == " + aToString(aCardKeysToExclude));

	functor_foreach_card = {
		run: function(uri, item)
		{
			var abCard  = item.QueryInterface(Components.interfaces.nsIAbCard);
			var mdbCard = item.QueryInterface(Components.interfaces.nsIAbMDBCard);
			var msg = "1177 - pass 3 - card key: " + ZimbraAddressBook.nsIAbMDBCardToKey(uri, mdbCard);

			if ( !abCard.isMailList && !isPropertyPresent(aCardKeysToExclude, ZimbraAddressBook.nsIAbMDBCardToKey(uri, mdbCard)))
			{
				var id = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_LUID);

				if (! (id > ZinFeedItem.ID_MAX_RESERVED)) // id might be null (not present) or zero (reset after the map was deleted)
				{
					id = ZinFeed.autoIncrement(zfcLocal.get(ZinFeedItem.ID_AUTO_INCREMENT), 'next');

					// aUri[uri] is the id of the enclosing folder

					mdbCard.setStringAttribute(TBCARD_ATTRIBUTE_LUID, id);

					zfcLocal.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, id , ZinFeedItem.ATTR_MD, abCard.lastModifiedDate, ZinFeedItem.ATTR_REV, 1, 'l', aUri[uri]));

					msg += " added:   " + ZimbraAddressBook.nsIAbCardToPrintable(abCard) + " - map: " + zfcLocal.get(id).toString();
				}
				else
				{
					var zfi = zfcLocal.get(id);

					// if things have changed, update the map...
					//
					if (zfi.get('l') != aUri[uri] || zfi.get(ZinFeedItem.ATTR_MD) != abCard.lastModifiedDate)
					{
						// abCard.lastModifiedDate is a bit flaky...
						// 1. it is set to '0' when the contact is first created
						// 2. moving a contact to a different folder then back resets lastModifiedDate to zero
						//    so someone could create it, sync, move it to a different folder, change it, moving it back
						//    and it'd look as if there was no change.
						// TODO - might need to update ZinFeedItem.ATTR_REV based on a change in checksum, rather than abCard.lastModifiedDate

						zfi.set(ZinFeedItem.ATTR_MD, abCard.lastModifiedDate);
						zfi.set('l', aUri[uri]);
						ZinFeed.autoIncrement(zfi, ZinFeedItem.ATTR_REV);

						msg += " changed: " + ZimbraAddressBook.nsIAbCardToPrintable(abCard) + " - map: " + zfi.toString();
					}
					else
						msg += " found:   " + ZimbraAddressBook.nsIAbCardToPrintable(abCard) + " - map: " + zfi.toString();
				}

				zfcLocal.get(id).set('present', '1');
			}
			else
				msg += " - ignored";

			gLogger.debug(msg);

			return true;
		}
	};

	for (uri in aUri)
		ZimbraAddressBook.forEachCard(uri, functor_foreach_card);

	// deletion detection works as follows.
	// 1. a 'present' attribute was added in pass 3 above
	// 2. iterate through the map
	//    - an item without a 'present' attribute is marked as deleted
	//    - remove the 'present' attribute so that it's not saved
	// 

	var functor_mark_deleted = {
		run: function(zfi)
		{
			if (zfi.isPresent(ZinFeedItem.ATTR_DEL))
				; // do nothing
			else if (zfi.isPresent('present'))
				zfi.del('present');
			else
			{
				zfi.set(ZinFeedItem.ATTR_DEL, 1);
				gLogger.debug("1177 - marking as deleted: " + zfi.toString());
				ZinFeed.autoIncrement(zfi, (zfi.type() == ZinFeedItem.TYPE_FL) ? ZinFeedItem.ATTR_MS : ZinFeedItem.ATTR_REV);
			}

			return true;
		}
	};

	zfcLocal.forEach(functor_mark_deleted, ZinFeedCollection.ITER_UNRESERVED);
}

// build a two dimensional associative array for reverse lookups - meaning given a sourceid and luid, find the gid.
// For example: reverse.1.4 == 7 means that sourceid == 1, luid == 4, gid == 7
// forward lookups are done via zfcGid: zfcGid.get(7).get(1) == 4
//
ZimbraFsm.prototype.buildReverseGid = function()
{
	var reverse = this.state.aReverseGid; // bring it into the local namespace

	var functor_each_gid_mapitem = {
		run: function(sourceid, luid)
		{
			if (isPropertyPresent(reverse, sourceid))
				reverse[sourceid][luid] = this.gid;
			else
				gLogger.warn("gid == " + this.gid + " has an unknown sourceid: " + sourceid + " - ignored");

			return true;
		}
	};

	var functor_foreach_gid = {
		run: function(zfi)
		{
			var gid = zfi.id();

			functor_each_gid_mapitem.gid = gid;
			zfi.forEach(functor_each_gid_mapitem, ZinFeedItem.ITER_SOURCEID);

			return true;
		}
	};

	for (sourceid in this.state.sources)
		reverse[sourceid] = new Object();

	this.state.zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_UNRESERVED);

	gLogger.debug("1177 - buildReverseGid initialises reverse: " + aToString(reverse));
}

ZimbraFsm.isOfInterest = function(zfc, id)
{
	// gLogger.debug("blahblah: arguments.length: " + arguments.length);
	// gLogger.debug("blahblah: zfc: " + zfc);
	// gLogger.debug("blahblah: id: " + id);
	// gLogger.debug("blahblah: zfc.isPresent(id): " + zfc.isPresent(id));
	// gLogger.debug("blahblah: zfi: " + zfc.isPresent(id) ? zfc.get(id).toString() : "not present");

	cnsAssert(arguments.length == 2 && zfc && id && id > 0 && zfc.isPresent(id));

	var zfi = zfc.get(id);
	var l   = zfi.get('l');
	var ret = null;

	switch (zfi.type())
	{
		case ZinFeedItem.TYPE_FL:
			ret = l == '1' && zfi.get('id') != ZIMBRA_ID_TRASH;
			break;
		case ZinFeedItem.TYPE_CN:
			if (l == 1)
				ret = false; // not sure how a contact could end up at the very top level but maybe it's possible!
			else
				ret = ZimbraFsm.isOfInterest(zfc, l);
			break;
		default:
			cnsAssert(false);
	}

	return ret;
}

ZimbraFsm.prototype.updateGidFromSources = function()
{
	var zfcGid  = this.state.zfcGid;
	var reverse = this.state.aReverseGid; // bring it into the local namespace
	var zfc;

	var functor_foreach_luid = {
		run: function(zfi)
		{
			var luid = zfi.id();
			var l    = zfi.get('l');
			var msg  = "1177 - building gid - sourceid: " + sourceid + " and luid: " + luid;

			if (isPropertyPresent(reverse[sourceid], luid))
			{
				zfcGid.get(reverse[sourceid][luid]).set('present', 1);
				msg += " - already in gid";
			}
			else if (!ZimbraFsm.isOfInterest(zfc, zfi.id()))
				msg += " - luid is not of interest - ignoring";
			else
			{
				var gid = ZinFeed.autoIncrement(zfcGid.get(ZinFeedItem.ID_AUTO_INCREMENT), 'next');

				zfcGid.set(new ZinFeedItem(null, ZinFeedItem.ATTR_ID, gid, 'present', 1, sourceid, luid));

				reverse[sourceid][luid] = gid;

				msg += " - added to gid: " + gid;
			}

			gLogger.debug(msg);

			return true;
		}
	};

	for (sourceid in this.state.sources)
	{
		zfc = this.state.sources[sourceid]['zfcLuid'];
		zfc.forEach(functor_foreach_luid, ZimbraFsm.forEachFlavour(this.state.sources[sourceid]['format']));
	}

	// sanity check - ensure that all gid's have been visited
	//
	var functor_foreach_gid = {
		run: function(zfi)
		{
			if (zfi.isPresent('present'))
				zfi.del('present');
			else
			{
				gLogger.warn("Found a gid unreferenced by any sourceid/luid.  This shouldn't happen.  Deleting...");
				zfcGid.del(zfi.id());
			}

			return true;
		}
	};

	zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_UNRESERVED);

	gLogger.debug("1177 - after updateGidFromSources(), zfcGid: " + zfcGid.toString());
	gLogger.debug("1177 - after updateGidFromSources(), reverse: " + aToString(this.state.aReverseGid));
}

ZimbraFsm.prototype.buildGcs = function()
{
	var aGcs          = new Object();  // an associative array where the key is a gid and the value is a Gcs object
	var aZfcCandidate = new Object();  // a copy of the luid maps updated as per this sync
	var sourceid_tb   = this.state.sourceid_tb;
	var zfcGid        = this.state.zfcGid;
	var reverse       = this.state.aReverseGid; // bring it into the local namespace

	for (var i in this.state.sources)
		aZfcCandidate[i] = cnsCloneObject(this.state.sources[i]['zfcLuid']); // cloned because items get deleted out of this during merge

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

	var functor_foreach_candidate = {
		run: function(zfi)
		{
			gLogger.debug("885438 - about to determine winner for:");
			gLogger.debug("885438 - sourceid: " + sourceid + " zfi: " + zfi.toString());

			if (ZimbraFsm.isOfInterest(sources[sourceid]['zfcLuid'], zfi.id()))
			{
				var luid = zfi.id();
				var gid  = reverse[sourceid][luid];

				cnsAssert(isPropertyPresent(reverse, sourceid) && isPropertyPresent(reverse[sourceid], luid));

				aGcs[gid] = this.compare(gid);// aZfcCandidate, reverse, zfcGid

				zfcGid.get(gid).forEach(functor_delete_other_candidate_mapitems, ZinFeedItem.ITER_SOURCEID);
			}
			else
				gLogger.debug("885438 - zfi not of interest - compare skipped - sourceid: " + sourceid + " zfi: " + zfi.toString());

			return true;
		},

		compare: function(gid)
		{
			var aNeverSynced   = new Object();
			var aChangeOfNote  = new Object(); // not any old change, but a change where the ms or md attributes incremented
			var aVerMatchesGid = new Object();
			var ret = null;

			var functor_each_luid_in_gid = {
				run: function(sourceid, luid)
				{
					if (sourceid == ZinFeedItem.ATTR_VER)
						return true;

					var zfi = aZfcCandidate[sourceid].get(luid);
					var msg = "885435 - sourceid: " + sourceid + " zfi: " + zfi.toString();

					if (!zfi.isPresent(ZinFeedItem.ATTR_LS))
					{
						aNeverSynced[sourceid] = true;
						msg += " added to aNeverSynced";
					}
					else
					{
						var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));
						var gid = reverse[sourceid][luid];

						gLogger.debug("885438 - gid: " + gid + " gid's ver: " + zfcGid.get(gid).get(ZinFeedItem.ATTR_VER) +
									  " zfi: " + zfi.toString() +
						              " lso: " + lso.toString() + " lso.compare == " + lso.compare(zfi));

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
							}
						}
					}

					gLogger.debug(msg);

					return true;
				}
			};

			zfcGid.get(gid).forEach(functor_each_luid_in_gid, ZinFeedItem.ITER_SOURCEID);

			var cNeverSynced   = aToLength(aNeverSynced);
			var cVerMatchesGid = aToLength(aVerMatchesGid);
			var cChangeOfNote  = aToLength(aChangeOfNote);

			gLogger.debug("885439 - aNeverSynced: "   + aToString(aNeverSynced));
			gLogger.debug("885439 - aVerMatchesGid: " + aToString(aVerMatchesGid));
			gLogger.debug("885439 - aChangeOfNote: "  + aToString(aChangeOfNote));

			cnsAssert(cNeverSynced == 0 || cNeverSynced == 1);

			if (cNeverSynced == 1)
			{
				cnsAssert(cVerMatchesGid == 0 && cChangeOfNote == 0);
				
				ret = new Gcs(propertyFromObject(aNeverSynced), Gcs.WIN);
			}
			else if (cChangeOfNote == 0)
			{
				cnsAssert(isPropertyPresent(aVerMatchesGid, sourceid_tb));
				ret = new Gcs(sourceid_tb, Gcs.WIN);
			}
			else if (cChangeOfNote == 1)
				ret = new Gcs(propertyFromObject(aChangeOfNote), Gcs.WIN);
			else
			{
				var lowest_sourceid = 100000;

				for (var i in aChangeOfNote)
					if (aChangeOfNote[i] < lowest_sourceid)
						lowest_sourceid = aChangeOfNote[i];

				ret = new Gcs(lowest_sourceid, Gcs.CONFLICT);
			}

			gLogger.debug("885439 - compare(" + gid + ") returns: " + ret.toString());

			return ret;
		}
	};

	var sources = this.state.sources; // bring the name into scope

	for (sourceid in this.state.sources)
		aZfcCandidate[sourceid].forEach(functor_foreach_candidate, ZimbraFsm.forEachFlavour(this.state.sources[sourceid]['format']));
	
	for (var gid in aGcs)
		gLogger.debug("aGcs[" + gid + "]: " + aGcs[gid].toString());

	return aGcs;
}

// This method builds the list of (MDU) operations required to update the meta-data for winners.
// - if a winning item is new to the gid, generate an MDU operation (which will create the version)
// - if a winning item was already in the gid and changed, generate an MDU operation (which will bump it's version)
// - if a winning item was already in the gid but didn't change, do nothing
//
ZimbraFsm.prototype.suoBuildWinners = function(aGcs)
{
	var zfcGid     = this.state.zfcGid;
	var aSuoResult = new Array();
	var suo;

	for (var gid in aGcs)
	{
		suo = null;

		var msg = "55432 - suoBuildWinners:";

		switch (aGcs[gid].state)
		{
			case Gcs.WIN:
			case Gcs.CONFLICT:
				var winner    = aGcs[gid].sourceid_winner;
				var sourceid  = winner;
				var zfcWinner = this.state.sources[winner]['zfcLuid']; // this.getZfc(winner) 
				var zfiWinner = zfcWinner.get(zfcGid.get(gid).get(winner)); // this.getLuid(collection, sourceid)
				// this.getZfc(winner).getLuid(collection, sourceid)

				msg += " gid: " + gid + " target sourceid: " + sourceid;

				if (!zfiWinner.isPresent(ZinFeedItem.ATTR_LS)) // winner is new to gid
				{
					cnsAssert(!zfcGid.get(gid).isPresent(ZinFeedItem.ATTR_VER));

					cnsAssert(zfcGid.get(gid).length() == 2); // just the id property and the winning sourceid

					msg += " - winner is new to gid  - MDU";

					suo = new Suo(gid, aGcs[gid].sourceid_winner, sourceid, Suo.MDU);
				}
				else
				{
					var lso = new Lso(zfiWinner.get(ZinFeedItem.ATTR_LS));
					var res = lso.compare(zfiWinner);

					cnsAssert(lso.get(ZinFeedItem.ATTR_VER) == zfcGid.get(gid).get(ZinFeedItem.ATTR_VER));
					cnsAssert(res >= 0); // winner either changed in an interesting way or stayed the same

					if (res == 1)
					{
						msg += " - winner changed in an interesting way - MDU";
						suo = new Suo(gid, aGcs[gid].sourceid_winner, sourceid, Suo.MDU);
					}
					else
						msg += " - winner didn't change - do nothing";
				}
				break;

			default:
				cnsAssert(false);
		}

		gLogger.debug(msg);

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

ZimbraFsm.prototype.suoBuildLosers = function(aGcs)
{
	var zfcGid     = this.state.zfcGid;
	var aSuoResult = new Object();
	var indexSuo   = 0;
	var suo;

	for (sourceid in this.state.sources)
		aSuoResult[sourceid] = new Object();

	for (var gid in aGcs)
		for (sourceid in this.state.sources)
			if (sourceid != aGcs[gid].sourceid_winner) // only look at losers
	{
		suo = null;

		var msg = "55434 - suoBuildLosers:";

		switch (aGcs[gid].state)
		{
			case Gcs.WIN:
			case Gcs.CONFLICT:
			{
				var winner = aGcs[gid].sourceid_winner;
				var zfcWinner = this.state.sources[winner]['zfcLuid'];
				var zfcTarget = this.state.sources[sourceid]['zfcLuid'];
				var zfiWinner = zfcWinner.get(zfcGid.get(gid).get(winner));

				msg += " gid: " + gid + " target sourceid: " + sourceid;
				// gLogger.debug("blah: gid: " + gid + " target sourceid: " + sourceid);

				if (!zfcGid.get(gid).isPresent(sourceid))
				{
					// when we delete, we actually move to trash on zimbra
					// when zimbra's trash gets emptied, we see the deletes, by which time the item is long gone from the original source
					// so here, we only add items to the gid if the winner is of interest (and not deleted)
					//
					if (!zfiWinner.isPresent(ZinFeedItem.ATTR_DEL) && ZimbraFsm.isOfInterest(zfcWinner, zfiWinner.id()))
					{
						msg += " - source not present in gid";
						suo = new Suo(gid, aGcs[gid].sourceid_winner, sourceid, Suo.ADD);
					}
				}
				else if (this.isLsoVerMatch(gid, zfcTarget.get(zfcGid.get(gid).get(sourceid))))
					msg += " lso and version match gid - do nothing"; // do nothing
				else if (zfiWinner.isPresent(ZinFeedItem.ATTR_DEL))
					suo = new Suo(gid, winner, sourceid, Suo.DEL);
				else if (!ZimbraFsm.isOfInterest(zfcWinner, zfiWinner.id()))
					suo = new Suo(gid, winner, sourceid, Suo.DEL);
				else
					suo = new Suo(gid, winner, sourceid, Suo.MOD);

				break;
			}
			default:
				cnsAssert(false);
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

		gLogger.debug(msg);
	}

	return aSuoResult;
}

ZimbraFsm.prototype.settleSomeConflicts = function()
{
}

ZimbraFsm.prototype.buildPreUpdateWinners = function(aGcs)
{
	for (var gid in aGcs)
	{
		var sourceid = aGcs[gid].sourceid_winner;
		var zfc      = this.state.sources[sourceid]['zfcLuid'];
		var luid     = this.state.zfcGid.get(gid).get(sourceid);
		var zfi      = cnsCloneObject(zfc.get(luid));

		zfi.set(ZinFeedItem.ATTR_ID, gid);

		this.state.zfcPreUpdateWinners.set(zfi);
	}
}

ZimbraFsm.prototype.suoRunWinners = function(aSuoWinners)
{
	if (0) // just experimenting...
	{
	var sci = new SuoCollectionIterator(aSuoWinners);

	var key = sci.getNext();

	while (key)
	{
		suo = aSuoWinners.get(key);
	}
	}

	for (var i = 0; i < aSuoWinners.length; i++)
	{
		suo = aSuoWinners[i];

		gLogger.debug("2277 - acting on suo: - " + " suo: "  + suo.toString());

		var zfcWinner   = this.state.sources[suo.sourceid_winner]['zfcLuid'];
		var luid_winner = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);

		this.resetLsoVer(suo.gid, zfcWinner.get(luid_winner));
	}
}

ZimbraFsm.prototype.entryActionLoadTb = function(state, event, continuation)
{
	this.initialiseMapsIfRequired();             // 1.  in case someone deleted the map files...
	this.updateTbLuidMap();                      // 2.  update the local thunderbird map...
	continuation('evNext');
}

ZimbraFsm.prototype.entryActionSyncPrepare = function(state, event, continuation)
{
	var aSuoWinners;

	this.buildReverseGid();                      // 3.  build this.state.aReverse from the gid
	this.updateGidFromSources();                 // 4.  map all luids into a single namespace (the gid)
	var aGcs = this.buildGcs();                  // 5.  reconcile the sources (via the gid) into a single truth (the sse output array) 
	this.buildPreUpdateWinners(aGcs);            // 6.  save state of winners before they are updated (to distinguish an ms vs md update)
	this.settleSomeConflicts();                  // 7.  a bit of conflict handling
	aSuoWinners = this.suoBuildWinners(aGcs);    // 8.  generate operations required to bring meta-data for winners up to date
	this.suoRunWinners(aSuoWinners);             // 9.  run the operations for winners
	this.state.aSuo = this.suoBuildLosers(aGcs); // 10. generate the operations required to bring the losing sources up to date
	                                             // ... subsequent state(s) run the suo's for the losers in this.state.aSuo

	continuation('evNext');
}

ZimbraFsm.prototype.entryActionUpdateTb = function(state, event, continuation)
{
	var i, gid, id, type, sourceid_target, luid_winner, luid_target, zfcWinner, zfcTarget, zfcGid, zfiWinner, zfiGid;
	var zc, uri, abCard, l_winner, l_gid, l_target, l_current, properties, attributes, msg;

	var SORT_ORDER = [ Suo.DEL | ZinFeedItem.TYPE_CN, Suo.DEL | ZinFeedItem.TYPE_FL, 
	                   Suo.MOD | ZinFeedItem.TYPE_FL, Suo.MOD | ZinFeedItem.TYPE_CN,
	                   Suo.ADD | ZinFeedItem.TYPE_FL, Suo.ADD | ZinFeedItem.TYPE_CN ];

	for (var i = 0; i < SORT_ORDER.length; i++)
		if (isPropertyPresent(this.state.aSuo[this.state.sourceid_tb], SORT_ORDER[i]))
			for (var indexSuo in this.state.aSuo[this.state.sourceid_tb][SORT_ORDER[i]])
	{
		suo = this.state.aSuo[this.state.sourceid_tb][SORT_ORDER[i]][indexSuo];
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
		msg = "";

		gLogger.debug("2277 - acting on suo: - opcode: " + Suo.opcodeAsString(SORT_ORDER[i] & Suo.MASK)
			+ " type: " + ZinFeedItem.typeAsString(SORT_ORDER[i] & ZinFeedItem.TYPE_MASK)
			+ " suo: "  + this.state.aSuo[this.state.sourceid_tb][SORT_ORDER[i]][indexSuo].toString());


		switch(SORT_ORDER[i])
		{
			case Suo.ADD | ZinFeedItem.TYPE_CN:
				// allocate a new luid in the source map
				// add to thunderbird addressbook
				// add the luid in the source map (zfc)
				// update the gid with the new luid
				// update the reverse array 

				luid_target = ZinFeed.autoIncrement(zfcTarget.get(ZinFeedItem.ID_AUTO_INCREMENT), 'next');

				cnsAssert(this.state.aSyncContact, luid_winner);
				zc = this.state.aSyncContact[luid_winner]; // the ZimbraContact object that arrived via GetContactResponse

				msg += "About to add a contact to the thunderbird addressbook, gid: " + gid + " and luid_winner: " + luid_winner;

				cnsAssert(typeof(zc != 'undefined'));

				attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
				properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

				msg += " properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

				l_winner = zfiWinner.get('l');                                // luid of the parent folder in the source
				l_gid    = this.state.aReverseGid[sourceid_winner][l_winner]; // gid  of the parent folder
				l_target = zfcGid.get(l_gid).get(sourceid_target); // luid of the parent folder in the target
				uri      = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abCard   = ZimbraAddressBook.addCard(uri, FORMAT_TB, properties, attributes);

				// msg += " l_winner: " + l_winner + " l_gid: " + l_gid + " l_target: " + l_target + " parent uri: " + uri;

				zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, luid_target , ZinFeedItem.ATTR_MD, abCard.lastModifiedDate, ZinFeedItem.ATTR_REV, 1, 'l', l_target));

				zfiGid.set(sourceid_target, luid_target);
				this.state.aReverseGid[sourceid_target][luid_target] = gid;
				break;

			case Suo.ADD | ZinFeedItem.TYPE_FL:
				var name   = zfiWinner.get('name');
				var abName = ZimbraFsm.getAddressBookName(name);

				if (!ZimbraAddressBook.getAddressBookUri(abName))
				{
					msg += "About to add a thunderbird addressbook (folder), gid: " + gid + " and luid_winner: " + luid_winner;

					uri = ZimbraAddressBook.newAddressBook(abName);

					luid_target = ZinFeed.autoIncrement(zfcTarget.get(ZinFeedItem.ID_AUTO_INCREMENT), 'next');

					zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_ID, luid_target, 'name', name, 'l', 1,
					                       ZinFeedItem.ATTR_MS, 1,
										   ZinFeedItem.ATTR_TPI, ZimbraAddressBook.getAddressBookPrefId(uri)));

					zfiGid.set(sourceid_target, luid_target);
					this.state.aReverseGid[sourceid_target][luid_target] = gid;
				}
				else
					gLogger.warn("Was about to create an addressbook: " + abName + " but it already exists.");  // TODO - this might happen if the user created an addressbook both locally and on a server with the same name - how to handle?

				break;

			case Suo.MOD | ZinFeedItem.TYPE_CN:
				// there are two scenarios here:
				// 1. the contact's content didn't change, it just got moved from one folder to another (l attribute in the map changed)
				// 2. the contact's content changed (might have changed folders as well)
				// These scenarios are distinguished by whether the zimbra server bumped the rev attribute or not.
				// See: http://wiki.ho.moniker.net/index.php/LedapZimbraSynchronisation#rev_attribute
				// A content change bumps the rev attribute in which case we would have issued a GetContactRequest
				// So in the event of a content change, the source is this.state.aSyncContact[luid_winner],
				// otherwise it's the contact in the thunderbird addressbook.
				//
				luid_target = zfiGid.get(sourceid_target);
				l_winner    = zfiWinner.get('l');                                // luid of the parent folder in the winner
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner]; // gid  of the parent folder
				l_target    = zfcGid.get(l_gid).get(sourceid_target);            // luid of the winner's parent folder in the target
				l_current   = zfcTarget.get(luid_target).get('l');               // luid of the target's parent folder before changes

				msg += "About to modify a contact in the addressbook, gid: " + gid;
				msg += " l_winner: " + l_winner + " l_gid: " + l_gid + " l_target: " + l_target + " l_current: " + l_current;

				if (l_target == l_current)
				{
					// if the parent folder hasn't changed, there must have been a content change on the server
					// in which case rev was bumped and we issued a GetContactRequest
					// Now, overwrite the card...
					//
					msg += " - parent folder hasn't changed";

					cnsAssert(isPropertyPresent(this.state.aSyncContact, luid_winner));

					uri    = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					gLogger.debug("2277: uri: " + uri + " luid_target: " + luid_target);
					abCard = ZimbraAddressBook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);
					gLogger.debug("2277: card: " + abCard);

					if (abCard)
					{
						zc = this.state.aSyncContact[luid_winner];

						attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
						properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

						msg += " setting card to: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						ZimbraAddressBook.updateCard(abCard, uri, FORMAT_TB, properties, attributes);
					}
				}
				else
				{
					msg += " - parent folder changed"; // implement as delete+add

					var uri_from = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_current));
					var uri_to   = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
					abCard       = ZimbraAddressBook.lookupCard(uri_from, TBCARD_ATTRIBUTE_LUID, luid_target);

					if (abCard)
					{
						if (isPropertyPresent(this.state.aSyncContact, luid_winner))
						{
							zc         = this.state.aSyncContact[luid_winner];
							attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid_target);
							properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, zc.element);

							msg += " - content changed";
						}
						else
						{
							attributes = ZimbraAddressBook.getCardAttributes(abCard);
							properties = ZimbraAddressBook.getCardProperties(abCard, FORMAT_TB);

							msg += " - content didn't change";
						}

						var cardsToBeDeletedArray = Components.classes["@mozilla.org/supports-array;1"].createInstance().
						                                   QueryInterface(Components.interfaces.nsISupportsArray);
						cardsToBeDeletedArray.AppendElement(abCard);

						ZimbraAddressBook.deleteCards(uri_from, cardsToBeDeletedArray);

						msg += " - card deleted - card added: properties: " + aToString(properties) + " and attributes: " + aToString(attributes);

						ZimbraAddressBook.addCard(uri_to, FORMAT_TB, properties, attributes);
					}
				}

				if (abCard)
					zfcTarget.set(new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, luid_target , ZinFeedItem.ATTR_MD, abCard.lastModifiedDate, ZinFeedItem.ATTR_REV, 1, 'l', l_target));  // rev gets reset to 1 on each modification - no big deal
				else
				{
					luid_target = null;
					gLogger.warn("Can't find card to modify in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");
				}

				break;

			case Suo.MOD | ZinFeedItem.TYPE_FL:
				luid_target = zfiGid.get(sourceid_target);
				uri         = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, luid_target));

				if (uri)
				{
					msg += "About to rename a thunderbird addressbook (folder), gid: " + gid + " and luid_winner: " + luid_winner;

					cnsAssert(zfiWinner.get('l') == 1); // luid of the parent folder in the winner == 1

					ZimbraAddressBook.renameAddressBook(uri, this.getTbAddressbookNameFromLuid(sourceid_winner, luid_winner));

					zfcTarget.get(luid_target).set('name', zfcWinner.get(luid_winner).get('name'));
					ZinFeed.autoIncrement(zfcTarget.get(luid_target), ZinFeedItem.ATTR_MS);
				}
				else
				{
					gLogger.warn("Was about to rename an addressbook: " + this.getTbAddressbookNameFromLuid(sourceid_target, luid_target) +
					             " but it didn't exist.  This shouldn't happen.");

					luid_target = null
				}

				break;

			case Suo.DEL | ZinFeedItem.TYPE_CN:
				luid_target = zfiGid.get(sourceid_target);
				l_target    = zfcTarget.get(luid_target).get('l');
				uri         = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, l_target));
				abCard      = ZimbraAddressBook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid_target);

				if (abCard)
				{
					msg += "Card to be deleted: " + ZimbraAddressBook.nsIAbCardToPrintable(abCard);

					var cardsToBeDeletedArray = Components.classes["@mozilla.org/supports-array;1"].createInstance().
					                                   QueryInterface(Components.interfaces.nsISupportsArray);
					cardsToBeDeletedArray.AppendElement(abCard);

					ZimbraAddressBook.deleteCards(uri, cardsToBeDeletedArray);

					zfcTarget.get(luid_target).set(ZinFeedItem.ATTR_DEL, 1);
				}
				else
				{
					gLogger.warn("Can't find card to delete in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");

					luid_target = null;
				}

				break;

			case Suo.DEL | ZinFeedItem.TYPE_FL:
				luid_target = zfiGid.get(sourceid_target);
				uri         = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid_target, luid_target));

				if (uri)
				{
					msg += "Addressbook to be deleted: name: " + zfcTarget.get(luid_target).get('name') + " uri: " + uri;

					ZimbraAddressBook.deleteAddressBook(uri);
					zfcTarget.get(luid_target).set(ZinFeedItem.ATTR_DEL, 1);
				}
				else
				{
					gLogger.warn("Can't find addressbook to delete in the addressbook: luid: "+ luid_target + " - this shouldn't happen.");

					luid_target = null;
				}

				break;

			default:
				cnsAssert(false);
		}

		if (luid_target)
			ZimbraFsm.setLsoToGid(zfiGid, zfcTarget.get(luid_target));

		gLogger.debug("2277: " + msg);
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
// 2. SORT_ORDER
//    the sort order for zimbra is a bit different from thunderbird.  With zimbra, we delete folders first, because
//    on successful deletion of a folder, pending delete operations on that folder's contacts are removed on the
//    assumption that they weren't deleted individually but were deleted consequential to the deletion of the Tb AddressBook
//    (even though we have no way of knowing one way or the other)
//

ZimbraFsm.prototype.entryActionUpdateZm = function(state, event, continuation)
{
	var SORT_ORDER = [ Suo.DEL | ZinFeedItem.TYPE_FL, Suo.DEL | ZinFeedItem.TYPE_CN, 
	                   Suo.MOD | ZinFeedItem.TYPE_FL, Suo.MOD | ZinFeedItem.TYPE_CN,
	                   Suo.ADD | ZinFeedItem.TYPE_FL, Suo.ADD | ZinFeedItem.TYPE_CN ];
	                 
	var soapMethod;
	var soapArg = new Object();
	var bucket  = null;
	var msg = "";
	var indexSuo = null;
	var sourceid, sourceid_winner, sourceid_target, uri, zfcWinner, zfcWinner, zfiWinner, l_gid, l_winner, l_target, name_winner, type;
	var properties;

	for (sourceid in this.state.sources)
		if (this.state.sources[sourceid]['format'] == FORMAT_ZM)
			for (var i = 0; i < SORT_ORDER.length && !bucket; i++)
				if (isPropertyPresent(this.state.aSuo[sourceid], SORT_ORDER[i]))
					for (indexSuo in this.state.aSuo[sourceid][SORT_ORDER[i]])
	{
		gLogger.debug("entryActionUpdateZm: " +
				" opcode: " + Suo.opcodeAsString(SORT_ORDER[i] & Suo.MASK) +
				" type: "   + ZinFeedItem.typeAsString(SORT_ORDER[i] & ZinFeedItem.TYPE_MASK) );

		gLogger.debug("entryActionUpdateZm: suo[" + indexSuo + "] ==  " + this.state.aSuo[sourceid][SORT_ORDER[i]][indexSuo].toString());

		suo             = this.state.aSuo[sourceid][SORT_ORDER[i]][indexSuo];
		sourceid_winner = suo.sourceid_winner;
		sourceid_target = suo.sourceid_target;
		luid_winner     = this.state.zfcGid.get(suo.gid).get(suo.sourceid_winner);
		zfcWinner       = this.state.sources[suo.sourceid_winner]['zfcLuid'];
		zfcTarget       = this.state.sources[suo.sourceid_target]['zfcLuid'];
		zfiWinner       = zfcWinner.get(luid_winner);
		l_winner        = zfiWinner.get('l');

		switch(SORT_ORDER[i])
		{
			case Suo.ADD | ZinFeedItem.TYPE_FL:
				name_winner = zfiWinner.get('name');
				soapMethod  = "CreateFolder";
				soapArg     = newObject('name', name_winner, 'l', l_winner);
				bucket      = SORT_ORDER[i];
				msg        += " about to add folder name: " + name_winner + " l: " + l_winner;
				break;

			case Suo.ADD | ZinFeedItem.TYPE_CN:
				l_gid      = this.state.aReverseGid[sourceid_winner][l_winner];
				l_target   = this.state.zfcGid.get(l_gid).get(sourceid_target);
				properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
				soapMethod = "CreateContact";
				soapArg    = newObject('properties', properties, 'l', l_target);
				bucket     = SORT_ORDER[i];
				msg       += " about to add contact: " + properties;
				break;

			case Suo.MOD | ZinFeedItem.TYPE_FL:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				name_winner = zfiWinner.get('name');
				soapMethod  = "FolderAction";
				soapArg     = newObject('id', luid_target, 'op', 'update', 'name', name_winner);
				bucket      = SORT_ORDER[i];
				msg        += " about to rename folder: ";
				break;

			case Suo.MOD | ZinFeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				l_gid       = this.state.aReverseGid[sourceid_winner][l_winner];
				l_target    = this.state.zfcGid.get(l_gid).get(sourceid_target);
				msg        += " about to modify contact: ";
				soapMethod  = null;

				if (this.state.sources[sourceid_winner]['format'] == FORMAT_TB) // always a content update 
					soapMethod = "ModifyContact";
				else
				{
					// look at the pre-update zfi:
					// if rev was bumped ==> content update  ==> ModifyContactRequest ==> load content from zc
					// if ms  was bumped ==> attributes only ==> ContactActionRequest ==> load content from zc
					//
					var zfi = this.state.zfcPreUpdateWinners.get(suo.gid);
					var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));

					soapMethod = (zfi.get(ZinFeedItem.ATTR_MD) > lso.get(ZinFeedItem.ATTR_MD)) ? "ModifyContact" : "ContactAction";
				}

				if (soapMethod == "ModifyContact")
				{
					properties = this.getContactFromLuid(sourceid_winner, luid_winner, FORMAT_ZM);
					soapArg    = newObject('id', luid_target, 'properties', properties, 'l', l_target);
					bucket     = SORT_ORDER[i];
				}
				else if (soapMethod == "ContactAction")
				{
					soapArg    = newObject('id', luid_target, 'op', 'move', 'l', l_target);
					bucket     = SORT_ORDER[i];
				}
				else
					cnsAssert(false);
				break;

			case Suo.DEL | ZinFeedItem.TYPE_FL:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				name_winner = zfiWinner.get('name');
				soapMethod  = "FolderAction";
				bucket      = SORT_ORDER[i];
				msg        += " about to move folder to trash: " + name_winner;

				if (this.isFolderPresentInSource(sourceid_target, ZIMBRA_ID_TRASH, name_winner))
				{
					var d = new Date(); // with this new name, the "move to trash" has a fighting change of success!
					// would prefer an iso8601 date but zimbra doesnt allow folder names to contain colons
					var newname = "/Trash/" + name_winner + "-" + hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	        		                                       "-" + hyphenate("-", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

					msg += " - avoiding name clash in Trash by renaming this folder to: " + newname;

					// with op=update, the server does the move before the rename so still fails because of folder name conflict in Trash
					// soapArg     = newObject('id', luid_target, 'op', 'update', 'name', newname, 'l', ZIMBRA_ID_TRASH);
					soapArg     = newObject('id', luid_target, 'op', 'rename', 'name', newname);
				}
				else
					soapArg     = newObject('id', luid_target, 'op', 'move', 'l', ZIMBRA_ID_TRASH);
				break;

			case Suo.DEL | ZinFeedItem.TYPE_CN:
				luid_target = this.state.zfcGid.get(suo.gid).get(sourceid_target);
				type        = SORT_ORDER[i] & ZinFeedItem.TYPE_MASK;
				soapMethod  = "ContactAction";
				soapArg     = newObject('id', luid_target, 'op', 'move', 'l', ZIMBRA_ID_TRASH);
				bucket      = SORT_ORDER[i];
				msg        += " about to move contact to trash.";
				break;

			default:
				cnsAssert(false);
		}

		if (bucket)
			break;
	}

	gLogger.debug("entryActionUpdateZm: " + msg);

	this.state.updateZmPackage = null;

	if (bucket)
	{
		this.state.updateZmPackage = newObject('sourceid', sourceid, 'bucket', bucket, 'indexSuo', indexSuo,
		                                       'soapmethod', soapMethod, 'soaparg', soapArg);

		gLogger.debug("entryActionUpdateZm: updateZmPackage: " + aToString(this.state.updateZmPackage));

		this.callSoapFsm(continuation, this.eventFromSoapDefault, "evRepeat",
		                           this.state.updateZmPackage.soapmethod, this.state.updateZmPackage.soaparg);
	}
	else
	{
		this.soapfsm.state.response = null;
		continuation('evNext');
	}
}

ZimbraFsm.prototype.exitActionUpdateZm = function(state, event)
{
	if (!this.soapfsm.state.response)
		return;

	var msg, suo, xpath_query, functor;
	var response = this.soapfsm.state.response;
	var change = new Object();
	var updateZmPackage = this.state.updateZmPackage;
	var msg = "3377: ";

	ZinXpath.setConditional(change, 'token', "/soap:Envelope/soap:Header/z:context/z:change/attribute::token", response, null);

	if (!isPropertyPresent(change, 'token'))
	{
		gLogger.error("No change token found.  This shouldn't happen.  Ignoring soap response.");

		delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket];  // drastic, but it ensures we don't end up in a loop

		return;
	}

	gLogger.debug("33771: updateZmPackage: " + aToString(updateZmPackage) + " and change.token: " + change.token);

	var functor_create_blah_response = {
		state: this.state,

		run: function(doc, node)
		{
			var attribute = attributesFromNode(node);
			var l    = attribute['l'];
			var id   = attribute['id'];
			var type = updateZmPackage.bucket & ZinFeedItem.TYPE_MASK;

			if (updateZmPackage.soapmethod == "CreateFolder")
				msg += "created: <folder id='" + id + "' l='" + l + "' name='" + attribute['name'] + "'>";
			else if (updateZmPackage.soapmethod == "CreateContact")
				msg += "created: <cn id='" + id +"' l='" + l + "'>";
			else if (updateZmPackage.soapmethod == "ModifyContact")
				msg += "modified: <cn id='" + id + "'>";

			if (!isPropertyPresent(attribute, 'id') || !isPropertyPresent(attribute, 'l'))
				gLogger.error("<folder> element received seems to be missing an 'id' or 'l' attribute - ignoring: " + aToString(attribute));
			else
			{
				gLogger.debug("updateZmPackage.indexSuo: " + updateZmPackage.indexSuo);

				suo = this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				var zfiGid = this.state.zfcGid.get(suo.gid);
				zfcTarget = this.state.sources[suo.sourceid_target]['zfcLuid'];
				var zfi;

				if (updateZmPackage.soapmethod == "ModifyContact")
				{
					zfi = zfcTarget.get(id);
					zfi.set(attribute)
					zfi.set(ZinFeedItem.ATTR_MS, change.token);
					ZimbraFsm.setLsoToGid(zfiGid, zfi);
					msg += " - updated luid and gid"; 
				}
				else
				{
					zfi = new ZinFeedItem(type, attribute);
					zfi.set(ZinFeedItem.ATTR_MS, change.token);
					ZimbraFsm.setLsoToGid(zfiGid, zfi);

					zfcTarget.set(zfi);

					zfiGid.set(suo.sourceid_target, id);
					this.state.aReverseGid[suo.sourceid_target][id] = suo.gid;
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

			if (!isPropertyPresent(attribute, 'id'))
				gLogger.error("<action> element received seems to be missing an 'id' attribute - ignoring: " + aToString(attribute));
			else
			{
				suo = this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket][updateZmPackage.indexSuo];

				var zfcTarget   = this.state.sources[suo.sourceid_target]['zfcLuid'];
				var luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
				var zfiTarget   = zfcTarget.get(luid_target);

				if (updateZmPackage.bucket == (Suo.DEL | ZinFeedItem.TYPE_FL))
					zfiTarget.set('l', ZIMBRA_ID_TRASH);
				else
					zfiTarget.set(updateZmPackage.soaparg);

				zfiTarget.set(ZinFeedItem.ATTR_MS, change.token);
				ZimbraFsm.setLsoToGid(this.state.zfcGid.get(suo.gid), zfiTarget);

				if (updateZmPackage.bucket == Suo.DEL | ZinFeedItem.TYPE_FL)
				{
					// iterate through aSuo, and remove operations that delete child contacts of this folder (now in Trash)
					//
					var aSuoDelContacts = this.state.aSuo[suo.sourceid_target][Suo.DEL | ZinFeedItem.TYPE_CN];

					for (var indexSuo in aSuoDelContacts)
					{
						suo         = aSuoDelContacts[indexSuo];
						luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);
						l_target    = zfcTarget.get(luid_target).get("l");

						if (id == l_target)
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
			if (updateZmPackage.soapmethod == "ModifyContact")
			{
				xpath_query = "/soap:Envelope/soap:Body/zm:ModifyContactResponse/zm:cn";
				functor = functor_create_blah_response;
			}
			else if (updateZmPackage.soapmethod == "ContactAction")
			{
				xpath_query = "/soap:Envelope/soap:Body/zm:ContactActionResponse/zm:action";
				functor = functor_action_response;
			}
			else
				cnsAssert(false);
			break;
		case Suo.DEL | ZinFeedItem.TYPE_FL:
			xpath_query = "/soap:Envelope/soap:Body/zm:FolderActionResponse/zm:action";
			functor = functor_action_response;
			break;
		case Suo.DEL | ZinFeedItem.TYPE_CN:
			xpath_query = "/soap:Envelope/soap:Body/zm:ContactActionResponse/zm:action";
			functor = functor_action_response;
			break;
		default:
			cnsAssert(false);
	}

	ZinXpath.runFunctor(functor, xpath_query, this.soapfsm.state.response);

	gLogger.debug(msg);

	if (aToLength(this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket]) == 0)
	{
		delete this.state.aSuo[updateZmPackage.sourceid][updateZmPackage.bucket];  // delete empty buckets
		gLogger.debug("33771: deleted aSuo sourceid: " + sourceid + " bucket: " + updateZmPackage.bucket);
	}
}

ZimbraFsm.prototype.getContactFromLuid = function(sourceid, luid, format_to)
{
	var zfc = this.state.sources[sourceid]['zfcLuid'];
	var zfi = zfc.get(luid);
	var l   = zfi.get('l');
	var ret = null;

	if (this.state.sources[sourceid]['format'] == FORMAT_TB)
	{
		var uri    = ZimbraAddressBook.getAddressBookUri(this.getTbAddressbookNameFromLuid(sourceid, l));
		var abCard = ZimbraAddressBook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

		if (abCard)
			ret = ZimbraAddressBook.getCardProperties(abCard, format_to);
		else
			gLogger.warn("can't find contact for to sourceid: " + sourceid + " and luid: " + luid + " in thunderbird addressbook uri: " + uri + " - this shouldn't happen.");
	}
	else
	{
		var zc = this.state.aSyncContact[luid_winner]; // the ZimbraContact object that arrived via GetContactResponse
		ret = CnsContactConverter.instance().convert(format_to, FORMAT_ZM, zc.element);
	}

	return ret;
}

ZimbraFsm.prototype.entryActionUpdateCleanup = function(state, event, continuation)
{
	var gid;
	var aGidsToDelete = new Array();

	// gLogger.debug("998899: after UpdateZm, zfcZm: " + this.state.sources[this.state.sourceid_zm]['zfcLuid'].toString());
	// gLogger.debug("998899: after UpdateZm, zfcGid: " + this.state.zfcGid.toString());

	// 1. delete the gid when all the mapitems source maps have a ZinFeedItem.ATTR_DEL attribute
	//    delete the mapping between a gid and an luid when the luid is not of interest
	
	var functor_foreach_luid = {
		state: this.state,
		run: function(zfi)
		{
			var luid = zfi.id();
			var gid = isPropertyPresent(this.state.aReverseGid[sourceid], luid) ? this.state.aReverseGid[sourceid][luid] : null;
			var zfc = this.state.sources[sourceid]['zfcLuid'];

			// delete luids and their link to the gid when ZinFeedItem.ATTR_DEL is set
			//
			if (zfi.isPresent(ZinFeedItem.ATTR_DEL))
			{
				zfc.del(luid);
				gLogger.debug("2332 - cleanup: sourceid: " + sourceid + " - deleted luid: " + luid);

				if (gid)
				{
					this.state.zfcGid.get(gid).del(sourceid);
					delete this.state.aReverseGid[sourceid][luid];

					gLogger.debug("2332 - cleanup: gid: " + gid + " - deleted reference to sourceid: " + sourceid);
				}
			}
			else if (this.state.sources[sourceid]['format'] == FORMAT_ZM && gid && !ZimbraFsm.isOfInterest(zfc, zfi.id()))
			{
				// for zimbra luids, delete the link to the gid if the luid is no longer of interest
				//
				this.state.zfcGid.get(gid).del(sourceid);
				delete this.state.aReverseGid[sourceid][luid];
				gLogger.debug("2332 - cleanup: gid: " + gid + " - deleted reference to sourceid: " + sourceid + " as the item is no longer of interest");
			}

			return true;
		}
	};

	for (sourceid in this.state.sources)
		this.state.sources[sourceid]['zfcLuid'].forEach(functor_foreach_luid, ZimbraFsm.forEachFlavour(this.state.sources[sourceid]['format']));

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

			zfi.forEach(functor_count_luids_in_gid, ZinFeedItem.ITER_SOURCEID);

			gLogger.debug("2332 - cleanup: zfi: " + zfi.toString() + " count: " + functor_count_luids_in_gid.count);

			if (functor_count_luids_in_gid.count == 0)
			{
				gLogger.debug("2332 - cleanup: gid: " + zfi.id() + " had no links to luids - deleted.");
				this.state.zfcGid.del(zfi.id());
			}

			return true;
		}
	};

	this.state.zfcGid.forEach(functor_foreach_gid, ZinFeedCollection.ITER_UNRESERVED);

	// sanity check, iterate through all sources
	// - confirm that there are no ZinFeedItem.ATTR_DEL flags in thunderbird sources
	// - there can only be a ZinFeedItem.ATTR_DEL flag in a zimbra source if there was a network or server failure
	// - confirm that everything in a source map is in the gid
	// - confirm that no item in a map has the 'present' flag - this should have got deleted and isn't meant to be persisted
	// - confirm that everything in the gid is in a source map
	// - warn if anything in the/a tb source isn't in the source map which
	//   could be because of an update parallel to sync or could indicate a problem

	if (0) // this is no longer relevant - OFI is gone...
	{
	var functor_cleanup_attributes = {
		run: function(zfi)
		{
			if (zfi.isPresent(ZinFeedItem.ATTR_OFI))
				zfi.del(ZinFeedItem.ATTR_OFI);

			return true;
		}
	};

	for (sourceid in this.state.sources)
		this.state.sources[sourceid]['zfcLuid'].forEach(functor_cleanup_attributes, ZimbraFsm.forEachFlavour(this.state.sources[sourceid]['format']));

	}

	continuation('evNext');
}

ZimbraFsm.prototype.entryActionCommit = function(state, event, continuation)
{
	this.state.zfcLastSync.get(this.state.sourceid_zm).set('SyncToken', this.state.SyncToken);

	this.state.zfcLastSync.save(ZinFeedCollection.fileName(ZimbraFsm.FILE_LASTSYNC));

	this.state.zfcGid.save(ZinFeedCollection.fileName(ZimbraFsm.FILE_GID));

	for (var i in this.state.sources)
		this.state.sources[i]['zfcLuid'].save(ZinFeedCollection.fileName(i, this.state.m_bimap_format.lookup(this.state.sources[i]['format'], null)));

	continuation('evNext');
}

ZimbraFsm.prototype.entryActionFinal = function(state, event, continuation)
{
}

ZimbraFsm.prototype.suoOpcode = function(suo)
{
	var type = this.feedItemTypeFromGid(suo.gid, suo.sourceid_winner);
	return (type | suo.opcode);
}

// if there's no ver in the gid, add it and reset the zfi ls
// else if the zfi ls doesn't match either the zfi or the gid attributes, bump the gid's ver and reset the zfi's ls
// otherwise do nothing
//
ZimbraFsm.prototype.resetLsoVer = function(gid, zfi)
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
		ZinFeed.autoIncrement(this.state.zfcGid.get(gid), ZinFeedItem.ATTR_VER);
		ver = zfiGid.get(ZinFeedItem.ATTR_VER);
	}

	if (ver)
	{
		lsoFromZfiAttributes.set(ZinFeedItem.ATTR_VER, ver);
		zfi.set(ZinFeedItem.ATTR_LS, lsoFromZfiAttributes.toString());

		gLogger.debug("9664: gid ver set to: " + ver + " and zfi: " + zfi.toString());
	}

}

ZimbraFsm.prototype.isFolderPresentInSource = function(sourceid, luid_parent, name)
{
	var isPresent = false;

	var functor = {
		run: function(zfi)
		{
			if (zfi.get('l') == luid_parent && zfi.isPresent('name') && zfi.get('name') == name)
				isPresent = true;

			return !isPresent;
		}
	};

	this.state.sources[sourceid]['zfcLuid'].forEach(functor, ZimbraFsm.forEachFlavour(this.state.sources[sourceid]['format']));

	return isPresent;
}

ZimbraFsm.prototype.feedItemTypeFromGid = function(gid, sourceid)
{
	var luid = this.state.zfcGid.get(gid).get(sourceid);
	return this.state.sources[sourceid]['zfcLuid'].get(luid).type();
}

ZimbraFsm.getAddressBookName = function()
{
	var ret = "zindus";

	if (arguments.length == 1)
		ret += "/" + arguments[0];

	return ret;
}

// TODO - assert that users can't add a "zindus/Trash" or "zindus/GAL" folder
//

ZimbraFsm.prototype.getTbAddressbookNameFromLuid = function(sourceid, luid)
{
	var zfc = this.state.sources[sourceid]['zfcLuid'];

	if (!zfc.isPresent(luid))
		gLogger.debug("552231 - blah: sourceid: " + sourceid + " luid: " + luid);

	cnsAssert(zfc.isPresent(luid));

	var name = zfc.get(luid).get('name');

	return ZimbraFsm.getAddressBookName(name);
}

ZimbraFsm.prototype.isLsoVerMatch = function(gid, zfi)
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

ZimbraFsm.getTbAddressbooks = function()
{
	var functor_foreach_addressbook = {
		prefix: ZimbraFsm.getAddressBookName(),
		result: new Array(),

		run: function(elem)
		{
			if (elem.dirName.substring(0, this.prefix.length) == this.prefix)
				this.result.push(elem.dirName);

			return true;
		}
	};

	ZimbraAddressBook.forEachAddressBook(functor_foreach_addressbook);

	gLogger.debug("getTbAddressbooks() returns: " + functor_foreach_addressbook.result.toString());

	return functor_foreach_addressbook.result;
}

ZimbraFsm.setLsoToGid = function(zfiGid, zfiTarget)
{
	var lso = new Lso(zfiTarget);
	var ver = zfiGid.get(ZinFeedItem.ATTR_VER);

	lso.set(ZinFeedItem.ATTR_VER, ver);

	zfiTarget.set(ZinFeedItem.ATTR_LS, lso.toString());
}

ZimbraFsm.forEachFlavour = function(format)
{
	return (format == FORMAT_ZM) ? ZinFeedCollection.ITER_ALL : ZinFeedCollection.ITER_UNRESERVED;
}

function SoapFsm()
{
	this.zsd   = null;
	this.state = new SoapFsmState();

	this.fsm = new Object();
	this.fsm.transitions = {
		start:          { evStart:        'stSoapResponse'                        },
		stSoapResponse: { evSoapResponse: 'final',          evSoapCancel: 'final' }
	};

	this.fsm.aActionEntry = {
		start:          this.entryActionStart,
		stSoapResponse: this.entryActionSoapResponse,
		final:               null // used to be this.entryActionFinal, now set by caller before machine starts
	};
}

SoapFsm.prototype.start = function(uri, zsd)
{
	this.state = new SoapFsmState();
	this.state.uri = uri;
	this.zsd       = zsd;

	fsmFireTransition(ZinMaestro.FSM_ID_SOAP, null, 'start', 'evStart', this);
}

SoapFsm.prototype.entryActionStart = function(state, event, continuation)
{
	continuation('evStart');
}

SoapFsm.prototype.entryActionSoapResponse = function(state, event, continuation)
{
	var soapCall   = new SOAPCall();
	var context    = this;

	soapCall.transportURI = this.state.uri;

	soapCall.message = this.zsd.doc;

	cnsAssert(!this.state.is_cancelled); // we shouldn't be here if we've called abort() on the callCompletion object!

	gLogger.debug("SoapFsm: request is " + xmlDocumentToString(soapCall.message));

	this.state.callCompletion = soapCall.asyncInvoke(
	        function (response, call, error)
			{
				context.handleAsyncResponse(response, call, error, continuation, context, gLogger);
			}
		);
}

SoapFsm.prototype.handleAsyncResponse = function (response, call, error, continuation, context, gLogger)
{
	var ret = false;

	cnsAssert(!context.state.is_cancelled); // we shouldn't be here because we called abort() on the callCompletion object!

	context.state.callCompletion = null; // don't need this anymore and setting it to null tells the world that no request is outstanding
	context.state.serviceCode = error;

	// four scenarios here:
	//   a) service failure
	//      - documentation says that this is reported by a non-zero value for the error argument
	//      - I also notice that when no web server is listening on the targetURI port, 
	//        this function is called with error == 0 but response == null.  This seems like a bug...
	//   b) soap fault and response.fault is non-null
	//      - there is some sub-scenario here whereby response.fault.detail might be missing, possibly because of a namespace muddle
	//      - the zimbra fault seems to stuff things up - need to isolate this test case better
	//   c) soap fault and response.fault is null and error = 0 but response is a soap:Fault element.
	//      This is a bug - either in zimbra's (document-style) response or mozilla
	//      - on the one hand, mozilla uses "http://www.w3.org/2001/09/soap-envelope" to indicate a soap 1.2 message
	//        this URL is now out of data - it should be http://www.w3.org/2003/05/soap-envelope
	//      - on the other hand, zimbra responds with the "2003" schema URL in response to a request that uses the "2001" schema URL
	//        This seems wrong - zimbra should respond either with the 2001 url or fall back to soap 1.1.
	//   d) <BlahResponse> document ==> success!
	//

	if (response == null && error == 0)
	{
		// this is a workaround for (what I think is) a mozilla bug
		// whereby if the web server isn't listening to the target URI,
		// the callback gets executed with a null response and error code zero.
		// here, we turn that into a non-zero error code.
		//
		context.state.serviceCode = SOAP_REQUEST_FAILED;
		gLogger.debug("SoapFsm.handleAsyncResponse: soap service failure - setting an arbitrary error code: " + context.state.serviceCod);
	}
	else if (error != 0)
	{ 
		gLogger.debug("SoapFsm.handleAsyncResponse: soap service failure - error code is " + error);
	}
	else 
	{
		gLogger.debug("SoapFsm.handleAsyncResponse: response.version is " + response.version);

		if (response.fault != null)
		{ 
			context.state.faultLoadFromSoapFault(response.fault);

			if (!context.state.faultString)
				context.state.faultLoadFromXml(response.fault.element);
		}
		else
		{
			var nodelist = response.message.getElementsByTagNameNS(ZimbraSoapDocument.NS_SOAP_ENVELOPE, "Fault");

			if (nodelist.length > 0)
			{
				context.state.faultLoadFromXml(response.message);
			}
			else
			{
				context.state.response = response.message;

				gLogger.debug("SoapFsm.handleAsyncResponse: response is " + xmlDocumentToString(response.message));
			}
		}
	}

	var msg;
	if (context.state.serviceCode != 0)
		msg = "soap service failure - serviceCode is " + context.state.serviceCode;
	else if (context.state.faultElementXml)
		msg = "soap fault: service code " + context.state.serviceCode;

	if (msg)
	{
		msg += " fault xml: " + context.state.faultElementXml;
		gLogger.debug("SoapFsm.handleAsyncResponse: " + msg);
	}

	continuation('evSoapResponse');

	return true;
}

SoapFsm.prototype.cancel = function(timeoutID)
{
	// if the user cancelled and there was a SoapFsm in progress then either:
	// - it had just started (newstate == start), in which case we have to clear it's timeout so that it doesn't continue, or
	// - it is waiting for a response from the server, in which case we have to abort the callCompletion object
	// A different way of handling either or both of these cases would have been for the syncfsm to set a flag in the soapfsm's state
	// and then the soapfsm would check the flag at all relevant points (only a small number of those)...
	// in the current implementation, is_cancelled is just used to assert correctness.

	// Do I want to consider the return value from callCompletion.abort() 
	// see http://www.xulplanet.com/references/xpcomref/ifaces/nsISOAPCallCompletion.html
	// right now, we ignore the completion status as reported by nsISOAPCallCompletion.isComplete() 
	// I don't trust that it isn't buggy given my experience with faults...
	// so "cancel" of the parent fsm doesn't cause any transitions to the soapfsm...

	window.clearTimeout(timeoutID);

	gLogger.debug("SoapFsm.cancel: cleared timeoutID: " + timeoutID);

	if (this.state.callCompletion)
	{
		var ret = this.state.callCompletion.abort();

		gLogger.debug("SoapFsm.abort: callCompletion.abort() returns: " + ret);
	}

	this.state.is_cancelled = true;
}

function SoapFsmState()
{
	this.uri              = null;  // the uri of the zimbra server - set by the start() method
	this.response         = null;  // SOAPResponse.message - the xml soap message response, assuming all was well
	this.serviceCode      = null;  // 
	this.faultCode        = null;  // These are derived from the soap fault element
	this.faultElementXml  = null;  // the soap:Fault element as string xml
	this.faultDetail      = null;
	this.faultString      = null;
	this.callCompletion   = null;  // the object returned by soapCall.asyncInvoke()
	this.is_cancelled     = false;
	// this.countTransitions = 0;  // for debugging
}


SoapFsmState.PRE_REQUEST                     = 0; // haven't made a request yet
SoapFsmState.PRE_RESPONSE                    = 1; // made a request but haven't yet recieved a response
SoapFsmState.POST_RESPONSE_SUCCESS           = 2; // recieved a non-fault soap response
SoapFsmState.POST_RESPONSE_FAIL_ON_SERVICE   = 3; // some sort of service failure (generated by mozilla)
SoapFsmState.POST_RESPONSE_FAIL_ON_FAULT     = 4; // recived a soap fault
SoapFsmState.CANCELLED                       = 5; // user cancelled
SoapFsmState.UNKNOWN                         = 6; // this should never be!

SoapFsmState.prototype.summaryCode = function()
{
	var ret;

	var isPreResponse  = (this.response == null) && (this.serviceCode == null) && (this.faultCode == null)
	                  && (this.faultElementXml == null) && (this.faultDetail == null) && (this.faultString == null);

	if (this.is_cancelled)                 ret = SoapFsmState.CANCELLED;
	else if (!this.uri)                    ret = SoapFsmState.PRE_REQUEST;
	else if (isPreResponse)                ret = SoapFsmState.PRE_RESPONSE;
	else if (this.response != null)        ret = SoapFsmState.POST_RESPONSE_SUCCESS;
	else if (this.serviceCode != 0)        ret = SoapFsmState.POST_RESPONSE_FAIL_ON_SERVICE;
	else if (this.faultElementXml != null) ret = SoapFsmState.POST_RESPONSE_FAIL_ON_FAULT;
	else                                   ret = SoapFsmState.UNKNOWN;

	return ret;
}

SoapFsmState.prototype.sanityCheck = function()
{
	var c = 0;
	if (this.response != null)        c++;
	if (this.serviceCode != 0)        c++;
	if (this.faultElementXml != null) c++;
	var isPostResponse = (c == 1);  // exactly one of these three things is true after a response
	var isPreResponse  = (this.response == null) && (this.serviceCode == null) && (this.faultCode == null)
	                  && (this.faultElementXml == null) && (this.faultDetail == null) && (this.faultString == null);
	cnsAssert(isPreResponse || isPostResponse && this.summaryCode() != SoapFsmState.UNKNOWN);
}

// load from xml - a SOAPResponse.message or SOAPFault.element
//
SoapFsmState.prototype.faultLoadFromXml = function(doc)
{
	var nodelist;
	
	this.faultElementXml = xmlDocumentToString(doc);

	conditionalGetElementByTagNameNS(doc, ZimbraSoapDocument.NS_SOAP_ENVELOPE, "faultstring", this, 'faultString');
	conditionalGetElementByTagNameNS(doc, "urn:zimbra",                        "Trace",       this, 'faultDetail');
	conditionalGetElementByTagNameNS(doc, "urn:zimbra",                        "Code",        this, 'faultCode');
}

// load from a SOAPFault object - http://www.xulplanet.com/references/objref/SOAPFault.html
//
SoapFsmState.prototype.faultLoadFromSoapFault = function(fault)
{
	if (fault.element)
		this.faultElementXml = xmlDocumentToString(fault.element);
		
	if (fault.faultString)
		this.faultString = fault.faultString;

	if (fault.detail)
		this.faultDetail = fault.detail;

	if (fault.faultcode)
		this.faultCode = fault.faultcode;
}

SoapFsmState.prototype.toString = function()
{
	var ret = "\n serviceCode = " + this.serviceCode +
	          "\n code = "        + this.faultCode +
	          "\n string = "      + this.faultString +
	          "\n detail = "      + this.faultDetail +
	          "\n elementxml = "  + this.faultElementXml +
	          "\n response = "    + this.response;

	return ret;
}

SoapFsmState.prototype.toHtml = function()
{
	return this.toString().replace(/\n/g, "<html:br>");
}

function AuthOnlyFsm(state) { this.ZimbraFsm(state); this.setFsm(); }
function TwoWayFsm(state)   { this.ZimbraFsm(state); this.setFsm(); }

copyPrototype(AuthOnlyFsm, ZimbraFsm);
copyPrototype(TwoWayFsm,   ZimbraFsm);

AuthOnlyFsm.prototype.setFsm = function()
{
	this.fsm.transitions  = {
		start:                  { evCancel: 'final', evStart:  'stAuth' },
		stAuth:                 { evCancel: 'final', evNext:  'final'   }
	};

	this.fsm.aActionEntry = {
		start:                  this.entryActionStart,
		stAuth:                 this.entryActionAuth,
		final:                  this.entryActionFinal
	};

	this.fsm.aActionExit = {
		stAuth:           this.exitActionAuth,
	};
}

TwoWayFsm.prototype.setFsm = function()
{
	this.fsm.transitions = {
		start:                  { evCancel: 'final', evStart: 'stAuth'                                          },
		stAuth:                 { evCancel: 'final', evNext:  'stLoad'                                          },
		stLoad:                 { evCancel: 'final', evNext:  'stGetAccountInfo'                                },
		stGetAccountInfo:       { evCancel: 'final', evNext:  'stCheckLicense'                                  },
		stCheckLicense:         { evCancel: 'final', evNext:  'stSync'                                          },
		stSync:                 { evCancel: 'final', evNext:  'stGetContact'                                    },
		stGetContact:           { evCancel: 'final', evNext:  'stLoadTb',        evRepeat: 'stGetContact'       },// evNext: 'stSyncGal'
		stSyncGal:              { evCancel: 'final', evNext:  'stSyncGalCommit'                                 },
		stSyncGalCommit:        { evCancel: 'final', evNext:  'stLoadTb'                                        },
		stLoadTb:               { evCancel: 'final', evNext:  'stSyncPrepare'                                   },
		stSyncPrepare:          { evCancel: 'final', evNext:  'stUpdateTb'                                      },
		stUpdateTb:             { evCancel: 'final', evNext:  'stUpdateZm'                                      },
		stUpdateZm:             { evCancel: 'final', evNext:  'stUpdateCleanup', evRepeat: 'stUpdateZm'         },
		stUpdateCleanup:        { evCancel: 'final', evNext:  'stCommit'                                        },
		stCommit:               { evCancel: 'final', evNext:  'final'                                           }
	};

	this.fsm.aActionEntry = {
		start:                  this.entryActionStart,
		stAuth:                 this.entryActionAuth,
		stLoad:                 this.entryActionLoad,
		stGetAccountInfo:       this.entryActionGetAccountInfo,
		stCheckLicense:         this.entryActionCheckLicense,
		stSync:                 this.entryActionSync,
		stGetContact:           this.entryActionGetContact,
		stSyncGal:              this.entryActionSyncGal,
		stSyncGalCommit:        this.entryActionSyncGal,
		stLoadTb:               this.entryActionLoadTb,
		stSyncPrepare:          this.entryActionSyncPrepare,
		stUpdateTb:             this.entryActionUpdateTb,
		// stAboutToUpdateZm:      this.entryActionAboutToUpdateZm,
		stUpdateZm:             this.entryActionUpdateZm,
		stUpdateCleanup:        this.entryActionUpdateCleanup,
		stCommit:               this.entryActionCommit,
		final:                  this.entryActionFinal
	};

	this.fsm.aActionExit = {
		stAuth:           this.exitActionAuth,
		stGetAccountInfo: this.exitActionGetAccountInfo,
		stCheckLicense:   this.exitActionCheckLicense,
		stSync:           this.exitActionSync, stGetContact:     this.exitActionGetContact,
		stSyncGal:        this.exitActionSyncGal,
		stUpdateZm:       this.exitActionUpdateZm
	};
}

function ZimbraFsmState(id_fsm)
{
	this.id_fsm              = id_fsm;
	this.zfcLastSync         = new ZinFeedCollection(); // maintains state re: last sync (anchors, success/fail)
	this.zfcGid              = new ZinFeedCollection(); // map of gid to (sourceid, luid)
	this.zfcPreUpdateWinners = new ZinFeedCollection(); // has the winning zfi's before they are updated to reflect their win (LS unchanged)

	this.authToken           = null;         // Auth
	this.sessionId           = null;
	this.lifetime            = null;
	this.zimbraId            = null;         // GetAccountInfo
	this.soapURL             = null;         // initialised to this.state.sources[this.state.sourceid_zm]['soapURL'] and may be modified by a <soapURL> response
	this.mapiStatus          = null;         // CheckLicenseStatus
	this.aSyncGalContact     = null;         // SyncGal
	this.mapIdSyncGalContact = null;      
	this.SyncGalToken        = null;
	this.SyncGalTokenChanged = false;
	this.aSyncContact        = new Object(); // each property is a ZimbraContact object returned in GetContactResponse
	this.SyncMd              = null;         // this gives us the time on the server
	this.SyncToken           = null;         
	this.aQueue              = new Object(); // associative array of contact ids - ids added in SyncResponse, deleted in GetContactResponse
	this.aReverseGid         = new Object(); // reverse lookups for the gid, ie given (sourceid, luid) find the gid.
	this.aSuo                = null;         // container for source update operations - populated in SyncPrepare
	this.updateZmPackage     = null;         // maintains state between an zimbra server update request and the response

	this.m_preferences  = new MozillaPreferences();
	this.m_bimap_format = new BiMap(
		[FORMAT_TB, FORMAT_ZM],
		['tb',      'zm'     ]);

	this.sources = new Object();
	this.sources[SOURCEID_TB] = new Object();
	this.sources[SOURCEID_ZM] = new Object();

	this.sources[SOURCEID_TB]['format']   = FORMAT_TB;
	this.sources[SOURCEID_TB]['name']     = stringBundleString("sourceThunderbird");

	this.sources[SOURCEID_ZM]['format']   = FORMAT_ZM;
	this.sources[SOURCEID_ZM]['name']     = stringBundleString("sourceServer");

	for (var i in this.sources)
	{
		var rr_flag = (this.sources[i]['format'] == FORMAT_ZM) ? ZinFeedCollection.RESERVED_RANGE_OFF : ZinFeedCollection.RESERVED_RANGE_ON;

		this.sources[i]['zfcLuid'] = new ZinFeedCollection(rr_flag);  // updated during sync and persisted at the end
	}

	this.sourceid_tb = SOURCEID_TB;
	this.sourceid_zm = SOURCEID_ZM;
}

ZimbraFsmState.prototype.setCredentials = function()
{
	if (arguments.length == 3)
	{
		this.sources[SOURCEID_ZM]['soapURL']  = arguments[0];
		this.sources[SOURCEID_ZM]['username'] = arguments[1];
		this.sources[SOURCEID_ZM]['password'] = arguments[2];
	}
	else
	{
		var prefset = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
		prefset.load(SOURCEID_ZM);

		this.sources[SOURCEID_ZM]['soapURL']  = prefset.getProperty(PrefSet.SERVER_URL);
		this.sources[SOURCEID_ZM]['username'] = prefset.getProperty(PrefSet.SERVER_USERNAME);

   		var pm = new PasswordManager();
		this.sources[SOURCEID_ZM]['password'] = pm.get(prefset.getProperty(PrefSet.SERVER_URL),
		                                               prefset.getProperty(PrefSet.SERVER_USERNAME) );
	}

	this.sources[SOURCEID_ZM]['soapURL'] += "/service/soap/";
}

function AuthOnlyFsmState() { this.ZimbraFsmState(ZinMaestro.FSM_ID_AUTHONLY); }
function TwoWayFsmState()   { this.ZimbraFsmState(ZinMaestro.FSM_ID_TWOWAY);   }

copyPrototype(AuthOnlyFsmState, ZimbraFsmState);
copyPrototype(TwoWayFsmState,   ZimbraFsmState);

