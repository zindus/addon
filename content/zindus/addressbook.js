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
}

                                                                           // source references relative to mozilla/mailnews/addrbook/
ZinAddressBook.kPABDirectory = 2;                                          // == nsIAbDirectoryProperties.dirType ==> mork address book
                                                                           // see src/nsDirPrefs.h and resources/content/addressbook.js
ZinAddressBook.kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab"; // see: resources/content/abCommon.js

ZinAddressBook.getAddressBookUri = function(name)
{
	var ret = null;

	var functor =
	{
		run: function(elem)
		{
			if (elem.dirName == name)
				ret = elem.directoryProperties.URI;
			else
				ret = null;
		
			return ret == null;
		}
	};

	if (name == ZinAddressBook.m_pab_name)
		ret = ZinAddressBook.getPabURI();
	else
		ZinAddressBook.forEachAddressBook(functor);

	return ret;
}

ZinAddressBook.getAddressBookPrefId = function(uri)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	return dir.dirPrefId;
}

ZinAddressBook.forEachAddressBook = function(functor)
{
	var rdf   = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var root  = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var nodes = root.childNodes;
	var fContinue = true;

	while (nodes.hasMoreElements() && fContinue)
	{
		var elem = nodes.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);

		if (elem.directoryProperties.dirType == ZinAddressBook.kPABDirectory)
			fContinue = functor.run(elem);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

ZinAddressBook.forEachCard = function(uri, functor)
{
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
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

// We have to normalise the order in which we iterate through the properties so that two hashes with the same
// keys result in the same crc.  We can't just iterate through the hash with for..in because that doesn't guarantee ordering
// - the keys might not have been added to the hash in the same order.
// We avoid a sort by relying on the fact that the keys are thunderbird contact properties.
// The index into the Converter's table guarantees the ordering.
//
ZinAddressBook.crc32 = function(properties)
{
	var ret = 0;
	var str = "";
	var aSorted = new Array();

	for (var i in properties)
		if (properties[i].length > 0)
		{
			zinAssert(isPropertyPresent(ZinContactConverter.instance().m_map[FORMAT_TB], i));
			aSorted[ZinContactConverter.instance().m_map[FORMAT_TB][i]] = true;
		}

	function callback_concat_str(element, index, array) {
		var key = ZinContactConverter.instance().m_equivalents[index][FORMAT_TB];
		str += key + ":" + properties[key];
	}

	// after this, str == FirstName:FredLastName:BloggsDisplayName:Fred BloggsPrimaryEmail:fred.bloggs@example.com
	//
	aSorted.forEach(callback_concat_str);

	ret = crc32(str);

	// newZinLogger("AddressBook").debug("crc32: given : '" + str + "', returns: " + ret);

	return ret;
}

ZinAddressBook.instanceAbook = function()
{
	return Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
}

ZinAddressBook.newAbDirectoryProperties = function(name)
{
	var abProps = Components.classes["@mozilla.org/addressbook/properties;1"].
	                createInstance(Components.interfaces.nsIAbDirectoryProperties);

	abProps.description = name;
	abProps.dirType     = ZinAddressBook.kPABDirectory;

	return abProps;
}

ZinAddressBook.newAddressBook = function(name)
{
	abProps = ZinAddressBook.newAbDirectoryProperties(name);
	ZinAddressBook.instanceAbook().newAddressBook(abProps);
	return abProps.URI;
}

ZinAddressBook.deleteAddressBook = function(uri)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = rdf.GetDataSource("rdf:addressdirectory");

	var arrayDir  = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var arrayRoot = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);

	arrayDir.AppendElement(dir);
	arrayRoot.AppendElement(root);

	ZinAddressBook.instanceAbook().deleteAddressBooks(ds, arrayRoot, arrayDir);
}

ZinAddressBook.renameAddressBook = function(uri, name)
{
	var rdf  = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir  = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var root = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var ds   = rdf.GetDataSource("rdf:addressdirectory");

	ZinAddressBook.instanceAbook().modifyAddressBook(ds, root, dir, ZinAddressBook.newAbDirectoryProperties(name));
}

ZinAddressBook.deleteCards = function(uri, aCards)
{
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);

	var cardsArray = Components.classes["@mozilla.org/supports-array;1"].createInstance().
	                            QueryInterface(Components.interfaces.nsISupportsArray);

	var logger = newZinLogger("AddressBook"); // TODO - this debugging is for issue#31 - remove once it is closed

	for (var i = 0; i < aCards.length; i++)
	{
		logger.debug("deleteCards: prepare: " + ZinAddressBook.nsIAbCardToPrintableVerbose(aCards[i]));
		cardsArray.AppendElement(aCards[i]);
	}

	logger.debug("deleteCards: about to delete");

	dir.deleteCards(cardsArray);

	logger.debug("deleteCards: done");
}

ZinAddressBook.addCard = function(uri, format, standard, extras)
{
	zinAssert(uri != null && isPropertyPresent(ZinContactConverter.instance().m_map, format) && standard != null && extras != null);

	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abstractCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].
	                      createInstance().QueryInterface(Components.interfaces.nsIAbCard);
	var realCard = dir.addCard(abstractCard);

	ZinAddressBook.updateCard(realCard, uri, format, standard, extras);

	return realCard;
}

ZinAddressBook.updateCard = function(abCard, uri, format, standard, extras)
{
	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	var i, j, key;
	var thunderbird_properties;

	var lastModifiedDatePre = abCard.lastModifiedDate;

	if (format != FORMAT_TB)
		thunderbird_properties =  ZinContactConverter.instance().convert(FORMAT_TB, format, standard);
	else
		thunderbird_properties = standard;
	
	for (i in thunderbird_properties)
	{
		j   = ZinContactConverter.instance().m_map[FORMAT_TB][i];    zinAssert(typeof j != 'undefined');
		key = ZinContactConverter.instance().m_equivalents[j][FORMAT_TB]; zinAssert(key != null);

		abCard.setCardValue(i, thunderbird_properties[i]);

		// logger.debug("AddressBook.addCard() - i == " + i + " and j == " + j);
		// logger.debug("AddressBook.addCard() calls abCard.setCardValue(" + i + ", " + thunderbird_properties[i] + ")");
	}

	for (i in extras)
		mdbCard.setStringAttribute(i, extras[i]);

	mdbCard.editCardToDatabase(uri);

	// confirm that callers can rely on the .lastModifiedDate property changing after an update
	// ie that they don't have to do a lookup after an update
	//
	zinAssert(lastModifiedDatePre != abCard.lastModifiedDate);

	return abCard;
}

ZinAddressBook.getCardProperties = function(abCard)
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

ZinAddressBook.getCardAttributes = function(abCard)
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

ZinAddressBook.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key);
	zinAssert(value);

	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var dir = rdf.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abCard = ZinAddressBook.instanceAbook().getAbDatabaseFromURI(uri).getCardFromAttribute(dir, key, value, false);

	return abCard; // an nsIABCard
}

ZinAddressBook.nsIAbCardToPrintable = function(abCard)
{
	return (abCard.isMailList ? abCard.mailListURI : abCard.getCardValue("PrimaryEmail"));
}

ZinAddressBook.nsIAbCardToPrintableVerbose = function(abCard)
{
	var ret;

	if (abCard.isMailList)
		ret = "maillist uri: " + abCard.mailListURI
	else
	{
		var properties = ZinAddressBook.getCardProperties(abCard);
		var attributes = ZinAddressBook.getCardAttributes(abCard);

		ret = "properties: " + aToString(properties) + " attributes: " + aToString(attributes);
	}

	return ret;
}

ZinAddressBook.nsIAbMDBCardToKey = function(mdbCard)
{
	zinAssert(typeof(mdbCard) == 'object' && mdbCard != null);

	return hyphenate('-', mdbCard.dbTableID, mdbCard.dbRowID, mdbCard.key);
}

ZinAddressBook.getPabURI = function()
{
	if (typeof(ZinAddressBook.m_pab_uri) == "undefined")
		ZinAddressBook.setupPab();

	return ZinAddressBook.m_pab_uri;
}

ZinAddressBook.getPabName = function()
{
	if (typeof(ZinAddressBook.m_pab_name) == "undefined")
		ZinAddressBook.setupPab();

	return ZinAddressBook.m_pab_name;
}

ZinAddressBook.setupPab = function()
{
	var pabByUri  = null;
	var pabByName = null;
	var pabName   = null;
	var ret = null;
	var msg;

	var functor_foreach_addressbook = {
		run: function(elem) {

			if (elem.directoryProperties.URI == ZinAddressBook.kPersonalAddressbookURI)
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

	if (typeof(ZinAddressBook.m_pab_uri) == "undefined")
	{
		ZinAddressBook.forEachAddressBook(functor_foreach_addressbook);

		var logger = newZinLogger("AddressBook");
	
		if (pabByUri)
		{
			ZinAddressBook.m_pab_uri  = String(pabByUri.uri);
			ZinAddressBook.m_pab_name = String(pabByUri.name);
			logger.debug("m_pab_uri selected by uri: uri: " + ZinAddressBook.m_pab_uri + " name: " + ZinAddressBook.m_pab_name);
		}
		else if (pabByName)
		{
			ZinAddressBook.m_pab_uri  = String(pabByName.uri);  // create a primitive string so that typeof() == "string" not "object"
			ZinAddressBook.m_pab_name = String(pabByName.name);
			logger.debug("m_pab_uri selected by name: uri: " + ZinAddressBook.m_pab_uri + " name: " + ZinAddressBook.m_pab_name);
		}
		else
			logger.error("Couldn't find Personal Address Book");
	}
}

ZinAddressBook.isElemPab = function(elem)
{
	return (ZinAddressBook.getPabURI() == elem.directoryProperties.URI);
}
