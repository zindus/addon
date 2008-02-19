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

function ZinFolderConverter()
{
	this.m_bimap_pab = new BiMap(              [FORMAT_TB,               FORMAT_ZM                  ],
	                                           [TB_PAB,                  ZM_FOLDER_CONTACTS         ]);

	this.m_bimap_emailed_contacts = new BiMap( [FORMAT_TB,               FORMAT_ZM                  ],
	                                           [TB_EMAILED_CONTACTS,     ZM_FOLDER_EMAILED_CONTACTS ]);

	this.m_app_name_with_slash = APP_NAME + "/";
	this.m_localised_emailed_contacts = null;  // the localised equivalent of "Emailed Contacts" eg "Personnes contactées par mail"

	this.m_logger = newZinLogger("ZinFolderConverter");
}

// This method converts to/from ATTR_NAME attributes in Tb and Zm maps.
// Note this this doesn't always return the public facing folder names because
// Zm:Contacts maps to Tb:TB and Zm:Emailed Contacts maps to TB_EMAILED_CONTACTS.
// For Zm, the map name is always the same as the name we get in the SyncResponse.
// For Tb, the map name must be converted to a public-facing name (to handle TB_PAB and TB_EMAILED_CONTACTS)
//
ZinFolderConverter.prototype.convertForMap = function(format_to, format_from, name)
{
	var ret;

	zinAssert(arguments.length == 3); // catch programming errors

	if (this.m_bimap_pab.lookup(format_from, null) == name)
		ret = this.m_bimap_pab.lookup(format_to, null);
	else if (this.m_bimap_emailed_contacts.lookup(format_from, null) == name)
		ret = this.m_bimap_emailed_contacts.lookup(format_to, null);
	else if (format_from == format_to)
		ret = name;
	else if (format_to == FORMAT_TB)
		ret = this.m_app_name_with_slash + name;
	else
	{
		zinAssertAndLog(name.substring(0, this.m_app_name_with_slash.length) == this.m_app_name_with_slash, name);
		ret = name.substring(this.m_app_name_with_slash.length)
	}

	// this.m_logger.debug("ZinFolderConverter.convert: name: " + name +
	//                     " from: " + this.m_bimap_format.lookup(format_from, null) + 
	//                     " to: " + this.m_bimap_format.lookup(format_to, null) + 
	//                     " returns: " + ret);

	return ret;
}

// This method caters for the items in the Thunderbird map that correspond to "reserved" ids in Zimbra's map -
// ie the "Contacts" and "Emailed Contacts" folders.  These items get special treatment and their ATTR_NAME attribute
// are for internal-use only.  This routine returns their thunderbird addressbook names, and for all other ids
// returns the item's ATTR_NAME.

ZinFolderConverter.prototype.convertForPublic = function(format_to, format_from, name)
{
	zinAssert(arguments.length == 3); // catch programming errors

	var ret = this.convertForMap(format_to, format_from, name);

	if (format_to == FORMAT_TB)
	{
		if (ret == TB_PAB)
			ret = ZinAddressBook.getPabName();
		else if (ret == TB_EMAILED_CONTACTS)
			ret = this.m_app_name_with_slash +
			              (this.m_localised_emailed_contacts ? this.m_localised_emailed_contacts : ZM_FOLDER_EMAILED_CONTACTS);
	}

	zinAssert(ret);

	return ret;
}

ZinFolderConverter.prototype.localised_emailed_contacts = function()
{
	if (arguments.length == 1)
	{
		this.m_localised_emailed_contacts = arguments[0];

		this.m_logger.debug("localised_emailed_contacts: set to: " + this.m_localised_emailed_contacts);
	}

	return this.m_localised_emailed_contacts;
}

// Use logic that's similar to zimbra's (see soap.txt)
// 1. notused: zimbraPrefLocale of the target account if it is present 
// 2. Thunderbird's "general.useragent.locale" preference (if set)
// 3. "Emailed Contacts"
//
ZinFolderConverter.prototype.recalculate_localised_emailed_contacts = function()
{
	var ret = ZM_FOLDER_EMAILED_CONTACTS;
	var value;

	var prefs = new MozillaPreferences("general.useragent.");
	var locale;
	
	if (arguments.length == 1)
		locale = arguments[0]; // used by the testharness to force a locale
	else
		locale = prefs.getCharPrefOrNull(prefs.branch(), "locale");

	this.m_logger.debug("recalculate_localised_emailed_contacts: general.useragent.locale: " + locale);

	// if (this.state.zimbraPrefLocale && value = this.emailed_contacts_per_locale(this.state.zimbraPrefLocale))
	// {
	// 	ret = value;
	// 	this.m_logger.debug("recalculate_localised_emailed_contacts: selected on the basis of zimbraPrefLocale");
	// }

	if (locale && (value = this.emailed_contacts_per_locale(locale)))
	{
		ret = value;

		this.m_logger.debug("recalculate_localised_emailed_contacts: selected on the basis of general.useragent.locale");
	}

	this.m_logger.debug("recalculate_localised_emailed_contacts: returns: " + ret);

	return ret;
}

ZinFolderConverter.prototype.emailed_contacts_per_locale = function(key)
{
	// A locale eg 'en-US' is made up of language (en) and nation/location (US)
	// This list aims to be a superset of Zimbra's supported locales...
	//
	var localeString =
	{
		da    : "Kontakter, der er sendt mail til",
		de    : "Mailempf\u00e4nger",
		es    : "Contactos respondidos",
		fr    : "Personnes contact\u00e9es par mail", // Nation component removed - was fr_FR
		it    : "Contatti usati per email",
		ja    : "\u30e1\u30fc\u30eb\u3092\u9001\u4fe1\u3057\u305f\u9023\u7d61\u5148",
		ko    : "\uc774\uba54\uc77c\ud55c \uc5f0\ub77d\ucc98",
		pl    : "Kontakty e-mail",
		pt    : "Contatos que receberam e-mail",      // Nation component removed - was pt_BR
		ru    : "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043d\u044b\u0435 \u043f\u043e \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b",
		sv    : "E-postkontakter",
		zh_CN : "\u7535\u5b50\u90ae\u4ef6\u8054\u7cfb\u4eba",
		zh_HK : "\u96fb\u5b50\u90f5\u4ef6\u806f\u7d61\u4eba"
	};

	var ret = null;

	if (isPropertyPresent(localeString, key))
		ret = localeString[key];
	else
	{
		key = key.substr(0, 2);

		if (isPropertyPresent(localeString, key))
			ret = localeString[key];
	}

	return ret;
}

