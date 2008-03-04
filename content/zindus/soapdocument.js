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

function ZimbraSoapDocument()
{
	this.doc      = document.implementation.createDocument("", "", null);
	this.envelope = this.doc.createElementNS(ZimbraSoapDocument.NS_SOAP_ENVELOPE, "soap:Envelope");

	this.doc.appendChild(this.envelope);
}

ZimbraSoapDocument.nsFromMethod = function(method)
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
		last_notused:   null
	};

	zinAssertAndLog(isPropertyPresent(aMethod, method), "method missing from namespace table: " + method);

	return aMethod[method];
}

ZimbraSoapDocument.NS_SOAP_ENVELOPE  = "http://schemas.xmlsoap.org/soap/envelope/";
ZimbraSoapDocument.NS_ZIMBRA         = "urn:zimbra";
ZimbraSoapDocument.NS_ACCOUNT        = "urn:zimbraAccount";
ZimbraSoapDocument.NS_MAIL           = "urn:zimbraMail";

ZimbraSoapDocument.nsResolverBimap = new BiMap(
	[ "soap",                              "z",                          "za",                          "zm"                       ],
	[ ZimbraSoapDocument.NS_SOAP_ENVELOPE, ZimbraSoapDocument.NS_ZIMBRA, ZimbraSoapDocument.NS_ACCOUNT, ZimbraSoapDocument.NS_MAIL ]);

ZimbraSoapDocument.nsResolver = function(prefix)
{
	return ZimbraSoapDocument.nsResolverBimap.lookup(prefix, null);
};

ZimbraSoapDocument.prototype.setElementAsBody = function(element)
{
	var elBody = this.doc.createElementNS(ZimbraSoapDocument.NS_SOAP_ENVELOPE, "soap:Body");

	elBody.appendChild(element);
	this.envelope.appendChild(elBody);
}

ZimbraSoapDocument.prototype.toString = function()
{
	return xmlDocumentToString(this.doc);
}

ZimbraSoapDocument.prototype.context = function(authToken, sessionId)
{
	var elHeader    = this.doc.createElementNS(ZimbraSoapDocument.NS_SOAP_ENVELOPE, "soap:Header");
	var elContext   = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "context");
	var elNonotify  = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "nonotify");
	var elNoqualify = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "noqualify");
	var elUserAgent = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "UserAgent");

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
	elContext.appendChild(elNoqualify);

	if (authToken != null)
	{
		var elAuthtoken = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "authToken");

		elAuthtoken.textContent = authToken;

		elContext.appendChild(elAuthtoken);

		if (sessionId != null)
		{
			var elSession   = this.doc.createElementNS(ZimbraSoapDocument.NS_ZIMBRA, "sessionId");

			elSession.setAttribute("id", sessionId);

			elContext.appendChild(elSession);
		}
	}
}

ZimbraSoapDocument.prototype.Auth = function(name, password, virtualhost)
{
	var elRequest  = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "AuthRequest");
	var elAccount  = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "account");
	var elPassword = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "password");

	elAccount.setAttribute("by", "name");
	elAccount.textContent = name;

	elPassword.textContent = password;

	elRequest.appendChild(elAccount);
	elRequest.appendChild(elPassword);

	if (virtualhost != null)
	{
		var elVirtualHost = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "virtualHost");

		elVirtualHost.textContent = virtualhost;

		elRequest.appendChild(elVirtualHost);
	}

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.GetAccountInfo = function(name)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "GetAccountInfoRequest");
	var elAccount = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "account");

	elAccount.setAttribute("by", "name");
	elAccount.textContent = name;

	elRequest.appendChild(elAccount);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.GetInfo = function()
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "GetInfoRequest");

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.CheckLicense = function()
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "CheckLicenseRequest");

	elRequest.setAttribute("feature", "mapi");

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.SyncGal = function(token)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_ACCOUNT, "SyncGalRequest");

	if (token != null)
		elRequest.setAttribute("token", token);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.GetContacts = function(id)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "GetContactsRequest");
	var elCn      = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "cn");

	zinAssert(id != null);

	elRequest.setAttribute("sync", "1");

	elCn.setAttribute("id", id);
	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.Sync = function(token)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "SyncRequest");

	if (token != null)
		elRequest.setAttribute("token", token);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.CreateFolder = function(folder)
{
	var elFolder;
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "CreateFolderRequest");

	elFolder = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "folder");

	zinAssert(isPropertyPresent(folder, 'name') && isPropertyPresent(folder, 'l') && folder.name.length > 0)

	elFolder.setAttribute("name", folder.name);
	elFolder.setAttribute("l",    folder.l);
	elFolder.setAttribute("view", "contact");
	elFolder.setAttribute("fie",  "1");

	elRequest.appendChild(elFolder);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.CreateContact = function(args)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "CreateContactRequest");
	var elCn      = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "cn");
	var i, elA;

	zinAssert(isPropertyPresent(args, 'properties') && isPropertyPresent(args, 'l') && aToLength(args.properties) > 0)

	elCn.setAttribute("l", args.l);

	for (i in args.properties)
	{
		elA = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "a");
		elA.setAttribute("n", i);
		elA.textContent = args.properties[i];
		elCn.appendChild(elA);
	}

	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.FolderAction = function(args)
{
	this.ActionRequest("FolderActionRequest", args);
}

ZimbraSoapDocument.prototype.ContactAction = function(args)
{
	this.ActionRequest("ContactActionRequest", args);
}

ZimbraSoapDocument.prototype.FakeHead = function(args)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "FakeHeadRequest");

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.ActionRequest = function(name, args)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, name);
	var elAction  = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "action");

	for (var i in args)
		elAction.setAttribute(i, args[i]); // expecting id, op, and either l or name

	elRequest.appendChild(elAction);

	this.setElementAsBody(elRequest);
}

ZimbraSoapDocument.prototype.ModifyContact = function(args)
{
	var elRequest = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "ModifyContactRequest");
	var elCn      = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "cn");
	var i, elA;

	zinAssert(isPropertyPresent(args, 'properties') &&
	          isPropertyPresent(args, 'l') &&
			  isPropertyPresent(args, 'id') && aToLength(args.properties) > 0);


	elRequest.setAttribute("replace", "1");
	elRequest.setAttribute("force", "1");

	elCn.setAttribute("id", args.id);
	elCn.setAttribute("l", args.l);

	for (i in args.properties)
	{
		elA = this.doc.createElementNS(ZimbraSoapDocument.NS_MAIL, "a");
		elA.setAttribute("n", i);
		elA.textContent = args.properties[i];
		elCn.appendChild(elA);
	}

	elRequest.appendChild(elCn);

	this.setElementAsBody(elRequest);
}
