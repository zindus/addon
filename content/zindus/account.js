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
 * Portions created by Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

Account.format              = PrefSet.ACCOUNT_FORMAT;
Account.url                 = PrefSet.ACCOUNT_URL;
Account.username            = PrefSet.ACCOUNT_USERNAME;
Account.gd_sync_with        = PrefSet.ACCOUNT_GD_SYNC_WITH;
Account.zm_sync_gal_enabled = PrefSet.ACCOUNT_ZM_SYNC_GAL_ENABLED;
Account.passwordlocator     = 'passwordlocator';

Account.PER_FORMAT_PROPERTIES = [ Account.gd_sync_with, Account.zm_sync_gal_enabled ];
Account.PROPERTIES            = [ Account.format, Account.url, Account.username, Account.passwordlocator ];
Account.PROPERTIES            = Account.PROPERTIES.concat(Account.PER_FORMAT_PROPERTIES);
Account.Google                = 'Google';   // these values are hardcoded into extensions.zindus.account.nn.format preferences
Account.Zimbra                = 'Zimbra';   // so if you ever want to change one the old preference values have to be migrated
Account.BIMAP_FORMAT          = getBimapFormat('long');

function Account(account)
{
	if (account)
	{
		this.m_properties = account.m_properties;
		this.m_sourceid   = account.m_sourceid;
	}
	else
	{
		this.m_properties = new Object();
		this.m_sourceid = null;
	}
}

Account.indexToSourceId = function(index)
{
	zinAssert(typeof(index) != 'undefined');

	return index + SOURCEID_TB + 1;
}

Account.sourceIdToIndex = function(sourceid)
{
	zinAssert(typeof(sourceid) != 'undefined');

	return sourceid - SOURCEID_TB - 1;
}

Account.prototype.get = function(key)
{
	zinAssertAndLog(isInArray(key, Account.PROPERTIES), "key: " + key);

	return this.m_properties[key];
}

Account.prototype.set = function(key, value)
{
	this.m_properties[key] = value;
}

Account.prototype.format = function()
{
	return this.m_properties[Account.format];
}

Account.prototype.unique_key = function()
{
	var ret;

	switch(this.format_xx())
	{
		case FORMAT_ZM: ret = hyphenate(":", Account.Zimbra, this.get(Account.url), this.get(Account.username)); break;
		case FORMAT_GD: ret = hyphenate(":", Account.Google,                  this.get(Account.username)); break;
		default: zinAssertAndLog(false, "mismatched case: " + this.format_xx());
	}

	return ret;
}

Account.prototype.sourceid = function(sourceid)
{
	if (sourceid)
		this.m_sourceid = sourceid;

	return this.m_sourceid;
}

Account.prototype.format_xx = function()
{
	return Account.BIMAP_FORMAT.lookup(null, this.format());
}

Account.prototype.toString = function()
{
	var ret = "Account:";

	ret += " sourceid: " + this.sourceid();

	for (var i in this.m_properties)
		ret += " " + i + ": " + this.m_properties[i];

	return ret;
}

Account.arrayToString = function(a_accounts)
{
	var ret = "";

	for (var i = 0; i < a_accounts.length; i++)
		ret += "\n " + a_accounts[i].toString();

	return ret;
}

Account.prototype.fromPrefset = function(sourceid)
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);
	var ret = true;
	var i, value;

	prefset.load(sourceid);

	this.set(Account.url,                 prefset.getProperty(PrefSet.ACCOUNT_URL));
	this.set(Account.username,            prefset.getProperty(PrefSet.ACCOUNT_USERNAME));
	this.set(Account.format,              prefset.getProperty(PrefSet.ACCOUNT_FORMAT));      // format == Account.Google, Account.Zimbra etc

	this.sourceid(sourceid);

	const a_keys = newObject(Account.url, null, Account.username, null, Account.format, null);

	for (i in a_keys)
		if (!this.get(i) || this.get(i).length < 1)
			ret = false;

	if (ret)
	{
		this.set(Account.passwordlocator,     new PasswordLocator(this.get(Account.url), this.get(Account.username)));

		for (i = 0; i < Account.PER_FORMAT_PROPERTIES.length; i++)
		{
			value = prefset.getProperty(Account.PER_FORMAT_PROPERTIES[i]);

			if (value != PrefSet.DEFAULT_VALUE)
				this.set(Account.PER_FORMAT_PROPERTIES[i], value);
		}

	}

	logger().debug("Account.prototype.fromPrefset: sourceid: " + sourceid + " prefset: " + prefset.toString() + " returns: " + ret);

	return ret;
}

Account.prototype.save = function()
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);
	var value;

	prefset.m_id = this.sourceid();

	prefset.remove(); // flush out any child preferences that we don't want to keep - eg when the account format changes

	prefset.setProperty(PrefSet.ACCOUNT_URL,      this.get(Account.url));
	prefset.setProperty(PrefSet.ACCOUNT_USERNAME, this.get(Account.username));
	prefset.setProperty(PrefSet.ACCOUNT_FORMAT,   this.get(Account.format));

	for (var i = 0; i < Account.PER_FORMAT_PROPERTIES.length; i++)
		prefset.delProperty(Account.PER_FORMAT_PROPERTIES[i]);

	value = this.get(Account.gd_sync_with);        if (value) prefset.setProperty(PrefSet.ACCOUNT_GD_SYNC_WITH,        value);
	value = this.get(Account.zm_sync_gal_enabled); if (value) prefset.setProperty(PrefSet.ACCOUNT_ZM_SYNC_GAL_ENABLED, value);

	prefset.save();
}

Account.prototype.remove = function()
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);

	prefset.m_id = this.sourceid();

	logger().debug("Account.prototype.remove: blah: removing prefset with sourceid: " + prefset.m_id);

	prefset.remove();
}

function AccountFactory()
{
}

AccountFactory.accountsLoadFromPrefset = function()
{
	var a_sourceid    = preferences().getImmediateChildren(preferences().branch(), PrefSet.ACCOUNT + '.');
	var ret           = new Array();
	var has_integrity = true;
	var i, account;

	for (var i = 0; i < a_sourceid.length; i++)
		a_sourceid[i] = Number(a_sourceid[i]);

	a_sourceid.sort(numeric_compare);

	// accounts have integrity:
	// - if the keys are 0, 1, 2 etc, offset as per indexToSourceId()
	// - account format is one of the Account.Google, Account.Zimbra values
	// If for some reason the accounts don't have integrity (eg the user messed with them), we wipe the lot...
	//

	for (i = 0; i < a_sourceid.length; i++)
	{
		account = new Account();
		has_integrity = account.fromPrefset(a_sourceid[i]);

		if (!has_integrity || account.sourceid() != Account.indexToSourceId(i) || !Account.BIMAP_FORMAT.isPresent(null, account.format()))
		{
			logger().error("This account doesn't have integrity: " + account.toString());
			has_integrity = false;
			break;
		}

		ret.push(account);
	}

	if (!has_integrity)
	{
		ret = new Array();
		logger().error("Wiping all accounts");

		for (i = 0; i < a_sourceid.length; i++)
		{
			account = new Account();
			account.fromPrefset(a_sourceid[i]);
			account.remove();
		}
	}

	logger().debug("accountsLoadFromPrefset: accounts: " + Account.arrayToString(ret));

	return ret;
}
