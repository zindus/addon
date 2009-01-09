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

var eAccount = new ZinEnum( {
	sourceid            : 'sourceid',
	format              : 'format',
	url                 : 'url',
	username            : 'username',
	gd_sync_with        : 'gd_sync_with',
	gd_suggested        : 'gd_suggested',
	zm_sync_gal_enabled : 'zm_sync_gal_enabled',
	passwordlocator     : 'passwordlocator'
} );

Account.Google = 'Google';   // these values are hardcoded into extensions.zindus.account.nn.format preferences
Account.Zimbra = 'Zimbra';   // so if you ever want to change one the old preference values have to be migrated

function Account(account)
{
	this.m_properties = account ? account.m_properties : new Object();

	let key, value;
	for each ([key, value] in eAccount) {
		this.__defineGetter__(key, this.make_getter(key));
		this.__defineSetter__(key, this.make_setter(key));
	}
}

Account.prototype = {
make_getter: function(key) {
	var context = this;
	return function() { return context.get(eAccount[key]); }
},
make_setter: function(key) {
	var context = this;
	return function(value) { context.set(eAccount[key], value); }
},
get : function(key) {
	zinAssertAndLog(eAccount.isPresent(key), key);
	let value = (key in this.m_properties) ? this.m_properties[key] : null;
	return value;
},
set : function(key, value) {
	this.m_properties[key] = value;
},
unique_key : function() {
	var ret;
	switch(this.format_xx()) {
		case FORMAT_ZM: ret = hyphenate(":", Account.Zimbra, this.url, this.username); break;
		case FORMAT_GD: ret = hyphenate(":", Account.Google,           this.username); break;
		default: zinAssertAndLog(false, "mismatched case: " + this.format_xx());
	}
	return ret;
},
format_xx : function() {
	return AccountStatic.m_bimap_format.lookup(null, this.format);
},
toString : function() {
	var ret = "Account:";

	for (var key in this.m_properties)
		ret += " " + key + ": " + this.m_properties[key];

	return ret;
},
fromPrefset : function(sourceid) {
	var prefset = AccountStatic.newPrefSet();
	var ret = true;
	var key;

	prefset.load(sourceid);

	this.sourceid = sourceid;

	for (key in AccountStatic.m_keys_required) {
		this.set(key, prefset.getProperty(key));

		if (!this.get(key) || this.get(key).length < 1) {
			ret = false;
			logger().debug("fromPrefset: returning false on key: " + key);
			break;
		}
	}

	if (ret) {
		this.passwordlocator = new PasswordLocator(this.url, this.username);

		for (key in AccountStatic.m_keys_optional) {
			let value = prefset.getProperty(key);

			if (value != PrefSet.DEFAULT_VALUE)
				this.set(key, value);
		}
	}

	logger().debug("Account.prototype.fromPrefset: sourceid: " + sourceid + " prefset: " + prefset.toString() + " returns: " + ret);

	return ret;
},
save : function() {
	var prefset = AccountStatic.newPrefSet(this.sourceid);
	var key;

	zinAssert(this.sourceid);

	prefset.remove(); // flush out any child preferences that we don't want to keep - eg when the account format changes

	for (key in AccountStatic.m_keys_required)
		prefset.setProperty(key, this.get(key));

	for (key in AccountStatic.m_keys_optional) {
		prefset.delProperty(key);

		let value = this.get(key);

		if (value)
			prefset.setProperty(key, value);
	}

	prefset.save();
},
remove : function() {
	logger().debug("Account.remove: removing prefset with sourceid: " + this.sourceid);

	AccountStatic.newPrefSet(this.sourceid).remove();
}
};

var AccountFactory = {
	accountsLoadFromPrefset : function() {
		var a_sourceid    = preferences().getImmediateChildren(preferences().branch(), PrefSet.ACCOUNT + '.');
		var ret           = new Array();
		var a_failed      = new Object();
		var i, account;

		for (var i = 0; i < a_sourceid.length; i++)
			a_sourceid[i] = Number(a_sourceid[i]);

		a_sourceid.sort(numeric_compare);

		// accounts have integrity:
		// - if the keys are 0, 1, 2 etc, offset as per indexToSourceId()
		// - account format is one of the Account.Google, Account.Zimbra values
		// If for some reason the accounts don't have integrity (eg the user messed with them), we wipe the lot...
		//

		for (i = 0; i < a_sourceid.length; i++) {
			account = new Account();

			a_failed['no-url-username-format'] = !account.fromPrefset(a_sourceid[i]);
			if (!isAnyValue(a_failed, true)) a_failed['indexToSourceIdMismatch'] = account.sourceid != AccountStatic.indexToSourceId(i);
			if (!isAnyValue(a_failed, true)) a_failed['unknown-format'] = !AccountStatic.m_bimap_format.isPresent(null, account.format);

			if (isAnyValue(a_failed, true))
			{
				logger().error("This account doesn't have integrity: " + aToString(a_failed) + " account: " + account.toString());
				break;
			}

			ret.push(account);
		}

		if (isAnyValue(a_failed, true))
		{
			ret = new Array();
			logger().error("Wiping all accounts");

			for (i = 0; i < a_sourceid.length; i++) {
				account = new Account();
				account.fromPrefset(a_sourceid[i]);
				account.remove();
			}
		}

		logger().debug("accountsLoadFromPrefset: accounts: " + AccountStatic.arrayToString(ret));

		return ret;
	}
};

var AccountStatic = {
	m_keys_optional      : newObjectWithKeys( eAccount.gd_sync_with, eAccount.gd_suggested, eAccount.zm_sync_gal_enabled ),
	m_keys_required      : newObjectWithKeys( eAccount.url, eAccount.username, eAccount.format),
	m_bimap_format       : getBimapFormat('long'),
	m_prefset_properties : eAccount.toArray(),
	newPrefSet : function (sourceid) {
		let prefset = new PrefSet(PrefSet.ACCOUNT, this.m_prefset_properties);
		if (sourceid)
			prefset.m_id = sourceid;
		return prefset;
	},
	indexToSourceId : function(index) {
		zinAssert(typeof(index) != 'undefined');

		return index + SOURCEID_TB + 1;
	},
	sourceIdToIndex : function(sourceid) {
		zinAssert(typeof(sourceid) != 'undefined');

		return sourceid - SOURCEID_TB - 1;
	},
	arrayToString : function(a_accounts) {
		var ret = "";

		for (var i = 0; i < a_accounts.length; i++)
			ret += "\n " + a_accounts[i].toString();

		return ret;
	}
};

// sourceid and passwordlocator aren't stored in (leaf) preferences so remove them
AccountStatic.m_prefset_properties.splice(AccountStatic.m_prefset_properties.indexOf(eAccount.sourceid), 1);
AccountStatic.m_prefset_properties.splice(AccountStatic.m_prefset_properties.indexOf(eAccount.passwordlocator), 1);
