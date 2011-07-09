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

var AppInfo = {
	m_app_version       : null,
	m_is_birthday_field : null,
	m_is_photo          : null,
	m_app_name          : null,
	m_app_name_capital  : null,
	firstcap            : 1, // const ==> first letter capitalised
	eApp                : new ZinEnum( newObjectWithKeysMatchingValues(
	                      'firefox', 'thunderbird', 'thunderbird2', 'thunderbird3', 'seamonkey', 'postbox', 'spicebird', 'other')),
	app_version : function() {
		if (!this.m_app_version) {
			let appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
			this.m_app_version = appInfo.version;
			logger().debug("AppInfo.app_version: returns: " + this.m_app_version);
		}
		return this.m_app_version;
	},
	app_name : function(arg) {
		if (!this.m_m_app_name) {
			const FF_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
			const TB_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
			const SM_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
			const PB_ID = "postbox@postbox-inc.com";                 // Postbox         (paid)
			const PE_ID = "express@postbox-inc.com";                 // Postbox Express (free)
			const SB_ID = "{ee53ece0-255c-4cc6-8a7e-81a8b6e5ba2c}";
			let appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
			switch(appInfo.ID) {
				case FF_ID: this.m_app_name = this.eApp.firefox;     break;
				case TB_ID: this.m_app_name = this.eApp.thunderbird; break;
				case SM_ID: this.m_app_name = this.eApp.seamonkey;   break;
				case PE_ID:
				case PB_ID: this.m_app_name = this.eApp.postbox;     break;
				case SB_ID: this.m_app_name = this.eApp.spicebird;   break;
				default:    this.m_app_name = this.eApp.other;       break;
			}
		}
		return (arg == this.firstcap) ?
		         (this.app_name().substr(0,1).toUpperCase() + this.app_name().substr(1).toLowerCase()) :
		         this.m_app_name;
	},
	is_birthday_field : function() {
		if (this.m_is_birthday_field == null) {
			let versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
			let app_name       = this.app_name();

			this.m_is_birthday_field =
				(app_name == this.eApp.postbox) ||
				(((app_name == this.eApp.thunderbird) && versionChecker.compare(this.app_version(), "3.0b3pre") >= 0)) ||
				(((app_name == this.eApp.seamonkey)   && versionChecker.compare(this.app_version(), "2.0b1") >= 0));

			logger().debug("AppInfo.is_birthday_field: returns: " + this.m_is_birthday_field);
		}
		return this.m_is_birthday_field;
	},
	is_photo : function() {
		if (this.m_is_photo == null) {
			let versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
			let app_name       = this.app_name();

			this.m_is_photo =
				(((app_name == this.eApp.thunderbird) && versionChecker.compare(this.app_version(), "3.0") >= 0)) ||
				(((app_name == this.eApp.seamonkey)   && versionChecker.compare(this.app_version(), "2.0") >= 0));

			// this.m_is_photo = false; // TODO disable for testing release

			logger().debug("AppInfo.is_photo: returns: " + this.m_is_photo);
		}
		return this.m_is_photo;
	},
	ab_version : function() {
		let app_name = this.app_name();
		let ret      = app_name;

		if ((app_name == this.eApp.thunderbird) ||
		    (app_name == this.eApp.seamonkey) ||
		    (app_name == this.eApp.spicebird && this.app_version() >= "0.8"))
			ret = ("@mozilla.org/abmanager;1" in Cc) ? this.eApp.thunderbird3 : this.eApp.thunderbird2;

		return ret;
	}
};
