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

function CnsContactConverter()
{
	this.m_equivalents = null; // an array of objects where each object is an n-tuplet of pairs of (format, contact property)
	this.m_map         = null; // a two-dimensonal associative array where [format][property] maps to index in m_equivalents
	// this.m_format      = null; // an associative array - key is format and value is all possible contact properties for that format

	this.setup();
}

CnsContactConverter.instance = function()
{
	if (typeof (CnsContactConverter.m_instance) == "undefined")
		CnsContactConverter.m_instance = new CnsContactConverter();

	return CnsContactConverter.m_instance;
}

// see: mozilla/mailnews/addrbook/resources/content/abCardOverlay.js
// which is a subset of the constants defined in mozilla/mailnews/addrbook/public/nsIAddrDatabase.idl
// - the .idl also includes: LastModifiedDate, ListName, ListDescription, ListTotalAddresses
//
CnsContactConverter.prototype.setup = function()
{
	this.m_equivalents = new Array();
	this.m_equivalents.push(newObject(FORMAT_TB, "FirstName",       FORMAT_ZM, "firstName"      ));
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

	var aIndex = [FORMAT_TB, FORMAT_ZM];
	var i, j, k;
	this.m_map = new Object();

	// logger.debug("ZimbraAddressBook.setup() - m_equivalents: " + aToString(this.m_equivalents));

	for (j = 0; j < aIndex.length;  j++)
		this.m_map[aIndex[j]] = new Object();

	for (i = 0; i < this.m_equivalents.length; i++)
		for (j = 0; j < aIndex.length; j++)
		{
			k = this.m_equivalents[i][aIndex[j]];

			// logger.debug("CnsContactConverter.setup() - i: " + i + " j: " + j + " k: " + k);

			if (k != null)
				this.m_map[aIndex[j]][k] = i;
		}

	// So (for example)...
	// m_map[FORMAT_TB][PrimaryEmail] == 4
	// m_map[FORMAT_ZM][email] == 4
}

CnsContactConverter.prototype.convert = function(format_to, format_from, properties_from)
{
	var i, j, key;

	zinAssert(format_to   == FORMAT_TB || format_to   == FORMAT_ZM);
	zinAssert(format_from == FORMAT_TB || format_from == FORMAT_ZM);

	var properties_to = new Object();

	for (i in properties_from)
	{
		// TODO - handle the HomeAddress and HomeAddress2 stuff
		//
		if (format_to == format_from)
			properties_to[i] = properties_from[i];
		else
		{
			j = this.m_map[format_from][i];

			if (typeof(j) != 'undefined')
			{
				key = this.m_equivalents[j][format_to];

				if (key != null)
					properties_to[key] = properties_from[i];
			}
		}
	}

	return properties_to;
}
