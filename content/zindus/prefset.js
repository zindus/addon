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

function PrefSet(prefprefix, a)
{
	this.m_id            = -1;
	this.m_prefprefix    = prefprefix;
	this.m_properties    = new Object();
	// this.m_logger        = newZinLogger("Prefset");

	for (var i in a)
		this.m_properties[a[i]] = PrefSet.DEFAULT_VALUE;
}

PrefSet.DEFAULT_VALUE            = null;

PrefSet.SERVER                   = "server";
PrefSet.SERVER_URL               = "url";
PrefSet.SERVER_USERNAME          = "username";
PrefSet.SERVER_PROPERTIES        = [ PrefSet.SERVER_URL, PrefSet.SERVER_USERNAME ];

PrefSet.GENERAL                  = "general";
PrefSet.GENERAL_MANUAL_SYNC_ONLY = "manualsynconly";
PrefSet.GENERAL_VERBOSE_LOGGING  = "verboselogging";
PrefSet.GENERAL_PROPERTIES       = [ PrefSet.GENERAL_MANUAL_SYNC_ONLY, PrefSet.GENERAL_VERBOSE_LOGGING ];

// Both id and branch are optional
// id is option because there might only be a single subsection under prefprefix
// branch is optional because
// a) the collection need only create one branch object and pass it to each .load() method
// b) at some point we might like to distinguish between user-defined and default preferences,
//
PrefSet.prototype.load = function(id, branch)
{
	var i, mp, prefs;

	zinAssert((arguments.length == 0) || (arguments.length == 1) || (arguments.length == 2));

	if (arguments.length == 0)
		id = null;

	if (arguments.length < 2)
	{
		mp = new MozillaPreferences();
		prefs = mp.branch();
	}
	else
	{
		prefs = branch;
	}

	for (i in this.m_properties)
	{
		try
		{
			this.m_properties[i] = new String(prefs.getCharPref(this.makePrefKey(id, i)));
		}
		catch (ex)
		{
			// do nothing
			// dump("PrefSet::load(" + id + ") - did not load preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
		}

		// this.m_logger.debug("load: loaded preference " + this.makePrefKey(id, i) + " == " + this.m_properties[i] + "\n");
	}

	this.m_id = id;
	
	return true;
}

PrefSet.prototype.save = function()
{
	var mp = new MozillaPreferences();
	var prefs = mp.branch();
	var i;
	var retval = false;

	zinAssert(this.m_id >= 0);

	// this.m_logger.debug("save: ");

	try
	{
		for (i in this.m_properties)
		{
			prefs.setCharPref(this.makePrefKey(this.m_id, i), this.m_properties[i]);

			// this.m_logger.debug("save: preference: " + this.makePrefKey(this.m_id, i) + " == " + this.m_properties[i]);
		}

		retval = true;
	}
	catch (ex)
	{
		// do nothing
		// dump("PrefSet::save(" + this.m_id + ") - did not save preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
	}
	
	return retval;
}

PrefSet.prototype.remove = function()
{
	var mp = new MozillaPreferences();
	var prefs = mp.branch();
	var retval = false;

	zinAssert(this.m_id >= 0);

	// this.m_logger.debug("remove: ");

	try
	{
		prefs.deleteBranch(this.makePrefKey(this.m_id));

		// dump("PrefSet.prototype.remove - deleted preferences for " + this.makePrefKey(this.m_id) + "\n");

		retval = true;
	}
	catch (ex)
	{
		// do nothing
		// dump("PrefSet::save(" + this.m_id + ") - did not save preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
	}
	
	return retval;
}

PrefSet.prototype.toString = function()
{
	var ret = "";
	var str;

	ret += " m_id: " + this.m_id;
	ret += " m_properties: {";

	for (i in this.m_properties)
	{
		str = this.m_properties[i] == PrefSet.DEFAULT_VALUE ? "<no-pref-value>" : this.m_properties[i];
		ret += " " + i + ": \"" + str + "\"";
	}

	ret += " }";

	return ret;
}

PrefSet.prototype.isaProperty = function(property)
{
	return (typeof(this.m_properties[property]) != "undefined");
}

PrefSet.prototype.getProperty = function(property)
{
	zinAssert(arguments.length == 1);
	return this.m_properties[property];
}

PrefSet.prototype.setProperty = function(property, value)
{
	this.m_properties[property] = value;
}

PrefSet.prototype.getId = function()
{
	return this.m_id;
}

// Makes keys of the following form:
// with m_prefprefix == "fred"
//    id      property      key
//    --      --------      ---
//    null    not supplied  fred
//    1       not supplied  fred.1
//    1       joe           fred.1.joe
//
PrefSet.prototype.makePrefKey = function(id, property)
{
	var ret = "";

	ret += this.m_prefprefix;
	
	if (id != null)
		ret += "." + id;

	if (arguments.length == 2)
	{
		ret +=  "." + property;
	}

	return ret;
}

function PrefSetHelper()
{
}

// return credentials from preferences and the password manager
//
PrefSetHelper.getUserUrlPw = function(prefset, pref_user, pref_url)
{
	var url, username, pw, pm;

	username = prefset.getProperty(pref_user);
	url      = prefset.getProperty(pref_url);

	if (username != null && url != null)
	{
		pm = new PasswordManager();
		pw = pm.get(url, username);
	}
	else
		pw = "";

	if (username == null) username = "";
	if (url == null)      url = "";

	// dump("PrefSetHelper.getUserUrlPw: blah2: username: " + (username == null ? "isnull" : username) +
	//                                            " url: " + (url == null ? "isnull" : url) + "\n");

	// we return String(x) because we want their typeof() to be 'string' instead of 'object'
	// see: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Objects:String#Description
	//
	return [ String(username), String(url), String(pw) ];
}
