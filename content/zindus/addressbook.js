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

function ZinAddressBook()
{
	this.m_pab_name = null;
	this.m_pab_uri  = null;

	this.m_nsIRDFService = null;
	this.m_map_name_to_uri = null;

	this.m_logger = newZinLogger("AddressBook");
}

const kPABDirectory           = 2;                                   // == nsIAbDirectoryProperties.dirType ==> mork address book
const kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";    // see: resources/content/abCommon.js

ZinAddressBook.prototype.getAddressBookUri = function(name)
{
	var ret = null;

	var functor =
	{
		context : this,

		run: function(elem)
		{
			var key   = elem.dirName;
			var value = elem.directoryProperties.URI;

			if (key == this.context.getPabName())
				value = this.context.getPabURI();
		
			this.context.m_map_name_to_uri[key] = value;

			return true;
		}
	};

	if (!this.m_map_name_to_uri)
	{
		this.m_map_name_to_uri = new Object();
		this.forEachAddressBook(functor);
	}

	return isPropertyPresent(this.m_map_name_to_uri, name) ? this.m_map_name_to_uri[name] : null;
}

ZinAddressBook.prototype.getAddressBookPrefId = function(uri)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
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

		if (elem.directoryProperties.dirType == kPABDirectory)
			fContinue = functor.run(elem);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

ZinAddressBook.prototype.forEachCard = function(uri, functor)
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

ZinAddressBook.prototype.nsIAddressBook = function()
{
	return Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
}

ZinAddressBook.prototype.nsIRDFService = function()
{
	if (!this.m_nsIRDFService)
		this.m_nsIRDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	return this.m_nsIRDFService;
}

ZinAddressBook.prototype.newAbDirectoryProperties = function(name)
{
	var abProps = Components.classes["@mozilla.org/addressbook/properties;1"].
	                createInstance(Components.interfaces.nsIAbDirectoryProperties);

	abProps.description = name;
	abProps.dirType     = kPABDirectory;

	return abProps;
}

ZinAddressBook.prototype.newAddressBook = function(name)
{
	abProps = this.newAbDirectoryProperties(name);
	this.nsIAddressBook().newAddressBook(abProps);

	this.m_map_name_to_uri = null;

	return abProps.URI;
}

ZinAddressBook.prototype.deleteAddressBook = function(uri)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	var arrayDir  = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var arrayRoot = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);

	arrayDir.AppendElement(dir);
	arrayRoot.AppendElement(root);

	this.m_map_name_to_uri = null;

	this.nsIAddressBook().deleteAddressBooks(ds, arrayRoot, arrayDir);
}

ZinAddressBook.prototype.renameAddressBook = function(uri, name)
{
	var dir  = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = this.nsIRDFService().GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = this.nsIRDFService().GetDataSource("rdf:addressdirectory");

	this.m_map_name_to_uri = null;

	this.nsIAddressBook().modifyAddressBook(ds, root, dir, this.newAbDirectoryProperties(name));
}

ZinAddressBook.prototype.deleteCards = function(uri, aCards)
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

ZinAddressBook.prototype.addCard = function(uri, properties, attributes)
{
	zinAssert(uri != null && properties != null && attributes != null);

	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abstractCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].
	                      createInstance().QueryInterface(Components.interfaces.nsIAbCard);
	var realCard = dir.addCard(abstractCard);

	this.updateCard(realCard, uri, properties, attributes, FORMAT_TB);

	return realCard;
}

ZinAddressBook.prototype.updateCard = function(abCard, uri, properties, attributes, format)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var key;
	var a_field_used = new Object();

	this.m_logger.debug("updateCard: blah: " + " \n properties: " + aToString(properties) +
	                                           "\n card properties: " + aToString(this.getCardProperties(abCard)));

	for (key in properties)
	{
		abCard.setCardValue(key, properties[key]);
		a_field_used[key] = true;
	}

	// now do deletes...
	//
	for (key in ZinContactConverter.instance().m_common_to[FORMAT_TB][format])
		if (!isPropertyPresent(a_field_used, key))
			abCard.setCardValue(key, "");

	for (key in attributes)
		mdbCard.setStringAttribute(key, attributes[key]);

	mdbCard.editCardToDatabase(uri);

	return abCard;
}

ZinAddressBook.prototype.getCardProperties = function(abCard)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var i, j, key, value;
	var ret = new Object();

	for (i in ZinContactConverter.instance().m_map[FORMAT_TB])
	{
		value = abCard.getCardValue(i);

		if (value)
			ret[i] = value;
	}

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

ZinAddressBook.prototype.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key);
	zinAssert(value);

	var dir = this.nsIRDFService().GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abCard = this.nsIAddressBook().getAbDatabaseFromURI(uri).getCardFromAttribute(dir, key, value, false);

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
		run: function(elem) {

			if (elem.directoryProperties.URI == kPersonalAddressbookURI)
			{
				pabByUri      = new Object();
				pabByUri.uri  = elem.directoryProperties.URI;
				pabByUri.name = elem.dirName;
			}

			if (elem.dirName == "Personal Address Book")
			{
				pabByName      = new Object();
				pabByName.uri  = elem.directoryProperties.URI;
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
		this.m_logger.debug("setupPab: addressbooks: " + this.addressbooksToString());
	}
}

ZinAddressBook.prototype.addressbooksToString = function()
{
	var ret = "";

	var functor_foreach_addressbook = {
		run: function(elem) {
			ret += "\n dirName: " + elem.dirName + " uri: "       + elem.directoryProperties.URI +
			                                       " dirPrefId: " + elem.dirPrefId +
												   " fileName: "  + elem.directoryProperties.fileName +
												   " position: "  + elem.directoryProperties.position;
			
			return true;
		}
	};

	this.forEachAddressBook(functor_foreach_addressbook);

	return ret;
}

ZinAddressBook.prototype.isElemPab = function(elem)
{
	return (this.getPabURI() == elem.directoryProperties.URI);
}

ZinAddressBook.prototype.nsIAbCardToPrintable = function(abCard)
{
	return (abCard.isMailList ? abCard.mailListURI : abCard.getCardValue("PrimaryEmail"));
}

ZinAddressBook.prototype.nsIAbCardToPrintableVerbose = function(abCard)
{
	var ret;

	if (abCard.isMailList)
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
