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

include("chrome://zindus/content/feed.js");
include("chrome://zindus/content/lso.js");

function ZinTestHarness()
{
	this.m_logger = newZinLogger("ZinTestHarness");
}

ZinTestHarness.prototype.run = function()
{
	var ret = true;

	// ret = ret && this.testCrc32();
	// ret = ret && this.testLookupCard();
	// ret = ret && this.testLogging();
	// ret = ret && this.testZinFeedCollection();
	// ret = ret && this.testFilesystem();
	// ret = ret && this.testPropertyDelete();
	// ret = ret && this.testLso();
	// ret = ret && this.testContactConverter();
	ret = ret && this.testFolderConverter();

	this.m_logger.debug("test(s) " + (ret ? "succeeded" : "failed"));
}

ZinTestHarness.prototype.testCrc32 = function()
{
	var left  = newObject("FirstName", "01-first-3", "LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com");
	var right = newObject("LastName", "02-last", "PrimaryEmail", "08-email-1@zindus.com" , "FirstName", "01-first-3");

	var crcLeft  = ZinContactConverter.instance().crc32(left);
	var crcRight = ZinContactConverter.instance().crc32(right);

	zinAssert(crcLeft == crcLeft);
}

ZinTestHarness.prototype.testLookupCard = function()
{
	var uri    = "moz-abmdbdirectory://abook.mab";
	var luid   = 258;
	var abCard = ZinAddressBook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

	this.m_logger.debug("testLookupCard: abCard: "                   + (abCard ? "non-null" : "null"));

	if (abCard)
	{
		this.m_logger.debug("testLookupCard: abCard: "                   + ZinAddressBook.nsIAbCardToPrintable(abCard));
		this.m_logger.debug("testLookupCard: abCard: isANormalCard: "    + abCard.isANormalCard);
		this.m_logger.debug("testLookupCard: abCard: isAnEmailAddress: " + abCard.isAnEmailAddress);
	}
}

ZinTestHarness.prototype.testZinFeedCollection = function()
{
	var cfc = new ZinFeedCollection();
	var cfi;

	cfi = new ZinFeedItem();
	cfi.set('id', 0);
	cfi.set('name1', "value1");

	cfc.set(cfi);

	var cfi2 = cfc.get(0);
	cfi2.set('fred', 1);

	cfi = new ZinFeedItem();
	cfi.set('id', 1);
	cfi.set('name2', "value2");
	cfi.set('name3', "value3");

	cfc.set(cfi);

	this.m_logger.debug("3233: cfc.toString() == \n" + cfc.toString());

	cfc.del(1);

	this.m_logger.debug("3233: cfc.toString() after del(1) == \n" + cfc.toString());
}

ZinTestHarness.prototype.testContactConverter = function()
{
	var element = new Object();

	element['email']     = "leni@barkly.zindus.com";
	element['firstName'] = "leni";

	var properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, element);

	this.m_logger.debug("3233: testContactConverter: converts:\nzimbra: " + aToString(element) + "\nto thunderbird: " + aToString(properties));
}

ZinTestHarness.prototype.testFolderConverter = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new ZinFolderConverter();

	this.testFolderConverterSuiteOne(converter, "convertForMap");
	this.testFolderConverterSuiteOne(converter, "convertForPublic");

	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, TB_PAB)             == ZinAddressBook.getPabName());
	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, ZM_FOLDER_CONTACTS) == ZinAddressBook.getPabName());

	var localised_emailed_contacts;

	// test without localisation
	//
	localised_emailed_contacts = ZM_FOLDER_EMAILED_CONTACTS;

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	// test localisation by language
	//
	converter.localised_emailed_contacts(converter.recalculate_localised_emailed_contacts("fr"));
	localised_emailed_contacts = "Personnes contact\u00e9es par mail";

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	// test localisation by language and location
	//
	converter.localised_emailed_contacts(converter.recalculate_localised_emailed_contacts("fr_FR"));

	this.testFolderConverterSuiteTwo(converter, localised_emailed_contacts);

	this.m_logger.debug("testFolderConverter: finish");

	return true;
}

ZinTestHarness.prototype.testFolderConverterSuiteTwo = function(converter, localised_emailed_contacts)
{
	var prefix = converter.m_app_name_with_slash;

	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, TB_EMAILED_CONTACTS)        == prefix + localised_emailed_contacts);
	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, ZM_FOLDER_EMAILED_CONTACTS) == prefix + localised_emailed_contacts);
}

ZinTestHarness.prototype.testFolderConverterSuiteOne = function(converter, method)
{
	var prefix = converter.m_app_name_with_slash;

	// test convertForMap
	//
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, "")                 == prefix);

	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, "fred")             == "fred");
	zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, "fred")             == prefix + "fred");
	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, "zindus/fred")      == "fred");
	zinAssert(converter[method](FORMAT_TB, FORMAT_TB, "zindus/fred")      == "zindus/fred");

	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, TB_PAB)             == ZM_FOLDER_CONTACTS);
	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, ZM_FOLDER_CONTACTS) == ZM_FOLDER_CONTACTS);

	zinAssert(converter[method](FORMAT_ZM, FORMAT_TB, TB_EMAILED_CONTACTS)        == ZM_FOLDER_EMAILED_CONTACTS);
	zinAssert(converter[method](FORMAT_ZM, FORMAT_ZM, ZM_FOLDER_EMAILED_CONTACTS) == ZM_FOLDER_EMAILED_CONTACTS);

	if (method != "convertForPublic") // these are tested separately
	{
		zinAssert(converter[method](FORMAT_TB, FORMAT_TB, TB_PAB)             == TB_PAB);
		zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, ZM_FOLDER_CONTACTS) == TB_PAB);

		zinAssert(converter[method](FORMAT_TB, FORMAT_TB, TB_EMAILED_CONTACTS)        == TB_EMAILED_CONTACTS);
		zinAssert(converter[method](FORMAT_TB, FORMAT_ZM, ZM_FOLDER_EMAILED_CONTACTS) == TB_EMAILED_CONTACTS);
	}

	return true;
}

ZinTestHarness.prototype.testPropertyDelete = function()
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

ZinTestHarness.prototype.testLso = function()
{
	var zfi, lso, str;
	// test constructor style #1
	//
	var d = new Date();
	var s = Date.UTC();
	var t = hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	        " " +
			hyphenate(":", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, 334, ZinFeedItem.ATTR_MS, 1234, ZinFeedItem.ATTR_REV, 1235);
	lso = new Lso(zfi);
	str = "##1234#1235#"

	// test a zimbra zfi against an lso generated from a zfi
	//
	ZinTestHarness.testLsoToString(lso, str);
	ZinTestHarness.testLsoCompareZm(lso, zfi);

	// test a zimbra zfi against an lso generated from a string
	//
	lso = new Lso(str);
	ZinTestHarness.testLsoToString(lso, str);
	ZinTestHarness.testLsoCompareZm(lso, zfi);

	// test a thunderbird zfi against an lso generated from a zfi
	//
	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, 334, ZinFeedItem.ATTR_CS, 1749681802);
	lso = new Lso(zfi);
	str = "#1749681802###";
	ZinTestHarness.testLsoToString(lso, str);
	ZinTestHarness.testLsoCompareTb(lso, zfi);

	return true;
}

ZinTestHarness.testLsoToString = function(lso, str)
{
	zinAssert(lso.toString() == str);
}

ZinTestHarness.testLsoCompareZm = function(lso, zfiOrig)
{
	var zfi;

	zfi = zinCloneObject(zfiOrig)
	zinAssert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1235);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_REV, 1236);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_DEL, 1);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1233);
	zfi.set(ZinFeedItem.ATTR_REV, 1235);
	zinAssert(lso.compare(zfi) == -1);  // test compare() == -1;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_MS, 1234);
	zfi.set(ZinFeedItem.ATTR_REV, 1232);
	zinAssert(lso.compare(zfi) == -1);  // test compare() == -1;
}

ZinTestHarness.testLsoCompareTb = function(lso, zfiOrig)
{
	var zfi;

	zfi = zinCloneObject(zfiOrig)
	zinAssert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_DEL, 1);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi = zinCloneObject(zfiOrig)
	zfi.set(ZinFeedItem.ATTR_CS, 1111111111111);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;
}

ZinTestHarness.prototype.testLogging = function()
{
	// var logger = new Log(Log.DEBUG, Log.dumpAndFileLogger, "ZinTestHarness.testLogging");
	var logger = newZinLogger("testLogging");

	logger.debug("hello, this is a debug");
	logger.info("hello, this is a info");
	logger.warn("hello, this is a warn");
	logger.error("hello, this is a error");
	logger.fatal("hello, this is a fatal");
}
