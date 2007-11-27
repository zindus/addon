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
	// ret = ret && this.testContactConverter();
	// ret = ret && this.testContactConverterForFolderNames();
	// ret = ret && this.testPropertyDelete();
	ret = ret && this.testLso();

	this.m_logger.debug("test(s) " + (ret ? "succeeded" : "failed"));
}

ZinTestHarness.prototype.testCrc32 = function()
{
	if (0)
	{
	var o = newObject("LastName", "02-last", "FirstName", "01-first-3", "PrimaryEmail", "08-email-1@moniker.net");
	var a = new Array();

	for (var i in o)
		a[ZinContactConverter.instance().m_map[FORMAT_TB][i]] = o[i];

	this.m_logger.debug("testCrc32: a: " + a.toString());
	}

	var left  = newObject("FirstName", "01-first-3", "LastName", "02-last", "PrimaryEmail", "08-email-1@moniker.net");
	var right = newObject("LastName", "02-last", "PrimaryEmail", "08-email-1@moniker.net" , "FirstName", "01-first-3");

	var crcLeft  = ZimbraAddressBook.crc32(left);
	var crcRight = ZimbraAddressBook.crc32(right);

	zinAssert(crcLeft == crcLeft);
}

ZinTestHarness.prototype.testLookupCard = function()
{
	var uri    = "moz-abmdbdirectory://abook.mab";
	var luid   = 258;
	var abCard = ZimbraAddressBook.lookupCard(uri, TBCARD_ATTRIBUTE_LUID, luid);

	this.m_logger.debug("testLookupCard: abCard: "                   + (abCard ? "non-null" : "null"));

	if (abCard)
	{
	this.m_logger.debug("testLookupCard: abCard: "                   + ZimbraAddressBook.nsIAbCardToPrintable(abCard));
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

	element['email']     = "leni@barkly.moniker.net";
	element['firstName'] = "leni";

	var properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, element);

	this.m_logger.debug("3233: testContactConverter: converts:\nzimbra: " + aToString(element) + "\nto thunderbird: " + aToString(properties));
}

ZinTestHarness.prototype.testContactConverterForFolderNames = function()
{
	var name, format_from, format_to;

	var prefix = APP_NAME + "/";

	this.m_logger.debug("testContactConverterForFolderNames: start");

	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_ZM, FORMAT_TB, "")            == prefix);

	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_ZM, FORMAT_ZM, "fred")        == "fred");
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_ZM, FORMAT_TB, "fred")        == prefix + "fred");
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_TB, FORMAT_ZM, "zindus/fred") == "fred");
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_TB, FORMAT_TB, "zindus/fred") == "zindus/fred");

	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_TB, FORMAT_ZM, TB_PAB)        == "Contacts");
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_TB, FORMAT_TB, TB_PAB)        == TB_PAB);
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_ZM, FORMAT_ZM, "Contacts")    == "Contacts");
	zinAssert(ZinContactConverter.instance().convertFolderName(FORMAT_ZM, FORMAT_TB, "Contacts")    == TB_PAB);

	this.m_logger.debug("testContactConverterForFolderNames: finish");
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
