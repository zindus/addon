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

function PasswordManager()
{
	this.m_pm                         = Cc["@mozilla.org/passwordmanager;1"].createInstance();
	this.m_nsIPasswordManagerInternal = this.m_pm.QueryInterface(Ci.nsIPasswordManagerInternal);
	this.m_nsIPasswordManager         = this.m_pm.QueryInterface(Ci.nsIPasswordManager);
	this.m_logger                     = newLogger("PasswordManager");
}

PasswordManager.prototype.get = function(host, username)
{
	var value = null;

	try {
		var a_host     = { value: "" };
		var a_username = { value: "" };
		var a_password = { value: "" };

		this.m_nsIPasswordManagerInternal.findPasswordEntry(host, username, "", a_host, a_username, a_password);

		value = a_password.value;
	}
	catch (ex) {
	}

	return value;
}

PasswordManager.prototype.del = function(host, username)
{
	var is_success = true;

	try {
		this.m_nsIPasswordManager.removeUser(host, username);
	}
	catch (ex) {
		is_success = false;
	}

	this.m_logger.debug("PasswordManager.del: host: " + host + " username: " + username + (is_success ? " succeeded" : " failed"));

	return is_success;
}

PasswordManager.prototype.set = function(host, username, password)
{
	try {
		this.m_nsIPasswordManager.removeUser(host, username); // Remove the old password first because addUser does "add" not "udpate"
	}
	catch (ex)
	{
	}

	this.m_nsIPasswordManager.addUser(host, username, password);

	this.m_logger.debug("PasswordManager.set: host: " + host + " username: " + username);
}

// The "test sync with account" feature means that we have to use a password without it being saved in the password manager
// against it's url and username.
// At the same time, we want to minimise the extent to which passwords are managed in cleartext in memory
// So what we do is store immediately store all passwords in the password manager using PasswordLocator
// and for the "test sync with account" feature we can use a fake url and username that's independent of the real sync url and username
//

PasswordLocator.TempUrl      = "http://temp-password-for-zindus-account.tld";
PasswordLocator.TempUsername = "username-should-never-persist-beyond-config-setup";

// one arg  ==> copy constructor
// two args ==> url and username
//
function PasswordLocator(url, username)
{
	if (arguments.length == 1)
	{
		var pl = url;

		username = pl.username();
		url      = pl.url();
	}

	zinAssertAndLog(typeof(url) != 'undefined' && typeof(username) != 'undefined' &&
	                url != null && username != null, "url: " + url + " username: " + username);

	this.m_url      = url;
	this.m_username = username;
}

PasswordLocator.prototype.toString = function()
{
	return "url: " + this.url() + " username: " + this.username();
}

PasswordLocator.prototype.url = function(value)
{
	if (value)
		this.m_url = value;

	return this.m_url;
}

PasswordLocator.prototype.username = function(value)
{
	if (value)
		this.m_username = value;

	return this.m_username;
}

PasswordLocator.prototype.delPassword = function()
{
	var pm = new PasswordManager();
	ret = pm.del(this.m_url, this.m_username);
}

PasswordLocator.prototype.setPassword = function(value)
{
	var ret = null;

	if (value)
	{
		var pm = new PasswordManager();
		pm.set(this.m_url, this.m_username, value);
		ret = value;
	}

	return ret;
}

PasswordLocator.prototype.getPassword  = function()
{
	var ret = null;

	if (this.m_url && this.m_username)
	{
		var pm = new PasswordManager();
		ret = pm.get(this.m_url, this.m_username);
	}

	return ret;
}
