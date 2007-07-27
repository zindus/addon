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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
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
	this.m_logger = newLogger();
}

ZinTestHarness.prototype.run = function()
{
	this.testZinFeedCollection();
	// this.testContactConverter();
	// this.testPropertyDelete();
	// this.testLso();
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

	var properties = CnsContactConverter.instance().convert(FORMAT_TB, FORMAT_ZM, element);

	this.m_logger.debug("3233: testContactConverter: converts:\nzimbra: " + aToString(element) + "\nto thunderbird: " + aToString(properties));
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
	var lso;
	// test constructor style #1
	//
	var d = new Date();
	var s = Date.UTC();
	var t = hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	        " " +
			hyphenate(":", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

	this.m_logger.debug("blah: t: " + t);

	var zfi1 = new ZinFeedItem(ZinFeedItem.TYPE_CN, ZinFeedItem.ATTR_ID, 334, ZinFeedItem.ATTR_MS, 1234, ZinFeedItem.ATTR_MD, 1168484761);
	var zfi2 = zinCloneObject(zfi1);

	lso = new Lso(zfi1);

	var str = "-1234-1168484761-"

	zinAssert(lso.toString() == str);

	ZinTestHarness.testLsoCompare(lso, zfi1);

	lso = new Lso(str);

	// this.m_logger.debug("testLso: lso == " + aToString(lso));
	// this.m_logger.debug("testLso: lso.toString() == " + lso.toString());

	zinAssert(lso.toString() == str);

	ZinTestHarness.testLsoCompare(lso, zfi2);
}

ZinTestHarness.testLsoCompare = function(lso, zfi)
{
	// this.m_logger.debug("testLso: lso.compare(zfi) == " + lso.compare(zfi));

	zinAssert(lso.compare(zfi) == 0);  // test compare() == 0;

	zfi.set(ZinFeedItem.ATTR_MS, 1235);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi.set(ZinFeedItem.ATTR_MS, 1234);
	zfi.set(ZinFeedItem.ATTR_MS, 1168484762);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi.set(ZinFeedItem.ATTR_MS, 1234);
	zfi.set(ZinFeedItem.ATTR_MS, 1168484761);
	zfi.set(ZinFeedItem.ATTR_DEL, 1);
	zinAssert(lso.compare(zfi) == 1);  // test compare() == 1;

	zfi.set(ZinFeedItem.ATTR_MS, 1233);
	zinAssert(lso.compare(zfi) == -1);  // test compare() == -1;
}
