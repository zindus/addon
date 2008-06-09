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
 * Portions created by Initial Developer are Copyright (C) 2007-2008
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// see: http://developer.mozilla.org/en/docs/Code_snippets:Preferences
//

MozillaPreferences.AS_LOGFILE_MAX_SIZE      = "system.as_logfile_max_size";
MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT = "system.as_timer_delay_on_repeat";
MozillaPreferences.AS_TIMER_DELAY_ON_START  = "system.as_timer_delay_on_start";
MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL  = "system.zm_sync_gal_md_interval";
MozillaPreferences.ZM_SYNC_GAL_IF_FEWER     = "system.zm_sync_gal_if_fewer";
MozillaPreferences.ZM_SYNC_GAL_RECHECK      = "system.zm_sync_gal_recheck";
MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME = "system.zm_prefer_soapurl_scheme";
MozillaPreferences.GD_SCHEME_DATA_TRANSFER  = "system.gd_data_transfer_scheme";

function MozillaPreferences()
{
	if (arguments.length == 0)
		this.m_prefix = "extensions." + APP_NAME + ".";
	else
		this.m_prefix = arguments[0];

	this.m_branch        = null;
	this.m_defaultbranch = null;
}

MozillaPreferences.prototype.branch = function()
{
	if (this.m_branch == null)
	{
		try
		{
			var instance = Components.classes["@mozilla.org/preferences-service;1"].
		                                       getService(Components.interfaces.nsIPrefService);
	
			this.m_branch = instance.getBranch(this.m_prefix);
		}
		catch(ex)
		{
			alert("Preferences::getService : " + ex);
		}
	}

	return this.m_branch;
}

MozillaPreferences.prototype.defaultbranch = function()
{
	if (this.m_defaultbranch == null)
	{
		try
		{
			var instance = Components. classes["@mozilla.org/preferences-service;1"].
		                                        getService(Components.interfaces.nsIPrefService);
	
			this.m_defaultbranch = instance.getDefaultBranch(this.m_prefix);
		}
		catch(ex)
		{
			alert("Preferences::getService : " + ex);
		}
	}

	return this.m_defaultbranch;
}

MozillaPreferences.prototype.setIntPref = function(branch, key, value)
{
	var intValue = parseInt(value);

	zinAssert(!isNaN(intValue));

	// dump("33443366: setIntPref sets preference " + key + ", and " + typeof(intValue) + " " + intValue + "\n");

	if (branch)
		branch.setIntPref(key, intValue);
}

MozillaPreferences.prototype.setCharPref = function(branch, key, value)
{
	if (branch)
		branch.setCharPref(key, value);
}

MozillaPreferences.prototype.getCharPrefReal = function(branch, key, mustbepresent)
{
	var ret = null;

	if (branch)
	{
		try
		{
			ret = String(branch.getCharPref(key));
		}
		catch(ex)
		{
			if (mustbepresent)
			{
				this.reportCatch(ex, key);

				throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
			}
		}
	}

	return ret;
}

MozillaPreferences.prototype.getCharPref = function(branch, key)
{
	return this.getCharPrefReal(branch, key, true);
}

MozillaPreferences.prototype.getCharPrefOrNull = function(branch, key)
{
	return this.getCharPrefReal(branch, key, false);
}

MozillaPreferences.prototype.getIntPrefReal = function(branch, key, value, mustbepresent)
{
	var ret = null;

	if (branch)
	{
		try
		{
			var tmp = branch.getIntPref(key);

			if (!isNaN(tmp))
			{
				ret = parseInt(tmp);
			}
		}
		catch(ex)
		{
			if (mustbepresent)
			{
				this.reportCatch(ex, key);

				throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
			}
		}
	}

	return ret;
}

MozillaPreferences.prototype.getIntPref = function(branch, key, value)
{
	return this.getIntPrefReal(branch, key, value, true);
}

MozillaPreferences.prototype.getIntPrefOrNull = function(branch, key, value)
{
	return this.getIntPrefReal(branch, key, value, false);
}

MozillaPreferences.prototype.reportCatch = function(ex, key)
{
	if (typeof alert == 'function')
		alert(ex.message + " with key " + key + " stack: \n" + ex.stack);
	else
		print(ex.message + " with key " + key + " stack: \n" + ex.stack);
}
