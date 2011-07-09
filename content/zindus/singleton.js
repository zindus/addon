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

// Handy place to keep stuff that we only ever need one of
// and for which we want to delay construction until after all .js files are loaded.
//
function singleton() {
	if (typeof (singleton.m_instance) == "undefined")
		singleton.m_instance = new SingletonInstance();

	return singleton.m_instance;
}

function SingletonInstance()
{
	this.m_preferences      = new MozillaPreferences();
	this.m_logger_global    = new Logger(this.get_loglevel_from_preference(), "global");
	this.m_logger_no_prefix = new Logger(this.get_loglevel_from_preference(), "");
}

SingletonInstance.prototype = {
	preferences : function() {
		return this.m_preferences;
	},
	logger : function(type) {
		return (type && type == 'info') ? this.m_logger_no_prefix : this.m_logger_global;
	},
	get_loglevel_from_preference : function() {
		return (this.m_preferences.getCharPrefOrNull(this.m_preferences.branch(),
	                        PrefSet.GENERAL + "." + PrefSet.GENERAL_AS_VERBOSE_LOGGING ) == "true") ? Logger.DEBUG : Logger.INFO;
	}
};
