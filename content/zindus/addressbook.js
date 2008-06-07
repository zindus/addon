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

function ZinAddressBookTb2() { ZinAddressBook.call(this); this.m_logger.debug("Tb2"); }
function ZinAddressBookTb3() { ZinAddressBook.call(this); this.m_logger.debug("Tb3"); }

ZinAddressBookTb2.prototype = new ZinAddressBook();
ZinAddressBookTb3.prototype = new ZinAddressBook();

function ZinAddressBook()
{
	this.m_contact_converter = null;
	this.m_pab_name = null;
	this.m_pab_uri  = null;

	this.m_nsIRDFService = null;
	this.m_map_name_to_uri = null;

	this.m_logger = ZinLoggerFactory.instance().newZinLogger("AddressBook");

	// these used to be const but a user is reporting an error on this line:
	// Error: redeclaration of const kPersonalAddressbookURI Source File: chrome://zindus/content/addressbook.js Line: 36 
	// Perhaps a file is being included twice or perhaps the name has been defined by another extension the user has installed?
	// either way, making them class members should fix it.
	// See issue#51
	//
	this.kPABDirectory           = 2;                                    // dirType ==> mork address book
	this.kMDBDirectoryRoot       = "moz-abmdbdirectory://";              // see: nsIAbMDBDirectory.idl
	this.kPersonalAddressbookURI = this.kMDBDirectoryRoot + "abook.mab"; // see: resources/content/abCommon.js
}

ZinAddressBook.TB2 = "TB2";
ZinAddressBook.TB3 = "TB3";

ZinAddressBook.TbVersion = function()
{
	var contract_id = "@mozilla.org/abmanager;1";
	var ret;

	if (contract_id in Components.classes)
		ret = ZinAddressBook.TB3;
	else
		ret = ZinAddressBook.TB2;

	return ret;
}

ZinAddressBook.prototype.contact_converter = function()
{
	if (arguments.length == 1)
		this.m_contact_converter = arguments[0];

	zinAssert(this.m_contact_converter);

	return this.m_contact_converter;
}

ZinAddressBook.prototype.populateNameToUriMap = function()
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
ZinAddressBook.prototype.getAddressBookUrisByPattern = function(pat)
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
ZinAddressBook.prototype.getAddressBookUriByName = function(name)
{
	var ret = null;

	this.populateNameToUriMap();

	if (isPropertyPresent(this.m_map_name_to_uri, name) && this.m_map_name_to_uri[name].length == 1)
		ret = this.m_map_name_to_uri[name];

	// this.m_logger.debug("getAddressBookUriByName: blah: name: " + name + " returns: " + ret);

	return ret;
}

ZinAddressBook.prototype.getAddressBookPrefId = function(uri)
{
	var dir = this.nsIAbDirectory(uri);
	return dir.dirPrefId;
}

ZinAddressBook.prototype.forEachAddressBook = function(functor)
{
	var root  = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var nodes = root.childNodes;
	var fContinue = true;

	while (nodes.hasMoreElements() && fContinue)
	{
		var elem = nodes.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);

		if (this.directoryProperty(elem, "dirType") == this.kPABDirectory)
			fContinue = functor.run(elem);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

ZinAddressBookTb3.prototype.forEachCard = function(uri, functor)
{
	var dir = this.nsIAbDirectory(uri);

	var enm = dir.childCards;
	var fContinue = true;

	while (fContinue && enm.hasMoreElements())
	{
		var item = enm.getNext();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

ZinAddressBookTb2.prototype.forEachCard = function(uri, functor)
{
	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var enm = dir.childCards;
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

ZinAddressBookTb2.prototype.nsIAddressBook = function()
{
	return Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
}

ZinAddressBookTb3.prototype.nsIAbManager = function()
{
	return Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
}

ZinAddressBookTb3.prototype.nsIAddrDatabase = function(uri)
{
	var dir = this.nsIAbDirectory(uri);

	return dir.QueryInterface(Components.interfaces.nsIAbMDBDirectory).database;
}

ZinAddressBookTb2.prototype.nsIAbDirectory = function(uri)
{
	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);

	return dir;
}

ZinAddressBookTb3.prototype.nsIAbDirectory = function(uri)
{
	var dir = this.nsIAbManager().getDirectory(uri);

	zinAssert(dir instanceof Components.interfaces.nsIAbMDBDirectory);

	return dir;
}

ZinAddressBook.prototype.nsIRDFService = function()
{
	if (!this.m_nsIRDFService)
		this.m_nsIRDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	return this.m_nsIRDFService;
}

ZinAddressBookTb2.prototype.newAbDirectoryProperties = function(name)
{
	var abProps = Components.classes["@mozilla.org/addressbook/properties;1"].
	                createInstance(Components.interfaces.nsIAbDirectoryProperties);

	abProps.description = name;
	abProps.dirType     = this.kPABDirectory;

	return abProps;
}

ZinAddressBook.prototype.newAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

ZinAddressBookTb2.prototype.newAddressBook = function(name)
{
	abProps = this.newAbDirectoryProperties(name);
	this.nsIAddressBook().newAddressBook(abProps);

	ZinAddressBook.prototype.newAddressBook.call(this);

	return abProps.URI;
}

ZinAddressBookTb3.prototype.newAddressBook = function(name)
{
	var prefkey = this.nsIAbManager().newAddressBook(name, "", this.kPABDirectory);

	var prefs = new MozillaPreferences("");
	var uri = this.kMDBDirectoryRoot + prefs.getCharPrefOrNull(prefs.branch(), prefkey + ".filename");

	ZinAddressBook.prototype.newAddressBook.call(this);

	return uri;
}

ZinAddressBook.prototype.deleteAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

ZinAddressBookTb2.prototype.deleteAddressBook = function(uri)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	var arrayDir  = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var arrayRoot = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);

	arrayDir.AppendElement(dir);
	arrayRoot.AppendElement(root);

	this.nsIAddressBook().deleteAddressBooks(ds, arrayRoot, arrayDir);

	ZinAddressBook.prototype.deleteAddressBook.call(this);
}

ZinAddressBookTb3.prototype.deleteAddressBook = function(uri)
{
	this.nsIAbManager().deleteAddressBook(uri);

	ZinAddressBook.prototype.deleteAddressBook.call(this);
}

ZinAddressBook.prototype.renameAddressBook = function()
{
	this.m_map_name_to_uri = null;
}

ZinAddressBookTb2.prototype.renameAddressBook = function(uri, name)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	this.nsIAddressBook().modifyAddressBook(ds, root, dir, this.newAbDirectoryProperties(name));

	ZinAddressBook.prototype.renameAddressBook.call(this);
}

ZinAddressBookTb3.prototype.renameAddressBook = function(uri, name)
{
	var dir = this.nsIAbDirectory(uri);

	dir.dirName = name;

	ZinAddressBook.prototype.renameAddressBook.call(this);
}

ZinAddressBookTb2.prototype.deleteCards = function(uri, aCards)
{
	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);

	var cardsArray = Components.classes["@mozilla.org/supports-array;1"].createInstance().
	                            QueryInterface(Components.interfaces.nsISupportsArray);

	for (var i = 0; i < aCards.length; i++)
	{
		this.m_logger.debug("deleteCards: prepare: " + this.nsIAbCardToPrintableVerbose(aCards[i]));
		cardsArray.AppendElement(aCards[i]);
	}

	this.m_logger.debug("deleteCards: about to delete");

	dir.deleteCards(cardsArray);

	this.m_logger.debug("deleteCards: done");
}

ZinAddressBookTb3.prototype.deleteCards = function(uri, aCards)
{
	var dir = this.nsIAbDirectory(uri);

	var cardsArray = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);

	for (var i = 0; i < aCards.length; i++)
	{
		this.m_logger.debug("deleteCards: prepare: " + this.nsIAbCardToPrintableVerbose(aCards[i]));
		cardsArray.appendElement(aCards[i], false);
	}

	this.m_logger.debug("deleteCards: about to delete");

	dir.deleteCards(cardsArray);

	this.m_logger.debug("deleteCards: done");
}

ZinAddressBook.prototype.addCard = function(uri, properties, attributes)
{
	zinAssert(uri != null && properties != null && attributes != null);

	// this.m_logger.debug("addCard: blah: about to add a card: uri: " + uri + " properties: " + aToString(properties) +
	//                                                       " attributes: " + aToString(attributes));

	var dir = this.nsIAbDirectory(uri);
	var abstractCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].
	                      createInstance().QueryInterface(Components.interfaces.nsIAbCard);
	var abCard = dir.addCard(abstractCard);

	this.updateCard(abCard, uri, properties, attributes, FORMAT_TB);

	return abCard;
}

ZinAddressBook.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var key;
	var a_field_used = new Object();

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

ZinAddressBookTb2.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	ZinAddressBook.prototype.updateCard.call(this, abCard, uri, properties, attributes, format);

	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	mdbCard.editCardToDatabase(uri);

	return abCard;
}

ZinAddressBookTb3.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var database = this.nsIAddrDatabase(uri);

	mdbCard.setAbDatabase(database);

	ZinAddressBook.prototype.updateCard.call(this, abCard, uri, properties, attributes, format);

	database.editCard(mdbCard, false);
	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(abCard);

	return abCard;
}

ZinAddressBook.prototype.getCardProperties = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var i, j, key, value;
	var ret = new Object();

	for (i in this.m_contact_converter.m_map[FORMAT_TB])
	{
		value = abCard.getCardValue(i);

		if (value)
			ret[i] = value;
	}

	// this.m_logger.debug("getCardProperties: blah: returns: " + aToString(ret));

	return ret;
}

ZinAddressBook.prototype.getCardAttributes = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
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

ZinAddressBookTb2.prototype.setCardAttribute = function(mdbCard, uri, key, value)
{
	zinAssert(typeof mdbCard.editCardToDatabase == 'function');
	mdbCard.setStringAttribute(key, value);
	mdbCard.editCardToDatabase(uri);
}

ZinAddressBookTb3.prototype.setCardAttribute = function(mdbCard, uri, key, value)
{
	var database = this.nsIAddrDatabase(uri);

	mdbCard.setAbDatabase(database);

	mdbCard.setStringAttribute(key, value);

	database.editCard(mdbCard, false);

	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(mdbCard);
}

ZinAddressBookTb2.prototype.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key);
	zinAssert(value);

	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abCard = this.nsIAddressBook().getAbDatabaseFromURI(uri).getCardFromAttribute(dir, key, value, false);

	return abCard; // an nsIABCard
}

ZinAddressBookTb3.prototype.lookupCard = function(uri, key, value)
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

ZinAddressBook.prototype.getPabURI = function()
{
	if (!this.m_pab_uri)
		this.setupPab();

	return this.m_pab_uri;
}

ZinAddressBook.prototype.getPabName = function()
{
	if (!this.m_pab_name)
		this.setupPab();

	return this.m_pab_name;
}

ZinAddressBook.prototype.setupPab = function()
{
	var pabByUri  = null;
	var pabByName = null;
	var pabName   = null;
	var ret = null;
	var msg;

	var functor_foreach_addressbook = {
		context: this,
		run: function(elem) {

			if (this.context.directoryProperty(elem, "URI") == this.context.kPersonalAddressbookURI)
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

ZinAddressBook.prototype.addressbooksToString = function()
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
			       " matches kPersonalAddressbookURI: " +
				         (this.context.directoryProperty(elem, "URI") == this.context.kPersonalAddressbookURI);
			
			return true;
		}
	};

	this.forEachAddressBook(functor_foreach_addressbook);

	return ret;
}

ZinAddressBook.prototype.isElemPab = function(elem)
{
	return (this.getPabURI() == this.directoryProperty(elem, "URI"));
}

ZinAddressBook.prototype.nsIAbCardToPrintable = function(abCard)
{
	return (abCard.isMailList ? abCard.mailListURI : abCard.getCardValue("PrimaryEmail"));
}

ZinAddressBook.prototype.nsIAbCardToPrintableVerbose = function(abCard)
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

ZinAddressBook.prototype.nsIAbMDBCardToKey = function(mdbCard)
{
	zinAssert(typeof(mdbCard) == 'object' && mdbCard != null);

	return hyphenate('-', mdbCard.dbTableID, mdbCard.dbRowID, mdbCard.key);
}

ZinAddressBookTb2.prototype.directoryProperty = function(elem, property)
{
	return elem.directoryProperties[property];
}

ZinAddressBookTb3.prototype.directoryProperty = function(elem, property)
{
	return elem[property];
}
