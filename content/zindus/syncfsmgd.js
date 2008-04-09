
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
		this.state.base_url = "http://www.google.com/m8/feeds/contacts/" + escape(username) + "/base";
	}

	this.state.m_logger.debug("authToken: " + this.state.authToken);
}

SyncFsmGd.prototype.entryActionGetContacts = function(state, event, continuation)
{
	if (1)
	{
	var sourceid_pr = this.state.sourceid_pr;
	var SyncToken = this.state.zfcLastSync.get(sourceid_pr).getOrNull('SyncToken');
	var url       = this.state.base_url + "?showdeleted=true";

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
	var msg = "exitActionGetContacts: \n";
	var response;

	if (1) // TODO
	{
	if (!this.state.m_http.response() || event == "evCancel")
		return;

	response = this.state.m_http.response();
	}
	else 
	{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>a2ghbe@gmail.com</id><updated>2008-03-30T00:33:50.384Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>cvek a2ghbe's Contacts</title><link rel='alternate' type='text/html' href='http://www.google.com/'/><link rel='http://schemas.google.com/g/2005#feed' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base'/><link rel='http://schemas.google.com/g/2005#post' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base'/><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base?max-results=25&amp;showdeleted=true'/><author><name>cvek a2ghbe</name><email>a2ghbe@gmail.com</email></author><generator version='1.0' uri='http://www.google.com/m8/feeds'>Contacts</generator><openSearch:totalResults>6</openSearch:totalResults><openSearch:startIndex>1</openSearch:startIndex><openSearch:itemsPerPage>25</openSearch:itemsPerPage><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0</id><updated>2008-03-29T20:36:25.343Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>John Smith</title><content type='text'>notes-line-1 notes-line-2</content><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0/1206822985343000'/><gd:organization rel='http://schemas.google.com/g/2005#work'><gd:orgName>company-acme</gd:orgName><gd:orgTitle>title-directory</gd:orgTitle></gd:organization><gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.primary@example.com' primary='true'/><gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.1@example.com'/><gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.2@example.com'/><gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.other@example.com'/><gd:email rel='http://schemas.google.com/g/2005#work' address='john.smith.work@example.com'/><gd:im address='aim-im-1' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/><gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#home_fax'>4-home-fax</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#pager'>6-pager</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>2-home</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>3-home</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>1-mobile</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#work_fax'>5-work-fax</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#work'>3-work</gd:phoneNumber><gd:postalAddress rel='http://schemas.google.com/g/2005#home'>home-address-line-1 home address line 2</gd:postalAddress></entry><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/1</id><updated>2008-03-25T21:10:58.283Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>Jane Smith</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/1'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/1/1206479458283001'/><gd:email rel='http://schemas.google.com/g/2005#other' address='jane.smith@example.com' primary='true'/><gd:im address='im-address' rel='http://schemas.google.com/g/2005#other'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>1-mobile</gd:phoneNumber><gd:postalAddress rel='http://schemas.google.com/g/2005#home'>home-address-line-1</gd:postalAddress></entry><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/2</id><updated>2008-03-30T00:29:11.271Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'></title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/2'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/2/1206836951271000'/><gd:deleted/></entry><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/3</id><updated>2008-03-25T21:14:10.496Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>Joe Smith</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/3'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/3/1206479650496002'/></entry><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/4</id><updated>2008-03-25T21:14:33.495Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>1-1</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/4'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/4/1206479673495000'/><gd:email rel='http://schemas.google.com/g/2005#other' address='1@example.com' primary='true'/></entry><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/5</id><updated>2008-03-29T21:33:31.780Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>cvek a2ghbe</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/5'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/5/1206826411780000'/><gd:email rel='http://schemas.google.com/g/2005#other' address='a2ghbe@gmail.com' primary='true'/></entry></feed>";

	var domparser = new DOMParser();
	response = domparser.parseFromString(xmlString, "text/xml");
	}

	this.state.m_logger.debug("exitActionGetContacts: typeof response.doc: " + typeof(response.doc));
	var xpath_query = "/atom:feed/atom:entry";
	this.state.a_gd_contact = GdContact.arrayFromXpath(response, xpath_query);

	var key_parent_folder = SyncFsm.zfcFindFirstFolder(this.zfcPr(), GD_FOLDER_CONTACTS);

	for (var id in this.state.a_gd_contact)
	{
		var rev        = this.state.a_gd_contact[id].m_meta['updated'];
		var is_deleted = isPropertyPresent(this.state.a_gd_contact[id].m_meta, 'deleted');
		var zfi = null;

		this.state.m_logger.debug("exitActionGetContacts: id: " + id + " properties: " + this.state.a_gd_contact[id].toString());

		if (this.zfcPr().isPresent(id))
		{
			zfi = this.zfcPr().get(id);

			zfi.set(ZinFeedItem.ATTR_REV, rev);

			msg += " updated: ";

			if (is_deleted)
			{
				this.zfcPr().get(id).set(ZinFeedItem.ATTR_DEL, '1');
				msg += " marked as deleted: ";
			}
			else if (zfi.isPresent(ZinFeedItem.ATTR_CSGD))
			{
				var checksum = ZinContactConverter.instance().crc32(this.state.a_gd_contact[id].m_contact);

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
			zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, id,
						                               ZinFeedItem.ATTR_REV, rev,
													   ZinFeedItem.ATTR_L, key_parent_folder);
			this.zfcPr().set(zfi); // add new
			msg += " added: " + zfi.toString();
		}
		else
			msg += " ignored deleted contact id: " + id;

		msg += "\n";
	}

	this.state.m_logger.debug(msg);
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
