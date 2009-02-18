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

includejs("payload.js");

function ConfigAccount()
{
	this.m_server_format_values   = [ FORMAT_GD,           FORMAT_ZM          ];
	this.m_server_format_ids      = [ "ca-format-google",  "ca-format-zimbra" ];
	this.m_server_format_bimap    = new BiMap( this.m_server_format_values, this.m_server_format_ids );

	this.m_gal_radio_values       = [ 'yes',           'if-fewer',           'no'           ];
	this.m_gal_radio_ids          = [ "ca-zm-gal-yes", "ca-zm-gal-if-fewer", "ca-zm-gal-no" ];
	this.m_gal_radio_bimap        = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	this.m_gd_sync_with_bimap     = new BiMap( [ 'zg',                      'pab'                    ], 
	                                           [ "ca-gd-syncwith-zg",       "ca-gd-syncwith-pab"     ] );
	this.m_gd_suggested_bimap     = new BiMap( [ 'include',                 'ignore'                 ], 
	                                           [ "ca-gd-suggested-include", "ca-gd-suggested-ignore" ] );

	this.m_logger                 = newLogger("ConfigAccount"); // this.m_logger.level(Logger.NONE);
	this.m_payload_configsettings = null;
	this.m_payload_sw             = null;
	this.m_maestro                = null;
	this.m_is_fsm_running         = false;
	this.m_account_keys           = new Object();
	this.m_format_last            = null;
	this.a_format_last            = new Object();

	for (var i = 0; i < A_VALID_FORMATS; i++)
		this.a_format_last[i] = null;
}

ConfigAccount.prototype.onLoad = function(payload)
{
	this.m_payload_configsettings = payload;

	let account  = payload.m_account;
	let accounts = payload.m_accounts ? payload.m_accounts : AccountStatic.arrayLoadFromPrefset();

	document.title = account ? stringBundleString("ca.edit.title", [ account.username ] ) : stringBundleString("ca.add.title") ;

	let is_zm_enabled = !accounts ||
	                    AccountStatic.arraySliceOfFormat(accounts, FORMAT_ZM).length == 0 ||
	                    (account && account.format_xx() == FORMAT_ZM);

	xulSetAttribute('disabled', !is_zm_enabled, "ca-format-zimbra");

	if (payload.m_format) {
		// we were loaded by the wizard which is supplying us a format in the payload
		// set the radiodbutton value and leave it hidden
		//
		let format = payload.m_format;

		if (format == 'Zindus')
			format = Account.Zimbra;

		with (ConfigAccountStatic)
			setRadio("ca-format-radiogroup", this.m_server_format_bimap, m_bimap_format.lookup(null, format));
	}
	else
		xulSetAttribute('hidden', false, "ca-format-groupbox");

	this.initialiseView();

	// Create an associative array of unique keys of existing accounts.
	// The OK button is disabled if the user tries to create a duplicate account.
	//
	if (accounts) {
		for (var i = 0; i < accounts.length; i++)
			this.m_account_keys[accounts[i].unique_key()] = true;

		if (account)
			delete this.m_account_keys[account.unique_key()];
	}

	this.m_logger.debug("onLoad: m_account_keys: " + aToString(this.m_account_keys));

	zinAssert(ObserverService.isRegistered(Maestro.TOPIC))

	// during which we get notified and updateView() is called...
	//
	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_CONFIGACCOUNT, Maestro.FSM_GROUP_SYNC);
}

ConfigAccount.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

	for (var i = 0; i < this.m_server_format_values.length; i++)
		ConfigSettingsStatic.removeFromPasswordDatabase(ConfigAccountStatic.newTempPasswordLocator(this.m_server_format_values[i]));

	if (this.m_payload_sw)
	{
		this.m_logger.debug("cancelling syncwindow by setting a flag in payload");
		this.m_payload_sw.m_is_cancelled = true;
	}
	else
		this.m_logger.debug("no syncwindow active");

	Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGACCOUNT);
}

ConfigAccount.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	var account = this.accountFromDocument();

	this.m_payload_configsettings.m_result = account;

	this.m_logger.debug("onAccept: account: " + account);

	for (var i = 0; i < this.m_server_format_values.length; i++)
		if (this.m_server_format_values[i] != account.format_xx())
			ConfigSettingsStatic.removeFromPasswordDatabase(ConfigAccountStatic.newTempPasswordLocator(this.m_server_format_values[i]));

	Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGACCOUNT);

	this.m_logger.debug("onAccept: exits");
}

ConfigAccount.prototype.onCommand = function(id_target)
{
	switch (id_target) {
		case "ca-format-google":
		case "ca-format-zimbra":
			this.updateView();
			this.setFocusForFormat();
			break;

		case "ca-button-authonly": {
			let account = this.accountFromDocument();

			this.m_payload_sw = new Payload();
			this.m_payload_sw.m_a_accounts      = [ account ];
			this.m_payload_sw.m_syncfsm_details = newObject('type', "authonly");
			this.m_payload_sw.m_is_cancelled    = false;
			this.m_payload_sw.m_es              = new SyncFsmExitStatus();

			logger().debug("ConfigAccount.onCommand: before openDialog: m_es: " + this.m_payload_sw.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul", "_blank", WINDOW_FEATURES, this.m_payload_sw);

			if (!window.closed) {
				let msg;

				logger().debug("ConfigAccount.onCommand: after openDialog: m_es: " +this.m_payload_sw.m_es.toString());

				if (this.m_payload_sw.m_es.m_exit_status == null) {
					logger().debug("ConfigAccount.onCommand: status.failon.unexpected");
					msg = stringBundleString("status.failon.unexpected") + "\n\n" +
					      stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);
				}
				else
					msg = this.m_payload_sw.m_es.asMessage("ca.auth.succeeded", "ca.auth.failed");

				zinAlert('ca.auth.title', msg);
			}

			this.m_payload_sw = null;
			}
			break;

		default:
			// do nothing
			break;
	}
}

ConfigAccount.prototype.onBlur = function(id)
{
	// this.m_logger.debug("onBlur: id: " + id);

	if (id == "ca-username" && this.serverFormat() == FORMAT_GD)
	{
		const max_length = 30; // this roughly corresponds to the min-width style on the XUL element
		let username     = dId(id).value;

		dId("ca-gd-syncwith-zg").label = stringBundleString("brand.zindus").toLowerCase() + "/" +
		                                 (username.length ? username.substr(0, max_length) :
										                    stringBundleString("cs.general.gd.syncwith.suffix"));
	}
	
	// free.fr
	//
	if (id == "ca-url" && this.serverFormat() == FORMAT_ZM)
	{
		let url              = dId(id).value;
		let is_share_service = (url == ConfigAccountStatic.m_share_service_url);
		let is_free_fr       = false;

		if (url.length > 0)
		{
			let prefset = prefsetMatchWithPreAuth(url);

			if (prefset && prefset.getProperty(PrefSet.PREAUTH_NAME) == "free.fr")
				is_free_fr = true;
		}

		if (is_free_fr || is_share_service)
			ConfigAccountStatic.setRadio("ca-zm-gal-menulist", this.m_gal_radio_bimap, "no");

		xulSetAttribute('disabled', is_free_fr || is_share_service, "ca-zm-gal-menulist");
	}
}

ConfigAccount.prototype.initialiseView = function()
{
	with (ConfigAccountStatic)
	{
		dId("ca-format-google").label = stringBundleString("brand.google");
		dId("ca-format-zimbra").label = stringBundleString("brand.zimbra");

		var account = this.m_payload_configsettings.m_account;

		if (account)
		{
			this.m_logger.debug("account: " + account.toString());
			this.m_logger.debug("account.format_xx: " + account.format_xx());

			setRadio("ca-format-radiogroup", this.m_server_format_bimap, account.format_xx());

			dId("ca-username").value = account.username;
			dId("ca-password").value = account.passwordlocator.getPassword();

			if (this.serverFormat() == FORMAT_GD)
			{
				if (account.gd_sync_with)
					setRadio("ca-gd-syncwith-radiogroup", this.m_gd_sync_with_bimap, account.gd_sync_with);

				if (account.gd_suggested)
					setRadio("ca-gd-suggested-radiogroup", this.m_gd_suggested_bimap, account.gd_suggested);
			}
		}

		// Zimbra
		//
		dId("ca-zm-gal-if-fewer").label =
				stringBundleString("cs.general.zm.gal.if.fewer", [ preference(MozillaPreferences.ZM_SYNC_GAL_IF_FEWER, 'int' ) ]);

		this.onBlur("ca-url");  // test for free.fr

		setRadio("ca-zm-gal-menulist", this.m_gal_radio_bimap,
			(account && account.zm_sync_gal_enabled) ? account.zm_sync_gal_enabled : 'if-fewer');

		// Google
		//
		this.onBlur("ca-username");

		if (this.serverFormat() == FORMAT_GD)
			dId("ca-url").value = eGoogleLoginUrl.kClientLogin;
		else if (this.m_payload_configsettings.m_format == 'Zindus')
			dId("ca-url").value = ConfigAccountStatic.m_share_service_url;
		else // Zimbra
			dId("ca-url").value = account ? account.url : "";

		// remember the current settings to support the user switching back+forth b/n Account formats
		//
		this.m_format_last = this.serverFormat();
		this.a_format_last[this.m_format_last] = this.accountFromDocument();

		this.setFocusForFormat();
	}
}

ConfigAccount.prototype.updateView = function()
{
	var i;

	if (this.m_is_fsm_running)
	{
		xulSetAttribute('disabled', true, "ca-command");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		xulSetAttribute('disabled', false, "ca-command");
	}

	// OK is enabled if url, username and password are set and not identical to another account
	//
	let format_current = this.serverFormat();
	let is_all_set     = dId("ca-username").value.length > 0 && dId("ca-url").value.length > 0 && dId("ca-password").value.length > 0;
	let is_duplicate   = AccountStatic.unique_key(format_current, dId("ca-url").value, dId("ca-username").value) in this.m_account_keys;

	this.m_logger.debug("updateView: is_all_set: " + is_all_set + " is_duplicate: " + is_duplicate);

	dId("zindus-ca-is-ok-enabled").setAttribute('label', String(is_all_set && !is_duplicate));

	if (format_current == FORMAT_GD)
	{
		xulSetAttribute('visible', false,  "ca-url-description", "ca-url-row", "ca-zm-vbox");
		dId("ca-pap-deck").selectedIndex = 0;
	}
	else
	{
		xulSetAttribute('visible', true, "ca-url-description", "ca-url-row", "ca-zm-vbox");
		dId("ca-pap-deck").selectedIndex = 1;
	}

	if (this.m_format_last != format_current)
	{
		this.m_logger.debug("updateView: server_format changed: format_current: " +
		                     ConfigAccountStatic.m_bimap_format.lookup(format_current, null));

		this.a_format_last[this.m_format_last] = this.accountFromDocument(this.m_format_last);

		if (this.a_format_last[format_current])
		{
			dId("ca-username").value = this.a_format_last[format_current].username;
			dId("ca-url").value      = this.a_format_last[format_current].url;
			dId("ca-password").value = this.a_format_last[format_current].passwordlocator.getPassword();
		}
		else
			this.serverFormatDetailsReset();

		this.m_format_last = format_current;
	}
}

ConfigAccount.prototype.setFocusForFormat = function()
{
	if (this.serverFormat() == FORMAT_GD)
		dId("ca-username").focus();
	else
		dId("ca-url").focus();
}

ConfigAccount.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_is_fsm_running = (fsmstate && ! fsmstate.isFinal());

	this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") +
	                                    " m_is_fsm_running: " + this.m_is_fsm_running);

	this.updateView();
}

ConfigAccount.prototype.serverFormat = function()
{
	var ret = null;

	if (dId("ca-format-radiogroup").selectedItem      == dId("ca-format-google"))
		ret = FORMAT_GD;
	else if (dId("ca-format-radiogroup").selectedItem == dId("ca-format-zimbra"))
		ret = FORMAT_ZM;
	else
		zinAssertAndLog(false, "mismatched case: ");

	return ret;
}

ConfigAccount.prototype.serverFormatDetailsReset = function()
{
	if (this.serverFormat() == FORMAT_GD)
		dId("ca-url").value = eGoogleLoginUrl.kClientLogin;
	else
		dId("ca-url").value = "";

	dId("ca-username").value = "";
	dId("ca-password").value = "";
}

ConfigAccount.prototype.accountFromDocument = function(format_xx)
{
	var account = new Account();

	with (ConfigSettingsStatic) {
		account.set('format', format_xx ?
			ConfigAccountStatic.m_bimap_format.lookup(format_xx, null) :
			ConfigAccountStatic.m_bimap_format.lookup(getValueFromRadio("ca-format-radiogroup", this.m_server_format_bimap), null));

		account.url             = dId("ca-url").value      ? zinTrim(dId("ca-url").value)      : "";
		account.username        = dId("ca-username").value ? zinTrim(dId("ca-username").value) : "";
		account.passwordlocator = ConfigAccountStatic.newTempPasswordLocator(account.format_xx());
		account.passwordlocator.setPassword(zinTrim(dId("ca-password").value));

		if (account.format_xx() == FORMAT_GD) {
			account.gd_sync_with = getValueFromRadio("ca-gd-syncwith-radiogroup", this.m_gd_sync_with_bimap);
			account.gd_suggested = getValueFromRadio("ca-gd-suggested-radiogroup", this.m_gd_suggested_bimap);
		}
		else
			account.zm_sync_gal_enabled = getValueFromRadio("ca-zm-gal-menulist", this.m_gal_radio_bimap);

		// Thunderbird2 nsIPasswordManager won't delete entries where the hostname has a trailing '/'
		//
		if (account.url.charAt(account.url.length - 1) == '/')
			account.url = account.url.substring(0, account.url.length - 1)
		
		this.m_logger.debug("accountFromDocument: returns: " + account.toString());
	}

	return account;
}

ConfigAccount.prototype.onInput = function()
{
	this.updateView();
}

var ConfigAccountStatic = {
	m_bimap_format : getBimapFormat('long'),
	m_share_service_url : preferences().getCharPrefOrNull(preferences().branch(), MozillaPreferences.ZM_SHARE_SERVICE_URL),
	setRadio : function(radiogroup_id, bimap, value) {
		zinAssertAndLog(value, "value: " + value);
		zinAssertAndLog(bimap.isPresent(value, null), "value: " + value);

		let selected_id = bimap.lookup(value, null);
		
		dId(radiogroup_id).selectedItem = dId(selected_id);
	},
	newTempPasswordLocator : function(format_xx) {
		let format   = this.m_bimap_format.lookup(format_xx, null);
		let url      = "http://temp-password-for-zindus-%format%-account.tld";
		let username = "username";

		return new PasswordLocator(url.replace(/%format%/, format).toLowerCase(), username);
	}
};
