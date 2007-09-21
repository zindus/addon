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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

function PasswordManager()
{
	this.m_pm = null;

    this.createInstance();
}

PasswordManager.prototype.createInstance = function()
{
	this.m_pm = Components.classes["@mozilla.org/passwordmanager;1"].createInstance();
}

PasswordManager.prototype.get = function(server, login)
{
	var value = null;

	try {
		var hostname = { value: "" };
		var username = { value: "" };
		var password = { value: "" };

		var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManagerInternal);

		pm.findPasswordEntry(server, login, "", hostname, username, password);

		value = password.value;
	}
	catch (ex) {
		// do nothing - if (server, login) doesn't exist the component throws an exception
	}

	return value;
}

PasswordManager.prototype.del = function(server, login)
{
	var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManager);

	try {
		pm.removeUser(server, login);
	}
	catch (ex) {
		// do nothing - if (server, login) doesn't exist the component throws an exception
		newZinLogger("PasswordManager").debug("PasswordManager.del: server: " + server + " login: " + login);
	}
}

PasswordManager.prototype.set = function(server, login, password)
{
	try {
		var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManager);

		// Here we have to remove the old password first, because
		// addUser does not update it

		pm.removeUser(server, login);
	}
	catch (ex)
	{
		newZinLogger("PasswordManager").debug("PasswordManager.set: server: " + server + " login: " + login);
	}

	this.m_pm.addUser(server, login, password);
}
