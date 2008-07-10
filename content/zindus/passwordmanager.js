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
	this.m_nsIPasswordManagerInternal = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManagerInternal);
	this.m_nsIPasswordManager         = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManager);
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
