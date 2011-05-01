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
// $Id: mozillapreferences.js,v 1.40 2011-05-01 02:36:30 cvsuser Exp $

// see: http://developer.mozilla.org/en/docs/Code_snippets:Preferences
//
// FIXME:
// this class needs to be refactored:
// - each key has important attributes:
//   - the preference name
//   - type: char/int/bool
//   - parent key ... to generalise prefset?
// - don't currently support boolean - this should change
//
// this class currently services two orthogonal purposes:
// - a facade to nsIPrefService
// - home for preference keys that don't belong in a prefset

MozillaPreferences.AS_LOGFILE_MAX_SIZE      = "system.as_logfile_max_size";
MozillaPreferences.AS_LOGFILE_ROTATIONS     = "system.as_logfile_rotations";
MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT = "system.as_timer_delay_on_repeat";
MozillaPreferences.AS_TIMER_DELAY_ON_START  = "system.as_timer_delay_on_start";
MozillaPreferences.AS_ALLOW_PRE_RELEASE     = "system.as_allow_pre_release";
MozillaPreferences.AS_PASSWORD_VERSION      = "system.as_password_version";
MozillaPreferences.AS_SHARE_SERICE_API_URL  = "system.as_share_service_api_url";
MozillaPreferences.AS_MIGRATION             = "system.as_migration";
MozillaPreferences.AS_SHOW_AGAIN_SLOW_SYNC  = "system.as_show_again_slow_sync";
MozillaPreferences.AS_CHUNK_SIZE_SCALE      = "system.as_chunk_size_scale";
MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL  = "system.zm_sync_gal_md_interval";
MozillaPreferences.ZM_SYNC_GAL_IF_FEWER     = "system.zm_sync_gal_if_fewer";
MozillaPreferences.ZM_SYNC_GAL_RECHECK      = "system.zm_sync_gal_recheck";
MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME = "system.zm_prefer_soapurl_scheme";
MozillaPreferences.ZM_SHARE_SERVICE_URL     = "system.zm_share_service_url";
MozillaPreferences.GD_SCHEME_DATA_TRANSFER  = "system.gd_data_transfer_scheme";
MozillaPreferences.GD_TRASH_EXPIRE_SECONDS  = "system.gd_trash_expire_seconds";
MozillaPreferences.GD_CONTACTS_PER_REQUEST  = "system.gd_contacts_per_request";
MozillaPreferences.GD_CONFIRM_ON_ERASE      = "system.gd_confirm_on_erase";

MozillaPreferences.getAllSystemPrefs = function()
{
	return newObject(
		MozillaPreferences.AS_LOGFILE_MAX_SIZE,      'int',
		MozillaPreferences.AS_LOGFILE_ROTATIONS,     'int',
		MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT, 'int',
		MozillaPreferences.AS_TIMER_DELAY_ON_START,  'int',
		MozillaPreferences.AS_PASSWORD_VERSION,      'char',
		MozillaPreferences.AS_SHARE_SERICE_API_URL,  'char',
		MozillaPreferences.AS_SHOW_AGAIN_SLOW_SYNC,  'bool',
		MozillaPreferences.AS_CHUNK_SIZE_SCALE,      'int',
		MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL,  'int',
		MozillaPreferences.ZM_SYNC_GAL_IF_FEWER,     'int',
		MozillaPreferences.ZM_SYNC_GAL_RECHECK,      'int',
		MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME, 'char',
		MozillaPreferences.ZM_SHARE_SERVICE_URL,     'char',
		MozillaPreferences.GD_SCHEME_DATA_TRANSFER,  'char',
		MozillaPreferences.GD_TRASH_EXPIRE_SECONDS,  'int',
		MozillaPreferences.GD_CONTACTS_PER_REQUEST,  'int',
		MozillaPreferences.GD_CONFIRM_ON_ERASE,      'bool' );
}

function MozillaPreferences()
{
	if (arguments.length == 0)
		this.m_prefix = "extensions." + APP_NAME + ".";
	else
		this.m_prefix = arguments[0];

	this.m_branch        = null;
	this.m_defaultbranch = null;
}

MozillaPreferences.prototype =
{
	branch : function() {
		if (this.m_branch == null) {
			try {
				let instance = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

				this.m_branch = instance.getBranch(this.m_prefix);
			}
			catch(ex) {
				zinAssertCatch(ex);
			}
		}

		return this.m_branch;
	},
	defaultbranch : function() {
		if (this.m_defaultbranch == null) {
			try {
				let instance = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

				this.m_defaultbranch = instance.getDefaultBranch(this.m_prefix);
			}
			catch(ex) {
				zinAssertCatch(ex);
			}
		}

		return this.m_defaultbranch;
	},
	setIntPref : function(branch, key, value) {
		let intValue = Number(value);

		zinAssert(!isNaN(intValue));

		if (branch)
			branch.setIntPref(key, intValue);
	},
	setCharPref : function(branch, key, value) {
		if (branch)
			branch.setCharPref(key, value);
	},
	setBoolPref : function(branch, key, value) {
		if (branch)
			branch.setBoolPref(key, Boolean(value));
	},
	getPrefReal : function(branch, key, type, mustbepresent) {
		let ret = null;
		let tmp;

		if (branch) {
			try {
				switch(type) {
					case 'int':
						tmp = branch.getIntPref(key);

						if (!isNaN(tmp))
							ret = Number(tmp);

						break;
					case 'char':
						ret = String(branch.getCharPref(key));
						break;
					case 'bool':
						ret = Boolean(branch.getBoolPref(key));
						break;
					default:
						zinAssert(false, type);
				}
			}
			catch(ex) {
				if (mustbepresent)
					zinAssertAndLog(false, key);
			}
		}

		return ret;
	},
	getImmediateChildren : function(branch, key) {
		let ret   = new Array();
		let a_key = {};
		let i;

		if (branch) {
			try {
				let a_tmp = branch.getChildList(key, {});

				// logger().debug("getImmediateChildren: key: " + key + " a_tmp: " + a_tmp.toString());

				let re = new RegExp('^' + key + '(\\w*).*$');

				for (i = 0; i < a_tmp.length; i++)
					a_key[String(a_tmp[i]).replace(re, "$1")] = null;
			}
			catch(ex) {
				zinAssertAndLog(false, key);
			}
		}

		for (i in a_key)
			ret.push(i);

		return ret;
	},
	deleteBranch : function (branch) {
		branch.deleteBranch("");
	},
	getCharPref       : function(branch, key) { return this.getPrefReal(branch, key, 'char', true);  },
	getCharPrefOrNull : function(branch, key) { return this.getPrefReal(branch, key, 'char', false); },
	getIntPref        : function(branch, key) { return this.getPrefReal(branch, key, 'int',  true);  },
	getIntPrefOrNull  : function(branch, key) { return this.getPrefReal(branch, key, 'int',  false); },
	getBoolPref       : function(branch, key) { return this.getPrefReal(branch, key, 'bool', true);  },
	getBoolPrefOrNull : function(branch, key) { return this.getPrefReal(branch, key, 'bool', false); }
};
