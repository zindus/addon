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

// An instance of this class is passed from SyncFsm to SyncFsm - carrying state from one to the next
//

function SyncFsmChainData(a_accounts)
{
	var account;

	zinAssert(a_accounts);

	this.m_account_index     = 0;
	this.m_a_item            = new Array(a_accounts.length);
	this.m_a_first_of_format = new Object();
	this.m_a_last_of_format  = new Object();
	this.m_a_sourceid        = new Object();
	this.m_zfcTb             = null;

	for (var i = 0; i < this.m_a_item.length; i++)
	{
		account = a_accounts[i];

		this.m_a_item[i] = newObject("account", account);

		for (var j in SyncFsmChainData.ITEM_KEYS)
			this.m_a_item[i][j] = SyncFsmChainData.ITEM_KEYS[j]();

		if (!isPropertyPresent(this.m_a_first_of_format, account.format_xx()))
			this.m_a_first_of_format[account.format_xx()] = i;

		this.m_a_last_of_format[account.format_xx()] = i;

		this.m_a_sourceid[AccountStatic.indexToSourceId(i)] = true;
	}
}

SyncFsmChainData.ITEM_KEYS = {
	is_slow_sync:     function() { return false;        },
	a_failcodes_seen: function() { return new Object(); }
};

SyncFsmChainData.prototype.toString = function()
{
	var ret = "SyncFsmChainData:" + "\n" +
	          " account_index: " + this.m_account_index +
		      " a_first_of_format: " + aToString(this.m_a_first_of_format) +
		      " a_last_of_format: "  + aToString(this.m_a_last_of_format);

	for (var i = 0; i < this.m_a_item.length; i++)
	{
		ret += "\n account: "      + this.account(i).toString();

		for (var j in SyncFsmChainData.ITEM_KEYS)
			if (typeof(this.sourceid(AccountStatic.indexToSourceId(i), j)) == 'object')
				ret += " " + j + ": " + aToString(this.sourceid(AccountStatic.indexToSourceId(i), j));
			else
				ret += " " + j + ": " + this.sourceid(AccountStatic.indexToSourceId(i), j);
	}

	return ret;
}

SyncFsmChainData.prototype.is_first_in_chain = function()
{
	return this.m_account_index == 0;
}

SyncFsmChainData.prototype.is_last_in_chain = function()
{
	return this.m_account_index == this.m_a_item.length - 1;
}

SyncFsmChainData.prototype.account = function(index)
{
	if (index)
		zinAssertAndLog(index < this.m_a_item.length, index);
	else
		index = this.m_account_index;

	return this.m_a_item[index].account;
}

SyncFsmChainData.prototype.length = function()
{
	return this.m_a_item.length;
}

SyncFsmChainData.prototype.first_sourceid_of_format = function(format_xx)
{
	zinAssert(format_xx);

	var index = this.m_a_first_of_format[format_xx];

	return typeof(index) == 'undefined' ? index : AccountStatic.indexToSourceId(index);
}

SyncFsmChainData.prototype.last_sourceid_of_format = function(format_xx)
{
	zinAssert(format_xx);

	var index = this.m_a_last_of_format[format_xx];

	return typeof(index) == 'undefined' ? index : AccountStatic.indexToSourceId(index);
}

SyncFsmChainData.prototype.zfcTb = function()
{
	if (arguments.length == 1)
		this.m_zfcTb = arguments[0];

	return this.m_zfcTb;
}

SyncFsmChainData.prototype.signature = function()
{
	var ret = "";
	var is_first  = true;

	for (var i = 0; i < this.m_a_item.length; i++)
	{
		if (is_first)
			is_first = false;
		else
			ret += ","

		ret += AccountStatic.indexToSourceId(i) + ":" + this.account(i).unique_key();
	}

	return ret;
}

SyncFsmChainData.prototype.sourceid = function(sourceid, key, value)
{
	var index = AccountStatic.sourceIdToIndex(sourceid);

	zinAssertAndLog(index >= 0 && index < this.m_a_item.length, "sourceid: " + sourceid);
	zinAssertAndLog(isPropertyPresent(SyncFsmChainData.ITEM_KEYS, key), "not a valid key: " + key);

	var item = this.m_a_item[index];

	if (typeof(value) != 'undefined')
		item[key] = value;

	return item[key];
}

SyncFsmChainData.prototype.account_names_as_string = function()
{
	var ret = "";
	var is_first  = true;

	for (var i = 0; i < this.m_a_item.length; i++)
	{
		if (is_first)
			is_first = false;
		else
			ret += ","

		ret += this.account(i).username;
	}

	return ret;
}
