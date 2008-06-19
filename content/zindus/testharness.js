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

function TestHarness()
{
	this.m_logger = newLogger("TestHarness");
	this.m_bugzilla_432145_count = 100;

	this.m_bugzilla_432145_uri = new Array();
	this.m_bugzilla_432145_uri[0] = "moz-abmdbdirectory://abook-3.mab";
	this.m_bugzilla_432145_uri[1] = "moz-abmdbdirectory://abook-12.mab";
	this.m_bugzilla_432145_uri[2] = "moz-abmdbdirectory://abook-20.mab";
	this.m_bugzilla_432145_uri[3] = "moz-abmdbdirectory://abook-21.mab";
	this.m_bugzilla_432145_uri[4] = "moz-abmdbdirectory://abook-22.mab";
}

TestHarness.prototype.run = function()
{
	var ret = true;

	ret = ret && this.testPreferencesHaveDefaults();
	// ret = ret && this.testCrc32();
	// ret = ret && this.testLogging();
	// ret = ret && this.testFilesystem();
	// ret = ret && this.testPropertyDelete();
	// ret = ret && this.testLso();
	ret = ret && this.testContactConverter();
	// ret = ret && this.testAddressBook1();
	// ret = ret && this.testAddressBook2();
	// ret = ret && this.testAddressBookBugzilla432145Create();
	// ret = ret && this.testAddressBookBugzilla432145Compare();
	// ret = ret && this.testAddressBookBugzilla432145Delete();
	// ret = ret && this.testFeedCollection();
	// ret = ret && this.testPermFromZfi();
	// ret = ret && this.testFolderConverter();
	// ret = ret && this.testFolderConverterPrefixClass();
	// ret = ret && this.testXmlHttpRequest();
	// ret = ret && this.testZuio();
	// ret = ret && this.testGoogleContacts1();
	// ret = ret && this.testGoogleContacts2();
	// ret = ret && this.testGoogleContacts3();
	ret = ret && this.testGdAddressConverter();
	ret = ret && this.testGdContact();
	ret = ret && this.testAbCreate2();

	this.m_logger.debug("test(s) " + (ret ? "succeeded" : "failed"));
}

TestHarness.prototype.testCrc32 = function()
{
	var left  = newObject("FirstName", "01-first-3", "LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com");
	var right = newObject("LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com" , "FirstName", "01-first-3");

	var contact_converter = this.newContactConverter();
	var crcLeft  = contact_converter.crc32(left)
	var crcRight = contact_converter.crc32(right)

	zinAssert(crcLeft == crcLeft);
}

TestHarness.prototype.newContactConverter = function(arg)
{
	var ret;

	ret = new ContactConverter();

	if (arguments.length == 0)
		ret.setup();
	else
		ret.setup(arg);

	return ret;
}

TestHarness.prototype.testFeedCollection = function()
{
	var zfc = new FeedCollection();
	var zfi;

	zfi = new FeedItem();
	zfi.set(FeedItem.ATTR_KEY, 0);
	zfi.set('name1', "value1");

	zfc.set(zfi);

	var zfi = zfc.get(0);
	zfi.set('fred', 1);

	zfi = new FeedItem();
	zfi.set(FeedItem.ATTR_KEY, 1);
	zfi.set('name2', "value2");
	zfi.set('name3', "value3");

	zfc.set(zfi);

	this.m_logger.debug("3233: zfc.toString() == \n" + zfc.toString());

	zfc.del(1);

	this.m_logger.debug("3233: zfc.toString() after del(1) == \n" + zfc.toString());

	zfi = new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_STATUSPANEL , 'appversion', 1234 );

	return true;
}

TestHarness.prototype.testContactConverter = function()
{
	var ret = true;
	ret = ret && this.testContactConverter1();
	ret = ret && this.testContactConverterGdPostalAddress();
	return ret;
}

TestHarness.prototype.testContactConverterGdPostalAddress = function()
{
	var xmlInput, contact_converter, a_gd_contact, contact, properties;

	this.setupFixtureGdPostalAddress();

	var xml_as_char = this.m_address_as_xml;

	contact_converter = this.newContactConverter();
	zinAssert(!contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "false", address shouldn't be converted to Thunderbird fields
	//
	contact    = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", "line 1\n\n\nline 4" ));
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	zinAssert(!isPropertyPresent(properties, "HomeAddress"));

	contact    = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", xml_as_char ));
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	zinAssert(!isPropertyPresent(properties, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", address should convert to/from Thunderbird fields
	// but the <otheraddr> element from Google doesn't become a Thunderbird property
	//
	contact_converter = this.newContactConverter(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);
	zinAssert(contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", this.m_address_as_xml_entity ));

	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);

	// this.m_logger.debug("properties: " + aToString(properties));

	zinAssert(isPropertyPresent(properties, "HomeAddress")  && properties["HomeAddress"]  == this.m_street1);
	zinAssert(isPropertyPresent(properties, "HomeAddress2") && properties["HomeAddress2"] == this.m_street2);
	zinAssert(!isPropertyPresent(properties, "otheraddr"));

	var gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, properties);
	xml_as_char = gd_properties["postalAddress#home"];

	var gd_address = new XML(xml_as_char);
	var ns = Namespace(Xpath.NS_ZINDUS_ADDRESS);

	zinAssert(gd_address.ns::street.length() == 2 && zinTrim(String(gd_address.ns::street[0])) == this.m_street1
	                                              && zinTrim(String(gd_address.ns::street[1])) == this.m_street2);;

	return true;
}

TestHarness.prototype.testContactConverter1 = function()
{
	var i, format, properties;
	var a_data = new Array();
	var contact_converter = this.newContactConverter();

	a_data.push(newObject(FORMAT_TB, 'PrimaryEmail', FORMAT_ZM, 'email',      FORMAT_GD, 'PrimaryEmail', 'value', 'john@example.com'));
	a_data.push(newObject(FORMAT_TB, 'FirstName',    FORMAT_ZM, 'firstName',  FORMAT_GD,  null         , 'value', 'john'            ));
	a_data.push(newObject(FORMAT_TB, 'HomeAddress',  FORMAT_ZM, 'homeStreet', FORMAT_GD,  null         , 'value', '123 blah st'     ));

	var a_properties = new Object();

	for (i = 0; i < A_VALID_FORMATS.length; i++)
		a_properties[A_VALID_FORMATS[i]] = new Object();
	
	for (i = 0; i < a_data.length; i++)
		for (format in a_data[i])
			if (isInArray(Number(format), A_VALID_FORMATS))
				if (a_data[i][format] != null)
					a_properties[format][a_data[i][format]] = a_data[i]['value'];

	// this.m_logger.debug("testContactConverter: a_properties: " + aToString(a_properties));

	// test conversion of ...
	zinAssert(contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, 'HomeAddress') == false);

	// test converting FORMAT_TB to all formats
	//
	zinAssert(isMatchObjects(a_properties[FORMAT_TB], contact_converter.convert(FORMAT_TB, FORMAT_TB, a_properties[FORMAT_TB])));
	zinAssert(isMatchObjects(a_properties[FORMAT_ZM], contact_converter.convert(FORMAT_ZM, FORMAT_TB, a_properties[FORMAT_TB])));
	zinAssert(isMatchObjects(a_properties[FORMAT_GD], contact_converter.convert(FORMAT_GD, FORMAT_TB, a_properties[FORMAT_TB])));

	// test that crc's match
	//
	var a_crc = new Object();
	for (i = 0; i < A_VALID_FORMATS.length; i++)
	{
		format = A_VALID_FORMATS[i];

		properties = cloneObject(a_properties[format]);
		contact_converter.removeKeysNotCommonToAllFormats(format, properties);

		// this.m_logger.debug("testContactConverter: format: " + format + " common properties: " + aToString(properties));

		properties = contact_converter.convert(FORMAT_TB, format, properties);

		// this.m_logger.debug("testContactConverter: format: " + format + " normalised properties: " + aToString(properties));

		a_crc[format] = contact_converter.crc32(properties);
	}
	
	// this.m_logger.debug("testContactConverter: a_crc: " + aToString(a_crc));

	for (i = 1; i < A_VALID_FORMATS.length; i++)
		zinAssert(a_crc[A_VALID_FORMATS[0]] == a_crc[A_VALID_FORMATS[i]]);

	var element = new Object();

	element['email']     = "xxx@example.com";
	element['firstName'] = "xxx";

	var properties = contact_converter.convert(FORMAT_TB, FORMAT_ZM, element);

	// this.m_logger.debug("testContactConverter: converts:\nzimbra: " + aToString(element) + "\nto thunderbird: " + aToString(properties));

	// test the contact_converter.keysCommonToThatMatch()
	//
	contact_converter = this.newContactConverter(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);

	var a_postalAddress = contact_converter.keysCommonToThatMatch(/^postalAddress#(.*)$/, "$1", FORMAT_GD, FORMAT_TB);
	zinAssert(isPropertyPresent(a_postalAddress, "home") && isPropertyPresent(a_postalAddress, "work"));

	return true;
}

TestHarness.prototype.gdContactFromXmlString = function(contact_converter, str)
{
	var domparser = new DOMParser();
	var doc = domparser.parseFromString(str, "text/xml");
	// this.m_logger.debug("gdContactFromXmlString: entry: " + xmlDocumentToString(doc));
	a_gd_contact = GdContact.arrayFromXpath(contact_converter, doc, "/atom:entry");

	zinAssertAndLog(aToLength(a_gd_contact) == 1, "length: " + aToLength(a_gd_contact));

	var contact = a_gd_contact[firstKeyInObject(a_gd_contact)];
	// this.m_logger.debug("gdContactFromXmlString: contact: " + contact.toString());

	return contact;
}

TestHarness.prototype.testContactConverterPropertyMatch = function(obj1, obj2)
{
	zinAssert(isMatchObjectKeys(obj1, obj2));

	for (var i in obj1)
		zinAssert(obj1[i] == obj2[i]);
}

TestHarness.prototype.testFolderConverterPrefixClass = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new FolderConverter();

	zinAssert(converter.prefixClass(converter.m_prefix_primary_account)   == FolderConverter.PREFIX_CLASS_PRIMARY);
	zinAssert(converter.prefixClass(converter.m_prefix_foreign_readonly)  == FolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(converter.m_prefix_foreign_readwrite) == FolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(converter.m_prefix_internal)          == FolderConverter.PREFIX_CLASS_INTERNAL);
	zinAssert(converter.prefixClass("fred")                               == FolderConverter.PREFIX_CLASS_NONE);

	return true;
}

TestHarness.prototype.testFolderConverter = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new FolderConverter();

	this.testFolderConverterSuiteOne(converter, "convertForMap");

	var addressbook = new AddressBook();
	var pabname = addressbook.getPabName();
	converter.localised_pab(pabname);

	this.testFolderConverterSuiteOne(converter, "convertForPublic");

	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == pabname);
	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == pabname);

	var localised_emailed_contacts;

	// test without localisation
	//
	localised_emailed_contacts = ZM_FOLDER_EMAILED_CONTACTS;

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	// test localisation by language
	//
	converter.localised_emailed_contacts(converter.translate_emailed_contacts("fr"));
	localised_emailed_contacts = "Personnes contact\u00e9es par mail";

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	// test localisation by language and location
	//
	converter.localised_emailed_contacts(converter.translate_emailed_contacts("fr_FR"));

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	this.m_logger.debug("testFolderConverter: finish");

	return true;
}

TestHarness.prototype.testFolderConverterSuiteOne = function(converter, method)
{
	// test convertForMap
	//
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(""))                 == converter.m_prefix_primary_account);

	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName("fred"))             == "fred");
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName("x"))                == converter.m_prefix_primary_account + "x");
	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName("zindus/fred"))      == "fred");
	zinAssert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName("zindus/fred"))      == "zindus/fred");

	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == ZM_FOLDER_CONTACTS);
	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == ZM_FOLDER_CONTACTS);

	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == ZM_FOLDER_EMAILED_CONTACTS);
	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == ZM_FOLDER_EMAILED_CONTACTS);

	if (method != "convertForPublic") // these are tested separately
	{
		zinAssert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == TB_PAB);
		zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == TB_PAB);

		zinAssert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == TB_EMAILED_CONTACTS);
		zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == TB_EMAILED_CONTACTS);
	}

	return true;
}

TestHarness.prototype.testFolderConverterSuiteTwo = function(converter, localised_emailed_contacts)
{
	var prefix = converter.m_prefix_primary_account;

	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == prefix + localised_emailed_contacts);
	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == prefix + localised_emailed_contacts);
}

TestHarness.prototype.testPropertyDelete = function()
{
	var x = new Object();

	x[1] = 1;
	x[2] = 2;
	x[3] = 3;
	x[4] = 4;
	x[5] = 5;

	this.m_logger.debug("3233: x: " + aToString(x));

	for (i in x)
	{
		this.m_logger.debug("3233: i: " + i);

		if (i == 3)
			delete x[i];
	}

	this.m_logger.debug("3233: x: " + aToString(x));
}

TestHarness.prototype.testLso = function()
{
	var zfi, lso, str;
	// test constructor style #1
	//
	var d = new Date();
	var s = Date.UTC();
	var t = hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	        " " +
			hyphenate(":", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

	zfi = new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, 334, FeedItem.ATTR_MS, 1234, FeedItem.ATTR_REV, 1235);
	lso = new Lso(zfi);
	str = "##1234#1235#"

	// test a zimbra zfi against an lso generated from a zfi
	//
	this.testLsoToString(lso, str);
	this.testLsoCompareZm(lso, zfi);

	// test a zimbra zfi against an lso generated from a string
	//
	lso = new Lso(str);
	this.testLsoToString(lso, str);
	this.testLsoCompareZm(lso, zfi);

	// test a thunderbird zfi against an lso generated from a zfi
	//
	zfi = new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, 334, FeedItem.ATTR_CS, 1749681802);
	lso = new Lso(zfi);
	str = "#1749681802###";
	this.testLsoToString(lso, str);
	this.testLsoCompareTb(lso, zfi);

	this.testLsoCaseOne();
	this.testLsoCaseTwo();

	return true;
}

TestHarness.prototype.testLsoCaseOne = function(lso, str)
{
	// test this outcome which seemed odd :
	// buildGcs: compare:  sourceid: 2 zfi: type=cn key=92114 id=92114 l=85098 ms=100170 rev=100170 ls=1##94649#94649#  gid: 523 gid's ver: 1 lso : 1##94649#94649# lso.compare == -1
	// Turned out to be a bug - compare() was using string comparisons, so it failed when comparing a 3-digit with a four-digit ms or rev

	var lso = new Lso("1##94649#94649#");
	var zfi = new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, "92114",
	                                               FeedItem.ATTR_ID, "92114",
	                                               FeedItem.ATTR_L, "85098",
	                                               FeedItem.ATTR_MS, "100170",
	                                               FeedItem.ATTR_REV, "100170",
	                                               FeedItem.ATTR_LS, "1##94649#94649#" );
	var ret = lso.compare(zfi);

	zinAssert(ret == 1);
}

TestHarness.prototype.testLsoCaseTwo = function()
{
	// test pulling the rev out of ATTR_LS and backdating it
	// this happens when we want to force an update of a google contact (because XML postalAddress conversion has just been turned on)
	//
	var zfi = new FeedItem(FeedItem.TYPE_CN, FeedItem.ATTR_KEY, "92114",
	                                               FeedItem.ATTR_ID, "92114",
	                                               FeedItem.ATTR_L, "85098",
	                                               FeedItem.ATTR_REV, "2008-05-05T00:51:12.105Z",
	                                               FeedItem.ATTR_LS, "1###2008-05-05T00:51:12.105Z#" );

	var lso = new Lso(zfi.get(FeedItem.ATTR_LS));
	zinAssert(lso.compare(zfi) == 0);

	var rev = lso.get(FeedItem.ATTR_REV);
	var new_rev = "1" + rev.substr(1);
	zfi.set(FeedItem.ATTR_REV, new_rev);

	zinAssert(lso.compare(zfi) == -1);
}

TestHarness.prototype.testLsoToString = function(lso, str)
{
	zinAssert(lso.toString() == str);
}

TestHarness.prototype.testLsoCompareZm = function(lso, zfiOrig)
{
	var zfi;

	zfi = cloneObject(zfiOrig)
	zinAssert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_MS, 1235);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_REV, 1236);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_DEL, 1);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_MS, 1233);
	zfi.set(FeedItem.ATTR_REV, 1235);
	zinAssert(lso.compare(zfi) == -1);  // test compare() == -1;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_MS, 1234);
	zfi.set(FeedItem.ATTR_REV, 1232);
	zinAssert(lso.compare(zfi) == -1);  // test compare() == -1;
}

TestHarness.prototype.testLsoCompareTb = function(lso, zfiOrig)
{
	var zfi;

	zfi = cloneObject(zfiOrig)
	zinAssert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_DEL, 1);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = cloneObject(zfiOrig)
	zfi.set(FeedItem.ATTR_CS, 1111111111111);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;
}

TestHarness.prototype.testLogging = function()
{
	// var logger = new Log(Log.DEBUG, Log.dumpAndFileLogger, "TestHarness.testLogging");
	var logger = newLogger("testLogging");

	logger.debug("hello, this is a debug");
	logger.info("hello, this is a info");
	logger.warn("hello, this is a warn");
	logger.error("hello, this is a error");
	logger.fatal("hello, this is a fatal");
}

TestHarness.prototype.testXmlHttpRequest = function()
{
	var soapURL = "http://george.ho.moniker.net/service/soap/";
	var zsd = new ZmSoapDocument();

	zsd.context(null, null);
	zsd.Auth("leni@george.ho.moniker.net", "qwe123qwe123", null);

	var xhrCallback = function()
	{
		if (xhr.readyState==4) {
			alert(xhr.status);
			alert(xhr.responseText);
		}
	};

	var xhr = new XMLHttpRequest();
	xhr.open("POST", soapURL, true);
	xhr.onreadystatechange=xhrCallback;
	xhr.send(zsd.doc);
}

TestHarness.prototype.testPermFromZfi = function()
{
	var ret = true;
	var zfi = new FeedItem(FeedItem.TYPE_RL, FeedItem.ATTR_KEY, 334, FeedItem.ATTR_PERM, "rwidxc");

	ret = ret && zmPermFromZfi(zfi) == ZM_PERM_READ | ZM_PERM_WRITE;

	zfi.set(FeedItem.ATTR_PERM, "r");

	ret = ret && zmPermFromZfi(zfi) == ZM_PERM_READ;

	zfi.set(FeedItem.ATTR_PERM, "");

	ret = ret && zmPermFromZfi(zfi) == ZM_PERM_NONE;

	return ret;
}

TestHarness.prototype.testZuio = function()
{
	var ret = true;
	var key, zuio;

	key = "123";
	zuio = new Zuio(key);

	ret = ret && zuio.id == 123;
	ret = ret && zuio.zid == null;
	ret = ret && !zuio.zid;

	return ret;
}

TestHarness.prototype.testAddressBook1 = function()
{
	var addressbook;

	if (AddressBook.version() == AddressBook.TB2)
		addressbook = new AddressBookTb2();
	else
		addressbook = new AddressBookTb3();

	// this.m_logger.debug("testAddressBook: addressbooks: " + addressbook.addressbooksToString());

	var uri = "moz-abmdbdirectory://abook.mab";
	var prefix = "zindus-test-";
	var properties = { "FirstName": null, "LastName": null, "DisplayName": null, "SecondEmail": null };
	var luid = "12346684";

	for (var i in properties)
		properties[i] = prefix + i;

	var attributes = newObject(TBCARD_ATTRIBUTE_LUID, luid);

	zinAssert(!addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid)); // test card shouldn't exist before the test starts

	var abCardIn = addressbook.addCard(uri, properties, attributes);

	var abCardOut = addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

	this.m_logger.debug("abCardIn: "  + addressbook.nsIAbCardToPrintableVerbose(abCardIn));
	this.m_logger.debug("abCardOut: " + addressbook.nsIAbCardToPrintableVerbose(abCardOut));

	zinAssert(isMatchObjects(properties, addressbook.getCardProperties(abCardIn)));
	zinAssert(isMatchObjects(properties, addressbook.getCardProperties(abCardOut)));
	zinAssert(isMatchObjects(attributes, addressbook.getCardAttributes(abCardIn)));
	zinAssert(isMatchObjects(attributes, addressbook.getCardAttributes(abCardOut)));

	addressbook.deleteCards(uri, [ abCardIn ]);

	zinAssert(!addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid)); // test card shouldn't exist after the test is finished

	return true;
}

TestHarness.prototype.testAddressBook2 = function()
{
	zinAssert(AddressBook.version() == AddressBook.TB3);

	var uri = "moz-abmdbdirectory://abook.mab";
	var properties = { "DisplayName": "BlahDisplayName",
					   "PrimaryEmail": "BlahPrimarEmail@example.com" };

	var dir    = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager).getDirectory(uri);
	var abCard = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(Ci.nsIAbCard);

	for (key in properties)
		abCard.setCardValue(key, properties[key]);

	abCard = dir.addCard(abCard);
	abCard = dir.modifyCard(abCard);

	var addressbook = new AddressBookTb3();
	this.m_logger.debug("abCard created: "  + addressbook.nsIAbCardToPrintableVerbose(abCard));
}

TestHarness.prototype.testAddressBookBugzilla432145Uri = function(count)
{
	var index = parseInt( (count * this.m_bugzilla_432145_uri.length) / this.m_bugzilla_432145_count );

	zinAssertAndLog(isPropertyPresent(this.m_bugzilla_432145_uri, index), "index: " + index);

	return this.m_bugzilla_432145_uri[index];
}

TestHarness.prototype.testAddressBookBugzilla432145Create = function()
{
	var addressbook = this.testAddressBookBugzilla432145Addressbook();

	// this.m_logger.debug("testAddressBook: addressbooks: " + addressbook.addressbooksToString());

	var properties = new Object();
	var attributes = new Object();
	var luid = "1";
	var count, abCardIn, abCardOut;

	for (count = 0; count < this.m_bugzilla_432145_count; count++)
	{
		this.testAddressBookBugzilla432145Populate(properties, attributes, luid);

		abCardIn = addressbook.addCard(this.testAddressBookBugzilla432145Uri(count), properties, attributes);

		luid++;
	}

	return true;
}

TestHarness.prototype.testAddressBookBugzilla432145Delete = function()
{
	var addressbook = this.testAddressBookBugzilla432145Addressbook();

	var luid = "1";
	var attributes, count, abCard;
	var a_cards_to_delete = new Array();

	for (count = 0; count < this.m_bugzilla_432145_count; count++)
	{
		abCard = addressbook.lookupCard(this.testAddressBookBugzilla432145Uri(count), TBCARD_ATTRIBUTE_LUID, luid);

		addressbook.deleteCards(this.testAddressBookBugzilla432145Uri(count), [ abCard ] );

		luid++;
	}

	return true;
}

TestHarness.prototype.testAddressBookBugzilla432145Compare = function()
{
	var addressbook = this.testAddressBookBugzilla432145Addressbook();

	var luid = "1";
	var attributes, count, abCard;
	var a_cards_to_delete = new Array();
	var properties = new Object();
	var attributes = new Object();

	for (count = 0; count < this.m_bugzilla_432145_count; count++)
	{
		this.testAddressBookBugzilla432145Populate(properties, attributes, luid);

		abCard = addressbook.lookupCard(this.testAddressBookBugzilla432145Uri(count), TBCARD_ATTRIBUTE_LUID, luid);

		zinAssertAndLog(isMatchObjects(properties, addressbook.getCardProperties(abCard)), count);
		zinAssertAndLog(isMatchObjects(attributes, addressbook.getCardAttributes(abCard)), count);

		luid++;
	}

	return true;
}

TestHarness.prototype.testAddressBookBugzilla432145Populate = function(properties, attributes, luid)
{
	var prefix = "zindus-test-";

	properties["FirstName"]   = null;
	properties["LastName"]    = null;
	properties["DisplayName"] = null;
	properties["SecondEmail"] = null;

	for (var i in properties)
		properties[i] = prefix + i + "-" + luid;

	attributes[TBCARD_ATTRIBUTE_LUID] = luid;
}

TestHarness.prototype.testAddressBookBugzilla432145Addressbook = function()
{
	var ret;

	if (AddressBook.version() == AddressBook.TB2)
		ret = new AddressBookTb2();
	else
		ret = new AddressBookTb3();

	return ret;
}

TestHarness.prototype.testGoogleContacts1 = function()
{
	var key, meta, properties, xmlString;

	properties = this.sampleGoogleContactProperties();

	meta = newObject("id", "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
	                  "updated", "2008-03-29T20:36:25.343Z",
					  "edit", "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0/12068229blah"
					  );


	xmlString = "<?xml version='1.0' encoding='UTF-8'?> <feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>username-goes-here@gmail.com</id><updated>2008-03-30T00:33:50.384Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>cvek username-goes-here's Contacts</title><link rel='alternate' type='text/html' href='http://www.google.com/'/><link rel='http://schemas.google.com/g/2005#feed' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base'/><link rel='http://schemas.google.com/g/2005#post' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base'/><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base?max-results=25&amp;showdeleted=true'/><author><name>cvek username-goes-here</name><email>username-goes-here@gmail.com</email></author><generator version='1.0' uri='http://www.google.com/m8/feeds'>Contacts</generator><openSearch:totalResults>6</openSearch:totalResults><openSearch:startIndex>1</openSearch:startIndex><openSearch:itemsPerPage>25</openSearch:itemsPerPage> \
	<entry> \
	<id>@@id@@</id> \
	<updated>@@updated@@</updated> \
	<category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/> \
	<title type='text'>@@title@@</title> \
	<content type='text'>@@content@@</content> \
	<link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0'/> \
	<link rel='edit' type='application/atom+xml' href='@@edit@@'/>\
	<gd:organization rel='http://schemas.google.com/g/2005#work'>\
		<gd:orgName>@@organization#orgName@@</gd:orgName>\
		<gd:orgTitle>@@organization#orgTitle@@</gd:orgTitle>\
	</gd:organization>\
	<gd:email rel='http://schemas.google.com/g/2005#other' address='@@PrimaryEmail@@' primary='true'/>\
	<gd:email rel='http://schemas.google.com/g/2005#home' address='@@SecondEmail@@'/>\
	<gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.2@example.com'/>\
	<gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.other@example.com'/>\
	<gd:email rel='http://schemas.google.com/g/2005#work' address='john.smith.work@example.com'/>\
	<gd:im address='@@im#AIM@@' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home_fax'>4-home-fax</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#pager'>@@phoneNumber#pager@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>@@phoneNumber#home@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>3-home</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>@@phoneNumber#mobile@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#work_fax'>@@phoneNumber#work_fax@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#work'>@@phoneNumber#work@@</gd:phoneNumber>\
	<gd:postalAddress rel='http://schemas.google.com/g/2005#home'>home-address-line-1 home address line 2</gd:postalAddress>\
	</entry></feed>";

	for (key in properties)
		xmlString = xmlString.replace("@@" + key + "@@", properties[key]);

	for (key in meta)
		xmlString = xmlString.replace("@@" + key + "@@", meta[key]);

	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");

	var xpath_query = "/atom:feed/atom:entry";
	var contact_converter = this.newContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, xpath_query);

	// 1. test that a contact can get parsed out of xml 
	// this.m_logger.debug("testGoogleContacts1: 1. id: " + id + " contact: " + contact.toString());
	zinAssertAndLog(aToLength(a_gd_contact) == 1, "length: " + aToLength(a_gd_contact));

	var id = firstKeyInObject(a_gd_contact);
	var contact = a_gd_contact[id];

	// 2. test that everything was parsed out of the xml correctly
	//
	this.matchGoogleContact(contact, properties, meta);

	// 3. test that updating with all properties works
	//
	contact.updateFromProperties(properties);

	this.matchGoogleContact(contact, properties, meta);

	// 3. test that updating with no properties works
	//
	delete properties["content"];
	delete properties["organization#orgName"];
	delete properties["organization#orgTitle"];
	delete properties["phoneNumber#work"];
	delete properties["phoneNumber#home"];
	delete properties["phoneNumber#work_fax"];
	delete properties["phoneNumber#pager"];
	delete properties["phoneNumber#mobile"];
	delete properties["PrimaryEmail"]; // properties["PrimaryEmail"] = "";
	delete properties["SecondEmail"];
	delete properties["im#AIM"];

	contact.updateFromProperties(properties);

	properties["SecondEmail"]      = "john.smith.home.2@example.com"; // take the next in line...
	properties["phoneNumber#home"] = "3-home";
	properties["im#AIM"]           = "aim-im-2";

	this.matchGoogleContact(contact, properties, meta);

	// 4. test adding all properties to a new contact
	//
	properties = this.sampleGoogleContactProperties();
	contact = new GdContact();
	contact.updateFromProperties(properties);
	this.matchGoogleContact(contact, properties, {});

	// 5. test creating a contact without a title
	//
	properties = newObject("content", "1-content", "organization#orgName", "2-organization#orgName");
	contact.updateFromProperties(properties);
	this.matchGoogleContact(contact, properties, {});

	// 5. test creating a contact with an empty title
	//
	properties = newObject("title", "", "content", "1-content", "organization#orgName", "2-organization#orgName");
	contact.updateFromProperties(properties);
	delete properties["title"];
	this.matchGoogleContact(contact, properties, {});

	return true;
}

TestHarness.prototype.testGoogleContacts2 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/username%40@gmail.com/base/7ae485588d2b6b50</id><updated>2008-04-26T01:58:35.904Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>77</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50/1209175115904000'/><gd:email rel='http://schemas.google.com/g/2005#other' address='77@example.com' primary='true'/></entry>"
	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");
	this.m_logger.debug("testGoogleContacts2: number of contacts parsed: " + aToLength(a_gd_contact));
	this.m_logger.debug("testGoogleContacts2: contact: " + a_gd_contact[firstKeyInObject(a_gd_contact)].toString());
}

TestHarness.prototype.sampleGoogleContactProperties = function()
{
	var properties = new Object();

	properties["title"] = "1";
	properties["content"] = "2";
	properties["organization#orgName"] = "3";
	properties["organization#orgTitle"] = "4";
	properties["phoneNumber#work"] = "5";
	properties["phoneNumber#home"] = "6";
	properties["phoneNumber#work_fax"] = "7";
	properties["phoneNumber#pager"] = "8";
	properties["phoneNumber#mobile"] = "9";
	properties["PrimaryEmail"] = "10";
	properties["SecondEmail"] = "11";
	properties["im#AIM"] = "12";

	return properties;
}

TestHarness.prototype.matchGoogleContact = function(contact, properties, meta)
{
	var key;
	zinAssert(contact && contact.m_properties);

	// this.m_logger.debug("matchGoogleContact: blah: \n properties: " + aToString(properties) + " \nmeta: " + aToString(meta) + " \ncontact: " + contact.toString());

	for (key in properties)
		zinAssertAndLog(contact.m_properties[key] == properties[key], "key: " + key);

	for (key in meta)
		zinAssertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	if (contact.m_properties)
		for (key in contact.m_properties)
			zinAssertAndLog(contact.m_properties[key] == properties[key], "key: " + key);

	if (contact.m_meta)
		for (key in contact.m_meta)
			zinAssertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	
}

TestHarness.prototype.testGoogleContacts3 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96</id><updated>2008-05-05T21:13:38.158Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>rr rr</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96/1210022018158000'/><gd:email rel='http://schemas.google.com/g/2005#home' address='rr.rr.rr.rr@example.com' primary='true'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>111111</gd:phoneNumber></entry>";
	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");
	this.m_logger.debug("testGoogleContacts2: number of contacts parsed: " + aToLength(a_gd_contact));
	this.m_logger.debug("testGoogleContacts2: contact: " + a_gd_contact[firstKeyInObject(a_gd_contact)].toString());
}

TestHarness.prototype.testGdAddressConverter = function()
{
	var xml_as_entity;
	var xml_as_char;
	var gac = new GdAddressConverter();

	// test convert with ADDR_TO_XML
	//
	var out = new Object();
	var a_fields = { "Address" : "Apartment 2", "Address2" : "123 Collins st", "City" : "Melbourne",
	                 "State" : "Vic", "ZipCode" : "3121", "Country" : "Australia" };

	gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_XML );

	xml_as_char   = out['x'];
	xml_as_entity = convertCER(xml_as_char, CER_TO_ENTITY);
	xml_as_char2  = convertCER(xml_as_entity, CER_TO_CHAR);

	// this.m_logger.debug("testGdAddressConverter: xml_as_char: " + xml_as_char);
	// this.m_logger.debug("testGdAddressConverter: xml_as_char2: " + xml_as_char2);
	// this.m_logger.debug("testGdAddressConverter: xml_as_entity: " + xml_as_entity);

	zinAssert(xml_as_char == xml_as_char2);

	// Test convert with ADDR_TO_PROPERTIES
	//
	// Test that all fields convert
	//
	var a_fields_orig = a_fields;
	a_fields = { };

	gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);

	// this.m_logger.debug("testGdAddressConverter: a_fields: " + aToString(a_fields));

	zinAssertAndLog(isMatchObjectKeys(a_fields, a_fields_orig), "a_fields keys: " + keysToString(a_fields) + " orig keys: " + keysToString(a_fields_orig));

	for (var key in a_fields)
		zinAssertAndLog(zinTrim(a_fields[key]) == zinTrim(a_fields_orig[key]), "mismatch for key: " + key);

	// Test that given non-xml, gac.convert() returns false
	//
	out['x'] = "some text";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	zinAssert(!retval && aToLength(a_fields) == 0);

	// Test that given empty <address>, gac.convert() returns true and a_fields is empty
	//
	out['x'] = "<address xmlns='" + Xpath.NS_ZINDUS_ADDRESS + "'/>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	zinAssertAndLog(retval && aToLength(a_fields) == 0, "retval: " + retval + " a_fields: " + aToString(a_fields));

	// Test that given empty <address>, gac.convert() returns true and a_fields is empty
	//
	out['x'] = "<address xmlns='" + Xpath.NS_ZINDUS_ADDRESS + "'> " + " <otheraddr> </otheraddr> </address>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	zinAssertAndLog(retval && aToLength(a_fields) == 0, "retval: " + retval + " a_fields: " + aToString(a_fields));

	// Test that given empty <somexml>, gac.convert() returns false and a_fields is empty
	//
	out['x'] = "<somexml> <otheraddr> </otheraddr> </somexml>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	zinAssert(!retval && aToLength(a_fields) == 0);

	return true;
}

TestHarness.prototype.setupFixtureGdPostalAddress = function()
{
	this.m_entry_as_xml_char = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/username%40@gmail.com/base/7ae485588d2b6b50</id><updated>2008-04-26T01:58:35.904Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>77</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50/1209175115904000'/> \
		<gd:email rel='http://schemas.google.com/g/2005#other' address='77@example.com' primary='true'/>\
		<gd:postalAddress rel='http://schemas.google.com/g/2005#home'>@@postal@@</gd:postalAddress>\
		</entry>"

	this.m_street1 = "Apartment 2";
	this.m_street2 = "123 Collins st";
	this.m_otheraddr = "original plain text address goes here";

	this.m_address_as_e4x = <address> <street> {this.m_street1} </street>
	<street> {this.m_street2} </street> <city> Melbourne </city> <state> Vic </state> <postcode> 3000 </postcode>
	<country> Australia </country> <otheraddr> {this.m_otheraddr} </otheraddr> </address>;
	this.m_address_as_e4x.setNamespace(Xpath.NS_ZINDUS_ADDRESS);

	this.m_gac = new GdAddressConverter();
	this.m_address_as_xml        = this.m_address_as_e4x.toXMLString();
	this.m_address_as_xml_entity = convertCER(this.m_address_as_xml, CER_TO_ENTITY);

	// this.m_logger.debug("blahzz: m_address_as_xml: " + this.m_address_as_xml );
}

TestHarness.prototype.testGdContact = function()
{
	var contact, tb_properties, gd_properties;
	var HomeAddress2      = "456 Collins st";
	var contact_converter = this.newContactConverter(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);

	this.setupFixtureGdPostalAddress();

	// test isAnyPostalAddressInXml()
	//
	var properties = this.sampleGoogleContactProperties();
	contact = new GdContact(contact_converter);
	contact.updateFromProperties(properties);
	zinAssert(!contact.isAnyPostalAddressInXml());

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should preverse <otheraddr>
	//
	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@",
	                                       convertCER(this.m_address_as_xml, CER_TO_ENTITY)));

	zinAssert(contact.isAnyPostalAddressInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);

	tb_properties["HomeAddress2"] = HomeAddress2;

	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);

	contact.updateFromProperties(gd_properties);
	// this.m_logger.debug("contact after update: " + contact.toString());
	zinAssert(contact.postalAddressOtherAddr("postalAddress#home") == this.m_otheraddr);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	zinAssert(tb_properties["HomeAddress2"] == HomeAddress2);

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should xmlify the Google contact
	// 
	this.setupFixtureGdPostalAddress();

	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", this.m_otheraddr));
	zinAssert(!contact.isAnyPostalAddressInXml());
	zinAssert(contact.isAnyPostalAddressNotInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	tb_properties["HomeAddress2"] = HomeAddress2;
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact.updateFromProperties(gd_properties);
	zinAssert(contact.postalAddressOtherAddr("postalAddress#home") == this.m_otheraddr);

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact (no address field) should xmlify the plain-text
	// into the <otheraddr> element
	// 
	this.setupFixtureGdPostalAddress();

	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", this.m_otheraddr));

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact.updateFromProperties(gd_properties);
	// this.m_logger.debug("contact after update: " + contact.toString());
	// this.m_logger.debug("contact.postalAddressOtherAddr: " + contact.postalAddressOtherAddr("postalAddress#home"));
	zinAssert(contact.postalAddressOtherAddr("postalAddress#home") == this.m_otheraddr);

	return true;
}

// test that all "system" and "general" preferences have a value in the default branch
//
TestHarness.prototype.testPreferencesHaveDefaults = function()
{
	var prefs = new MozillaPreferences();
	var i, j, prefset, key, value;

	// test system preferences
	//
	var a_system_prefs = MozillaPreferences.getAllSystemPrefs();

	for (key in a_system_prefs)
	{
		if (a_system_prefs[key] == 'char')
			value = prefs.getCharPrefOrNull(prefs.defaultbranch(), key);
		else
			value = prefs.getIntPrefOrNull(prefs.defaultbranch(), key);

		zinAssertAndLog(value, "key: " + key);
	}

	// test PrefSet.GENERAL preferences
	//
	var a_prefset = [];
	a_prefset.push({ parent: PrefSet.GENERAL, properties: PrefSet.GENERAL_PROPERTIES, id: null });

	a_preauth = prefs.getImmediateChildren(prefs.branch(), PrefSet.PREAUTH + '.');

	for (var j in a_preauth)
		a_prefset.push({ parent: PrefSet.PREAUTH, properties: PrefSet.PREAUTH_PROPERTIES, id: j });

	for (i = 0; i < a_prefset.length; i++)
	{
		prefset = new PrefSet(a_prefset[i].parent, a_prefset[i].properties);
		prefset.load(a_prefset[i].id, prefs.defaultbranch());

		// this.m_logger.debug("prefset: " + a_prefset[i].parent + " is: " + prefset.toString());

		for (j = 0; j < a_prefset[i].properties.length; j++)
		{
			key = a_prefset[i].properties[j];
			zinAssertAndLog(prefset.getProperty(key), "key: " + key);
		}
	}

	return true;
}

// code to create addressbook "fred" and get its prefId.
//
TestHarness.prototype.testAbCreate1 = function()
{
	var prefix = "fred";

	for (var i = 1; i < 10; i++)
	{
		var name = prefix + "-" + i;
		var abProps = Cc["@mozilla.org/addressbook/properties;1"].createInstance(Ci.nsIAbDirectoryProperties);
		abProps.description = name;
		abProps.dirType     = kPABDirectory;

		var ab  = Cc["@mozilla.org/addressbook;1"].createInstance(Ci.nsIAddressBook);
		ab.newAddressBook(abProps);
		var uri = abProps.URI;
		var zab = new AddressBookTb2();
		zab.populateNameToUriMap();
		var rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
		var dir = rdf.GetResource(uri).QueryInterface(Ci.nsIAbDirectory);

		this.m_logger.debug("created addressbook name: " + name + " uri: " + uri + " typeof: " + typeof(uri));
		this.m_logger.debug("abProps.prefName: " + abProps.prefName);
		this.m_logger.debug("dirPrefId: " + dir.dirPrefId);
	}
}

TestHarness.prototype.testAbCreate2 = function()
{
	var zab = new AddressBookTb3();
	zab.newAddressBook("fred-1");
}
