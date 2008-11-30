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

function AddressBookTb2() { AddressBook.call(this); this.m_logger = newLogger("AddressBook"); this.m_logger.debug("Tb2"); }
function AddressBookTb3() { AddressBook.call(this); this.m_logger = newLogger("AddressBook"); this.m_logger.debug("Tb3"); }

AddressBookTb2.prototype = new AddressBook();
AddressBookTb3.prototype = new AddressBook();

const kPABDirectory           = 2;                               // dirType ==> mork address book
const kMDBDirectoryRoot       = "moz-abmdbdirectory://";         // see: nsIAbMDBDirectory.idl
const kPersonalAddressbookURI = kMDBDirectoryRoot + "abook.mab"; // see: resources/content/abCommon.js
const a_card_attributes       = [ TBCARD_ATTRIBUTE_LUID, TBCARD_ATTRIBUTE_CHECKSUM, TBCARD_ATTRIBUTE_EXPIRED_ON,
                                  TBCARD_ATTRIBUTE_LUID_ITER ];

function AddressBook()
{
	this.m_contact_converter = null;
	this.m_pab_name = null;
	this.m_pab_uri  = null;

	this.m_nsIRDFService = null;
	this.m_map_name_to_uri = null;
	
	// used to construct m_logger here but since this constructor is called at .js file load time
	// and we don't want to hold open a reference to the logfile, better to delay the logger construction
	// until it's needed (ie. when the derived class get constructed).
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

AddressBook.new = function()
{
	return (AddressBook.version() == AddressBook.TB2) ? new AddressBookTb2() : new AddressBookTb3();
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
	if (!this.m_map_name_to_uri)
	{
		var context = this;

		var functor =
		{
			run: function(elem)
			{
				var key = elem.dirName;
				var uri = context.directoryProperty(elem, "URI");

				if (key == context.getPabName())
					uri = context.getPabURI();
		
				if (!isPropertyPresent(context.m_map_name_to_uri, key))
					context.m_map_name_to_uri[key] = new Array();

				context.m_map_name_to_uri[key].push(new AddressBookImportantProperties(uri, elem.dirPrefId));

				return true;
			}
		};

		this.m_map_name_to_uri = new Object();
		this.forEachAddressBook(functor);

		// this.m_logger.debug("AddressBook.populateNameToUriMap: blah: " + this.getNameToUriMapAsString());
	}
}

AddressBook.prototype.getNameToUriMapAsString = function()
{
	var ret = " m_map_name_to_uri: ";

	for (var key in this.m_map_name_to_uri)
		ret += "\n " +
			   " length: " + this.m_map_name_to_uri[key].length +
		       " key: "    + strPadTo(key, 40) +
		       " values: " + this.m_map_name_to_uri[key].toString();

	return ret;
}

// returns an array of AddressBookImportantProperties that match the RegExp pat
//
AddressBook.prototype.getAddressBooksByPattern = function(pat)
{
	zinAssert(pat instanceof RegExp);

	var ret = new Object();

	this.populateNameToUriMap();

	for (var key in this.m_map_name_to_uri)
		if (pat.test(key))
			ret[key] = this.m_map_name_to_uri[key];

	// this.m_logger.debug("AddressBook.getAddressBooksByPattern: pat: " + pat + " ret: " + aToString(ret));
			
	return ret;
}

// returns a uri iff there is exactly one addressbook named "name"
//
AddressBook.prototype.getAddressBookUriByName = function(name)
{
	var ret = null;

	this.populateNameToUriMap();

	if (isPropertyPresent(this.m_map_name_to_uri, name) && this.m_map_name_to_uri[name].length == 1)
		ret = this.m_map_name_to_uri[name][0].uri();

	// this.m_logger.debug("getAddressBookUriByName: returns: " + ret + " when: " + this.getNameToUriMapAsString());

	return ret;
}

AddressBook.prototype.getAddressBookNameByUri = function(uri)
{
	var ret = null;

	this.populateNameToUriMap();

	for (var key in this.m_map_name_to_uri)
		for (var i = 0; i < this.m_map_name_to_uri[key].length; i++)
			if (this.m_map_name_to_uri[key][i].uri() == uri)
			{
				ret = key;
				break;
			}

	// this.m_logger.debug("getAddressBookNameByUri: uri: " + uri + " returns: " + ret);

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

AddressBook.prototype.forEachCard = function(uri, functor)
{
	var generator = this.forEachCardGenerator(uri, functor, 0);

	while (generator.next())
		;
}

AddressBookTb3.prototype.forEachCardGenerator = function(uri, functor, yield_count)
{
	var dir       = this.nsIAbDirectory(uri);
	var enm       = dir.childCards;
	var fContinue = true;
	var count     = 0;

	while (fContinue && enm.hasMoreElements())
	{
		var item = enm.getNext();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (yield_count > 0)
		{
			if (++count % yield_count == 0)
				yield true;
		}
	}

	yield false;
}

AddressBookTb2.prototype.forEachCardGenerator = function(uri, functor, yield_count)
{
	var dir       = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	var fContinue = true;
	var count     = 0;
	var enm;

	try { enm = dir.childCards; } catch (ex) { zinAssertAndLog(false, uri); } // assertion here points to a bad uri

	try { enm.first() } catch(ex) { fContinue = false; }

	while (fContinue)
	{
		var item = enm.currentItem();

		fContinue = functor.run(uri, item);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		try { enm.next(); } catch(ex) { fContinue = false; }

		if (++count % yield_count == 0)
			yield true;
	}

	yield false;
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
	var prefkey = this.nsIAbManager().newAddressBook(name, "", kPABDirectory); // TODO - what does this do if it fails?
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
	var abp  = this.newAbDirectoryProperties(name);

	// even though it's not changing, nsIAbDirectoryProperties.URI still has to be set, otherwise dragons may come...
	// see issue #135
	//
	abp.URI = uri;

	this.nsIAddressBook().modifyAddressBook(ds, root, dir, abp);

	AddressBook.prototype.renameAddressBook.call(this);
}

AddressBookTb3.prototype.renameAddressBook = function(uri, name)
{
	var dir = this.nsIAbDirectory(uri);

	dir.dirName = name;

	AddressBook.prototype.renameAddressBook.call(this);
}

AddressBook.prototype.deleteCardsArray = function(dir, cardsArray)
{
	var error_msg  = null;
	var error_name = null;

	try {
		dir.deleteCards(cardsArray);
	}
	catch (e) {
		error_name = e.name;
		error_msg = "deleteCards: failed: exception: " + e;
	}

	if (error_name == "NS_ERROR_INVALID_POINTER")
	{
		// May have encountered a known Thunderbird bug - try a workaround to:
		// https://bugzilla.mozilla.org/show_bug.cgi?id=451306
		//
		var abip = this.newAddressBook("zindus-bug-451306-temporary-addressbook");
		this.deleteAddressBook(abip.uri());

		error_name = null;

		try {
			dir.deleteCards(cardsArray);
		}
		catch (e) {
			error_name = e.name;
			error_msg  += "\n workaround unsuccessful: " + e;
		}

		if (!error_name)
			error_msg = "deleteCards: encountered bug #451306 - workaround succeeded";
	}

	ret = (error_name == null);

	if (error_msg)
		this.m_logger.debug(error_msg);

	this.m_logger.debug("deleteCards: " + (ret ? "succeeded" : "failed"));

	return ret;
}

AddressBookTb2.prototype.deleteCards = function(uri, aCards)
{
	var cardsArray = Cc["@mozilla.org/supports-array;1"].createInstance().QueryInterface(Ci.nsISupportsArray);
	var ret        = true;
	var dir;

	try {
		dir = this.nsIRDFService().GetResource(uri).QueryInterface(Ci.nsIAbDirectory);
	}
	catch (ex) {
		zinAssertAndLog(false, uri); // assertion here points to a programming error passing in a bad uri
	}

	zinAssert(aCards.length > 0);

	for (var i = 0; i < aCards.length; i++)
		cardsArray.AppendElement(aCards[i]);

	return this.deleteCardsArray(dir, cardsArray);
}

AddressBookTb3.prototype.deleteCards = function(uri, aCards)
{
	var dir        = this.nsIAbDirectory(uri);
	var cardsArray = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);

	for (var i = 0; i < aCards.length; i++)
		cardsArray.appendElement(aCards[i], false);

	return this.deleteCardsArray(dir, cardsArray);
}

AddressBook.prototype.addCard = function(uri, properties, attributes)
{
	zinAssert(uri != null);
	zinAssert(properties != null);
	zinAssert(attributes != null);

	if (false)
		this.m_logger.debug("addCard: uri: " + uri + " properties: " + aToString(properties) + " attributes: " + aToString(attributes));

	var dir          = this.nsIAbDirectory(uri);
	var abstractCard = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance().QueryInterface(Ci.nsIAbCard);
	var abCard       = dir.addCard(abstractCard);

	this.updateCard(abCard, uri, properties, attributes, FORMAT_TB);

	return abCard;
}

AddressBook.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var a_field_used = new Object();
	var key;

	// this.m_logger.debug("updateCard: blah: " + " \n properties: " + aToString(properties) +
	//                                            "\n card properties: " + aToString(this.getCardProperties(abCard)));

	this.setCardProperties(abCard, uri, properties);

	for (key in properties)
		a_field_used[key] = true;

	// now do deletes...
	//
	var a_deletes = {};

	for (key in this.contact_converter().m_common_to[FORMAT_TB][format])
		if (!isPropertyPresent(a_field_used, key))
			a_deletes[key] = "";

	this.setCardProperties(abCard, uri, a_deletes);

	this.setCardAttributes(abCard, uri, attributes)

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
	var database = this.nsIAddrDatabase(uri);

	AddressBook.prototype.updateCard.call(this, abCard, uri, properties, attributes, format);

	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(abCard);

	return abCard;
}

AddressBook.prototype.getCardProperties = function(abCard)
{
	var ret = new Object();
	var i, value;

	for (i in this.m_contact_converter.m_map[FORMAT_TB])
	{
		if (AddressBook.version() == AddressBook.TB2)
			value = abCard.getCardValue(i);
		else
			value = abCard.getProperty(i, null);

		// this.m_logger.debug("AddressBook.getCardProperties: i: " + i + " value: " + value);

		if (value)
			ret[i] = value;
	}

	// this.m_logger.debug("getCardProperties: blah: returns: " + aToString(ret));

	return ret;
}

AddressBookTb2.prototype.getCardAttributes = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	var ret     = new Object();
	var i, value;

	for (i = 0; i < a_card_attributes.length; i++)
	{
		value = mdbCard.getStringAttribute(a_card_attributes[i]);

		if (value)
			ret[a_card_attributes[i]] = value;
	}

	return ret;
}

AddressBookTb3.prototype.getCardAttributes = function(abCard)
{
	var ret = new Object();
	var i, value;

	for (i = 0; i < a_card_attributes.length; i++)
	{
		value = abCard.getProperty(a_card_attributes[i], null);

		if (value)
			ret[a_card_attributes[i]] = value;
	}

	return ret;
}

AddressBookTb2.prototype.setCardAttributes = function(abCard, uri, collection)
{
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	zinAssert(typeof mdbCard.editCardToDatabase == 'function');

	for (var key in collection)
		mdbCard.setStringAttribute(key, collection[key]);

	mdbCard.editCardToDatabase(uri);
}

AddressBookTb3.prototype.setCardAttributes = function(abCard, uri, collection)
{
	this.setCardProperties(abCard, uri, collection);
}

AddressBookTb3.prototype.setCardProperties = function(abCard, uri, properties)
{
	for (var key in properties)
		abCard.setProperty(key, properties[key]);

	var dir = this.nsIAbDirectory(uri);
	dir.modifyCard(abCard);
}

AddressBookTb2.prototype.setCardProperties = function(abCard, uri, properties)
{
	for (var key in properties)
		abCard.setCardValue(key, properties[key]);

	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	mdbCard.editCardToDatabase(uri);
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
	var context   = this;
	var ret       = null;
	var msg;

	var functor_foreach_addressbook = {
		run: function(elem) {

			if (context.directoryProperty(elem, "URI") == kPersonalAddressbookURI)
			{
				pabByUri      = new Object();
				pabByUri.uri  = context.directoryProperty(elem, "URI");
				pabByUri.name = elem.dirName;
			}

			if (elem.dirName == "Personal Address Book")
			{
				pabByName      = new Object();
				pabByName.uri  = context.directoryProperty(elem, "URI");
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
	var context = this;
	var ret     = "";

	var functor_foreach_addressbook = {
		run: function(elem) {
			ret += "\n " +
			       " dirName: " + elem.dirName +
			       " uri: "       + context.directoryProperty(elem, "URI") +
			       " dirPrefId: " + elem.dirPrefId +
			       " fileName: "  + context.directoryProperty(elem, "fileName") +
			       " position: "  + context.directoryProperty(elem, "position") +
			       " matches kPersonalAddressbookURI: " + (context.directoryProperty(elem, "URI") == kPersonalAddressbookURI);
			
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

AddressBookTb2.prototype.nsIAbMDBCardToKey = function(abCard)
{
	zinAssert(typeof(abCard) == 'object' && abCard != null);
	var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);

	return hyphenate('-', mdbCard.dbTableID, mdbCard.dbRowID, mdbCard.key);
}

AddressBookTb3.prototype.nsIAbMDBCardToKey = function(abCard)
{
	zinAssert(typeof(abCard) == 'object' && abCard != null);

	var attributes = this.getCardAttributes(abCard);
	zinAssert(isPropertyPresent(attributes, TBCARD_ATTRIBUTE_LUID_ITER));

	return attributes[TBCARD_ATTRIBUTE_LUID_ITER];
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

AddressBookImportantProperties.prototype.uri = function()
{
	return this.m_uri;
}

AddressBookImportantProperties.prototype.prefid = function()
{
	return this.m_prefid;
}
