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

function PasswordManager()
{
	this.m_pm                         = Cc["@mozilla.org/passwordmanager;1"].createInstance();
	this.m_nsIPasswordManagerInternal = this.m_pm.QueryInterface(Ci.nsIPasswordManagerInternal);
	this.m_nsIPasswordManager         = this.m_pm.QueryInterface(Ci.nsIPasswordManager);
	this.m_logger                     = newLogger("PasswordManager");
}

PasswordManager.prototype = {
	get : function(host, username) {
		var value = null;

		try {
			var a_host     = { value: "" };
			var a_username = { value: "" };
			var a_password = { value: "" };

			this.m_nsIPasswordManagerInternal.findPasswordEntry(host, username, "", a_host, a_username, a_password);

			value = a_password.value;
		}
		catch (ex) {
			this.m_logger.debug("get: findPasswordEntry failed: host: " + host + " username: " + username + " ex: " + ex);
		}

		return value;
	},
	del : function(host, username) {
		var is_success = true;
		zinAssert(typeof(host) == 'string');
		zinAssert(typeof(username) == 'string');

		try {
			this.m_nsIPasswordManager.removeUser(host, username);
		}
		catch (ex) {
			is_success = false;
			// this.m_logger.debug("del: removeUser failed: host: " + host + " username: " + username + " ex: " + ex); // issue #172
		}

		if (is_success)
			this.m_logger.debug("del: host: " + host + " username: " + username + (is_success ? " succeeded" : " failed"));

		return is_success;
	},
	set : function(host, username, password) {
		var is_success = false;

		try {
			this.m_nsIPasswordManager.removeUser(host, username); // Remove the old password first because addUser does "add" not "udpate"
		}
		catch (ex) {
			// this.m_logger.debug("set: removeUser failed: host: " + host + " username: " + username + " ex: " + ex); // issue #172
		}

		try {
			is_success = true;
			this.m_nsIPasswordManager.addUser(host, username, password);
		}
		catch (ex) {
			this.m_logger.debug("set: addUser failed: host: " + host + " username: " + username + " ex: " + ex);
		}

		if (is_success)
			this.m_logger.debug("set: host: " + host + " username: " + username);
	}
};

// PasswordLocator
// This class allows us to avoid ever passing a password from one function to another.
// Instead, we pass around instances of PasswordLocator then retrieve the actual password from Thunderbird's password
// manager when we have to use it.
//
// one arg  ==> copy constructor
// two args ==> url and username
//
function PasswordLocator()
{
	var url, username;

	if (arguments.length == 1) {
		url      = arguments[0].url();
		username = arguments[0].username();
	}
	else if (arguments.length == 2) {
		url      = arguments[0];
		username = arguments[1];
	}
	else
		zinAssert(false);

	zinAssertAndLog(typeof(url) != 'undefined' && typeof(username) != 'undefined' &&
	                url != null && username != null, function () { return "url: " + url + " username: " + username; });

	this.m_url      = url;
	this.m_username = username;
}

PasswordLocator.prototype = {
	toString : function() {
		return "url: " + this.url() + " username: " + this.username();
	},
	url : function(value) {
		if (value)
			this.m_url = value;

		return this.m_url;
	},
	username : function(value) {
		if (value)
			this.m_username = value;

		return this.m_username;
	},
	delPassword : function() {
		let pm = new PasswordManager();
		pm.del(this.m_url, this.m_username);
	},
	setPassword : function(value) {
		if (value) {
			let pm = new PasswordManager();
			pm.set(this.m_url, this.m_username, value);
		}
	},
	getPassword : function() {
		var ret = null;

		if (this.m_url && this.m_username) {
			let pm = new PasswordManager();
			ret = pm.get(this.m_url, this.m_username);
		}

		return ret;
	}
};
