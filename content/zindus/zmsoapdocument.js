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

function ZmSoapDocument()
{
	this.doc      = document.implementation.createDocument("", "", null);
	this.envelope = this.doc.createElementNS(Xpath.NS_SOAP_ENVELOPE, "soap:Envelope");

	this.doc.appendChild(this.envelope);
}

ZmSoapDocument.nsFromMethod = function(method)
{
	var aMethod = {
		Auth:           "za",
		CheckLicense:   "za",
		GetAccountInfo: "za",
		GetInfo:        "za",
		SyncGal:        "za",
		ContactAction:  "zm", 
		CreateContact:  "zm", 
		CreateFolder:   "zm", 
		GetContacts:    "zm",
		FolderAction:   "zm", 
		ModifyContact:  "zm",
		FakeHead:       "zm",
		Sync:           "zm",
		Batch:          "z",  // used in ForeignContactDelete
		last_notused:   null
	};

	zinAssertAndLog(isPropertyPresent(aMethod, method), "method missing from namespace table: " + method);

	return aMethod[method];
}

ZmSoapDocument.prototype.setElementAsBody = function(element)
{
	var elBody = this.doc.createElementNS(Xpath.NS_SOAP_ENVELOPE, "soap:Body");

	elBody.appendChild(element);
	this.envelope.appendChild(elBody);
}

ZmSoapDocument.prototype.toString = function()
{
	return xmlDocumentToString(this.doc);
}

ZmSoapDocument.prototype.toStringFiltered = function()
{
	var ret = this.toString();

	ret = ret.replace(/<password>.*<\/password>/,   "<password-suppressed/>");
	ret = ret.replace(/<authToken>.*<\/authToken>/, "<authToken-suppressed/>");

	return ret;
}

ZmSoapDocument.prototype.context = function(authToken, zimbraId, is_noqualify)
{
	var elHeader    = this.doc.createElementNS(Xpath.NS_SOAP_ENVELOPE, "soap:Header");
	var elContext   = this.doc.createElementNS(Xpath.NS_ZIMBRA, "context");
	var elNonotify  = this.doc.createElementNS(Xpath.NS_ZIMBRA, "nonotify");
	var elNoqualify = this.doc.createElementNS(Xpath.NS_ZIMBRA, "noqualify");
	var elUserAgent = this.doc.createElementNS(Xpath.NS_ZIMBRA, "userAgent");

	// UserAgent is useless to zindus - we add it so that server administrators can see what's going on
	//
	elUserAgent.setAttribute("name", APP_NAME);
	elUserAgent.setAttribute("version", APP_VERSION_NUMBER);

	// noqualify controls the formatting of returned id's and distinguishes whether the owner of the mailbox 
	// matches the principal.  Since there's no delegation of authority here, we use noqualify.
	// see: ZimbraServer/src/java/com/zimbra/cs/service/util/ItemIdFormatter.java

	this.envelope.appendChild(elHeader);

	elHeader.appendChild(elContext);

	elContext.appendChild(elUserAgent);
	elContext.appendChild(elNonotify);

	if (is_noqualify)
		elContext.appendChild(elNoqualify);

	if (authToken != null)
	{
		var elAuthtoken = this.doc.createElementNS(Xpath.NS_ZIMBRA, "authToken");

		elAuthtoken.textContent = authToken;

		elContext.appendChild(elAuthtoken);

		if (zimbraId != null)
		{
			var elAccount = this.doc.createElementNS(Xpath.NS_ZIMBRA, "account");

			elAccount.setAttribute("by", "id");
			elAccount.textContent = zimbraId;

			elContext.appendChild(elAccount);
		}
	}
}

ZmSoapDocument.prototype.Auth = function(name, password, virtualhost)
{
	var elRequest  = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "AuthRequest");
	var elAccount  = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "account");
	var elPassword = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "password");

	elAccount.setAttribute("by", "name");
	elAccount.textContent = name;

	elPassword.textContent = password;

	elRequest.appendChild(elAccount);
	elRequest.appendChild(elPassword);

	if (virtualhost != null)
	{
		var elVirtualHost = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "virtualHost");

		elVirtualHost.textContent = virtualhost;

		elRequest.appendChild(elVirtualHost);
	}

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.GetAccountInfo = function(by, name)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "GetAccountInfoRequest");
	var elAccount = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "account");

	elAccount.setAttribute("by", by);
	elAccount.textContent = name;

	elRequest.appendChild(elAccount);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.GetInfo = function()
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "GetInfoRequest");

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.CheckLicense = function()
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "CheckLicenseRequest");

	elRequest.setAttribute("feature", "mapi");

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.SyncGal = function(token)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZACCOUNT, "SyncGalRequest");

	if (token != null)
		elRequest.setAttribute("token", token);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.GetContacts = function(a_id)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "GetContactsRequest");
	var elCn      = this.doc.createElementNS(Xpath.NS_ZMAIL, "cn");

	zinAssert(a_id != null && a_id.length > 0);

	elRequest.setAttribute("sync", "1");

	elCn.setAttribute("id", hyphenate(",", a_id));

	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.Sync = function(token)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "SyncRequest");

	if (token != null)
		elRequest.setAttribute("token", token);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.CreateFolder = function(folder)
{
	var elFolder;
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "CreateFolderRequest");

	elFolder = this.doc.createElementNS(Xpath.NS_ZMAIL, "folder");

	zinAssert(isPropertyPresent(folder, 'name') && isPropertyPresent(folder, 'l') && folder.name.length > 0)

	elFolder.setAttribute("name", folder.name);
	elFolder.setAttribute("l",    folder.l);
	elFolder.setAttribute("view", "contact");
	elFolder.setAttribute("fie",  "1");

	elRequest.appendChild(elFolder);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.CreateContact = function(args)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "CreateContactRequest");
	var elCn      = this.doc.createElementNS(Xpath.NS_ZMAIL, "cn");
	var i, elA;

	// lets allow the creation of completely empty contacts in support of zindus/ToBeDeleted
	// && aToLength(args.properties) > 0
	//
	zinAssertAndLog(isPropertyPresent(args, 'properties') && isPropertyPresent(args, 'l') && aToLength(args.properties) > 0,
	                        "properties: " + aToString(args));

	elCn.setAttribute("l", args.l);

	for (i in args.properties)
	{
		elA = this.doc.createElementNS(Xpath.NS_ZMAIL, "a");
		elA.setAttribute("n", i);
		elA.textContent = args.properties[i];
		elCn.appendChild(elA);
	}

	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.FolderAction = function(args)
{
	this.setElementAsBody(this.ActionRequest("FolderActionRequest", args));
}

ZmSoapDocument.prototype.ContactAction = function(args)
{
	this.setElementAsBody(this.ActionRequest("ContactActionRequest", args));
}

ZmSoapDocument.prototype.ActionRequest = function(name, args)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, name);
	var elAction  = this.doc.createElementNS(Xpath.NS_ZMAIL, "action");

	for (var i in args)
		elAction.setAttribute(i, args[i]); // attributes passed in here include: id, op, l and name

	elRequest.appendChild(elAction);

	return elRequest;
}

ZmSoapDocument.prototype.FakeHead = function(args)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "FakeHeadRequest");

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.ModifyContact = function(args)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZMAIL, "ModifyContactRequest");
	var elCn      = this.doc.createElementNS(Xpath.NS_ZMAIL, "cn");
	var i, elA;

	zinAssert(isPropertyPresent(args, 'properties') &&
	          isPropertyPresent(args, 'l') &&
			  isPropertyPresent(args, 'id') && aToLength(args.properties) > 0);

	elCn.setAttribute("id", args.id);
	elCn.setAttribute("l", args.l);

	for (i in args.properties)
	{
		elA = this.doc.createElementNS(Xpath.NS_ZMAIL, "a");

		elA.setAttribute("n", i);

		if (args.properties[i])
			elA.textContent = args.properties[i];

		elCn.appendChild(elA);
	}

	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}

ZmSoapDocument.prototype.ForeignContactDelete = function(args)
{
	var elRequest = this.doc.createElementNS(Xpath.NS_ZIMBRA, "BatchRequest");
	var elCreate  = this.doc.createElementNS(Xpath.NS_ZMAIL,  "CreateContactRequest");
	var elCn      = this.doc.createElementNS(Xpath.NS_ZMAIL,  "cn");
	var i, elA;

	zinAssert(isPropertyPresent(args, 'properties') && aToLength(args.properties) > 0 &&
	          isPropertyPresent(args, 'zid') &&
	          isPropertyPresent(args, 'id') );

	elRequest.setAttribute("onerror", "stop");

	elCn.setAttribute("l", ZM_ID_FOLDER_TRASH);

	for (i in args.properties)
	{
		elA = this.doc.createElementNS(Xpath.NS_ZMAIL, "a");
		elA.setAttribute("n", i);
		elA.textContent = args.properties[i];
		elCn.appendChild(elA);
	}

	elCn.appendChild(elA);
	elCreate.appendChild(elCn);

	var delete_args = newObject("id", args.zid + ":" + args.id, "op", "delete");
	elDeleteForeign = this.ActionRequest("ContactActionRequest", delete_args);

	elRequest.appendChild(elCreate);
	elRequest.appendChild(elDeleteForeign);

	this.setElementAsBody(elRequest);
}
