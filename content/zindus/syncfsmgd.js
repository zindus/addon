
SyncFsmGd.prototype.entryActionAuth = function(state, event, continuation)
{
	var nextEvent = null;

	this.state.stopwatch.mark(state);

	if (1) // TODO - this works ok
	{
	var sourceid_pr = this.state.sourceid_pr;

	var username = this.state.sources[sourceid_pr]['username'];
	var password = this.state.sources[sourceid_pr]['password'];

	this.state.m_logger.debug("blah: username: " + username + " password: " + password);

	if (username.length > 0 && password.length > 0)
	{
		var headers = newObject("Content-type", "application/x-www-form-urlencoded");
		var url = "https://www.google.com/accounts/ClientLogin";
		var body = "";
		body += "accountType=GOOGLE"; // TODO: HOSTED_OR_GOOGLE
		body += "&Email=" + username;
		body += "&Passwd=" + password;
		body += "&service=cp"; // gbase
		body += "&source=Toolware-Zindus-0.01";

		this.setupHttpGd(state, 'evNext', "POST", url, headers, body, false)

		nextEvent = 'evSoapRequest';
	}
	else
	{
		this.state.stopFailCode = 'FailOnIntegrityBadCredentials';
		nextEvent = 'evLackIntegrity';
	}
	}
	else nextEvent = 'evNext';

	continuation(nextEvent);
}

SyncFsmGd.prototype.exitActionAuth = function(state, event)
{
	if (!this.state.m_http || !this.state.m_http.response('text') || event == "evCancel")
		return;

	var response = this.state.m_http.response('text');

	var aMatch = response.match(/Auth=(.+?)(\s|$)/ ); // a[0] is the whole pattern, a[1] is the first capture, a[2] the second etc...

	if (aMatch && aMatch.length == 3)
		this.state.authToken = aMatch[1];

	if (this.state.authToken)
	{
		var username  = this.state.sources[this.state.sourceid_pr]['username'];
		this.state.gd_base_url = "http://www.google.com/m8/feeds/contacts/" + escape(username) + "/base";
	}

	this.state.m_logger.debug("authToken: " + this.state.authToken);
}

SyncFsmGd.prototype.entryActionGetContacts = function(state, event, continuation)
{
	if (1)
	{
	var sourceid_pr = this.state.sourceid_pr;
	var SyncToken = this.state.zfcLastSync.get(sourceid_pr).getOrNull('SyncToken');
	var url       = this.state.gd_base_url + "?showdeleted=true";

	if (SyncToken)
		url += "&updated-min=" + SyncToken + "&";

	url += "&max-results=10000";

	this.state.m_logger.debug("entryActionGetContacts: url: " + url);

	this.setupHttpGd(state, 'evNext', "GET", url, null, null, false);

	continuation('evSoapRequest');
	}
	else continuation('evNext');
}

SyncFsmGd.prototype.exitActionGetContacts = function(state, event)
{
	if (!this.state.m_http.response() || event == "evCancel")
		return;

	var response = this.state.m_http.response();

	// set the sync token
	//
	var feed = new Object('updated', "");
	var warn_msg = "<updated> element is missing from <feed>!";
	ZinXpath.setConditionalFromSingleElement(feed, 'updated', "//atom:feed/atom:updated", response, warn_msg);
	this.state.gd_sync_token = feed.updated;
	this.state.m_logger.debug("exitActionGetContacts: gd_sync_token: " + this.state.gd_sync_token);

	// parse the <feed> response for <entry>'s and then process each contact
	//
	var key_parent_folder = SyncFsm.zfcFindFirstFolder(this.zfcPr(), GD_FOLDER_CONTACTS);
	var msg               = "exitActionGetContacts: \n";

	this.state.a_gd_contact = GdContact.arrayFromXpath(response, "/atom:feed/atom:entry");

	for (var id in this.state.a_gd_contact)
	{
		var rev        = this.state.a_gd_contact[id].m_meta['updated'];
		var edit_url   = this.state.a_gd_contact[id].m_meta['edit'];
		var is_deleted = isPropertyPresent(this.state.a_gd_contact[id].m_meta, 'deleted');
		var zfi = null;

		this.state.m_logger.debug("exitActionGetContacts: id: " + id + " properties: " + this.state.a_gd_contact[id].toString());

		if (this.zfcPr().isPresent(id))
		{
			zfi = this.zfcPr().get(id);

			zfi.set(ZinFeedItem.ATTR_REV,  rev);
			zfi.set(ZinFeedItem.ATTR_EDIT, edit_url);

			msg += " updated: ";

			if (is_deleted)
			{
				this.zfcPr().get(id).set(ZinFeedItem.ATTR_DEL, '1');

				if (zfi.isPresent(ZinFeedItem.ATTR_CSGD))
					zfi.del(ZinFeedItem.ATTR_CSGD);
					
				msg += " marked as deleted: ";
			}
			else if (zfi.isPresent(ZinFeedItem.ATTR_CSGD))
			{
				var converter   = ZinContactConverter.instance();
				var properties  = converter.convert(FORMAT_TB, FORMAT_GD, this.state.a_gd_contact[id].m_contact);
				var checksum    = converter.crc32(properties);

				if (checksum == zfi.get(ZinFeedItem.ATTR_CSGD))
				{
					var gid = this.state.aReverseGid[this.state.sourceid_pr][id];
					SyncFsm.setLsoToGid(this.state.zfcGid.get(gid), zfi);
					msg += " ATTR_CSGD matched, lso updated: ";
				}
				else
					msg += " ATTR_CSGD didn't match: "; // so the contact changed since we updated it...

				zfi.del(ZinFeedItem.ATTR_CSGD);
			}

			msg += " zfi: " + zfi.toString();
		}
		else if (!is_deleted)
		{
			zfi = this.newZfiCnGd(id, rev, edit_url, key_parent_folder);
			this.zfcPr().set(zfi); // add new
			msg += " added: " + zfi.toString();
		}
		else
			msg += " ignored deleted contact id: " + id;

		msg += "\n";
	}

	this.state.m_logger.debug(msg);
}

SyncFsmGd.prototype.newZfiCnGd = function(id, rev, edit_url, key_parent_folder)
{
	var zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY,  id,
				                                   ZinFeedItem.ATTR_REV,  rev,
				                                   ZinFeedItem.ATTR_EDIT, edit_url,
											       ZinFeedItem.ATTR_L,    key_parent_folder);

	return zfi;
}

SyncFsmGd.prototype.testForCsGd = function()
{
	var functor = {
		state: this.state,
		run: function(zfi)
		{
			if (zfi.isPresent(ZinFeedItem.ATTR_CSGD))
			{
				this.state.m_logger.warn("zfi retained a ATTR_CSGD attribute after GetContacts.  This shouldn't happen.  zfi: " + zfi.toString());
				zfi.del(ZinFeedItem.ATTR_CSGD);
			}

			return true;
		}
	};

	this.zfcPr().forEach(functor);
}

SyncFsmGd.prototype.entryActionGetContactPuGd = function(state, event, continuation)
{
	var sourceid_pr = this.state.sourceid_pr;
	var nextEvent = null;

	if (!this.state.is_done_get_contacts_pu)
	{
		for (indexSuo in this.state.aSuo[sourceid_pr][Suo.MOD | ZinFeedItem.TYPE_CN])
		{
			suo         = this.state.aSuo[sourceid_pr][Suo.MOD | ZinFeedItem.TYPE_CN][indexSuo];
			luid_target = this.state.zfcGid.get(suo.gid).get(suo.sourceid_target);

			if (!isPropertyPresent(this.state.a_gd_contact, luid_target))
				this.state.a_gd_contact_to_get.push(luid_target);
		}

		this.state.is_done_get_contacts_pu = true;

		this.state.m_logger.debug("entryActionGetContactPuGd: a_gd_contact_to_get: " + this.state.a_gd_contact_to_get.toString());
	}

	if (this.state.a_gd_contact_to_get.length > 0)
	{
		var id = this.state.a_gd_contact_to_get.pop();
		var url = id;

		this.setupHttpGd(state, 'evRepeat', "GET", url, null, null, false);
		
		nextEvent = 'evSoapRequest'
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

	var response     = this.state.m_http.response();
	var xpath_query  = "/atom:entry";
	var a_gd_contact = GdContact.arrayFromXpath(response, xpath_query);

	zinAssertAndLog(aToLength(a_gd_contact) ==  1, "length: " + aToLength(a_gd_contact));

	var id = firstKeyInObject(a_gd_contact);

	zinAssertAndLog(!isPropertyPresent(this.state.a_gd_contact, id), "id: " + id);

	this.state.a_gd_contact[id] = a_gd_contact[id];
}
