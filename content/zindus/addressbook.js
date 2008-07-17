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

function AddressBookTb2() { AddressBook.call(this); this.m_logger.debug("Tb2"); }
function AddressBookTb3() { AddressBook.call(this); this.m_logger.debug("Tb3"); }

AddressBookTb2.prototype = new AddressBook();
AddressBookTb3.prototype = new AddressBook();

const kPABDirectory           = 2;                               // dirType ==> mork address book
const kMDBDirectoryRoot       = "moz-abmdbdirectory://";         // see: nsIAbMDBDirectory.idl
const kPersonalAddressbookURI = kMDBDirectoryRoot + "abook.mab"; // see: resources/content/abCommon.js

function AddressBook()
{
	this.m_contact_converter = null;
	this.m_pab_name = null;
	this.m_pab_uri  = null;

	this.m_nsIRDFService = null;
	this.m_map_name_to_uri = null;

	this.m_logger = newLogger("AddressBook");
}

AddressBook.TB2 = "TB2";
AddressBook.TB3 = "TB3";

AddressBook.version = function()
{
	var contract_id = "@mozilla.org/abmanager;1";
	var ret;

	if (contract_id in Cc)
		ret = AddressBook.TB3;
	else
		ret = AddressBook.TB2;

	return ret;
}

AddressBook.prototype.contact_converter = function()
{
	if (arguments.length == 1)
		this.m_contact_converter = arguments[0];

	zinAssert(this.m_contact_converter);

	return this.m_contact_converter;
}

AddressBook.prototype.populateNameToUriMap = function()
{
	var ret = null;

	var functor =
	{
		context : this,

		run: function(elem)
		{
			var key   = elem.dirName;
			var value = this.context.directoryProperty(elem, "URI");

			if (key == this.context.getPabName())
				value = this.context.getPabURI();
		
			if (!isPropertyPresent(this.context.m_map_name_to_uri, key))
				this.context.m_map_name_to_uri[key] = new Array();

			this.context.m_map_name_to_uri[key].push(value);

			return true;
		}
	};

	if (!this.m_map_name_to_uri)
	{
		this.m_map_name_to_uri = new Object();
		this.forEachAddressBook(functor);
	}
}

// returns an array of uris that match the RegExp pat
//
AddressBook.prototype.getAddressBookUrisByPattern = function(pat)
{
	zinAssert(pat instanceof RegExp);

	var ret = new Object();

	this.populateNameToUriMap();

	for (var key in this.m_map_name_to_uri)
		if (pat.test(key))
			ret[key] = this.m_map_name_to_uri[key];
			
	// this.m_logger.debug("getAddressBookUrisByPattern: blah: aToString(ret));

	return ret;
}

// returns a uri iff there is exactly one addressbook named "name"
//
AddressBook.prototype.getAddressBookUriByName = function(name)
{
	var ret = null;

	this.populateNameToUriMap();

	if (isPropertyPresent(this.m_map_name_to_uri, name) && this.m_map_name_to_uri[name].length == 1)
		ret = this.m_map_name_to_uri[name];

	// this.m_logger.debug("getAddressBookUriByName: blah: name: " + name + " returns: " + ret);

	return ret;
}

AddressBook.prototype.forEachAddressBook = function(functor)
{
	var root      = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Ci.nsIAbDirectory);
	var nodes     = root.childNodes;
	var fContinue = true;
	var aUri      = new Object();
	var uri;

	while (nodes.hasMoreElements() && fContinue)
	{
		var elem = nodes.getNext().QueryInterface(Ci.nsIAbDirectory);

		uri = this.directoryProperty(elem, "URI");

		if (this.directoryProperty(elem, "dirType") == kPABDirectory && !isPropertyPresent(aUri, uri))
			fContinue = functor.run(elem);

		if (isPropertyPresent(aUri, uri))
			this.m_logger.warn("forEachAddressBook: avoid calling functor twice on uri: " + uri);

		aUri[uri] = true;

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

AddressBookTb3.prototype.forEachCard = function(uri, functor)
{
	var dir       = this.nsIAbDirectory(uri);
	var enm       = dir.childCards;
	var fContinue = true;

	while (fContinue && enm.hasMoreElements())
	{
		var item = enm.getNext();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

AddressBookTb2.prototype.forEachCard = function(uri, functor)
{
	var dir       = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var enm       = dir.childCards;
	var fContinue = true;

	try { enm.first() } catch(ex) { fContinue = false; }

	while (fContinue)
	{
		var item = enm.currentItem();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		try { enm.next(); } catch(ex) { fContinue = false; }
	}
}

AddressBookTb2.prototype.nsIAddressBook = function()
{
	return Cc["@mozilla.org/addressbook;1"].createInstance(Ci.nsIAddressBook);
}

AddressBookTb3.prototype.nsIAbManager = function()
{
	return Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
}

AddressBookTb3.prototype.nsIAddrDatabase = function(uri)
{
	var dir = this.nsIAbDirectory(uri);

	return dir.QueryInterface(Ci.nsIAbMDBDirectory).database;
}

AddressBookTb2.prototype.nsIAbDirectory = function(uri)
{
	return this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
}

AddressBookTb3.prototype.nsIAbDirectory = function(uri)
{
	var dir = this.nsIAbManager().getDirectory(uri);

	zinAssert(dir instanceof Ci.nsIAbMDBDirectory);

	return dir;
}

AddressBook.prototype.nsIRDFService = function()
{
	if (!this.m_nsIRDFService)
		this.m_nsIRDFService = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);

	return this.m_nsIRDFService;
}

AddressBookTb2.prototype.newAbDirectoryProperties = function(name)
{
	var abProps = Cc["@mozilla.org/addressbook/properties;1"].createInstance(Ci.nsIAbDirectoryProperties);

	abProps.description = name;
	abProps.dirType     = kPABDirectory;

	return abProps;
}

AddressBook.prototype.newAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

AddressBookTb2.prototype.newAddressBook = function(name)
{
	var abProps = this.newAbDirectoryProperties(name);
	this.nsIAddressBook().newAddressBook(abProps);

	AddressBook.prototype.newAddressBook.call(this);

	return new AddressBookImportantProperties(abProps.URI, abProps.prefName);
}

AddressBookTb3.prototype.newAddressBook = function(name)
{
	var prefkey = this.nsIAbManager().newAddressBook(name, "", kPABDirectory);
	var prefs   = new MozillaPreferences("");
	var uri     = kMDBDirectoryRoot + prefs.getCharPrefOrNull(prefs.branch(), prefkey + ".filename");

	AddressBook.prototype.newAddressBook.call(this);

	// this.m_logger.debug("blah: prefkey: " + prefkey + " uri: " + uri);

	return new AddressBookImportantProperties(uri, prefkey);
}

AddressBook.prototype.deleteAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

AddressBookTb2.prototype.deleteAddressBook = function(uri)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Ci.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	var arrayDir  = Cc["@mozilla.org/supports-array;1"].createInstance(Ci.nsISupportsArray);
	var arrayRoot = Cc["@mozilla.org/supports-array;1"].createInstance(Ci.nsISupportsArray);

	arrayDir.AppendElement(dir);
	arrayRoot.AppendElement(root);

	this.nsIAddressBook().deleteAddressBooks(ds, arrayRoot, arrayDir);

	AddressBook.prototype.deleteAddressBook.call(this);
}

AddressBookTb3.prototype.deleteAddressBook = function(uri)
{
	this.nsIAbManager().deleteAddressBook(uri);

	AddressBook.prototype.deleteAddressBook.call(this);
}

AddressBook.prototype.renameAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

AddressBookTb2.prototype.renameAddressBook = function(uri, name)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Ci.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	this.nsIAddressBook().modifyAddressBook(ds, root, dir, this.newAbDirectoryProperties(name));

	AddressBook.prototype.renameAddressBook.call(this);
}

AddressBookTb3.prototype.renameAddressBook = function(uri, name)
{
	var dir = this.nsIAbDirectory(uri);

	dir.dirName = name;

	AddressBook.prototype.renameAddressBook.call(this);
}

AddressBookTb2.prototype.deleteCards = function(uri, aCards)
{
	var dir        = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var cardsArray = Cc["@mozilla.org/supports-array;1"].createInstance().QueryInterface(Ci.nsISupportsArray);
	var ret        = true;

	zinAssert(aCards.length > 0);

	for (var i = 0; i < aCards.length; i++)
	{
		this.m_logger.debug("deleteCards: prepare: " + this.nsIAbCardToPrintableVerbose(aCards[i]));
		cardsArray.AppendElement(aCards[i]);
	}

	this.m_logger.debug("deleteCards: about to delete: " + cardsArray.Count() + " card(s)");

	// cardsArray = {}; // TODO force excaption

	try {
		dir.deleteCards(cardsArray);
	}
	catch (e) {
		ret = false;
		this.m_logger.error("deleteCards: failed: exception: " + e);
	}

	this.m_logger.debug("deleteCards: " + (ret ? "succeeded" : "failed"));

	return ret;
}

AddressBookTb3.prototype.deleteCards = function(uri, aCards)
{
	var dir        = this.nsIAbDirectory(uri);
	var cardsArray = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);

	for (var i = 0; i < aCards.length; i++)
	{
		this.m_logger.debug("deleteCards: prepare: " + this.nsIAbCardToPrintableVerbose(aCards[i]));
		cardsArray.appendElement(aCards[i], false);
	}

	this.m_logger.debug("deleteCards: about to delete");

	dir.deleteCards(cardsArray);

	this.m_logger.debug("deleteCards: done");
}

AddressBook.prototype.addCard = function(uri, properties, attributes)
{
	zinAssert(uri != null && properties != null && attributes != null);

	// this.m_logger.debug("addCard: blah: about to add a card: uri: " + uri + " properties: " + aToString(properties) +
	//                                                       " attributes: " + aToString(attributes));

	var dir          = this.nsIAbDirectory(uri);
	var abstractCard = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance().QueryInterface(Ci.nsIAbCard);
	var abCard       = dir.addCard(abstractCard);

	this.updateCard(abCard, uri, properties, attributes, FORMAT_TB);

	return abCard;
}

AddressBook.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	var a_field_used = new Object();
	var key;

	// this.m_logger.debug("updateCard: blah: " + " \n properties: " + aToString(properties) +
	//                                            "\n card properties: " + aToString(this.getCardProperties(abCard)));

	for (key in properties)
	{
		abCard.setCardValue(key, properties[key]);
		a_field_used[key] = true;
	}

	// now do deletes...
	//
	for (key in this.contact_converter().m_common_to[FORMAT_TB][format])
		if (!isPropertyPresent(a_field_used, key))
			abCard.setCardValue(key, "");

	for (key in attributes)
		mdbCard.setStringAttribute(key, attributes[key]);

	return abCard;
}

AddressBookTb2.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	AddressBook.prototype.updateCard.call(this, abCard, uri, properties, attributes, format);

	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	mdbCard.editCardToDatabase(uri);

	return abCard;
}

AddressBookTb3.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	var database = this.nsIAddrDatabase(uri);

	mdbCard.setAbDatabase(database);

	AddressBook.prototype.updateCard.call(this, abCard, uri, properties, attributes, format);

	database.editCard(mdbCard, false, null); // see editCard comment above
	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(abCard);

	return abCard;
}

AddressBook.prototype.getCardProperties = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	var ret     = new Object();
	var i, j, key, value;

	for (i in this.m_contact_converter.m_map[FORMAT_TB])
	{
		value = abCard.getCardValue(i);

		// this.m_logger.debug("AddressBook.getCardProperties: i: " + i + " value: " + value);

		if (value)
			ret[i] = value;
	}

	// this.m_logger.debug("getCardProperties: blah: returns: " + aToString(ret));

	return ret;
}

AddressBook.prototype.getCardAttributes = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	var ret     = new Object();
	var i, value;

	var attributes = [ TBCARD_ATTRIBUTE_LUID, TBCARD_ATTRIBUTE_CHECKSUM ];

	for (i = 0; i < attributes.length; i++)
	{
		value = mdbCard.getStringAttribute(attributes[i]);

		if (value)
			ret[attributes[i]] = value;
	}

	return ret;
}

AddressBookTb2.prototype.setCardAttribute = function(mdbCard, uri, key, value)
{
	zinAssert(typeof mdbCard.editCardToDatabase == 'function');
	mdbCard.setStringAttribute(key, value);
	mdbCard.editCardToDatabase(uri);
}

AddressBookTb3.prototype.setCardAttribute = function(mdbCard, uri, key, value)
{
	var database = this.nsIAddrDatabase(uri);

	mdbCard.setAbDatabase(database);
	mdbCard.setStringAttribute(key, value);

	database.editCard(mdbCard, false, null); // Tb3a3 added the third param here.  null means that listeners aren't notified of change, see http://mxr.mozilla.org/mozilla/source/mailnews/addrbook/public/nsIAddrDatabase.idl

	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(mdbCard);
}

AddressBookTb2.prototype.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key);
	zinAssert(value);

	var dir    = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var abCard = this.nsIAddressBook().getAbDatabaseFromURI(uri).getCardFromAttribute(dir, key, value, false);

	return abCard; // an nsIABCard
}

AddressBookTb3.prototype.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key);
	zinAssert(value);

	var dir    = this.nsIAbDirectory(uri);
	var abCard = dir.database.getCardFromAttribute(dir, key, value, false);

	// this.m_logger.debug("lookupCard: blah: uri: " + uri + " key: " + key + " value: " + value +
	//                     " returns: " + this.nsIAbCardToPrintableVerbose(abCard));

	return abCard; // an nsIABCard
}

AddressBook.prototype.getPabURI = function()
{
	if (!this.m_pab_uri)
		this.setupPab();

	return this.m_pab_uri;
}

AddressBook.prototype.getPabName = function()
{
	if (!this.m_pab_name)
		this.setupPab();

	return this.m_pab_name;
}

AddressBook.prototype.setupPab = function()
{
	var pabByUri  = null;
	var pabByName = null;
	var pabName   = null;
	var ret = null;
	var msg;

	var functor_foreach_addressbook = {
		context: this,
		run: function(elem) {

			if (this.context.directoryProperty(elem, "URI") == kPersonalAddressbookURI)
			{
				pabByUri      = new Object();
				pabByUri.uri  = this.context.directoryProperty(elem, "URI");
				pabByUri.name = elem.dirName;
			}

			if (elem.dirName == "Personal Address Book")
			{
				pabByName      = new Object();
				pabByName.uri  = this.context.directoryProperty(elem, "URI");
				pabByName.name = elem.dirName;
			}

			return true;
		}
	};

	this.forEachAddressBook(functor_foreach_addressbook);

	if (pabByUri)
	{
		this.m_pab_uri  = String(pabByUri.uri);
		this.m_pab_name = String(pabByUri.name);
		this.m_logger.debug("m_pab_uri selected by uri: uri: " + this.m_pab_uri + " name: " + this.m_pab_name);
	}
	else if (pabByName)
	{
		this.m_pab_uri  = String(pabByName.uri);  // create a primitive string so that typeof() == "string" not "object"
		this.m_pab_name = String(pabByName.name);
		this.m_logger.debug("m_pab_uri selected by name: uri: " + this.m_pab_uri + " name: " + this.m_pab_name);
	}
	else
	{
		this.m_logger.error("Couldn't find Personal Address Book");
		this.m_logger.debug("m_pab_uri couldn't be identified! addressbooks: " + this.addressbooksToString());
	}
}

AddressBook.prototype.addressbooksToString = function()
{
	var ret = "";

	var functor_foreach_addressbook = {
		context: this,
		run: function(elem) {
			ret += "\n " +
			       " dirName: " + elem.dirName +
			       " uri: "       + this.context.directoryProperty(elem, "URI") +
			       " dirPrefId: " + elem.dirPrefId +
			       " fileName: "  + this.context.directoryProperty(elem, "fileName") +
			       " position: "  + this.context.directoryProperty(elem, "position") +
			       " matches kPersonalAddressbookURI: " + (this.context.directoryProperty(elem, "URI") == kPersonalAddressbookURI);
			
			return true;
		}
	};

	this.forEachAddressBook(functor_foreach_addressbook);

	return ret;
}

AddressBook.prototype.isElemPab = function(elem)
{
	return (this.getPabURI() == this.directoryProperty(elem, "URI"));
}

AddressBook.prototype.nsIAbCardToPrintable = function(abCard)
{
	return (abCard.isMailList ? abCard.mailListURI : abCard.getCardValue("PrimaryEmail"));
}

AddressBook.prototype.nsIAbCardToPrintableVerbose = function(abCard)
{
	var ret;

	if (!abCard)
		ret = "null";
	else if (abCard.isMailList)
		ret = "maillist uri: " + abCard.mailListURI
	else
	{
		var properties = this.getCardProperties(abCard);
		var attributes = this.getCardAttributes(abCard);

		ret = "properties: " + aToString(properties) + " attributes: " + aToString(attributes);
	}

	return ret;
}

AddressBook.prototype.nsIAbMDBCardToKey = function(mdbCard)
{
	zinAssert(typeof(mdbCard) == 'object' && mdbCard != null);

	return hyphenate('-', mdbCard.dbTableID, mdbCard.dbRowID, mdbCard.key);
}

AddressBookTb2.prototype.directoryProperty = function(elem, property)
{
	return elem.directoryProperties[property];
}

AddressBookTb3.prototype.directoryProperty = function(elem, property)
{
	return elem[property];
}

function AddressBookImportantProperties(uri, prefId)
{
	this.m_uri    = uri;
	this.m_prefid = prefId
}

AddressBookImportantProperties.prototype.toString = function()
{
	return "uri: " + this.m_uri + " prefid: " + this.m_prefid;
}
