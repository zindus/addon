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
// $Id: perlocale.js,v 1.1 2009-06-15 06:18:09 cvsuser Exp $

var PerLocaleStatic = {
	general_useragent : function() {
		let prefs = new MozillaPreferences("general.useragent.");
		return prefs.getCharPrefOrNull(prefs.branch(), "locale");

	}
};

PerLocaleStatic["Emailed Contacts"] = {
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

PerLocaleStatic["Personal Address Book"] = {
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
		pt    : "Cat\u00E1logo pessoal",
		pl    : "Osobista ksi\u0105\u017Cka adresowa",
		ru    : "\u041B\u0438\u0447\u043D\u0430\u044F \u0430\u0434\u0440\u0435\u0441\u043D\u0430\u044F \u043A\u043D\u0438\u0433\u0430",
		sv    : "Personlig adressbok",
		tr    : "Ki\u015Fisel adres defteri",
		uk    : "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0430 \u0430\u0434\u0440\u0435\u0441\u043D\u0430 \u043A\u043D\u0438\u0433\u0430",
		zh_CN : "\u4e2a\u4eba\u901a\u8baf\u5f55"
	};
