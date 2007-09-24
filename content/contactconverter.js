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

function ZinContactConverter()
{
	this.m_equivalents = null; // an array of objects where each object is an n-tuplet of pairs of (format, contact property)
	this.m_map         = null; // a two-dimensonal associative array where [format][property] maps to index in m_equivalents

    this.m_bimap_folder_name = new BiMap(
			[FORMAT_TB, FORMAT_ZM   ],
			[TB_PAB,    ZM_CONTACTS ])

	this.m_app_name_with_slash = APP_NAME + "/";

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
	this.m_equivalents.push(newObject(FORMAT_TB, "FirstName",       FORMAT_ZM, "firstName"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, "LastName",        FORMAT_ZM, "lastName"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, "DisplayName",     FORMAT_ZM, "fullName"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, "NickName",        FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "PrimaryEmail",    FORMAT_ZM, "email"          ));
	this.m_equivalents.push(newObject(FORMAT_TB, "SecondEmail",     FORMAT_ZM, "email2"         ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkPhone",       FORMAT_ZM, "workPhone"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomePhone",       FORMAT_ZM, "homePhone"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, "FaxNumber",       FORMAT_ZM, "workFax"        ));
	this.m_equivalents.push(newObject(FORMAT_TB, "PagerNumber",     FORMAT_ZM, "pager"          ));
	this.m_equivalents.push(newObject(FORMAT_TB, "CellularNumber",  FORMAT_ZM, "mobilePhone"    ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeAddress",     FORMAT_ZM, "homeStreet"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeAddress2",    FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeCity",        FORMAT_ZM, "homeCity"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeState",       FORMAT_ZM, "homeState"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeZipCode",     FORMAT_ZM, "homePostalCode" ));
	this.m_equivalents.push(newObject(FORMAT_TB, "HomeCountry",     FORMAT_ZM, "homeCountry"    ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkAddress",     FORMAT_ZM, "workStreet"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkAddress2",    FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkCity",        FORMAT_ZM, "workCity"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkState",       FORMAT_ZM, "workState"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkZipCode",     FORMAT_ZM, "workPostalCode" ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WorkCountry",     FORMAT_ZM, "workCountry"    ));
	this.m_equivalents.push(newObject(FORMAT_TB, "JobTitle",        FORMAT_ZM, "jobTitle"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Department",      FORMAT_ZM, "department"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Company",         FORMAT_ZM, "company"        ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WebPage1",        FORMAT_ZM, "workURL"        ));
	this.m_equivalents.push(newObject(FORMAT_TB, "WebPage2",        FORMAT_ZM, "homeURL"        ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom1",         FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom2",         FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom3",         FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Custom4",         FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, "Notes",           FORMAT_ZM, "notes"          ));
	this.m_equivalents.push(newObject(FORMAT_TB, "ScreenName",      FORMAT_ZM, null             ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "middleName"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "email3"         ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "workPhone2"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "assistantPhone" ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "companyPhone"   ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "callbackPhone"  ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "homePhone2"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "homeFax"        ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "pager"          ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "carPhone"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherStreet"    ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherCity"      ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherState"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherPostalCode"));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherCountry"   ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherPhone"     ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherFax"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "otherURL"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "birthday"       ));
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "fileAs"         ));

	// these fields aren't in the zimbra web UI but they are supported by the zimbra server
	// these are just the ones I've found by playing with Outlook sync - there might me more...
	//
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "namePrefix"      )); // eg "Mr."
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "nameSuffix"      )); // eg "Mr."
	this.m_equivalents.push(newObject(FORMAT_TB, null,              FORMAT_ZM, "initials"        ));

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
	                                "modifyTimeStamp",             0);

	var aIndex = [FORMAT_TB, FORMAT_ZM];
	var i, j, k;
	this.m_map = new Object();

	// this.m_logger.debug("ZimbraAddressBook.setup() - m_equivalents: " + aToString(this.m_equivalents));

	for (j = 0; j < aIndex.length;  j++)
		this.m_map[aIndex[j]] = new Object();

	for (i = 0; i < this.m_equivalents.length; i++)
		for (j = 0; j < aIndex.length; j++)
		{
			k = this.m_equivalents[i][aIndex[j]];

			// gLogger.debug("ZinContactConverter.setup() - i: " + i + " j: " + j + " k: " + k);

			if (k != null)
				this.m_map[aIndex[j]][k] = i;
		}

	// So (for example)...
	// m_map[FORMAT_TB][PrimaryEmail] == 4
	// m_map[FORMAT_ZM][email] == 4

	this.m_bimap_format = new BiMap(
		[FORMAT_TB,     FORMAT_ZM ],
		['thunderbird', 'zimbra'  ]);

	this.m_address_line = new Object();
	this.m_address_line[FORMAT_ZM] = { "homeStreet" :  0, "workStreet"   : 0 };
	this.m_address_line[FORMAT_TB] = { "HomeAddress":  0, "HomeAddress2" : 0, "WorkAddress" : 0, "WorkAddress2" : 0 };
}

ZinContactConverter.prototype.convert = function(format_to, format_from, properties_from)
{
	var key_from, index_to, key_to;
	var a_normalised_line = newObject("home", new Array(), "work", new Array());

	zinAssert(format_to   == FORMAT_TB || format_to   == FORMAT_ZM);
	zinAssert(format_from == FORMAT_TB || format_from == FORMAT_ZM);

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

ZinContactConverter.prototype.convertFolderName = function(format_from, format_to, name)
{
	var ret;

	if (this.m_bimap_folder_name.lookup(format_from, null) == name)
		ret = this.m_bimap_folder_name.lookup(format_to, null);
	else if (format_from == format_to)
		ret = name;
	else if (format_to == FORMAT_TB)
		ret = this.m_app_name_with_slash + name;
	else
	{
		zinAssert(name.substring(0, this.m_app_name_with_slash.length) == this.m_app_name_with_slash);
		ret = name.substring(this.m_app_name_with_slash.length)
	}

	// this.m_logger.debug("convertFolderName: name: " + name +
	//                     " from: " + this.m_bimap_format.lookup(format_from, null) + 
	//                     " to: " + this.m_bimap_format.lookup(format_to, null) + 
	//                     " returns: " + ret);

	return ret;
}
