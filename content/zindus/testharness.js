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
 * Portions created by Initial Developer are Copyright (C) 2007-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

function TestHarness()
{
	this.m_logger = newLogger("TestHarness");
	this.m_a_books = [1000, 2000, 3000, 4000, 5000];

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
	// ret = ret && this.testSuo();
	// ret = ret && this.testAccount();
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
	ret = ret && this.testZuio();
	// ret = ret && this.testGoogleContacts1();
	// ret = ret && this.testGoogleContacts2();
	// ret = ret && this.testGoogleContacts3();
	// ret = ret && this.testGoogleContacts4();
	// ret = ret && this.testGoogleContacts5();
	ret = ret && this.testZinEnum();
	ret = ret && this.testContactGoogle1();
	ret = ret && this.testContactGoogle2();
	// ret = ret && this.testContactGoogleIssue179();
	ret = ret && this.testContactGoogleIterators();
	ret = ret && this.testContactGooglePostalAddress();
	ret = ret && this.testGdAddressConverter();
	ret = ret && this.testBiMap();
	ret = ret && this.testStringBundleContainsContactProperties();
	// ret = ret && this.testAddCard();
	// ret = ret && this.testDeleteCard();
	// ret = ret && this.testFileLoggingTimes();
	// ret = ret && this.testStringTimes();
	// ret = ret && this.tweakLuidOnCard();
	// ret = ret && this.testExitStatusMessages();
	// ret = ret && this.testRenameAddressBook();
	// ret = ret && this.createGoogleRuleViolation();
	// ret = ret && this.testGoogleContactWithe4x();
	// ret = ret && this.createBigAddressbooks();
	// ret = ret && this.testPerformanceCardLookup();
	// ret = ret && this.testPerformanceZfcSet();
	// ret = ret && this.testPerformanceStringConcat();
	// ret = ret && this.testPerformanceLoggingStyles();
	// ret = ret && this.testTb3CardUuid();

	this.m_logger.debug("test(s) " + (ret ? "succeeded" : "failed"));
}

TestHarness.prototype.testSuo = function()
{
	var suo, it, fn, aSuo, str, generator;
	var context = this;

	aSuo = new Object();
	aSuo[SOURCEID_TB] = new Object();
	aSuo[SOURCEID_AA] = new Object();

	aSuo[SOURCEID_TB][Suo.ADD | FeedItem.TYPE_FL] = new Object();
	aSuo[SOURCEID_AA][Suo.MOD | FeedItem.TYPE_CN] = new Object();

	aSuo[SOURCEID_TB][Suo.ADD | FeedItem.TYPE_FL][1] = " Suo.ADD|FL ";
	aSuo[SOURCEID_AA][Suo.MOD | FeedItem.TYPE_CN][2] = " Suo.MOD|CN ";

	it = new SuoIterator(aSuo);

	str = "test #1.1 - iterate over everthing: ";
	for (suo in it.iterator(function(sourceid, bucket) { return true; }))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str) && /MOD/.test(str));

	str = "test #1.2 - generate over everthing: ";
	generator = it.generator(function(sourceid, bucket) { return true; });
	while (Boolean([key, suo] = generator.next()))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str) && /MOD/.test(str));

	str = "test #2.1 - iterate ADD: ";
	for (suo in it.iterator(function(sourceid, bucket) { return bucket & Suo.ADD; }))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str));

	str = "test #2.2 - iterate TYPE_FL: ";
	for (suo in it.iterator(Suo.match_with_bucket(Suo.ADD | FeedItem.TYPE_FL)))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str));

	str = "test #2.3 - generator TYPE_FL: ";
	generator = it.generator(Suo.match_with_bucket(Suo.ADD | FeedItem.TYPE_FL));
	while (Boolean([key, suo] = generator.next()))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str));

	str = "test #3 - iterate MOD: ";
	for (suo in it.iterator(function(sourceid, bucket) { return bucket & Suo.MOD; }))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/MOD/.test(str));

	str = "test #4 - iterate SOURCEID_AA ... MOD: ";
	for (suo in it.iterator(function(sourceid, bucket) { return sourceid == SOURCEID_AA; }))
		str += suo.toString();
	this.m_logger.debug("str: " + str);
	zinAssert(/MOD/.test(str));

	str = "test #5 - iterate all ... with a deletion: ";
	aSuo[SOURCEID_AA][Suo.DEL | FeedItem.TYPE_CN] = new Object();
	aSuo[SOURCEID_AA][Suo.DEL | FeedItem.TYPE_CN][2] = " Suo.DEL|CN ";

	var key;
	for ([key, suo] in it.iterator(function() { return true; }))
	{
		str += suo.toString();
		if ((key.bucket & Suo.MASK) | Suo.DEL)
			delete aSuo[key.sourceid][key.bucket][key.id];
	}
	this.m_logger.debug("str: " + str);
	zinAssert(/ADD/.test(str) && /MOD/.test(str) && /DEL/.test(str));

		// this.m_logger.debug("key: " + aToString(key) + " suo: " + suo.toString());

	return true;
}

TestHarness.prototype.testAccount = function()
{
	var sourceid = 77;
	var account = new Account();
	account.url      = 'http://test-url';
	account.username = 'fred';
	account.username += 'x';
	account.format   = Account.Google;
	account.sourceid = sourceid;
	account.save();

	var account1 = new Account();
	account1.fromPrefset(sourceid);

	// tests fromPrefset, getters and setters
	//
	zinAssert(account.username == account1.username);
	zinAssert(account.url == account1.url);
	zinAssert(account.format == account1.format);
	zinAssert(account.sourceid == account1.sourceid);

	// tests remove() and fromPrefset returns false if account for sourceid isn't in preferences
	//
	account1.remove();

	zinAssert(!account1.fromPrefset(sourceid));

	this.m_logger.debug("account: " + account.toString());

	return true;
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
	var key, zfi;

	key = 1;
	zfi = new FeedItem();
	zfi.set(FeedItem.ATTR_KEY, key);
	zfi.set('name1', "value1");

	zfc.set(zfi);

	var zfi = zfc.get(key);
	zfi.set('fred', 11);

	key = 2;
	zfi = new FeedItem();
	zfi.set(FeedItem.ATTR_KEY, key);
	zfi.set('name2', "value2");
	zfi.set('name3', "value3");

	zfc.set(zfi);

	this.m_logger.debug("zfi.toString() == " + zfi.toString(FeedItem.TOSTRING_RET_FIRST_ONLY));
	this.m_logger.debug("zfc.toString() == \n" + zfc.toString());

	zfc.del(key);

	this.m_logger.debug("zfc.toString() after del(" + key + ") == \n" + zfc.toString());

	zfi = new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_STATUSBAR , 'appversion', 1234 );

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
	var contact_converter, contact, properties;
	var context = this;

	function new_contact(str) {
		return ContactGoogle.textToContact(context.m_entry_as_xml_char.replace("@@postal@@", str ), ContactGoogle.ePostal.kEnabled);
	}

	this.setupFixtureGdPostalAddress();

	var xml_as_char = this.m_address_as_xml;

	contact_converter = this.newContactConverter();
	zinAssert(!contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "false", address shouldn't be converted to Thunderbird fields
	//
	contact = new_contact("line 1\n\n\nline 4");
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	zinAssert(!isPropertyPresent(properties, "HomeAddress"));

	contact = new_contact(xml_as_char);
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	zinAssert(!isPropertyPresent(properties, "HomeAddress"));

	// With PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", address should convert to/from Thunderbird fields
	// but the <otheraddr> element from Google doesn't become a Thunderbird property
	//
	contact_converter = this.newContactConverter(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);
	zinAssert(contact_converter.isKeyConverted(FORMAT_GD, FORMAT_TB, "HomeAddress"));

	contact    = new_contact(this.m_address_as_xml_entity);
	properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);

	// this.m_logger.debug("xmlInput: "   + xmlInput);
	// this.m_logger.debug("properties: " + aToString(properties));

	zinAssert(isPropertyPresent(properties, "HomeAddress")  && properties["HomeAddress"]  == this.m_street1);
	zinAssert(isPropertyPresent(properties, "HomeAddress2") && properties["HomeAddress2"] == this.m_street2);
	zinAssert(!isPropertyPresent(properties, "otheraddr"));

	var gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, properties);
	xml_as_char = gd_properties["postalAddress_home"];

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

	a_data.push(newObject(FORMAT_TB, 'PrimaryEmail', FORMAT_ZM, 'email',      FORMAT_GD, 'email1', 'value', 'john@example.com'));
	a_data.push(newObject(FORMAT_TB, 'FirstName',    FORMAT_ZM, 'firstName',  FORMAT_GD,  null   , 'value', 'john'            ));
	a_data.push(newObject(FORMAT_TB, 'HomeAddress',  FORMAT_ZM, 'homeStreet', FORMAT_GD,  null   , 'value', '123 blah st'     ));

	var a_properties = new Object();

	for (i = 0; i < A_VALID_FORMATS.length; i++)
		a_properties[A_VALID_FORMATS[i]] = new Object();
	
	for (i = 0; i < a_data.length; i++)
		for (format in a_data[i])
			if (isInArray(Number(format), A_VALID_FORMATS))
				if (a_data[i][format] != null)
					a_properties[format][a_data[i][format]] = a_data[i]['value'];

	this.m_logger.debug("testContactConverter: a_properties: " + aToString(a_properties));

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

	var a_postalAddress = contact_converter.keysCommonToThatMatch(/^postalAddress_(.*)$/, "$1", FORMAT_GD, FORMAT_TB);
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

	zinAssert(converter.prefixClass(FolderConverter.PREFIX_PRIMARY_ACCOUNT)   == FolderConverter.PREFIX_CLASS_PRIMARY);
	zinAssert(converter.prefixClass(FolderConverter.PREFIX_FOREIGN_READONLY)  == FolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(FolderConverter.PREFIX_FOREIGN_READWRITE) == FolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(FolderConverter.PREFIX_INTERNAL)          == FolderConverter.PREFIX_CLASS_INTERNAL);
	zinAssert(converter.prefixClass("fred")                                   == FolderConverter.PREFIX_CLASS_NONE);

	return true;
}

TestHarness.prototype.testFolderConverter = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new FolderConverter();

	this.testFolderConverterSuiteOne(converter, "convertForMap");

	var addressbook = AddressBook.new();
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
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(""))                 == FolderConverter.PREFIX_PRIMARY_ACCOUNT);

	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, SyncFsm.zfiFromName("fred"))             == "fred");
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName("x"))                == FolderConverter.PREFIX_PRIMARY_ACCOUNT + "x");
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
	var prefix = FolderConverter.PREFIX_PRIMARY_ACCOUNT;

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

	lso = new Lso("1##94649#94649#");
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
			zinAlert('text.alert.title', xhr.status);
			zinAlert('text.alert.title', xhr.responseText);
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

	ret = ret && zuio.id() == 123;
	ret = ret && zuio.zid() == null;
	ret = ret && !zuio.zid();

	zinAssert(ret);

	return ret;
}

TestHarness.prototype.testAddressBook1 = function()
{
	var addressbook = AddressBook.new();

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

	var addressbook = AddressBook.new();
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
	var addressbook = AddressBook.new();

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
	var addressbook = AddressBook.new();

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
	var addressbook = AddressBook.new();

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

TestHarness.prototype.testGoogleContacts1 = function()
{
	var key, meta, properties, xmlString;

	properties = this.sampleGoogleContactProperties();

	meta = newObject("id",      "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
	                 "self",    "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
					 "updated", "2008-03-29T20:36:25.343Z",
					 "edit",    "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0/12068229blah"
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
	<gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.other@example.com' />\
	<gd:email rel='http://schemas.google.com/g/2005#work' address='john.smith.work@example.com'/>\
	<gd:im address='@@im#AIM@@' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home_fax'>4-home-fax</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#pager'>@@phoneNumber#pager@@</gd:phoneNumber>\
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

	properties["PrimaryEmail"]     = "john.smith.home.2@example.com"; // the first <email> element
	properties["SecondEmail"]      = "john.smith.other@example.com";  // the second...
	properties["phoneNumber#home"] = "3-home";
	properties["im#AIM"]           = "aim-im-2";

	this.matchGoogleContact(contact, properties, meta);

	// 4. test adding all properties to a new contact
	//
	properties = this.sampleGoogleContactProperties();
	var contact_converter = this.newContactConverter();
	contact = new GdContact(contact_converter);
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

	// test that we can find openSearch
	//
	var warn_msg = "<openSearch> element is missing from <feed>!";
	var openSearch = { totalResults: 0 };
	Xpath.setConditionalFromSingleElement(openSearch, 'totalResults', "//atom:feed/openSearch:totalResults", response, warn_msg);
	this.m_logger.debug("entryActionGetContactGd1: openSearch totalResults: " + openSearch.totalResults);

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

	return true;
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

TestHarness.prototype.sampleContactGoogleProperties = function()
{
	var properties = new Object();

	properties["title"] = "1";
	properties["content"] = "2";
	properties["organization_orgName"] = "3";
	properties["organization_orgTitle"] = "4";
	properties["phoneNumber_work"] = "5";
	properties["phoneNumber_home"] = "6";
	properties["phoneNumber_work_fax"] = "7";
	properties["phoneNumber_pager"] = "8";
	properties["phoneNumber_mobile"] = "9";
	properties["email1"] = "10";
	properties["email2"] = "11";
	properties["im_AIM"] = "12";
	// properties["postalAddress_home"] = "13";
	// properties["postalAddress_work"] = "14";
	properties["postalAddress_home"] = "<address xmlns='http://schemas.zindus.com/sync/2008'><street>13</street></address>";
	properties["postalAddress_work"] = "<address xmlns='http://schemas.zindus.com/sync/2008'><street>14</street></address>";

	return properties;
}

TestHarness.prototype.matchGoogleContact = function(contact, properties, meta)
{
	var key;
	zinAssert(contact && contact.m_properties);

	// this.m_logger.debug("matchGoogleContact: blah: \n properties: " + aToString(properties) + " \nmeta: " + aToString(meta) + " \ncontact: " + contact.toString());

	for (key in properties)
		zinAssertAndLog(contact.m_properties[key] == properties[key], "key: " + key + " value in contact: " + contact.m_properties[key] + " expected: " + properties[key]);

	for (key in meta)
		zinAssertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	if (contact.m_properties)
		for (key in contact.m_properties)
			zinAssertAndLog(contact.m_properties[key] == properties[key], "key: " + key);

	if (contact.m_meta)
		for (key in contact.m_meta)
			zinAssertAndLog(contact.m_meta[key] == meta[key], "key: " + key);

	
}

TestHarness.prototype.matchContactGoogle = function(contact, properties, meta, is_match_postal)
{
	var key;
	zinAssert(contact && contact.properties);

	function try_match_postal(key) {

		if (/postalAddress.*$/.test(key) && is_match_postal)
		{
			var re = /[ \r\n'"]/mg;
			var left  = contact.properties[key].replace(re,"")
			var right = properties[key].replace(re,"");
			// logger().debug("AMHEREZ: left: " + left);
			// logger().debug("AMHEREZ: right: " + right);

			zinAssertAndLog(left == right, "key: " + key + " value in contact: " + contact.properties[key] + " expected: " + properties[key]);
		}
	}

	this.m_logger.debug("matchContactGoogle:");
	this.m_logger.debug("matchContactGoogle: blah: \n properties: " + aToString(properties) + " \nmeta: " + aToString(meta) + " \ncontact properties: " + aToString(contact.properties));
	this.m_logger.debug("matchContactGoogle: blah: \ncontact properties: " + aToString(contact.properties));
	this.m_logger.debug("matchContactGoogle: blah: \ncontact xml: " + contact.toStringXml());

	for (key in properties)
		if (!/postalAddress.*$/.test(key))
			zinAssertAndLog(contact.properties[key] == properties[key], "key: " + key + " value in contact: " + contact.properties[key] + " expected: " + properties[key]);
		else
			try_match_postal(key);

	if (meta)
		for (key in meta)
			zinAssertAndLog(contact.meta[key] == meta[key], "key: " + key + " contact.meta[key]: " + contact.meta[key] + " meta[key]: " + meta[key]);

	if (contact.properties)
		for (key in contact.properties)
			if (!/postalAddress.*$/.test(key))
				zinAssertAndLog(contact.properties[key] == properties[key], "key: " + key);
			else
				try_match_postal(key);

	if (meta)
		for (key in contact.meta)
			zinAssertAndLog(contact.meta[key] == meta[key], "key: " + key);
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

	return true;
}

// this looks at a google contact whereby the corresponding thunderbird contact has no properties
//
TestHarness.prototype.testGoogleContacts4 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/blah%40example.com/base/4fa24c410ca0d4f1</id><updated>2008-07-10T15:23:32.801Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'></title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/blah%40example.com/base/4fa24c410ca0d4f1'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/blah%40example.com/base/4fa24c410ca0d4f1/1215703412801000'/><gd:organization primary='true' rel='http://schemas.google.com/g/2005#other'><gd:orgName>Fred Bloggs</gd:orgName></gd:organization></entry>";

	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");
	this.m_logger.debug("testGoogleContacts4: number of contacts parsed: " + aToLength(a_gd_contact));

	var contact = a_gd_contact[firstKeyInObject(a_gd_contact)];

	zinAssert(contact.is_empty());
	zinAssert(!contact.is_deleted());

	this.m_logger.debug("testGoogleContacts4: contact: " + contact.toString());

	return true;
}

// a google contact with an empty gd:postalAddress element
//
TestHarness.prototype.testGoogleContacts5 = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96</id><updated>2008-05-05T21:13:38.158Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>rr rr</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96/1210022018158000'/><gd:email rel='http://schemas.google.com/g/2005#home' address='rr.rr.rr.rr@example.com' primary='true'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>111111</gd:phoneNumber><gd:postalAddress rel='http://schemas.google.com/g/2005#work'></gd:postalAddress></entry>";

	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");
	var contact_converter = this.newContactConverter();
	var a_gd_contact = GdContact.arrayFromXpath(contact_converter, response, "/atom:entry");

	var contact = a_gd_contact[firstKeyInObject(a_gd_contact)];

	this.m_logger.debug("testGoogleContacts5 1: contact: " + contact.toString());
	this.m_logger.debug("testGoogleContacts5 2: contact: " + contact.toStringXml());

	// properties = newObject("PrimaryEmail", "blah@example.com");
	// contact.updateFromProperties(properties);

	contact.removeEmptyPostalElements();

	this.m_logger.debug("testGoogleContacts5 3: contact: " + contact.toString());
	this.m_logger.debug("testGoogleContacts5 4: contact: " + contact.toStringXml());

	return true;
}

TestHarness.prototype.testContactGoogle1 = function()
{
	var xmlString = "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005' gd:etag='&quot;SXo5cTVSLyp7ImA9WxRaE08KRAw.&quot;'><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96</id><updated>2008-05-05T21:13:38.158Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>rr rr</title><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/606f624c0ebd2b96/1210022018158000'/> \
	<gd:email rel='http://schemas.google.com/g/2005#home' address='rr.rr.rr.rr@example.com' primary='true' /> \
	<gd:email rel='http://schemas.google.com/g/2005#home' address='be@example.com' /> \
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>111111</gd:phoneNumber><gd:postalAddress rel='http://schemas.google.com/g/2005#work'>123 acme st</gd:postalAddress><gd:deleted/><gd:organization primary='true' rel='http://schemas.google.com/g/2005#other'><gd:orgName>Bloggs org name</gd:orgName><gd:orgTitle>an org title</gd:orgTitle></gd:organization><gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/></entry>";

	var xml    = new XML(xmlString);
	var nsAtom = Namespace(Xpath.NS_ATOM);
	var b, x, str, key, value, enm, generator, contact, properties;

	// this.m_logger.debug("testContactGoogle: xml: " + xml.toString());

	if (false)
	{
		str = new String(xml.nsAtom::xxx);
		b   = Boolean(xml.nsAtom::ie);
		x   = xml.nsAtom::id;
		this.m_logger.debug("testContactGoogle: xml: " + str + " str.length: " + str.length + " b: " + b + " x.length: " + x.length());
	}

	if (true)
	{
		// contact = new ContactGoogle(xml);
		contact = ContactGoogle.textToContact(xmlString);

		this.m_logger.debug("contact.meta.id: " + contact.meta.id);

		generator = ContactGoogle.eMeta.generator();

		while (Boolean([key, value] = generator.next()))
			this.m_logger.debug("contact.meta." + key + ": " + contact.meta[key]);
	}
	
	if (false)
	{
		contact = new ContactGoogle(xml);
		this.m_logger.debug("contact.properties: " + aToString(contact.properties));
	}

	if (true)
	{
		contact = new ContactGoogle();
		properties = {
			'title' :                'a-title',
			'content' :              'a-content',
			'organization_orgName':  'a-org-name',
			'organization_orgTitle': 'a-org-title',
			'phoneNumber_home':      'a-phone-home',
			'im_AIM':                'a-im-AIM',
			'email1':                'email1@e.com',
			'email2':                'email2@e.com'
		};
		// set all properties
		contact.properties = properties;
		this.m_logger.debug("contact.xml: " + contact.m_entry.toXMLString());
		this.m_logger.debug("contact.properties: " + aToString(contact.properties));
		this.m_logger.debug("properties: " + aToString(properties));
		zinAssert(isMatchObjects(properties, contact.properties));

		// delete some properties
		//
		delete properties['organization_orgName'];
		delete properties['organization_orgTitle'];
		delete properties['im_AIM'];
		delete properties['email2'];
		delete properties['title'];
		// delete properties['phoneNumber_home'];
		properties['phoneNumber_home'] = "";
		contact.properties = properties;
		this.m_logger.debug("contact.xml: " + contact.m_entry.toXMLString());
		if (properties['phoneNumber_home'] == "") delete properties['phoneNumber_home'];
		zinAssertAndLog(isMatchObjects(properties, contact.properties), "\n properties: " + aToString(properties) + "\n contact: " + aToString(contact.properties));
	}

	return true;
}

TestHarness.prototype.testContactGoogle2 = function()
{
	var i, key, meta, groups, new_groups, properties, xmlString, xmlStringEntry;
	var context = this;

	properties = this.sampleContactGoogleProperties();

	meta = newObject("id",      "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
	                 "self",    "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0",
					 "updated", "2008-03-29T20:36:25.343Z",
					 "edit",    "http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0/12068229blah",
					 "deleted", false
					  );

	groups = [ 'group-zero' , 'group-one' ];

	xmlString = "<?xml version='1.0' encoding='UTF-8'?> <feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>username-goes-here@gmail.com</id><updated>2008-03-30T00:33:50.384Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>cvek username-goes-here's Contacts</title><link rel='alternate' type='text/html' href='http://www.google.com/'/><link rel='http://schemas.google.com/g/2005#feed' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base'/><link rel='http://schemas.google.com/g/2005#post' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base'/><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base?max-results=25&amp;showdeleted=true'/><author><name>cvek username-goes-here</name><email>username-goes-here@gmail.com</email></author><generator version='1.0' uri='http://www.google.com/m8/feeds'>Contacts</generator><openSearch:totalResults>6</openSearch:totalResults><openSearch:startIndex>1</openSearch:startIndex><openSearch:itemsPerPage>25</openSearch:itemsPerPage>@@entry@@</feed>";
	xmlStringEntry = "\
	<entry> \
	<id>@@id@@</id> \
	<updated>@@updated@@</updated> \
	<category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/> \
	<title type='text'>@@title@@</title> \
	<content type='text'>@@content@@</content> \
	<link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/username-goes-here%40gmail.com/base/0'/> \
	<link rel='edit' type='application/atom+xml' href='@@edit@@'/>\
	<gd:organization rel='http://schemas.google.com/g/2005#work'>\
		<gd:orgName>@@organization_orgName@@</gd:orgName>\
		<gd:orgTitle>@@organization_orgTitle@@</gd:orgTitle>\
	</gd:organization>\
	<gd:email rel='http://schemas.google.com/g/2005#other' address='@@email1@@' primary='true'/>\
	<gd:email rel='http://schemas.google.com/g/2005#home' address='@@email2@@'/>\
	<gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.2@example.com'/>\
	<gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.other@example.com' />\
	<gd:email rel='http://schemas.google.com/g/2005#work' address='john.smith.work@example.com'/>\
	<gd:im address='@@im_AIM@@' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home_fax'>4-home-fax</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#pager'>@@phoneNumber_pager@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>@@phoneNumber_home@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>3-home</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>@@phoneNumber_mobile@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#work_fax'>@@phoneNumber_work_fax@@</gd:phoneNumber>\
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#work'>@@phoneNumber_work@@</gd:phoneNumber>\
	<gd:postalAddress rel='http://schemas.google.com/g/2005#home'>@@postalAddress_home@@</gd:postalAddress>\
	<gd:postalAddress rel='http://schemas.google.com/g/2005#work'>@@postalAddress_work@@</gd:postalAddress>\
	<gd:postalAddress rel='http://schemas.google.com/g/2005#work'>@@postalAddress_work@@</gd:postalAddress>\
	<gContact:groupMembershipInfo deleted='false' href='@@group-0@@'/>\
	<gContact:groupMembershipInfo deleted='false' href='@@group-1@@'/>\
	<gContact:groupMembershipInfo deleted='true' href='blah1'/>\
	<gContact:groupMembershipInfo deleted='false' />\
	</entry>";

	xmlString = xmlString.replace("@@entry@@", xmlStringEntry);

	for (key in properties)
		xmlString = xmlString.replace("@@" + key + "@@", properties[key]);

	for (i = 0; i < groups.length; i++)
		xmlString = xmlString.replace("@@" + 'group-' + i + "@@", groups[i]);

	for (key in meta)
		xmlString = xmlString.replace("@@" + key + "@@", meta[key]);

	var a_gd_contact = ContactGoogle.textToContacts(xmlString);

	for (var id in a_gd_contact)
		this.m_logger.debug("contact: " + a_gd_contact[id].toString());

	// 1. test that a contact can get parsed out of xml 
	// this.m_logger.debug("testGoogleContacts1: 1. id: " + id + " contact: " + contact.toString());
	zinAssertAndLog(aToLength(a_gd_contact) == 1, "length: " + aToLength(a_gd_contact));

	var id = firstKeyInObject(a_gd_contact);
	var contact = a_gd_contact[id];

	function remove_postal_properties(properties) {
		var ret = cloneObject(properties);
		if ('postalAddress_home' in ret) delete ret['postalAddress_home'];
		if ('postalAddress_work' in ret) delete ret['postalAddress_work'];
		return ret;
	}
	function match(contact, properties, meta) {
		var mode;
		var orig = contact.mode();
		mode = ContactGoogle.ePostal.kEnabled;
		contact.mode(mode); context.matchContactGoogle(contact, properties, meta, mode & ContactGoogle.ePostal.kEnabled);
		mode = ContactGoogle.ePostal.kDisabled;
		contact.mode(mode); context.matchContactGoogle(contact, properties, meta, mode & ContactGoogle.ePostal.kEnabled);
		contact.mode(orig);
	}

	// 2. test that everything was parsed out of the xml correctly with/without postal
	//
	match(contact, properties, meta, true);

	// 3. test that updating with all properties works
	//
	contact.properties = properties;

	match(contact, properties, meta);

	// 3. test that updating with no properties works
	//
	delete properties["content"];
	delete properties["organization_orgName"];
	delete properties["organization_orgTitle"];
	delete properties["phoneNumber_work"];
	delete properties["phoneNumber_home"];
	delete properties["phoneNumber_work_fax"];
	delete properties["phoneNumber_pager"];
	delete properties["phoneNumber_mobile"];
	delete properties["email1"]; // properties["PrimaryEmail"] = "";
	delete properties["email2"];
	delete properties["im_AIM"];

	contact.properties = properties;

	properties["email1"]           = "john.smith.home.2@example.com"; // the first <email> element
	properties["email2"]           = "john.smith.other@example.com";  // the second...
	properties["phoneNumber_home"] = "3-home";
	properties["im_AIM"]           = "aim-im-2";

	match(contact, properties, meta);

	// test modifying a contact
	//
	properties = this.sampleContactGoogleProperties();
	contact.properties = properties;
	match(contact, properties, null);

	// test adding all properties to a new contact
	// 1. with postal enabled
	//
	properties = this.sampleContactGoogleProperties();
	contact = new ContactGoogle();
	contact.mode(ContactGoogle.ePostal.kEnabled);
	contact.properties = properties;
	match(contact, properties, null);

	// 2. with postal disabled
	//
	contact = new ContactGoogle();
	contact.mode(ContactGoogle.ePostal.kDisabled);
	contact.properties = properties;
	for (var key in properties)
		if (/postalAddress.*$/.test(key))
			delete properties[key];
	match(contact, properties, null);

	// test creating a contact without a title and with an empty field (email address)
	//
	properties = newObject("content", "1-content", "organization_orgName", "2-organization_orgName", "email1", "");
	contact.properties = properties;
	delete properties["email1"];
	this.matchContactGoogle(contact, properties, null);

	// test postalAddressRemoveEmptyElements()
	//
	a_gd_contact = ContactGoogle.textToContacts(xmlString);
	id = firstKeyInObject(a_gd_contact);
	contact = a_gd_contact[id];

	contact.m_entry.* += <gd:postalAddress xmlns:gd={Xpath.NS_GD} rel="http://schemas.google.com/g/2005#work"></gd:postalAddress>
	this.m_logger.debug("testGoogleContacts1: 6.1. contact: " + contact.m_entry.toXMLString());
	var length  = contact.m_entry.postalAddress.length();

	contact.postalAddressRemoveEmptyElements();
	this.m_logger.debug("testGoogleContacts1: 6.2. contact: " + contact.m_entry.toXMLString());
	zinAssert(length == contact.m_entry.postalAddress.length());

	// test groups
	//
	function match_groups(groups, contact) {
		var i;

		for (i = 0; i < groups.length; i++)
			zinAssert(groups[i] == contact.groups[i]);

		for (i = 0; i < contact.groups.length; i++)
			zinAssert(groups[i] == contact.groups[i]);
	}

	// test getter
	//
	match_groups(groups, contact);
	this.m_logger.debug("contact groups: " + contact.groups.toString());

	// test setter #1
	//
	new_groups = [ 'a', 'b', 'c' ];
	contact.groups = new_groups;
	match_groups(new_groups, contact);
	this.m_logger.debug("contact groups: " + contact.groups.toString());

	// test setter #2
	//
	new_groups = [ ];
	contact.groups = new_groups;
	match_groups(new_groups, contact);
	this.m_logger.debug("contact groups: " + contact.groups.toString());

	// test that a <gd:organization> without a rel attribute is ignored
	//
	var xmlStringTwo = xmlString.replace("organization rel='http://schemas.google.com/g/2005#work'", 
	                                     "organization ");
	a_gd_contact = ContactGoogle.textToContacts(xmlStringTwo);
	id = firstKeyInObject(a_gd_contact);
	contact = a_gd_contact[id];
	this.m_logger.debug("contact: AMHEREXX: " + contact.toString()); // TODO remove me
	zinAssert(!('organization_orgTitle' in contact.properties));
	zinAssert(!('organization_orgName'  in contact.properties));

	return true;
}

TestHarness.prototype.testContactGoogleIssue179 = function()
{
	var xmlStringEntry = "\
	<?xml version='1.0' encoding='UTF-8'?><entry xmlns='http://www.w3.org/2005/Atom' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'> \
	<id>http://www.google.com/m8/feeds/contacts/example%40googlemail.com/base/d</id> \
	<updated>2009-02-05T13:22:07.967Z</updated> \
	<category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/> \
	<title>BTW</title><content>some content here </content> \
	 <link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/example%40googlemail.com/thin/d'/> \
	 <link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/example%40googlemail.com/thin/d'/> \
	 <gd:organization rel='http://schemas.google.com/g/2005#other'> \
	 	<gd:orgName>aa1</gd:orgName> \
		<gd:orgTitle>aa2</gd:orgTitle> \
	</gd:organization> \
	<gd:organization rel='http://schemas.google.com/g/2005#other'> \
		<gd:orgName>bb1</gd:orgName> \
		<gd:orgTitle>bb2</gd:orgTitle> \
	</gd:organization> \
	<gd:organization rel='http://schemas.google.com/g/2005#other'> \
		<gd:orgTitle>cc1</gd:orgTitle> \
	</gd:organization> \
	<gd:email rel='http://schemas.google.com/g/2005#other' address='btw@example.com' primary='true'/> \
	<gd:email rel='http://schemas.google.com/g/2005#other' address='btw@example.com'/> \
	<gd:phoneNumber label='work mobile'>123456789</gd:phoneNumber> \
	<gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>123456789</gd:phoneNumber> \
	<gd:postalAddress rel='http://schemas.google.com/g/2005#work'>xxxxx</gd:postalAddress> \
	<gd:postalAddress rel='http://schemas.google.com/g/2005#home'>lskjdflkjsdflkjsdf </gd:postalAddress> \
	<gContact:groupMembershipInfo deleted='false' href='http://www.google.com/m8/feeds/groups/example%40googlemail.com/base/6'/> \
	</entry>";

	let contact = ContactGoogle.textToContact(xmlStringEntry);

	this.m_logger.debug("contact: " + contact.toString());

	return true;
}

TestHarness.prototype.testContactGoogleIterators = function()
{
	var cgei = new ContactGoogleEmailIterator();
	var a_keys;
	
	function setup(entry) {
		var a_keys = new Object();
		var key, value;

		cgei.iterator(entry);

		for ( [ key, value ] in cgei)
		{
			a_keys[key] = value;
			logger().debug("cgei: a_keys: key: " + key + " value: " + value.toXMLString());
		}

		return a_keys;
	}

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' /><email address='y' /><email address='z' /></entry>);
	zinAssert(a_keys['email1'].@address == 'x' && a_keys['email2'].@address == 'y');

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' primary='true' /><email address='y' /><email address='z' /></entry>);
	zinAssert(a_keys['email1'].@address == 'x' && a_keys['email2'].@address == 'y');

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' /><email address='y' primary='true' /><email address='z' /></entry>);
	zinAssert(a_keys['email1'].@address == 'y' && a_keys['email2'].@address == 'x');

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' /><email address='y' /><email address='z' primary='true' /></entry>);
	zinAssert(a_keys['email1'].@address == 'z' && a_keys['email2'].@address == 'x' && aToLength(a_keys) == 2);

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' /></entry>);
	zinAssert(a_keys['email1'].@address == 'x');

	a_keys = setup( <entry xmlns={Xpath.NS_GD}><email address='x' primary='true' /></entry>);
	zinAssert(a_keys['email1'].@address == 'x');

	a_keys = setup( <entry xmlns={Xpath.NS_GD}></entry>);
	zinAssert(aToLength(a_keys) == 0);

	var cgopi = new ContactGoogleOrderedPropertyIterator();
	var key, i;

	i = 1;
	for (key in cgopi.iterator(newObjectWithKeys('email2', 'email1')))
		zinAssertAndLog(key == ('email' + i++), "key: " + key);

	i = 1;
	for (key in cgopi.iterator(newObjectWithKeys('email1', 'email2')))
		zinAssertAndLog(key == ('email' + i++), "key: " + key);

	return true;
}

TestHarness.prototype.testBiMap = function()
{
	var bimap = new BiMap(
		[ 'a',  'b', 'c' ],
		[  1,    2,   3   ]);

	zinAssert(bimap.lookup('a', null) == 1);
	zinAssert(bimap.lookup('b', null) == 2);
	zinAssert(bimap.lookup('c', null) == 3);
	zinAssert(bimap.lookup(null, 1) == 'a');
	zinAssert(bimap.lookup(null, 2) == 'b');
	zinAssert(bimap.lookup(null, 3) == 'c');
	zinAssert(bimap.isPresent(null, 3));
	zinAssert(bimap.isPresent('a', null));
	zinAssert(bimap.isPresent('b', null));

	this.m_logger.debug("testBiMap: done.");

	return true;
}
TestHarness.prototype.testZinEnum = function()
{
	var enm1, enm2, generator, key, value;

	enm1      = new ZinEnum( 'a', 'b', 'c' );
	enm2      = new ZinEnum( { 'x' : 11, 'y' : 22, 'z': 33 } );
	generator = enm1.generator();

	while (Boolean([key, value] = generator.next()))
		this.m_logger.debug("generator: key: " + key);

	for (value in enm1) {
		this.m_logger.debug("enm1: for: value: " + value);
		zinAssertAndLog(enm1.isPresent(value), value);
	}

	for (value in enm2) {
		this.m_logger.debug("enm2: for: value: " + value);
		zinAssertAndLog(enm2.isPresent(value), value);
	}

	for each ([key, value] in enm1) {
		this.m_logger.debug("enm1: for: value: " + value);
		zinAssertAndLog(enm1.isPresent(value), value);
	}
	for each ([key, value] in enm2) {
		this.m_logger.debug("enm2: for: value: " + value);
		zinAssertAndLog(enm2.isPresent(value), value);
	}

	return true;
}

TestHarness.prototype.testGdAddressConverter = function()
{
	var xml_as_entity, xml_as_char, xml_as_char2;
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

	// this.m_logger.debug("testGdAddressConverter: out[x]: " + out['x']);

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
		<gd:im address='@@im#AIM@@' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/>\
		</entry>";

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

TestHarness.prototype.testContactGooglePostalAddress = function()
{
	var contact_converter = this.newContactConverter(ContactConverter.VARY_INCLUDE_GD_POSTAL_ADDRESS);
	var contact, properties, tb_properties, gd_properties;
	var context = this;

	function new_contact(str) {
		return ContactGoogle.textToContact(context.m_entry_as_xml_char.replace("@@postal@@", str ), ContactGoogle.ePostal.kEnabled);
	}

	this.m_logger.debug("testContactGooglePostalAddress: start");
	this.setupFixtureGdPostalAddress();

	// test isAnyPostalAddressInXml()
	//
	properties = this.sampleContactGoogleProperties();
	contact = new ContactGoogle();
	contact.mode(ContactGoogle.ePostal.kEnabled);
	contact.properties = properties;
	zinAssert(contact.isAnyPostalAddressInXml());

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", test a contact can be created with an empty <gd:postalAddress> element - Issue #83
	//
	contact = new_contact("");

	zinAssert(!contact.isAnyPostalAddressInXml());

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should preverse <otheraddr>
	//
	contact = new_contact(this.m_address_as_xml_entity);

	zinAssert(contact.isAnyPostalAddressInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);

	tb_properties["HomeAddress2"] = this.m_street2;

	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);

	contact.properties = gd_properties;
	// this.m_logger.debug("contact after update: " + contact.toString());
	zinAssert(contact.postalAddressOtherAddr("postalAddress_home") == this.m_otheraddr);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	zinAssert(tb_properties["HomeAddress2"] == this.m_street2);

	// repeat the above but use characters that require CER translation to be valid XML
	//
	this.m_street2 = 'Hello <less >greater &ampersand "quote';
	tb_properties["HomeAddress2"] = this.m_street2;
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	// this.m_logger.debug("blah: gd_properties: " + aToString(gd_properties));

	contact.properties = gd_properties;

	// this.m_logger.debug("blah: contact after update: " + contact.toString());

	zinAssert(contact.postalAddressOtherAddr("postalAddress_home") == this.m_otheraddr);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	zinAssert(tb_properties["HomeAddress2"] == this.m_street2);

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact with an address field should xmlify the Google contact
	// 
	this.setupFixtureGdPostalAddress();

	contact = new_contact(this.m_otheraddr);
	zinAssert(!contact.isAnyPostalAddressInXml());

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	tb_properties["HomeAddress2"] = this.m_street2;
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	this.m_logger.debug("testing xmlify");
	this.m_logger.debug("tb_properties:  " + aToString(tb_properties));
	this.m_logger.debug("gd_properties:  " + aToString(gd_properties));
	this.m_logger.debug("contact before update: " + contact.toString());
	contact.properties = gd_properties;
	zinAssert(contact.postalAddressOtherAddr("postalAddress_home") == this.m_otheraddr);
	var tb_properties_2 = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	this.m_logger.debug("contact after update: " + contact.toString());
	this.m_logger.debug("tb_properties_2:  " + aToString(tb_properties_2));
	zinAssert(isMatchObjects(tb_properties, tb_properties_2));


	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", adding postal fields to a contact should xmlify postalAddress inside the contact
	// 
	this.setupFixtureGdPostalAddress();

	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact = ContactGoogle.textToContact(context.m_entry_as_xml_char.replace("@@postal@@", "" ), ContactGoogle.ePostal.kDisabled);
	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact.properties = gd_properties;
	this.m_logger.debug("contact with no postal: " + contact.toString());
	contact.mode(ContactGoogle.ePostal.kEnabled);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	tb_properties["HomeAddress2"] = this.m_street2;
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	// this.m_logger.debug("testing xmlify on add");
	// this.m_logger.debug("tb_properties:  " + aToString(tb_properties));
	// this.m_logger.debug("gd_properties:  " + aToString(gd_properties));
	// this.m_logger.debug("contact before add: " + contact.toString());
	contact.properties = gd_properties;
	var tb_properties_2 = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	// this.m_logger.debug("contact after add: " + contact.toString());
	// this.m_logger.debug("tb_properties_2:  " + aToString(tb_properties_2));
	zinAssert(isMatchObjects(tb_properties, tb_properties_2));

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", updating the contact (no address field) should xmlify the plain-text
	// into the <otheraddr> element
	// 
	this.setupFixtureGdPostalAddress();

	contact = new_contact(this.m_otheraddr);

	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	gd_properties = contact_converter.convert(FORMAT_GD, FORMAT_TB, tb_properties);
	contact.properties = gd_properties;
	// this.m_logger.debug("contact.postalAddressOtherAddr: " + contact.postalAddressOtherAddr("postalAddress_home"));
	zinAssert(contact.postalAddressOtherAddr("postalAddress_home") == this.m_otheraddr);

	// When GENERAL_GD_SYNC_POSTAL_ADDRESS == "true", test creating and matching a contact from xml that contains entities
	// 
	var entity_str = " &amp;lt;fred&amp;gt; ";
	var xml_with_entity_str = this.m_address_as_xml_entity.replace(this.m_street1, entity_str);
	contact = new_contact(xml_with_entity_str);
	tb_properties = contact_converter.convert(FORMAT_TB, FORMAT_GD, contact.properties);
	zinAssert(tb_properties["HomeAddress"] == zinTrim(convertCER(entity_str, CER_TO_CHAR)));

	// test addWhitespaceToPostalProperties
	//
	if (false)
	{
	contact = new_contact(this.m_address_as_xml_entity);
	zinAssert(contact.isAnyPostalAddressInXml());
	gd_properties = cloneObject(contact.properties);
	// this.m_logger.debug("addWhitespaceToPostalProperties: before: " + aToString(gd_properties));
	var properties_with_postal_whitespace = ContactGoogle.addWhitespaceToPostalProperties(gd_properties);
	this.m_logger.debug("addWhitespaceToPostalProperties: after: " + aToString(properties_with_postal_whitespace));
	zinAssert(new RegExp(' ' + this.m_street1 + ' ').test(properties_with_postal_whitespace['postalAddress_home']))
	zinAssert(gd_properties['email1'] == properties_with_postal_whitespace['email1']);
	}

	this.m_logger.debug("testContactGooglePostalAddress: end");

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
	a_prefset.push({ parent: PrefSet.GENERAL, properties: PrefSet.GENERAL_AS_PROPERTIES, id: null });
	a_prefset.push({ parent: PrefSet.GENERAL, properties: PrefSet.GENERAL_GD_PROPERTIES, id: null });

	var a_preauth = prefs.getImmediateChildren(prefs.branch(), PrefSet.PREAUTH + '.');

	for (j = 0; j < a_preauth.length; j++)
		a_prefset.push({ parent: PrefSet.PREAUTH, properties: PrefSet.PREAUTH_PROPERTIES, id: a_preauth[j] });

	for (i = 0; i < a_prefset.length; i++)
	{
		prefset = new PrefSet(a_prefset[i].parent, a_prefset[i].properties);
		prefset.load(a_prefset[i].id, prefs.defaultbranch());

		// this.m_logger.debug("prefset: " + a_prefset[i].parent + " is: " + prefset.toString());

		for (j = 0; j < a_prefset[i].properties.length; j++)
		{
			key = a_prefset[i].properties[j];
			zinAssertAndLog(prefset.getProperty(key), "parent: " + a_prefset[i].parent + " key: " + key);
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
		var zab = AddressBook.new();
		zab.populateNameToUriMap();
		var rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
		var dir = rdf.GetResource(uri).QueryInterface(Ci.nsIAbDirectory);

		this.m_logger.debug("created addressbook name: " + name + " uri: " + uri + " typeof: " + typeof(uri));
		this.m_logger.debug("abProps.prefName: " + abProps.prefName);
		this.m_logger.debug("dirPrefId: " + dir.dirPrefId);
	}
}

TestHarness.prototype.testStringBundleContainsContactProperties = function()
{
	var properties = {};
	var contact_converter = this.newContactConverter();

	for (key in contact_converter.m_common_to[FORMAT_TB][FORMAT_GD])
		zinAssertAndLog(stringBundleString("cc." + key).length > 0, "unable to load string for key: " + key);

	return true;
}

TestHarness.prototype.addCardTb2 = function(properties, uri)
{
	// this.m_logger.debug("testAddCard");

	if (!uri)
		uri = "moz-abmdbdirectory://abook.mab";

	var dir    = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService).GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
	var abCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance().QueryInterface(Components.interfaces.nsIAbCard);
	abCard = dir.addCard(abCard);

	if (typeof(properties) == 'undefined')
		properties = { PrimaryEmail: "111-test@example.com", DisplayName: "111 test" };
	
	for (var key in properties)
		abCard.setCardValue(key, properties[key]);

	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
	mdbCard.editCardToDatabase(uri);

	return mdbCard;
}

TestHarness.prototype.createGoogleRuleViolation = function()
{
	this.m_logger.debug("createGoogleRule");

	this.addCardTb2({ FirstName: "John", LastName: "Smith" }); // creates an contact that's empty in Google's eyes
	this.addCardTb2({ PrimaryEmail: "111-test@example.com", DisplayName: "111 test", Notes: "111-test line one\r\nline two" });
	this.addCardTb2({ PrimaryEmail: "111-test@example.com", DisplayName: "111 test", Notes: "111-test line one\r\nline two" });
	this.addCardTb2({ PrimaryEmail: "222-test@example.com", DisplayName: "222 test", Notes: "222-test line one\nline two" });
	this.addCardTb2({ PrimaryEmail: "222-test@example.com", DisplayName: "222 test", Notes: "222-test line one\nline two" });

	return true;
}
TestHarness.prototype.testAddCard = function()
{
	this.m_logger.debug("testAddCard");

	this.addCardTb2();

	return true;
}

TestHarness.prototype.testDeleteCard = function()
{
	this.m_logger.debug("test delete card");

	var uri    = "moz-abmdbdirectory://abook.mab";
	var dir    = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService).GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);

	var mdbCard = this.addCardTb2();

	// now we've got a card - try to delete it

	if (false)
	try {
		var cardsArray = { };
		dir.deleteCards(cardsArray);
	} catch(ex) {
		// do nothing
		this.m_logger.debug("Error.name: " + ex.name);
	}
	else
	{
		// workaround...
		//
		if (false)
		{
	var stopwatch = new StopWatch("new/delete addressbook");

	stopwatch.mark("start: ");
		var addressbook = AddressBook.new();
		var name = "delete-cards-test-addressbook";
		var abip = addressbook.newAddressBook(name);
		addressbook.deleteAddressBook(abip.uri());
	stopwatch.mark("end: ");
		}

		var addressbook = AddressBook.new();
		addressbook.deleteCards(uri, [ mdbCard ]);
		if (false)
		{
		var cardsArray = Cc["@mozilla.org/supports-array;1"].createInstance().QueryInterface(Ci.nsISupportsArray);

		cardsArray.AppendElement(mdbCard);

		var error_name = null;
		try {
			dir.deleteCards(cardsArray);
		} catch(ex) {
			this.m_logger.debug("Error.name: " + ex.name);
			error_name = ex.name;
		}

		if (error_name == "NS_ERROR_INVALID_POINTER")
		{
			addressbook = AddressBook.new();
			var abip = addressbook.newAddressBook("delete-cards-test-addressbook");
			addressbook.deleteAddressBook(abip.uri());

			dir.deleteCards(cardsArray);

			this.m_logger.debug("Recovered and deleted the card");
		}
		}

	}

	return true;
}

TestHarness.prototype.testFileLoggingTimes = function()
{
	var log_appender = new LogAppenderHoldOpen();
	var logger       = new Logger(singleton().logger().level(), "TestHarnessTimer", log_appender);
	var msg          = " 123456789 123456789 123456789 123456789 123456789 123456789";
	var lines        = 8683;
	var i, a;

	if (false)
	{
	this.testFileLoggingTimeOutput(logger, lines, msg);

	var msg2 = "";

	for (i = 1; i <= 10; i++)
		msg2 += msg;

	this.testFileLoggingTimeOutput(logger, lines/10, msg2);
	}

	// test #3 - build a LIFO buffer and output when it's full
	//
	var stopwatch = new StopWatch("logging stopwatch");

	stopwatch.mark("start: lines: " + lines + " line length: " + msg.length + " via arrayx");

	for (i = 0; i < lines/10; i++)
	{
		a = new Array();
	
		for (j = 1; j <= 10; j++)
		{
			a.push(msg);
			a.push("\n");
		}

		logger.debug(a.toString());
	}
	stopwatch.mark("end");

	// test #4 - as above but use concat()
	//
	var stopwatch = new StopWatch("logging stopwatch");

	stopwatch.mark("start: lines: " + lines + " line length: " + msg.length + " via concat");

	for (i = 0; i < lines/10; i++)
	{
		logger.debug("".concat(msg, msg, msg, msg, msg, msg, msg, msg, msg, msg));
	}
	stopwatch.mark("end");

	// test #5 - as per 3 but use concat and apply()
	//
	var stopwatch = new StopWatch("logging stopwatch");

	stopwatch.mark("start: lines: " + lines + " line length: " + msg.length + " via array and concat and apply");

	for (i = 0; i < lines/10; i++)
	{
		a = new Array();
	
		for (j = 1; j <= 10; j++)
			a.push(msg);

		logger.debug(String.prototype.concat.apply("", a));
	}
	stopwatch.mark("end");

	return true;
}

TestHarness.prototype.testFileLoggingTimeOutput = function(logger, lines, msg)
{
	var stopwatch = new StopWatch("logging stopwatch");

	stopwatch.mark("start: lines: " + lines + " line length: " + msg.length);

	for (var i = 0; i < lines; i++)
		logger.debug(msg);

	stopwatch.mark("end");
}

TestHarness.prototype.testStringTimes = function()
{
	var count = 10000;
	var i, j;
	var x = " 123456789";
	var stopwatch = new StopWatch("logging stopwatch");

	stopwatch.mark("start: using '+': count: " + count);

	for (i = 1; i <= count; i++)
	{
		msg = "";

		for (j = 1; j <= 10; j++)
			msg += x;
	}
	
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: build an array, then use concat: count: " + count);

	for (i = 1; i <= count; i++)
	{
		var a = new Array();

		for (j = 1; j <= 10; j++)
			a.push(x);

		msg = String.prototype.concat.apply("", a);
	}
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: zinAssert " + count);
	for (i = 1; i <= count; i++)
		zinAssert(true);
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: zinAssertAndLog with x+y strings" + count);
	for (i = 1; i <= count; i++)
		zinAssertAndLog(true, "" + msg + "lkjsdf" + msg + "lkjsdflkj");
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: zinAssertAndLog with a function" + count);
	for (i = 1; i <= count; i++)
		zinAssertAndLog(true, function() {"" + msg });
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: bimap" + count);
	var bimap = getBimapFormat('short');
	for (i = 1; i <= count; i++)
		bimap.lookup(FORMAT_TB, null)
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: concat" + count);
	var str = " gid: 449 loser: 2 gcs: winner: 1 state: win - winner matches gid - no change";
	msg = ""
	for (i = 0; i < count; i++)
		msg += str + "\n";
	this.m_logger.debug(msg);
	stopwatch.mark("end");

	stopwatch.reset();
	stopwatch.mark("start: array" + count);
	var str = " gid: 449 loser: 2 gcs: winner: 1 state: win - winner matches gid - no change";
	var a = new Array();
	msg = ""
	for (i = 0; i < count; i++)
		a.push(i);
	this.m_logger.debug(str + a.toString());
	stopwatch.mark("end");

	return true;
}

TestHarness.prototype.tweakLuidOnCard = function()
{
	var addressbook = AddressBook.new();
	var contact_converter = this.newContactConverter();
	addressbook.contact_converter(contact_converter);

	var uri  = "moz-abmdbdirectory://abook-10.mab";
	var luid = "501"; // aa@example.com
	var newluid = "260";

	var abCard = addressbook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

	zinAssert(abCard);

	this.m_logger.debug("abCard before: "  + addressbook.nsIAbCardToPrintableVerbose(abCard));

	var mdbCard = abCard.QueryInterface(Components.interfaces.nsIAbMDBCard);

	addressbook.setCardAttributes(abCard, uri, newObject(TBCARD_ATTRIBUTE_LUID, newluid));

	mdbCard.editCardToDatabase(uri);

	this.m_logger.debug("abCard after: "  + addressbook.nsIAbCardToPrintableVerbose(abCard));

	return true;
}

TestHarness.prototype.testExitStatusMessages = function()
{
	var data_store_map = stringBundleString("text.file.bug", [ BUG_REPORT_URI ]) +
	                     stringBundleString("status.failon.integrity.data.store.detail") +
	                     stringBundleString("text.suggest.reset");

	var a = {
		'failon.service'                      : { 'trailer': stringBundleString("status.failon.service.detail")    },
		'failon.fault'                        : { 'trailer': stringBundleString("text.zm.soap.method", [ "Auth" ]) },
		'failon.cancel'                       : { 'trailer': stringBundleString("status.failon.cancel.detail")     },
		'failon.integrity.zm.bad.credentials' : {},
		'failon.integrity.gd.bad.credentials' : {},
		'failon.integrity.data.store.in'      : { 'trailer': stringBundleString("text.suggest.reset")              },
		'failon.integrity.data.store.out'     : { 'trailer': stringBundleString("text.file.bug", [ BUG_REPORT_URI ]) },
		'failon.integrity.data.store.map'     : { 'trailer': data_store_map },
		'failon.unexpected'                   : { 'trailer': stringBundleString("text.file.bug", [ BUG_REPORT_URI ]) },
		'failon.folder.name.empty'            : { },
		'failon.folder.name.duplicate'        : { 'arg':    [ 'fred' ] },
		'failon.folder.name.reserved'         : { 'arg':    [ 'fred' ] },
		'failon.folder.name.invalid'          : { 'arg':    [ 'fred' ] },
		'failon.folder.must.be.present'       : { 'arg':    [ 'fred' ] },
		'failon.folder.reserved.changed'      : { 'trailer': stringBundleString("text.suggest.reset"), 'arg':    [ 'fred' ] },
		'failon.folder.name.clash'            : { 'arg':    [ 'fred' ] },
		'failon.folder.source.update'         : { 'trailer': stringBundleString("text.suggest.reset"), 'arg':    [ 'fred' ] },
		'failon.folder.cant.create.shared'    : { 'arg':    [ 'fred' ] },
		'failon.unable.to.update.server'      : { 'trailer': stringBundleString("text.zm.soap.method", [ "Auth: some args" ]) },
		'failon.unable.to.update.thunderbird' : { 'trailer': stringBundleString("status.failon.unable.to.update.thunderbird.detail1",
		                                                     [ 'fred' ]) },
		'failon.no.xpath'                     : {},
		'failon.no.tbpre'                     : {},
		'failon.no.pab'                       : { 'trailer': stringBundleString("text.file.bug", [ BUG_REPORT_URI ]) },
		'failon.multiple.ln'                  : { 'trailer': 'address book names go here' },
		'failon.gd.forbidden'                 : {},
		'failon.gd.syncwith'                  : { 'trailer': stringBundleString("text.suggest.reset"), 'arg':    [ 'fred' ] },
		'failon.zm.empty.contact'             : { 'arg':    [ 'fred' ] },
		'failon.unauthorized'                 : { },
		'failon.auth':  { 'trailer': stringBundleString("text.http.status.code", [ 403 ])     },
		'': {}
	};

	var es = new SyncFsmExitStatus();

	for (var failcode in a)
		if (failcode.length > 0)
		{
			es.failcode(failcode);

			if (isPropertyPresent(a[failcode], 'trailer'))
				es.m_fail_trailer = a[failcode].trailer;

			if (isPropertyPresent(a[failcode], 'arg'))
				es.m_fail_arg = a[failcode].arg;

			this.m_logger.debug("testExitStatusMessages: failcode: " + failcode + " message:\n" +
		                     	es.asMessage("cs.sync.succeeded", "cs.sync.failed"));
		}
		
	return true;
}

TestHarness.prototype.testRenameAddressBook = function()
{
	var addressbook = AddressBook.new();
	var abName      = "test-rename-1";
	var abNameNew   = "test-rename-1-new";

	// var abip = addressbook.newAddressBook(abName);
	// uri = abip.m_uri
	// this.m_logger.debug("testRenameAddressBook: abName: " + abName + " uri: " + uri);

	uri = addressbook.getAddressBookUriByName(abName)
	addressbook.renameAddressBook(uri, abNameNew);
	uri = addressbook.getAddressBookUriByName(abNameNew)

	this.m_logger.debug("testRenameAddressBook: abNameNew: " + abNameNew + " uri: " + uri);

	return true;
}

TestHarness.prototype.testGoogleContactWithe4x = function()
{
	this.setupFixtureGdPostalAddress();

	this.m_logger.debug("is_email_address_in_entry: returns: " +
	                       GdContact.is_email_address_in_entry('77@example.com', this.m_entry_as_xml_char));

	return true;
}

TestHarness.prototype.createBigAddressbooks = function()
{
	var name, abip, i;
	var addressbook = AddressBook.new();

	this.m_logger.debug("createBigAddressbooks");

	for (i = 0; i < this.m_a_books.length; i++)
	{
		name = "test-" + this.m_a_books[i];
		abip = addressbook.newAddressBook(name);

		this.createLotsOfContacts(abip.uri(), this.m_a_books[i]);
	}

	return true;
}

TestHarness.prototype.testPerformanceCardLookup = function()
{
	var addressbook = AddressBook.new();
	var contact_converter = this.newContactConverter();
	addressbook.contact_converter(contact_converter);
	var aUri = new Object();
	var stopwatch = new StopWatch("testPerformanceCardLookup");
	var i, j, count, uri, generator, key, value, abCard;

	this.m_logger.debug("testPerformanceCardLookup");

	for (j = 0; j < this.m_a_books.length; j++)
	{
		name = "test-" + this.m_a_books[j];
		aUri[name] = addressbook.getAddressBookUriByName(name);
		uri       = aUri[name];
		count     = 0;

		stopwatch.reset();
		stopwatch.mark("name: " + name + " starts");
		this.m_logger.debug("testPerformanceCardLookup: name: " + name + " uri: " + uri);
		key    = 'Notes';

		for (i = 1000; i<= 1000+this.m_a_books[j]; i++)
		{
			// value  = i + "-test@example.com"; // PrimaryEmail

			value  = i + "-test-line-one";    // Notes
			abCard = addressbook.lookupCard(uri, key, value);

			value = addressbook.nsIAbCardToPrintableVerbose(abCard);

			this.m_logger.debug("value: "  + value);

			count++;

			zinAssertAndLog(abCard, i);
		}

		stopwatch.mark("name: " + name + " ends count: " + count);
	}

	return true;
}

TestHarness.prototype.createLotsOfContacts = function(uri, num)
{
	var properties = { };

	this.m_logger.debug("createLotsOfContacts: uri: " + uri + " num: " + num);

	for (var i = 1000; i<= 1000+num; i++)
	{
		properties['PrimaryEmail'] = i + "-test@example.com";
		properties['DisplayName'] = i + "-test-display";
		properties['Notes'] = i + "-test-line-one";

		this.addCardTb2(properties, uri);
	}

	return true;
}

TestHarness.prototype.testPerformanceZfcSet = function()
{
	var stopwatch = new StopWatch("testPerformanceZfcSet");
	var max = 12000;
	var msg = "";
	var last = 0;
	var i;

	var zfc = new FeedCollection();
	var zfi;

	for (i = 0; i < max; i++)
	{
		zfi = new FeedItem();
		zfi.set(FeedItem.ATTR_KEY, i);
		zfi.set('name1', "value1");

		zfc.set(zfi);

		if (zfc.isPresent(i))
			; // do nothing

		if (i % 1000 == 0)
		{
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	return true;
}

TestHarness.prototype.testPerformanceStringConcat = function()
{
	var stopwatch = new StopWatch("testPerformanceStringConcat");
	var max = 10000;
	var msg = "";
	var snippet = " hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string ";
	var i, last;

	last = 0;

	for (i = 0; i < max; i++)
	{
		msg += snippet;
		
		if (i % 1000 == 0)
		{
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	last = 0;
	stopwatch.reset();
	var bs = new BigString();

	for (i = 0; i < max; i++)
	{
		bs.concat(snippet);
		
		if (i % 1000 == 0)
		{
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	this.m_logger.debug("testPerformanceStringConcat: msg.length: " + msg.length + " bs.length: " + bs.toString().length);

	last = 0;
	stopwatch.reset();
	var a = new Array();
	msg = "";

	for (i = 0; i <= max; i++)
	{
		a.push(snippet);
		
		if (i % 1000 == 0)
		{
			msg += String.prototype.concat.apply("", a);
			a = new Array();
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	this.m_logger.debug("testPerformanceStringConcat: msg.length: " + msg.length);

	return true;
}

TestHarness.prototype.testPerformanceLoggingStyles = function()
{
	var max = 40000; // 250 chars in snippet * 40000 == 10Mb
	var msg = "";
	var snippet = " hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string hello world lets make this a whole string ";
	var i, last, stopwatch;

	if (false)
	{
	stopwatch = new StopWatch("test #1");
	stopwatch.mark("starts: make one big string then log it: " + (stopwatch.elapsed() - last)); last = stopwatch.elapsed();
	let bs = new BigString();
	last = 0;

	for (i = 0; i <= max; i++)
	{
		bs.concat(snippet);
		
		if (i % 1000 == 0)
		{
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	stopwatch.mark("before logger.debug: " + (stopwatch.elapsed() - last));
	let str = bs.toString();
	this.m_logger.debug(str);
	stopwatch.mark("ends: after logger.debug: " + (stopwatch.elapsed() - last));
	}

	// test #2
	if (true)
	{
	stopwatch = new StopWatch("test #2");
	stopwatch.mark("starts: log via LogAppenderHoldOpen: " + (stopwatch.elapsed() - last)); last = stopwatch.elapsed();
	last = 0;

	// this class has been removed: var appender = new LogAppenderHoldOpenAndBuffer()
	var appender = new LogAppenderHoldOpen()
	var buflogger = new Logger(singleton().logger().level(), "testPerformanceLoggingStyles", appender);

	stopwatch.mark("before loop with buflogger: " + (stopwatch.elapsed() - last)); last = stopwatch.elapsed();

	for (i = 0; i <= max; i++)
	{
		buflogger.debug(snippet);
		
		if (i % 1000 == 0)
		{
			stopwatch.mark(i + " " + (stopwatch.elapsed() - last));
			last = stopwatch.elapsed();
		}
	}

	stopwatch.mark("ends: after loop with buflogger: " + (stopwatch.elapsed() - last)); last = stopwatch.elapsed();
	}

	return true;
}

TestHarness.prototype.testTb3CardUuid = function()
{
	this.m_logger.debug("testTb3CardUuid");

	var addressbook = AddressBook.new();
	var contact_converter = this.newContactConverter();
	var name        = "test-tb3-card-uuid";
	var abip        = addressbook.newAddressBook(name);
	var uri         = abip.uri();
	var properties  = new Object();
	var attributes  = new Object();

	addressbook.contact_converter(contact_converter);

	var i = 333;

	properties['PrimaryEmail'] = i + "-test@example.com";
	properties['DisplayName'] = i + "-test-display";
	// properties['Notes'] = i + "-test-line-one";
	properties['Notes'] = "american frame \
	lanscape hole =  9 3/4  x     7 3/4         $17.26\n\
	                 frame ^V 1/2  x    14.1/2\n\
\n\
					 portrait     hole   = 7 1/4  x    10        $16.79\n\
					                  frame  = 14       x    16 3/4";

	properties['JobTitle'] = "JobTitle";
	properties['Company'] = "Company";

	properties = this.sampleContactGoogleProperties();
	contact = new ContactGoogle();
	contact.mode(ContactGoogle.ePostal.kEnabled);
	contact.properties = properties;

	// for (var i in Components.interfaces)
	//	this.m_logger.debug(i);

	var abCard = addressbook.addCard(uri, contact.properties, attributes);
	// var mdbCard = abCard.QueryInterface(Ci.nsIAbMDBCard);
	// var mdbCard = abCard.QueryInterface(Ci.nsAbMDBCard);
	// var dbRowID = mdbCard.getProperty("DBRowID", null);
	var db = addressbook.nsIAddrDatabase(uri)
	var dbRowID = db.getCardValue(abCard, "dbRowID");

	this.m_logger.debug("dbRowID: " + dbRowID);

	return true;
}

