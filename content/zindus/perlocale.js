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
// $Id: perlocale.js,v 1.8 2009-11-18 13:29:37 cvsuser Exp $

// A locale eg 'en-US' is made up of language (en) and nation/location (US)
//
// Note - if any of the translations change, there will have to be code that migrates the old name to the new...
// FIXME: update for new locales as per:
//   http://www.zimbra.com/products/languages.html
//   http://wiki.zimbra.com/index.php?title=Translations
//

var PerLocaleStatic = {
	m_general_useragent    : null,
	m_translation          : new Object(),
	m_all_translations_of  : new Object(),
	m_is_properties_loaded : false,
	m_locale_superset      : new Object(),

	load_properties : function() {
		let src    = "chrome://zindus/content/perlocale.properties";
		let sbs    = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
		let bundle = sbs.createBundle(src);
		let enm    = bundle.getSimpleEnumeration();
		let re     = /^zindus\.(.+?)\.(.+?)$/; // eg: zindus.cs.tb.pab
		let l      = new Array();
		let r      = new Array();

		l.push("tb.pab");             r.push(TB_PAB_FULLNAME);
		l.push("zm.emailedcontacts"); r.push(ZM_FOLDER_EMAILED_CONTACTS);
		l.push("gd.contacts");        r.push(ContactGoogle.eSystemGroup.Contacts);
		l.push("gd.coworkers");       r.push(ContactGoogle.eSystemGroup.Coworkers);
		l.push("gd.family");          r.push(ContactGoogle.eSystemGroup.Family);
		l.push("gd.friends");         r.push(ContactGoogle.eSystemGroup.Friends);
		l.push("gd.suggested");       r.push(ContactGoogle.eSystemGroup.Suggested);

		let bimap = new BiMap(l, r);

		while (enm.hasMoreElements()) {
			let elem   = enm.getNext().QueryInterface(Ci.nsIPropertyElement);
			let a      = re.exec(elem.key); zinAssertAndLog(a.length == 3, elem.key);
			let locale = a[1];
			let key    = a[2];
			let k      = bimap.lookup(key, null);

			this.m_locale_superset[locale] = true;

			logger().debug(elem.key + " AMHERE: setting m_translation: key: " + key + " lookedup: " + k + " to: " + elem.value); // TODO

			if (!(k in PerLocaleStatic.m_translation))
				PerLocaleStatic.m_translation[k] = new Object();

			PerLocaleStatic.m_translation[k][locale] = elem.value;
		}

		this.m_is_properties_loaded = true;
	},
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

		if (!this.m_is_properties_loaded)
			this.load_properties();

		zinAssertAndLog(key in this.m_translation, key);

		if (locale in this.m_translation[key])
			ret = this.m_translation[key][locale];
		else if (locale && locale.length > 2)
			ret = this.translation_of_locale(key, locale.substr(0, 2));

		// logger().debug("translation_of_locale: key: " + key + " locale: " + locale + " returns: " + ret);

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
			let locale;
			this.m_all_translations_of[key] = new Object();
			this.m_all_translations_of[key][key] = true;
			for (locale in this.m_locale_superset) {
				let translation = this.translation_of_locale(key, locale);
				if (translation)
					this.m_all_translations_of[key][translation] = true;
			}

			logger().debug("all_translations_of: key: " + key + " returns: " + keysToString(this.m_all_translations_of[key]));
		}

		return this.m_all_translations_of[key];
	}
};
