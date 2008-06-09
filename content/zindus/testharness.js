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

include("chrome://zindus/content/feed.js");
include("chrome://zindus/content/lso.js");
include("chrome://zindus/content/gdaddressconverter.js");

function ZinTestHarness()
{
	this.m_logger = ZinLoggerFactory.instance().newZinLogger("ZinTestHarness");
	this.m_bugzilla_432145_count = 100;

	this.m_bugzilla_432145_uri = new Array();
	this.m_bugzilla_432145_uri[0] = "moz-abmdbdirectory://abook-3.mab";
	this.m_bugzilla_432145_uri[1] = "moz-abmdbdirectory://abook-12.mab";
	this.m_bugzilla_432145_uri[2] = "moz-abmdbdirectory://abook-20.mab";
	this.m_bugzilla_432145_uri[3] = "moz-abmdbdirectory://abook-21.mab";
	this.m_bugzilla_432145_uri[4] = "moz-abmdbdirectory://abook-22.mab";
}

ZinTestHarness.prototype.run = function()
{
	var ret = true;

	// ret = ret && this.testCrc32();
	// ret = ret && this.testLogging();
	// ret = ret && this.testFilesystem();
	// ret = ret && this.testPropertyDelete();
	// ret = ret && this.testLso();
	// ret = ret && this.testContactConverter();
	// ret = ret && this.testAddressBook1();
	// ret = ret && this.testAddressBook2();
	// ret = ret && this.testAddressBookBugzilla432145Create();
	// ret = ret && this.testAddressBookBugzilla432145Compare();
	// ret = ret && this.testAddressBookBugzilla432145Delete();
	// ret = ret && this.testZinFeedCollection();
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

	this.m_logger.debug("test(s) " + (ret ? "succeeded" : "failed"));
}

ZinTestHarness.prototype.testCrc32 = function()
{
	var left  = ZinUtil.newObject("FirstName", "01-first-3", "LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com");
	var right = ZinUtil.newObject("LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com" , "FirstName", "01-first-3");

	var contact_converter = this.newZinContactConverter();
	var crcLeft  = contact_converter.crc32(left)
	var crcRight = contact_converter.crc32(right)

	ZinUtil.assert(crcLeft == crcLeft);
}

ZinTestHarness.prototype.newZinContactConverter = function(arg)
{
	var ret;

	ret = new ZinContactConverter();

	if (arguments.length == 0)
		ret.setup();
	else
		ret.setup(arg);

	return ret;
}

ZinTestHarness.prototype.testZinFeedCollection = function()
{
	var zfc = new ZinFeedCollection();
	var zfi;

	zfi = new ZinFeedItem();
	zfi.set(ZinFeedItem.ATTR_KEY, 0);
	zfi.set('name1', "value1");

	zfc.set(zfi);

	var zfi = zfc.get(0);
	zfi.set('fred', 1);

	zfi = new ZinFeedItem();
	zfi.set(ZinFeedItem.ATTR_KEY, 1);
	zfi.set('name2', "value2");
	zfi.set('name3', "value3");

	zfc.set(zfi);

	this.m_logger.debug("3233: zfc.toString() == \n" + zfc.toString());

	zfc.del(1);

	this.m_logger.debug("3233: zfc.toString() after del(1) == \n" + zfc.toString());

	zfi = new ZinFeedItem(null, ZinFeedItem.ATTR_KEY, ZinFeedItem.KEY_STATUSPANEL , 'appversion', 1234 );

	return true;
}

ZinTestHarness.prototype.testContactConverter = function()
{
	var ret = true;
	ret = ret && this.testContactConverter1();
	ret = ret && this.testContactConverterGdPostalAddress();
	return ret;
}

ZinTestHarness.prototype.testContactConverterGdPostalAddress = function()
{
	var xmlInput, contact_converter, a_gd_contact, contact, properties;

	this.setupFixtureGdPostalAddress();

	var xml_as_char = this.m_address_as_xml;

	contact_converter = this.newZinContactConverter();
	ZinUtil.assert(!contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "false", address shouldn't be converted to Thunderbird fields
	//
	contact    = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", "line 1\n\n\nline 4" ));
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	ZinUtil.assert(!ZinUtil.isPropertyPresent(properties, "HomeAddress"));

	contact    = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", xml_as_char ));
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	ZinUtil.assert(!ZinUtil.isPropertyPresent(properties, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", address should convert to/from Thunderbird fields
	// but the <otheraddr> element from Google doesn't become a Thunderbird property
	//
	contact_converter = this.newZinContactConverter(ZinContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);
	ZinUtil.assert(contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@", xml_as_char ));

	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);

	// this.m_logger.debug("properties: " + ZinUtil.aToString(properties));

	ZinUtil.assert(ZinUtil.isPropertyPresent(properties, "HomeAddress")  && properties["HomeAddress"]  == this.m_street1);
	ZinUtil.assert(ZinUtil.isPropertyPresent(properties, "HomeAddress2") && properties["HomeAddress2"] == this.m_street2);
	ZinUtil.assert(!ZinUtil.isPropertyPresent(properties, "otheraddr"));

	var gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, properties);
	xml_as_char = gd_properties["postalAddress#home"];

	var gd_address = new XML(xml_as_char);
	var ns = Namespace(ZinXpath.NS_ZINDUS_ADDRESS);

	ZinUtil.assert(gd_address.ns::street.length() == 2 && ZinUtil.zinTrim(String(gd_address.ns::street[0])) == this.m_street1
	                                              && ZinUtil.zinTrim(String(gd_address.ns::street[1])) == this.m_street2);;

	return true;
}

ZinTestHarness.prototype.testContactConverter1 = function()
{
	var i, format, properties;
	var a_data = new Array();
	var contact_converter = this.newZinContactConverter();

	a_data.push(ZinUtil.newObject(FORMAT_TB, 'PrimaryEmail', FORMAT_ZM, 'email',      FORMAT_GD, 'PrimaryEmail', 'value', 'john@example.com'));
	a_data.push(ZinUtil.newObject(FORMAT_TB, 'FirstName',    FORMAT_ZM, 'firstName',  FORMAT_GD,  null         , 'value', 'john'            ));
	a_data.push(ZinUtil.newObject(FORMAT_TB, 'HomeAddress',  FORMAT_ZM, 'homeStreet', FORMAT_GD,  null         , 'value', '123 blah st'     ));

	var a_properties = new Object();

	for (i = 0; i < A_VALID_FORMATS.length; i++)
		a_properties[A_VALID_FORMATS[i]] = new Object();
	
	for (i = 0; i < a_data.length; i++)
		for (format in a_data[i])
			if (ZinUtil.isInArray(Number(format), A_VALID_FORMATS))
				if (a_data[i][format] != null)
					a_properties[format][a_data[i][format]] = a_data[i]['value'];

	// this.m_logger.debug("testContactConverter: a_properties: " + ZinUtil.aToString(a_properties));

	// test conversion of ...
	ZinUtil.assert(contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, 'HomeAddress') == false);

	// test converting FORMAT_TB to all formats
	//
	ZinUtil.assert(ZinUtil.isMatchObjects(a_properties[FORMAT_TB], contact_converter.convert(FORMAT_TB, FORMAT_TB, a_properties[FORMAT_TB])));
	ZinUtil.assert(ZinUtil.isMatchObjects(a_properties[FORMAT_ZM], contact_converter.convert(FORMAT_ZM, FORMAT_TB, a_properties[FORMAT_TB])));
	ZinUtil.assert(ZinUtil.isMatchObjects(a_properties[FORMAT_GD], contact_converter.convert(FORMAT_GD, FORMAT_TB, a_properties[FORMAT_TB])));

	// test that crc's match
	//
	var a_crc = new Object();
	for (i = 0; i < A_VALID_FORMATS.length; i++)
	{
		format = A_VALID_FORMATS[i];

		properties = ZinUtil.cloneObject(a_properties[format]);
		contact_converter.removeKeysNotCommonToAllFormats(format, properties);

		// this.m_logger.debug("testContactConverter: format: " + format + " common properties: " + ZinUtil.aToString(properties));

		properties = contact_converter.convert(FORMAT_TB, format, properties);

		// this.m_logger.debug("testContactConverter: format: " + format + " normalised properties: " + ZinUtil.aToString(properties));

		a_crc[format] = contact_converter.crc32(properties);
	}
	
	// this.m_logger.debug("testContactConverter: a_crc: " + ZinUtil.aToString(a_crc));

	for (i = 1; i < A_VALID_FORMATS.length; i++)
		ZinUtil.assert(a_crc[A_VALID_FORMATS[0]] == a_crc[A_VALID_FORMATS[i]]);

	var element = new Object();

	element['email']     = "xxx@example.com";
	element['firstName'] = "xxx";

	var properties = contact_converter.convert(FORMAT_TB, FORMAT_ZM, element);

	// this.m_logger.debug("testContactConverter: converts:\nzimbra: " + ZinUtil.aToString(element) + "\nto thunderbird: " + ZinUtil.aToString(properties));

	// test the contact_converter.keysCommonToThatMatch()
	//
	contact_converter = this.newZinContactConverter(ZinContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);
	this.m_logger.debug("blah77: m_common_to: " + ZinUtil.aToString(contact_converter.m_common_to));
	this.m_logger.debug("blah77: m_common_to[format_from][format_to].length: "+ contact_converter.m_common_to[FORMAT_GD][FORMAT_TB].length);

	var a_postalAddress = contact_converter.keysCommonToThatMatch(/^postalAddress#(.*)$/, "$1", FORMAT_GD, FORMAT_TB);
	this.m_logger.debug("a_postalAddress: " + ZinUtil.aToString(a_postalAddress));
	ZinUtil.assert(ZinUtil.isPropertyPresent(a_postalAddress, "home") && ZinUtil.isPropertyPresent(a_postalAddress, "work"));

	return true;
}

ZinTestHarness.prototype.gdContactFromXmlString = function(contact_converter, str)
{
	var domparser = new DOMParser();
	var doc = domparser.parseFromString(str, "text/xml");
	// this.m_logger.debug("gdContactFromXmlString: entry: " + ZinUtil.xmlDocumentToString(doc));
	a_gd_contact = GdContact.arrayFromXpath(contact_converter, doc, "/atom:entry");

	ZinUtil.assertAndLog(ZinUtil.aToLength(a_gd_contact) == 1, "length: " + ZinUtil.aToLength(a_gd_contact));

	var contact = a_gd_contact[ZinUtil.firstKeyInObject(a_gd_contact)];
	// this.m_logger.debug("gdContactFromXmlString: contact: " + contact.toString());

	return contact;
}

ZinTestHarness.prototype.testContactConverterPropertyMatch = function(obj1, obj2)
{
	ZinUtil.assert(ZinUtil.isMatchObjectKeys(obj1, obj2));

	for (var i in obj1)
		ZinUtil.assert(obj1[i] == obj2[i]);
}

ZinTestHarness.prototype.testFolderConverterPrefixClass = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new ZinFolderConverter();

	ZinUtil.assert(converter.prefixClass(converter.m_prefix_primary_account)   == ZinFolderConverter.PREFIX_CLASS_PRIMARY);
	ZinUtil.assert(converter.prefixClass(converter.m_prefix_foreign_readonly)  == ZinFolderConverter.PREFIX_CLASS_SHARED);
	ZinUtil.assert(converter.prefixClass(converter.m_prefix_foreign_readwrite) == ZinFolderConverter.PREFIX_CLASS_SHARED);
	ZinUtil.assert(converter.prefixClass(converter.m_prefix_internal)          == ZinFolderConverter.PREFIX_CLASS_INTERNAL);
	ZinUtil.assert(converter.prefixClass("fred")                               == ZinFolderConverter.PREFIX_CLASS_NONE);

	return true;
}

ZinTestHarness.prototype.testFolderConverter = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new ZinFolderConverter();

	this.testFolderConverterSuiteOne(converter, "convertForMap");

	var addressbook = new ZinAddressBook();
	var pabname = addressbook.getPabName();
	converter.localised_pab(pabname);

	this.testFolderConverterSuiteOne(converter, "convertForPublic");

	ZinUtil.assert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == pabname);
	ZinUtil.assert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == pabname);

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

ZinTestHarness.prototype.testFolderConverterSuiteOne = function(converter, method)
{
	// test convertForMap
	//
	ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(""))                 == converter.m_prefix_primary_account);

	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName("fred"))             == "fred");
	ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName("x"))                == converter.m_prefix_primary_account + "x");
	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName("zindus/fred"))      == "fred");
	ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName("zindus/fred"))      == "zindus/fred");

	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == ZM_FOLDER_CONTACTS);
	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == ZM_FOLDER_CONTACTS);

	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == ZM_FOLDER_EMAILED_CONTACTS);
	ZinUtil.assert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == ZM_FOLDER_EMAILED_CONTACTS);

	if (method != "convertForPublic") // these are tested separately
	{
		ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_PAB))             == TB_PAB);
		ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_CONTACTS)) == TB_PAB);

		ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == TB_EMAILED_CONTACTS);
		ZinUtil.assert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == TB_EMAILED_CONTACTS);
	}

	return true;
}

ZinTestHarness.prototype.testFolderConverterSuiteTwo = function(converter, localised_emailed_contacts)
{
	var prefix = converter.m_prefix_primary_account;

	ZinUtil.assert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == prefix + localised_emailed_contacts);
	ZinUtil.assert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == prefix + localised_emailed_contacts);
}

ZinTestHarness.prototype.testPropertyDelete = function()
{
	var x = new Object();

	x[1] = 1;
	x[2] = 2;
	x[3] = 3;
	x[4] = 4;
	x[5] = 5;

	this.m_logger.debug("3233: x: " + ZinUtil.aToString(x));

	for (i in x)
	{
		this.m_logger.debug("3233: i: " + i);

		if (i == 3)
			delete x[i];
	}

	this.m_logger.debug("3233: x: " + ZinUtil.aToString(x));
}

ZinTestHarness.prototype.testLso = function()
{
	var zfi, lso, str;
	// test constructor style #1
	//
	var d = new Date();
	var s = Date.UTC();
	var t = ZinUtil.hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	        " " +
			ZinUtil.hyphenate(":", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, 334, ZinFeedItem.ATTR_MS, 1234, ZinFeedItem.ATTR_REV, 1235);
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
	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, 334, ZinFeedItem.ATTR_CS, 1749681802);
	lso = new Lso(zfi);
	str = "#1749681802###";
	this.testLsoToString(lso, str);
	this.testLsoCompareTb(lso, zfi);

	this.testLsoCaseOne();
	this.testLsoCaseTwo();

	return true;
}

ZinTestHarness.prototype.testLsoCaseOne = function(lso, str)
{
	// test this outcome which seemed odd :
	// buildGcs: compare:  sourceid: 2 zfi: type=cn key=92114 id=92114 l=85098 ms=100170 rev=100170 ls=1##94649#94649#  gid: 523 gid's ver: 1 lso : 1##94649#94649# lso.compare == -1
	// Turned out to be a bug - compare() was using string comparisons, so it failed when comparing a 3-digit with a four-digit ms or rev

	var lso = new Lso("1##94649#94649#");
	var zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, "92114",
	                                               ZinFeedItem.ATTR_ID, "92114",
	                                               ZinFeedItem.ATTR_L, "85098",
	                                               ZinFeedItem.ATTR_MS, "100170",
	                                               ZinFeedItem.ATTR_REV, "100170",
	                                               ZinFeedItem.ATTR_LS, "1##94649#94649#" );
	var ret = lso.compare(zfi);

	ZinUtil.assert(ret == 1);
}

ZinTestHarness.prototype.testLsoCaseTwo = function()
{
	// test pulling the rev out of ATTR_LS and backdating it
	// this happens when we want to force an update of a google contact (because XML postalAddress conversion has just been turned on)
	//
	var zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, "92114",
	                                               ZinFeedItem.ATTR_ID, "92114",
	                                               ZinFeedItem.ATTR_L, "85098",
	                                               ZinFeedItem.ATTR_REV, "2008-05-05T00:51:12.105Z",
	                                               ZinFeedItem.ATTR_LS, "1###2008-05-05T00:51:12.105Z#" );

	var lso = new Lso(zfi.get(ZinFeedItem.ATTR_LS));
	ZinUtil.assert(lso.compare(zfi) == 0);

	var rev = lso.get(ZinFeedItem.ATTR_REV);
	var new_rev = "1" + rev.substr(1);
	zfi.set(ZinFeedItem.ATTR_REV, new_rev);

	ZinUtil.assert(lso.compare(zfi) == -1);
}

ZinTestHarness.prototype.testLsoToString = function(lso, str)
{
	ZinUtil.assert(lso.toString() == str);
}

ZinTestHarness.prototype.testLsoCompareZm = function(lso, zfiOrig)
{
	var zfi;

	zfi = ZinUtil.cloneObject(zfiOrig)
	ZinUtil.assert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1235);
	ZinUtil.assert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_REV, 1236);
	ZinUtil.assert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_DEL, 1);
	ZinUtil.assert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1233);
	zfi.set(ZinFeedItem.ATTR_REV, 1235);
	ZinUtil.assert(lso.compare(zfi) == -1);  // test compare() == -1;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1234);
	zfi.set(ZinFeedItem.ATTR_REV, 1232);
	ZinUtil.assert(lso.compare(zfi) == -1);  // test compare() == -1;
}

ZinTestHarness.prototype.testLsoCompareTb = function(lso, zfiOrig)
{
	var zfi;

	zfi = ZinUtil.cloneObject(zfiOrig)
	ZinUtil.assert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_DEL, 1);
	ZinUtil.assert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = ZinUtil.cloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_CS, 1111111111111);
	ZinUtil.assert(lso.compare(zfi) == 1);  // test compare() == 1;
}

ZinTestHarness.prototype.testLogging = function()
{
	// var logger = new Log(Log.DEBUG, Log.dumpAndFileLogger, "ZinTestHarness.testLogging");
	var logger = ZinLoggerFactory.instance().newZinLogger("testLogging");

	logger.debug("hello, this is a debug");
	logger.info("hello, this is a info");
	logger.warn("hello, this is a warn");
	logger.error("hello, this is a error");
	logger.fatal("hello, this is a fatal");
}

ZinTestHarness.prototype.testXmlHttpRequest = function()
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

ZinTestHarness.prototype.testPermFromZfi = function()
{
	var ret = true;
	var zfi = new ZinFeedItem(ZinFeedItem.TYPE_RL, ZinFeedItem.ATTR_KEY, 334, ZinFeedItem.ATTR_PERM, "rwidxc");

	ret = ret && ZinUtil.zmPermFromZfi(zfi) == ZM_PERM_READ | ZM_PERM_WRITE;

	zfi.set(ZinFeedItem.ATTR_PERM, "r");

	ret = ret && ZinUtil.zmPermFromZfi(zfi) == ZM_PERM_READ;

	zfi.set(ZinFeedItem.ATTR_PERM, "");

	ret = ret && ZinUtil.zmPermFromZfi(zfi) == ZM_PERM_NONE;

	return ret;
}

ZinTestHarness.prototype.testZuio = function()
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

ZinTestHarness.prototype.testAddressBook1 = function()
{
	var addressbook;

	if (ZinAddressBook.TbVersion() == ZinAddressBook.TB2)
		addressbook = new ZinAddressBookTb2();
	else
		addressbook = new ZinAddressBookTb3();

	// this.m_logger.debug("testAddressBook: addressbooks: " + addressbook.addressbooksToString());

	var uri = "moz-abmdbdirectory://abook.mab";
	var prefix = "zindus-test-";
	var properties = { "FirstName": null, "LastName": null, "DisplayName": null, "SecondEmail": null };
	var luid = "12346684";

	for (var i in properties)
		properties[i] = prefix + i;

	var attributes = ZinUtil.newObject(TBCARD_ATTRIBUTE_LUID, luid);

	ZinUtil.assert(!addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid)); // test card shouldn't exist before the test starts

	var abCardIn = addressbook.addCard(uri, properties, attributes);

	var abCardOut = addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

	this.m_logger.debug("abCardIn: "  + addressbook.nsIAbCardToPrintableVerbose(abCardIn));
	this.m_logger.debug("abCardOut: " + addressbook.nsIAbCardToPrintableVerbose(abCardOut));

	ZinUtil.assert(ZinUtil.isMatchObjects(properties, addressbook.getCardProperties(abCardIn)));
	ZinUtil.assert(ZinUtil.isMatchObjects(properties, addressbook.getCardProperties(abCardOut)));
	ZinUtil.assert(ZinUtil.isMatchObjects(attributes, addressbook.getCardAttributes(abCardIn)));
	ZinUtil.assert(ZinUtil.isMatchObjects(attributes, addressbook.getCardAttributes(abCardOut)));

	addressbook.deleteCards(uri, [ abCardIn ]);

	ZinUtil.assert(!addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid)); // test card shouldn't exist after the test is finished

	return true;
}

ZinTestHarness.prototype.testAddressBook2 = function()
{
	ZinUtil.assert(ZinAddressBook.TbVersion() == ZinAddressBook.TB3);

	var uri = "moz-abmdbdirectory://abook.mab";
	var properties = { "DisplayName": "BlahDisplayName",
					   "PrimaryEmail": "BlahPrimarEmail@example.com" };

	var dir = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).getDirectory(uri);

	var abCard;
	abCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].
	                    createInstance(Components.interfaces.nsIAbCard);

	for (key in properties)
		abCard.setCardValue(key, properties[key]);

	abCard = dir.addCard(abCard);

	abCard = dir.modifyCard(abCard);

	var addressbook = new ZinAddressBookTb3();
	this.m_logger.debug("abCard created: "  + addressbook.nsIAbCardToPrintableVerbose(abCard));
}

ZinTestHarness.prototype.testAddressBookBugzilla432145Uri = function(count)
{
	var index = parseInt( (count * this.m_bugzilla_432145_uri.length) / this.m_bugzilla_432145_count );

	ZinUtil.assertAndLog(ZinUtil.isPropertyPresent(this.m_bugzilla_432145_uri, index), "index: " + index);

	return this.m_bugzilla_432145_uri[index];
}

ZinTestHarness.prototype.testAddressBookBugzilla432145Create = function()
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

ZinTestHarness.prototype.testAddressBookBugzilla432145Delete = function()
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

ZinTestHarness.prototype.testAddressBookBugzilla432145Compare = function()
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

		ZinUtil.assertAndLog(ZinUtil.isMatchObjects(properties, addressbook.getCardProperties(abCard)), count);
		ZinUtil.assertAndLog(ZinUtil.isMatchObjects(attributes, addressbook.getCardAttributes(abCard)), count);

		luid++;
	}

	return true;
}

ZinTestHarness.prototype.testAddressBookBugzilla432145Populate = function(properties, attributes, luid)
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

ZinTestHarness.prototype.testAddressBookBugzilla432145Addressbook = function()
{
	var ret;

	if (ZinAddressBook.TbVersion() == ZinAddressBook.TB2)
		ret = new ZinAddressBookTb2();
	else
		ret = new ZinAddressBookTb3();

	return ret;
}

ZinTestHarness.prototype.testGoogleContacts1 = function()
{
	var key, meta, properties, xmlString;

	properties = this.sampleGoogleContactProperties();

	meta = ZinUtil.newObject("id", "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
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
	var contact_converter = this.newZinContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, xpath_query);

	// 1. test that a contact can get parsed out of xml 
	// this.m_logger.debug("testGoogleContacts1: 1. id: " + id + " contact: " + contact.toString());
	ZinUtil.assertAndLog(ZinUtil.aToLength(a_gd_contact) == 1, "length: " + ZinUtil.aToLength(a_gd_contact));

	var id = ZinUtil.firstKeyInObject(a_gd_contact);
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
	properties = ZinUtil.newObject("content", "1-content", "organization#orgName", "2-organization#orgName");
	contact.updateFromProperties(properties);
	this.matchGoogleContact(contact, properties, {});

	// 5. test creating a contact with an empty title
	//
	properties = ZinUtil.newObject("title", "", "content", "1-content", "organization#orgName", "2-organization#orgName");
	contact.updateFromProperties(properties);
	delete properties["title"];
	this.matchGoogleContact(contact, properties, {});

	return true;
}

ZinTestHarness.prototype.testGoogleContacts2 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/username%40@gmail.com/base/7ae485588d2b6b50</id><updated>2008-04-26T01:58:35.904Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>77</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username%40gmail.com/base/7ae485588d2b6b50/1209175115904000'/><gd:email rel='http://schemas.google.com/g/2005#other' address='77@example.com' primary='true'/></entry>"
	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newZinContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");
	this.m_logger.debug("testGoogleContacts2: number of contacts parsed: " + ZinUtil.aToLength(a_gd_contact));
	this.m_logger.debug("testGoogleContacts2: contact: " + a_gd_contact[ZinUtil.firstKeyInObject(a_gd_contact)].toString());
}

ZinTestHarness.prototype.sampleGoogleContactProperties = function()
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

ZinTestHarness.prototype.matchGoogleContact = function(contact, properties, meta)
{
	var key;
	ZinUtil.assert(contact && contact.m_properties);

	// this.m_logger.debug("matchGoogleContact: blah: \n properties: " + ZinUtil.aToString(properties) + " \nmeta: " + ZinUtil.aToString(meta) + " \ncontact: " + contact.toString());

	for (key in properties)
		ZinUtil.assertAndLog(contact.m_properties[key] == properties[key], "key: " + key);

	for (key in meta)
		ZinUtil.assertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	if (contact.m_properties)
		for (key in contact.m_properties)
			ZinUtil.assertAndLog(contact.m_properties[key] == properties[key], "key: " + key);

	if (contact.m_meta)
		for (key in contact.m_meta)
			ZinUtil.assertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	
}

ZinTestHarness.prototype.testGoogleContacts3 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96</id><updated>2008-05-05T21:13:38.158Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>rr rr</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96/1210022018158000'/><gd:email rel='http://schemas.google.com/g/2005#home' address='rr.rr.rr.rr@example.com' primary='true'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>111111</gd:phoneNumber></entry>";
	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newZinContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");
	this.m_logger.debug("testGoogleContacts2: number of contacts parsed: " + ZinUtil.aToLength(a_gd_contact));
	this.m_logger.debug("testGoogleContacts2: contact: " + a_gd_contact[ZinUtil.firstKeyInObject(a_gd_contact)].toString());
}

ZinTestHarness.prototype.testGdAddressConverter = function()
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
	xml_as_entity = gac.convertCER(xml_as_char, GdAddressConverter.CER_TO_ENTITY);
	xml_as_char2  = gac.convertCER(xml_as_entity, GdAddressConverter.CER_TO_CHAR);

	this.m_logger.debug("testGdAddressConverter: xml_as_char: " + xml_as_char);
	this.m_logger.debug("testGdAddressConverter: xml_as_char2: " + xml_as_char2);
	this.m_logger.debug("testGdAddressConverter: xml_as_entity: " + xml_as_entity);

	ZinUtil.assert(xml_as_char == xml_as_char2);

	// Test convert with ADDR_TO_PROPERTIES
	//
	// Test that all fields convert
	//
	var a_fields_orig = a_fields;
	a_fields = { };

	gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);

	// this.m_logger.debug("testGdAddressConverter: a_fields: " + ZinUtil.aToString(a_fields));

	ZinUtil.assertAndLog(ZinUtil.isMatchObjectKeys(a_fields, a_fields_orig), "a_fields keys: " + ZinUtil.keysToString(a_fields) + " orig keys: " + ZinUtil.keysToString(a_fields_orig));

	for (var key in a_fields)
		ZinUtil.assertAndLog(ZinUtil.zinTrim(a_fields[key]) == ZinUtil.zinTrim(a_fields_orig[key]), "mismatch for key: " + key);

	// Test that given non-xml, gac.convert() returns false
	//
	out['x'] = "some text";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	ZinUtil.assert(!retval && ZinUtil.aToLength(a_fields) == 0);

	// Test that given empty <address>, gac.convert() returns true and a_fields is empty
	//
	out['x'] = "<address xmlns='" + ZinXpath.NS_ZINDUS_ADDRESS + "'/>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	ZinUtil.assertAndLog(retval && ZinUtil.aToLength(a_fields) == 0, "retval: " + retval + " a_fields: " + ZinUtil.aToString(a_fields));

	// Test that given empty <address>, gac.convert() returns true and a_fields is empty
	//
	out['x'] = "<address xmlns='" + ZinXpath.NS_ZINDUS_ADDRESS + "'> " + " <otheraddr> </otheraddr> </address>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	ZinUtil.assertAndLog(retval && ZinUtil.aToLength(a_fields) == 0, "retval: " + retval + " a_fields: " + ZinUtil.aToString(a_fields));

	// Test that given empty <somexml>, gac.convert() returns false and a_fields is empty
	//
	out['x'] = "<somexml> <otheraddr> </otheraddr> </somexml>";
	a_fields = { };
	var retval = gac.convert(out, 'x', a_fields, GdAddressConverter.ADDR_TO_PROPERTIES);
	ZinUtil.assert(!retval && ZinUtil.aToLength(a_fields) == 0);

	return true;
}

ZinTestHarness.prototype.setupFixtureGdPostalAddress = function()
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
	this.m_address_as_e4x.setNamespace(ZinXpath.NS_ZINDUS_ADDRESS);

	this.m_gac = new GdAddressConverter();
	this.m_address_as_xml = this.m_address_as_e4x.toXMLString();

	// this.m_logger.debug("blahzz: m_address_as_xml: " + this.m_address_as_xml );
}

ZinTestHarness.prototype.testGdContact = function()
{
	var contact, tb_properties, gd_properties;
	var HomeAddress2      = "456 Collins st";
	var contact_converter = this.newZinContactConverter(ZinContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);

	this.setupFixtureGdPostalAddress();

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should preverse <otheraddr>
	//
	contact = this.gdContactFromXmlString(contact_converter, this.m_entry_as_xml_char.replace("@@postal@@",
	                                       contact_converter.m_gac.convertCER(this.m_address_as_xml, GdAddressConverter.CER_TO_ENTITY)));

	ZinUtil.assert(contact.isAnyPostalAddressInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);

	tb_properties["HomeAddress2"] = HomeAddress2;

	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	this.m_logger.debug("blahaa: gd_properties: " + ZinUtil.aToString(gd_properties));

	contact.updateFromProperties(gd_properties);
	// this.m_logger.debug("contact after update: " + contact.toString());
	ZinUtil.assert(contact.postalAddressOtherAddr("postalAddress#home") == this.m_otheraddr);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	ZinUtil.assert(tb_properties["HomeAddress2"] == HomeAddress2);

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should xmlify the Google contact
	// 
	this.setupFixtureGdPostalAddress();

	contact = this.gdContactFromXmlString(contact_converter,
	                                      this.m_entry_as_xml_char.replace("@@postal@@", this.m_otheraddr));
	ZinUtil.assert(!contact.isAnyPostalAddressInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.m_properties);
	tb_properties["HomeAddress2"] = HomeAddress2;
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact.updateFromProperties(gd_properties);
	this.m_logger.debug("contact after update: " + contact.toString());
	ZinUtil.assert(contact.postalAddressOtherAddr("postalAddress#home") == this.m_otheraddr);

	return true;
}
