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

function PrefSet(prefprefix, a)
{
	this.m_id         = PrefSet.ID_UNINITIALISED;
	this.m_prefprefix = prefprefix;
	this.m_properties = new Object();

	for (var i in a)
		this.m_properties[a[i]] = PrefSet.DEFAULT_VALUE;
}

PrefSet.DEFAULT_VALUE         = null;
PrefSet.ID_UNINITIALISED      = -1;

PrefSet.ACCOUNT               = "account";
PrefSet.ACCOUNT_FORMAT        = "format";
PrefSet.ACCOUNT_URL           = "url";
PrefSet.ACCOUNT_USERNAME      = "username";
PrefSet.ACCOUNT_PROPERTIES    = [ PrefSet.ACCOUNT_URL, PrefSet.ACCOUNT_USERNAME, PrefSet.ACCOUNT_FORMAT ];

PrefSet.PREAUTH               = "preauth";
PrefSet.PREAUTH_NAME          = "name";
PrefSet.PREAUTH_REGEXP        = "regexp";
PrefSet.PREAUTH_URI_HIER_PART = "preauth_url_hier_part";
PrefSet.PREAUTH_POST_BODY     = "preauth_post_body";
PrefSet.PREAUTH_PROPERTIES    = [ PrefSet.PREAUTH_NAME, PrefSet.PREAUTH_REGEXP, PrefSet.PREAUTH_URI_HIER_PART, PrefSet.PREAUTH_POST_BODY ];

PrefSet.GENERAL                        = "general";
PrefSet.GENERAL_AUTO_SYNC              = "as_auto_sync";
PrefSet.GENERAL_VERBOSE_LOGGING        = "as_verbose_logging";
PrefSet.GENERAL_GD_SYNC_WITH           = "gd_sync_with";
PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS = "gd_sync_postal_address";
PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED    = "zm_sync_gal_enabled";
PrefSet.GENERAL_PROPERTIES             = [ PrefSet.GENERAL_AUTO_SYNC,             PrefSet.GENERAL_VERBOSE_LOGGING,
                                           PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED,   PrefSet.GENERAL_GD_SYNC_WITH,
										   PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS ];

// Both id and branch are optional
// id is optional because there might only be a single subsection under prefprefix
// branch is optional because
// a) the collection need only create one branch object and pass it to each .load() method
// b) at some point we might like to distinguish between user-defined and default preferences,
//
PrefSet.prototype.load = function(id, branch)
{
	zinAssert((arguments.length == 0) || (arguments.length == 1) || (arguments.length == 2));

	this.m_id = id ?     id     : PrefSet.ID_UNINITIALISED;
	branch    = branch ? branch : preferences().branch();

	for (var i in this.m_properties)
	{
		try {
			this.m_properties[i] = branch.getCharPref(this.makePrefKey(this.m_id, i));
		}
		catch (ex) {
		}
	}

	return true;
}

PrefSet.prototype.save = function()
{
	var branch = preferences().branch();
	var i;
	var retval = false;

	zinAssert(this.m_id != null && (this.m_id == PrefSet.ID_UNINITIALISED || this.m_id >= 0));

	try {
		for (i in this.m_properties)
			branch.setCharPref(this.makePrefKey(this.m_id, i), this.m_properties[i]);

		retval = true;
	}
	catch (ex) {
	}
	
	return retval;
}

PrefSet.prototype.remove = function()
{
	var branch = preferences().branch();
	var ret = false;

	zinAssert(this.m_id != null && (this.m_id == PrefSet.ID_UNINITIALISED || this.m_id >= 0));

	try {
		branch.deleteBranch(this.makePrefKey(this.m_id));

		ret = true;
	}
	catch (ex) {
	}
	
	return ret;
}

PrefSet.prototype.hasUserValue = function(property)
{
	var branch = preferences().branch();
	var ret = false;

	try {
		ret = branch.prefHasUserValue(this.makePrefKey(this.m_id, property));
	}
	catch (ex) {
	}

	return ret;
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

PrefSet.prototype.isPropertyPresent = function(property)
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
	
	if (id != PrefSet.ID_UNINITIALISED)
		ret += "." + id;

	if (arguments.length == 2)
		ret +=  "." + property;

	return ret;
}

PrefSet.prototype.getPassword = function()
{
	zinAssert(this.m_prefprefix == PrefSet.ACCOUNT);

	var username = this.getProperty(PrefSet.ACCOUNT_USERNAME);
	var url      = this.getProperty(PrefSet.ACCOUNT_URL);
	var ret      = null;

	if (username != null && url != null)
	{
		var pm = new PasswordManager();
		ret = String(pm.get(url, username));
	}

	return ret;
}
