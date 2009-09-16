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
// $Id: perlocale.js,v 1.3 2009-09-16 06:45:47 cvsuser Exp $

// A locale eg 'en-US' is made up of language (en) and nation/location (US)
//
// Note - if any of the "Emailed Contacts" translations change, there will have to be code that migrates the old name to the new...
// FIXME: update for new locales as per:
//   http://www.zimbra.com/products/languages.html
//   http://wiki.zimbra.com/index.php?title=Translations
//

var PerLocaleStatic = {
	m_general_useragent : null,
	m_translation : new Object(),
	m_all_translations_of : new Object(),
	// any locale we've got any kind of translation for goes here
	m_locale_superset : newObjectWithKeys( "cs", "da", "de", "es", "fr", "hu", "it", "ja", "ko", "nl", "pl", "pt", "ru", "sv",
	                                       "tr", "uk", "zh_CN", "zh_HK"),
	general_useragent : function() {
		if (!this.m_general_useragent) {
			let prefs = new MozillaPreferences("general.useragent.");
			this.m_general_useragent = prefs.getCharPrefOrNull(prefs.branch(), "locale");
			logger().debug("general.useragent.locale is: " + this.m_general_useragent);
		}

		return this.m_general_useragent;
	},
	translation_of_locale : function(key, locale) {
		let ret = null;
		zinAssertAndLog(key in this.m_translation, key);

		if (locale in this.m_translation[key])
			ret = this.m_translation[key][locale];
		else if (locale && locale.length > 2)
			ret = this.translation_of_locale(key, locale.substr(0, 2));

		return ret;
	},
	translation_of : function(key, locale) {
		// Use logic that's similar to zimbra's (see soap.txt)
		// 1. notused: zimbraPrefLocale of the target account if it is present 
		// 2. Thunderbird's "general.useragent.locale" preference (if set)
		// 3. "Emailed Contacts"
		//
	
		locale = locale || PerLocaleStatic.general_useragent();

		let ret = key;
		let tmp = PerLocaleStatic.translation_of_locale(key, locale);

		if (tmp)
			ret = tmp;

		// logger().debug("translation_of: key: " + key + (tmp ? "matched: " : "") + " locale: " + locale + " returns: " + ret);

		return ret;
	},
	all_translations_of : function(key) {
		if (!(key in this.m_all_translations_of)) {
			this.m_all_translations_of[key] = new Object();
			this.m_all_translations_of[key][key] = true;
			for (var locale in this.m_locale_superset) {
				let translation = this.translation_of_locale(key, locale);
				if (translation)
					this.m_all_translations_of[key][translation] = true;
			}

			logger().debug("all_translations_of: key: " + key + " returns: " + aToString(this.m_all_translations_of[key]));
		}

		return this.m_all_translations_of[key];
	}
};

// This list aims to be a superset of Zimbra's supported locales...
//
PerLocaleStatic.m_translation[ZM_FOLDER_EMAILED_CONTACTS] = {
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

PerLocaleStatic.m_translation[TB_PAB_FULLNAME] = {
		cs    : "Osobn\u00ED kontakty",
		da    : "Personlig adressebog",
		de    : "Pers\u00F6nliches Adressbuch",
		es    : "Libreta de direcciones personal",
		fr    : "Adresses personnelles",
		hu    : "Szem\u00E9lyes c\u00EDmjegyz\u00E9k",
		it    : "Rubrica personale",
		ja    : "\u500b\u4eba\u7528\u30a2\u30c9\u30ec\u30b9\u5e33",
		ko    : "\uac1c\uc778 \uc8fc\uc18c\ub85d",
		nl    : "Persoonlijk adresboek",
		pl    : "Osobista ksi\u0105\u017Cka adresowa",
		pt    : "Cat\u00E1logo pessoal",
		ru    : "\u041B\u0438\u0447\u043D\u0430\u044F \u0430\u0434\u0440\u0435\u0441\u043D\u0430\u044F \u043A\u043D\u0438\u0433\u0430",
		sv    : "Personlig adressbok",
		tr    : "Ki\u015Fisel adres defteri",
		uk    : "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0430 \u0430\u0434\u0440\u0435\u0441\u043D\u0430 \u043A\u043D\u0438\u0433\u0430",
		zh_CN : "\u4e2a\u4eba\u901a\u8baf\u5f55"
	};

PerLocaleStatic.m_translation[ContactGoogle.eSystemGroup.Contacts] = {
	};
PerLocaleStatic.m_translation[ContactGoogle.eSystemGroup.Friends] = {
	};
PerLocaleStatic.m_translation[ContactGoogle.eSystemGroup.Family] = {
	};
PerLocaleStatic.m_translation[ContactGoogle.eSystemGroup.Coworkers] = {
	};
PerLocaleStatic.m_translation[GD_SUGGESTED] = {
	};
