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

include("chrome://zindus/content/crc32.js");

function ZinContactConverter()
{
	this.m_equivalents  = null; // an array of objects where each object is an n-tuplet of pairs of (format, contact property)
	this.m_map          = null; // a two-dimensonal associative array where [format][property] maps to index in m_equivalents
	this.m_common_to    = null; // associative array of [format1][format2] is a hash - the keys are the format1 props that map to format2

	this.m_logger = newZinLogger("ContactConverter");

	this.setup();
}

ZinContactConverter.instance = function()
{
	if (typeof (ZinContactConverter.m_instance) == "undefined")
		ZinContactConverter.m_instance = new ZinContactConverter();

	return ZinContactConverter.m_instance;
}

// see: mozilla/mailnews/addrbook/resources/content/abCardOverlay.js
// which is a subset of the constants defined in mozilla/mailnews/addrbook/public/nsIAddrDatabase.idl
// - the .idl also includes: LastModifiedDate, ListName, ListDescription, ListTotalAddresses
//
ZinContactConverter.prototype.setup = function()
{
	this.m_equivalents = new Array();
	this.m_equivalents.push(newObject(FORMAT_TB, "FirstName",       FORMAT_ZM, "firstName",         FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "LastName",        FORMAT_ZM, "lastName",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "DisplayName",     FORMAT_ZM, "fullName",          FORMAT_GD, "title"));
	this.m_equivalents.push(newObject(FORMAT_TB, "NickName",        FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "PrimaryEmail",    FORMAT_ZM, "email",             FORMAT_GD, "PrimaryEmail"));
	this.m_equivalents.push(newObject(FORMAT_TB, "SecondEmail",     FORMAT_ZM, "email2",            FORMAT_GD, "SecondEmail"));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkPhone",       FORMAT_ZM, "workPhone",         FORMAT_GD, "phoneNumber#work"));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomePhone",       FORMAT_ZM, "homePhone",         FORMAT_GD, "phoneNumber#home"));
	this.m_equivalents.push(newObject(FORMAT_TB, "FaxNumber",       FORMAT_ZM, "workFax",           FORMAT_GD, "phoneNumber#work_fax"));
	this.m_equivalents.push(newObject(FORMAT_TB, "PagerNumber",     FORMAT_ZM, "pager",             FORMAT_GD, "phoneNumber#pager"));
	this.m_equivalents.push(newObject(FORMAT_TB, "CellularNumber",  FORMAT_ZM, "mobilePhone",       FORMAT_GD, "phoneNumber#mobile"));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeAddress",     FORMAT_ZM, "homeStreet",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeAddress2",    FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeCity",        FORMAT_ZM, "homeCity",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeState",       FORMAT_ZM, "homeState",         FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeZipCode",     FORMAT_ZM, "homePostalCode",    FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeCountry",     FORMAT_ZM, "homeCountry",       FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkAddress",     FORMAT_ZM, "workStreet",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkAddress2",    FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkCity",        FORMAT_ZM, "workCity",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkState",       FORMAT_ZM, "workState",         FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkZipCode",     FORMAT_ZM, "workPostalCode",    FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkCountry",     FORMAT_ZM, "workCountry",       FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "JobTitle",        FORMAT_ZM, "jobTitle",          FORMAT_GD, "organization#orgTitle"));
	this.m_equivalents.push(newObject(FORMAT_TB, "Department",      FORMAT_ZM, "department",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Company",         FORMAT_ZM, "company",           FORMAT_GD, "organization#orgName"));
	this.m_equivalents.push(newObject(FORMAT_TB, "WebPage1",        FORMAT_ZM, "workURL",           FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "WebPage2",        FORMAT_ZM, "homeURL",           FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom1",         FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom2",         FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom3",         FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom4",         FORMAT_ZM, null,                FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, "Notes",           FORMAT_ZM, "notes",             FORMAT_GD, "content"));
	this.m_equivalents.push(newObject(FORMAT_TB, "ScreenName",      FORMAT_ZM, null,                FORMAT_GD, "im#AIM"));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "middleName",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "email3",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "workPhone2",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "assistantPhone",    FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "companyPhone",      FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "callbackPhone",     FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "homePhone2",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "homeFax",           FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "carPhone",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherStreet",       FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherCity",         FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherState",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherPostalCode",   FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherCountry",      FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherPhone",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherFax",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherURL",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "birthday",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "fileAs",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "imAddress1",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "imAddress2",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "imAddress3",        FORMAT_GD, null));

	// these fields aren't in the zimbra web UI but are supported by the zimbra server
	// these are just the ones found through experimenting with Outlook sync - there are certainly more...
	// Must consider whether there is a better way, eg: query/determine the entire list...
	//
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "namePrefix",        FORMAT_GD, null)); // eg "Mr."
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "nameSuffix",        FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "initials",          FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "email4",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "email5",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "email6",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "office",            FORMAT_GD, null));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "outlookUserField1", FORMAT_GD, null));

	// Don't generate debug messages if unable to convert these attributes...
	// eg. the <cn> elements returned by SyncGal include ldap attributes
	// Enumerating these here might be ok at first to confirm completeness but will have diminishing value after a while.
	// The trouble is that the response from the zimbra server lumps together all the attributes of a contact and provides
	// no way of distinguishing contact content from metadata so we can't be sure we're converting all attributes relevent to content.
	//
	this.m_dont_convert = newObject("zimbraId",                    0,
	                                "objectClass",                 0,
	                                "createTimeStamp",             0,
	                                "zimbraMailForwardingAddress", 0,
	                                "zimbraCalResType",            0,
	                                "modifyTimeStamp",             0);

	var i, j, k;
	this.m_map = new Object();

	// this.m_logger.debug("ZimbraAddressBook.setup() - m_equivalents: " + aToString(this.m_equivalents));

	for (j = 0; j < A_VALID_FORMATS.length;  j++)
		this.m_map[A_VALID_FORMATS[j]] = new Object();

	for (i = 0; i < this.m_equivalents.length; i++)
		for (j = 0; j < A_VALID_FORMATS.length; j++)
		{
			k = this.m_equivalents[i][A_VALID_FORMATS[j]];

			// gLogger.debug("ZinContactConverter.setup() - i: " + i + " j: " + j + " k: " + k);

			if (k != null)
				this.m_map[A_VALID_FORMATS[j]][k] = i;
		}

	// So (for example)...
	// m_map[FORMAT_TB][PrimaryEmail] == 4
	// m_map[FORMAT_ZM][email] == 4
	// m_equivalents[4][FORMAT_TB] = "PrimaryEmail";

	this.m_bimap_format = getBimapFormat();

	this.m_address_line = new Object();
	this.m_address_line[FORMAT_ZM] = { "homeStreet" :  0, "workStreet"   : 0 };
	this.m_address_line[FORMAT_TB] = { "HomeAddress":  0, "HomeAddress2" : 0, "WorkAddress" : 0, "WorkAddress2" : 0 };
	this.m_address_line[FORMAT_GD] = { };

	this.m_common_to = new Object(); // a 2-D associative array where [FORMAT_TB][format] maps to an index in m_equivalents

	for (j = 0; j < A_VALID_FORMATS.length;  j++)
		if (A_VALID_FORMATS[j] != FORMAT_TB)
			{
				this.populate_common_to(FORMAT_TB, A_VALID_FORMATS[j]);
				this.populate_common_to(A_VALID_FORMATS[j], FORMAT_TB);
			}

	for (i in this.m_common_to)
		for (j in this.m_common_to[i])
			this.m_logger.debug("m_common_to: [" + i + "][" + j + "]: " + aToString(this.m_common_to[i][j]));
}

ZinContactConverter.prototype.convert = function(format_to, format_from, properties_from)
{
	var key_from, index_to, key_to;
	var a_normalised_line = newObject("home", new Array(), "work", new Array());

	zinAssert(isValidFormat(format_to) && isValidFormat(format_from));

	var properties_to = new Object();

	for (key_from in properties_from)
	{
		if (isPropertyPresent(this.m_dont_convert, key_from))
			; // do nothing
		else if (format_to == format_from)
			properties_to[key_from] = properties_from[key_from];
		else
		{
			if (isPropertyPresent(this.m_address_line[format_from], key_from))
				this.normaliseAddressLine(format_to, format_from, properties_from, key_from, a_normalised_line);
			else
			{
				index_to = this.m_map[format_from][key_from];

				if (typeof(index_to) != 'undefined')
				{
					key_to = this.m_equivalents[index_to][format_to];

					if (key_to != null)
						properties_to[key_to] = properties_from[key_from];
				}
				else
				{
					this.m_logger.warn("Ignoring contact field that we don't have a mapping for: " +
					                  "from: " + this.m_bimap_format.lookup(format_from, null) + " " +
					                  "field: "  + key_from);
				}
			}
		}
	}

	// this.m_logger.debug("convert: a_normalised_line[home].length: " + a_normalised_line["home"].length);
	// this.m_logger.debug("convert: a_normalised_line[home]: " + a_normalised_line["home"].toString());
	// this.m_logger.debug("convert: a_normalised_line[work].length: " + a_normalised_line["work"].length);
	// this.m_logger.debug("convert: a_normalised_line[work]: " + a_normalised_line["work"].toString());

	if (a_normalised_line["home"].length > 0 || a_normalised_line["work"].length > 0)
		this.outputNormalisedAddressLine(format_to, properties_to, a_normalised_line);

	// this.m_logger.debug("convert:" + " format_to: " + format_to + " format_from: " + format_from + 
	//                                  " properties_from: "       + aToString(properties_from) +
	//                                  " returns properties_to: " + aToString(properties_to));
		
	return properties_to;
}

// Here's what the address line conversion stuff does:
// Thunderbird field                       Zimbra field
// =================                       ============
// HomeAddress                       <==>  homeStreet line 1
// HomeAddress2 comma-separated      <==>  homeStreet lines 2 onwards
// eg.
// HomeAddress:  Unit 1, 123 Acme st       homeStreet: Unit 1, 123 Acme st
// HomeAddress2: Melbourne, VIC, 3000                  Melbourne
//                                                     VIC
//                                                     3000

ZinContactConverter.prototype.outputNormalisedAddressLine = function(format_to, properties_to, a_normalised_line)
{
	switch(format_to)
	{
		case FORMAT_TB:
			if (a_normalised_line["home"].length > 0)
				properties_to["HomeAddress"]  = a_normalised_line["home"][0];

			if (a_normalised_line["home"].length > 1)
				properties_to["HomeAddress2"] = this.arrayToSeparatedString(a_normalised_line["home"], ",", 1);

			if (a_normalised_line["work"].length > 0)
				properties_to["WorkAddress"]  = a_normalised_line["work"][0];

			if (a_normalised_line["work"].length > 1)
				properties_to["WorkAddress2"] = this.arrayToSeparatedString(a_normalised_line["work"], ",", 1);
			break;

		case FORMAT_ZM:
			if (a_normalised_line["home"].length > 0)
				properties_to["homeStreet"] = this.arrayToSeparatedString(a_normalised_line["home"], "\n", 0);

			if (a_normalised_line["work"].length > 0)
				properties_to["workStreet"] = this.arrayToSeparatedString(a_normalised_line["work"], "\n", 0);
			break;
		default: zinAssert(false);
	}
}

ZinContactConverter.prototype.arrayToSeparatedString = function(a, separator, startAt)
{
	var ret = "";

	zinAssert(startAt < a.length);

	for (var i = startAt; i < a.length; i++)
	{
		if (i != startAt)
			ret += separator;

		ret += a[i];
	}

	return ret;
}

ZinContactConverter.prototype.normaliseAddressLine = function(format_to, format_from, properties_from, key_from, a_normalised_line)
{
	var i;

	// this.m_logger.debug("normaliseAddressLine: format_to: " + format_to + " format_from: " + format_from + " key_from: " + key_from);

	switch(format_from)
	{
		case FORMAT_TB: switch(key_from) {
				case "HomeAddress":  a_normalised_line["home"][0] = properties_from[key_from];                             break;
				case "WorkAddress":  a_normalised_line["work"][0] = properties_from[key_from];                             break;
				case "HomeAddress2": this.lineTwoFromCommaSeparated(properties_from, key_from, a_normalised_line, "home"); break;
				case "WorkAddress2": this.lineTwoFromCommaSeparated(properties_from, key_from, a_normalised_line, "work"); break;
				default: zinAssert(false);
			}
			break;

		case FORMAT_ZM: switch(key_from) {
				case "homeStreet": this.lineFromNewlineSeparated(properties_from, key_from, a_normalised_line, "home"); break;
				case "workStreet": this.lineFromNewlineSeparated(properties_from, key_from, a_normalised_line, "work"); break;
				default: zinAssert(false);
			}
			break;
		default: zinAssert(false);
	}

	// this.m_logger.debug("normaliseAddressLine: a_normalised_line[home]: " + a_normalised_line["home"].toString());
	// this.m_logger.debug("normaliseAddressLine: a_normalised_line[work]: " + a_normalised_line["work"].toString());
}

ZinContactConverter.prototype.lineTwoFromCommaSeparated = function(properties_from, key_from, a_normalised_line, type)
{
	var a = properties_from[key_from].split(",");

	this.m_logger.debug("lineTwoFromCommaSeparated: type: " + type + " a: " + a.toString());

	for (var i = 0; i < a.length; i++)
		a_normalised_line[type][i + 1] = a[i];
}

ZinContactConverter.prototype.lineFromNewlineSeparated = function(properties_from, key_from, a_normalised_line, type)
{
	var a = properties_from[key_from].split("\n");

	// this.m_logger.debug("lineFromNewlineSeparated: type: " + type + " a: " + a.toString());

	for (var i = 0; i < a.length; i++)
	{
		if (i == 0)
			a_normalised_line[type][i] = a[i];
		else
			a_normalised_line[type][i] = a[i].replace(/,/, " "); // can't allow commas in line 2 and onwards
	}
}

ZinContactConverter.prototype.isKeyConverted = function(format_to, format_from, key)
{
	zinAssert(isValidFormat(format_to) && isValidFormat(format_from));

	var index_to = this.m_map[format_from][key];

	return typeof(index_to) != 'undefined' && (this.m_equivalents[index_to][format_to] != null ||
	                                           isPropertyPresent(this.m_address_line[format_from], key));
}

// We have to normalise the order in which we iterate through the properties so that two hashes with the same
// keys result in the same crc.  We can't just iterate through the hash with for..in because that doesn't guarantee ordering
// - the keys might not have been added to the hash in the same order.
// We avoid a sort by relying on the fact that the keys are thunderbird contact properties.
// The index into the Converter's table guarantees the ordering.
//
ZinContactConverter.prototype.crc32 = function(properties)
{
	var ret = 0;
	var str = "";
	var aSorted = new Array();

	for (var i in properties)
		if (properties[i].length > 0)
		{
			index_to = ZinContactConverter.instance().m_map[FORMAT_TB][i];

			if (typeof(index_to) != 'undefined')
			{
				// ignore properties which don't have a bidirectional mapping
				//
				if (this.isKeyConverted(FORMAT_ZM, FORMAT_TB, i))
					aSorted[index_to] = true;

			}
			else
				zinAssertAndLog(false, "properties: " + aToString(properties) + " i: " + i);

		}

	function callback_concat_str(element, index, array) {
		var key = ZinContactConverter.instance().m_equivalents[index][FORMAT_TB];
		str += key + ":" + properties[key];
	}

	// after this, str == FirstName:FredLastName:BloggsDisplayName:Fred BloggsPrimaryEmail:fred.bloggs@example.com
	//
	aSorted.forEach(callback_concat_str);

	ret = crc32(str);

	return ret;
}

ZinContactConverter.prototype.removeKeysNotCommonToBothFormats = function(format_from, properties)
{
	var keys_to_remove = new Object();
	var format_to = (format_from == FORMAT_ZM ? FORMAT_TB : FORMAT_ZM);
	var i;

	for (i in properties)
		if (!this.isKeyConverted(format_to, format_from, i))
			keys_to_remove[i] = true;

	for (i in keys_to_remove)
		delete properties[i];
}

// So for example:
//	this.m_common_to[FORMAT_TB][FORMAT_GD] = PrimaryEmail, SecondEmail, WorkPhone ...
//	this.m_common_to[FORMAT_GD][FORMAT_TB] = PrimaryEmail, SecondEmail, phoneNumber#work ...
//
ZinContactConverter.prototype.populate_common_to = function(format_to, format_from)
{
	if (typeof this.m_common_to[format_to] != 'object')
		this.m_common_to[format_to] = new Object();

	if (typeof this.m_common_to[format_to][format_from] != 'object')
		this.m_common_to[format_to][format_from] = new Object();

	for (var key in this.m_map[format_from])
		if (this.isKeyConverted(format_to, format_from, key))
			this.m_common_to[format_to][format_from][this.m_equivalents[this.m_map[format_from][key]][format_to]] = true;
}
