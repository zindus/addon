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

// see: http://developer.mozilla.org/en/docs/Code_snippets:Preferences
//

function MozillaPreferences()
{
	this.m_prefix        = "extensions." + APP_NAME + ".";
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
	
			this.m_defaultbranch = instance.getDefaultBranch(this.m_prefithis.m_prefix);
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

MozillaPreferences.prototype.getCharPref = function(branch, key, value)
{
	var ret = null;

	if (branch)
	{
		try
		{
			ret = branch.getCharPref(key);
		}
		catch(ex)
		{
			this.reportCatch(ex, key);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}

	// dump("33443366: getCharPref gets preference " + key + " == " + ret + "\n");

	return ret;
}

MozillaPreferences.prototype.getCharPrefOrNull = function(branch, key)
{
	var ret = null;

	if (branch)
		try
		{
			ret = branch.getCharPref(key);
		}
		catch(ex)
		{
			// do nothing
		}

	// dump("MozillaPreferences.getCharPrefOrNull: of key " + key + " returns: " + ret + "\n");

	return ret;
}

MozillaPreferences.prototype.getIntPref = function(branch, key, value)
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
			this.reportCatch(ex, key);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}

	// dump("33443366: getIntPref gets preference " + key + " == " + ret + "\n");

	return ret;
}

MozillaPreferences.prototype.reportCatch = function(ex, key)
{
	if (typeof alert == 'function')
		alert(ex.message + " with key " + key + " stack: \n" + ex.stack);
	else
		print(ex.message + " with key " + key + " stack: \n" + ex.stack);
}
