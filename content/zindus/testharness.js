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
	// ret = ret && this.testLogging();
	// ret = ret && this.testFilesystem();
	// ret = ret && this.testPropertyDelete();
	// ret = ret && this.testLso();
	// ret = ret && this.testContactConverter();
	// ret = ret && this.testZinFeedCollection();
	// ret = ret && this.testPermFromZfi();
	// ret = ret && this.testFolderConverter();
	// ret = ret && this.testFolderConverterPrefixClass();
	// ret = ret && this.testXmlHttpRequest();
	// ret = ret && this.testZuio();
	// ret = ret && this.testGoogleContacts();

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
	var element = new Object();

	element['email']     = "leni@barkly.zindus.com";
	element['firstName'] = "leni";

	var properties = ZinContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, element);

	this.m_logger.debug("3233: testContactConverter: converts:\nzimbra: " + aToString(element) + "\nto thunderbird: " + aToString(properties));
}

ZinTestHarness.prototype.testFolderConverterPrefixClass = function()
{
	this.m_logger.debug("testFolderConverter: start");
	var converter = new ZinFolderConverter();

	zinAssert(converter.prefixClass(converter.m_prefix_primary_account)   == ZinFolderConverter.PREFIX_CLASS_PRIMARY);
	zinAssert(converter.prefixClass(converter.m_prefix_foreign_readonly)  == ZinFolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(converter.m_prefix_foreign_readwrite) == ZinFolderConverter.PREFIX_CLASS_SHARED);
	zinAssert(converter.prefixClass(converter.m_prefix_internal)          == ZinFolderConverter.PREFIX_CLASS_INTERNAL);
	zinAssert(converter.prefixClass("fred")                               == ZinFolderConverter.PREFIX_CLASS_NONE);

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

ZinTestHarness.prototype.testFolderConverterSuiteOne = function(converter, method)
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

ZinTestHarness.prototype.testFolderConverterSuiteTwo = function(converter, localised_emailed_contacts)
{
	var prefix = converter.m_prefix_primary_account;

	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_TB, SyncFsm.zfiFromName(TB_EMAILED_CONTACTS))        == prefix + localised_emailed_contacts);
	zinAssert(converter.convertForPublic(FORMAT_TB, FORMAT_ZM, SyncFsm.zfiFromName(ZM_FOLDER_EMAILED_CONTACTS)) == prefix + localised_emailed_contacts);
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

	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, 334, ZinFeedItem.ATTR_MS, 1234, ZinFeedItem.ATTR_REV, 1235);
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
	zfi = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_KEY, 334, ZinFeedItem.ATTR_CS, 1749681802);
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

	ret = ret && SyncFsm.zmPermFromZfi(zfi) == ZM_PERM_READ | ZM_PERM_WRITE;

	zfi.set(ZinFeedItem.ATTR_PERM, "r");

	ret = ret && SyncFsm.zmPermFromZfi(zfi) == ZM_PERM_READ;

	zfi.set(ZinFeedItem.ATTR_PERM, "");

	ret = ret && SyncFsm.zmPermFromZfi(zfi) == ZM_PERM_NONE;

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

ZinTestHarness.prototype.testGoogleContacts = function()
{
	var urlAuth     = "https://www.google.com/accounts/ClientLogin";
	var user        = "a2ghbe@gmail.com";
	// var user        = "google-a2ghbe@moniker.net";
	// var urlUser     = "http://www.google.com/m8/feeds/contacts/google-a2ghbe@moniker.net/base"; // @ == %40
	var urlUser     = "http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base"; // @ == %40
	var content = "";
	var authToken = null;
	
	// content += "accountType=HOSTED_OR_GOOGLE";
	content += "accountType=GOOGLE";
	content += "&Email=" + user;
	content += "&Passwd=p92vCFNS65ZDHAqbHYSC";
	content += "&service=cp"; // gbase cp
	content += "&source=Toolware-Zindus-0.01";

	m_logger = newZinLogger("testGoogleContacts");

	var xhrCallbackAuth = function()
	{
		m_logger.debug("readyState: " + xhr.readyState);

		if (xhr.readyState==4) {
			m_logger.debug("status: " + xhr.status + " is 200: " + (xhr.status == "200" ? "true" : "false"));

			m_logger.debug("responseHeaders: " + xhr.getAllResponseHeaders());

			m_logger.debug("responseText: " + xhr.responseText);

			if (xhr.status == "200")
			{
				var str = String(xhr.responseText);

				var aMatch = str.match(/Auth=(.+?)(\s|$)/ ); // a[0] is the whole pattern, a[1] is the first capture, a[2] the second etc...

				if (aMatch && aMatch.length == 3)
					authToken = aMatch[1];
			}
		}
	};

	var xhr;

	// var preferences = new MozillaPreferences("network.http");
	// var proxy_version = preferences.getCharPref(preferences.branch(), "proxy.version");
	// var version = preferences.getCharPref(preferences.branch(), "version");

	// preferences.setCharPref(preferences.branch(), "proxy.version", "1.0");
	// preferences.setCharPref(preferences.branch(), "version", "1.0");

	if (true)
	{
		m_logger.debug("1. authenticate: url: " + urlAuth);

		xhr = new XMLHttpRequest();
		xhr.open("POST", urlAuth, false); // true ==> async
		xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		xhr.setRequestHeader("User-Agent", "blah");
		this.testGoogleContactsSetXhr(xhr);
		xhr.send(content);

		xhrCallbackAuth();
	}

	var curl2  = "DQAAAIIAAABmHgs5-EKXqlzYAnfks-WD5PU2K5m3AEwS50IY8AJ4xiZBINdP9-jKcjRLXvQkt78ksl5kcJjDp8sUPszjPj32V5wEmXlgfRXHWBEEFYWfuuaRCbep6mh-79aT_aITEDMZbGBlaGFeL7tMcpKNtk8TGSOrOQU-Icu500Y2GvOzsawl3Gbsey5IDkIkwggr_5A";
	var js1 = "DQAAAIIAAAAfdpSw9Q5cG8o9i9ei3a_TynT3NTVBr83TMT23vBuKsmXpYTkX28jnz5jwAdg7jQGAdpqrERBqJUvCqE2_LZxbdSYDLShxZs-G9oavclLRbyFuNLHVOdtFH3WOY7grDkmuwrNQ5ZZv5eTtx31w7JDGzHAKJOgndTguLWOhNjG_h1U4iIpZA9RaV_KpRfx2rYA";
	// authToken = js1;

	m_logger.debug("authToken: " + authToken);

	if (authToken)
	{
		m_logger.debug("2. get all contacts: url: " + urlUser);

		xhr = new XMLHttpRequest();
		xhr.open("GET", urlUser, false);
		xhr.setRequestHeader("Authorization", "GoogleLogin auth=" + authToken);
		this.testGoogleContactsSetXhr(xhr);
		xhr.send("");

		xhrCallbackAuth();
	}

	// preferences.setCharPref(preferences.branch(), "proxy.version", proxy_version);
	// preferences.setCharPref(preferences.branch(), "version", version);


	return true;
}

ZinTestHarness.prototype.testGoogleContactsSetXhr = function(xhr)
{
		xhr.setRequestHeader("Accept", null);
		xhr.setRequestHeader("Accept-Language", null);
		xhr.setRequestHeader("Accept-Encoding", null);
		xhr.setRequestHeader("Accept-Charset",  null);
		xhr.setRequestHeader("User-Agent",  null);
}
