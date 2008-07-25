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

Account.PROPERTIES = [ 'sourceid', 'format', 'url', 'username', 'password' ];

function Account()
{
	this.m_properties = new Object();
	this.m_bimap_format = getBimapFormat('long');
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
	return this.m_properties['format'];
}

Account.prototype.format_xx = function()
{
	return this.m_bimap_format.lookup(null, this.format());
}

Account.prototype.toString = function(key, value)
{
	var ret = "Account:";

	for (var i = 0; i < Account.PROPERTIES.length; i++)
		ret += " " + Account.PROPERTIES[i] + ": "
		           + (Account.PROPERTIES[i] == 'password' ? "<suppressed>" : this.m_properties[Account.PROPERTIES[i]]);

	return ret;
}

Account.prototype.fromPrefset = function(sourceid)
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);

	prefset.load(sourceid);

	this.set('url',      prefset.getProperty(PrefSet.ACCOUNT_URL));
	this.set('username', prefset.getProperty(PrefSet.ACCOUNT_USERNAME));
	this.set('format',   prefset.getProperty(PrefSet.ACCOUNT_FORMAT)); // format == 'Google', 'Zimbra' etc
	this.set('password', prefset.getPassword());
	this.set('sourceid', sourceid);
}

Account.prototype.save = function()
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);

	prefset.m_id = this.get('sourceid');

	prefset.setProperty(PrefSet.ACCOUNT_URL,      this.get('url'));
	prefset.setProperty(PrefSet.ACCOUNT_USERNAME, this.get('username'));
	prefset.setProperty(PrefSet.ACCOUNT_FORMAT,   this.get('format'));

	// logger().debug("Account.prototype.save: blah: saving prefset with sourceid: " + prefset.m_id);

	prefset.save();
}

Account.prototype.remove = function()
{
	var prefset = new PrefSet(PrefSet.ACCOUNT, PrefSet.ACCOUNT_PROPERTIES);

	prefset.m_id = this.get('sourceid');

	// logger().debug("Account.prototype.remove: blah: removing prefset with sourceid: " + prefset.m_id);

	prefset.remove();
}

function AccountFactory()
{
}

AccountFactory.accountsLoadFromPrefset = function()
{
	var a_sourceid  = preferences().getImmediateChildren(preferences().branch(), PrefSet.ACCOUNT + '.');
	var ret         = new Array();
	var account;

	for (var i = 0; i < a_sourceid.length; i++)
		a_sourceid[i] = Number(a_sourceid[i]);

	a_sourceid.sort(numeric_compare);

	for (var i = 0; i < a_sourceid.length; i++)
	{
		account = new Account();
		account.fromPrefset(a_sourceid[i]);
		ret.push(account);
	}

	// logger().debug("accountsLoadFromPrefset: a_sourceid: " + a_sourceid.toString() +" accounts: " + aToString(ret));

	return ret;
}

