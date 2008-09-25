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

function ConfigAccount()
{
	this.m_server_format_values   = [ FORMAT_GD,                  FORMAT_ZM                 ];
	this.m_server_format_ids      = [ "zindus-ca-format-google",  "zindus-ca-format-zimbra" ];
	this.m_server_format_bimap    = new BiMap( this.m_server_format_values, this.m_server_format_ids );

	this.m_gal_radio_values       = [ "yes",                       "if-fewer",                       "no"                       ];
	this.m_gal_radio_ids          = [ "zindus-ca-zm-gal-yes", "zindus-ca-zm-gal-if-fewer", "zindus-ca-zm-gal-no" ];
	this.m_gal_radio_bimap        = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	this.m_gd_sync_with_bimap     = new BiMap( [ "zg",                              "pab"                              ], 
	                                           [ "zindus-ca-gd-syncwith-zg", "zindus-ca-gd-syncwith-pab" ] );

	this.m_logger                 = newLogger("ConfigAccount"); // this.m_logger.level(Logger.NONE);
	this.m_payload_configsettings = null;
	this.m_payload_sw             = null;
	this.m_maestro                = null;
	this.m_is_fsm_running         = false;
	this.m_format_bimap           = getBimapFormat('long');
	this.m_format_last            = null;
	this.a_format_last            = new Object();

	for (var i = 0; i < A_VALID_FORMATS; i++)
		this.a_format_last[i] = null;
}

ConfigAccount.prototype.onLoad = function(target)
{
	this.m_payload_configsettings = window.arguments[0];

	document.title = this.m_payload_configsettings.m_account ?
	                            stringBundleString("ca.edit.title", [ this.m_payload_configsettings.m_account.get(Account.username) ] ) :
	                            stringBundleString("ca.add.title") ;

	this.initialiseView();

	xulSetAttribute('disabled', !this.m_payload_configsettings.m_is_zm_enabled, "zindus-ca-format-zimbra");

	zinAssert(ObserverService.isRegistered(Maestro.TOPIC))

	// during which we get notified and updateView() is called...
	//
	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_CONFIGACCOUNT, Maestro.FSM_GROUP_SYNC);
}

ConfigAccount.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

	for (var i = 0; i < this.m_server_format_values.length; i++)
		ConfigAccount.newTempPasswordLocator(this.m_server_format_values[i]).delPassword();

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
			ConfigAccount.newTempPasswordLocator(this.m_server_format_values[i]).delPassword();

	Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGACCOUNT);

	this.m_logger.debug("onAccept: exits");
}

ConfigAccount.prototype.onCommand = function(id_target)
{
	switch (id_target)
	{
		case "zindus-ca-format-google":
		case "zindus-ca-format-zimbra":
			this.updateView();
			this.setFocusForFormat();
			break;

		case "zindus-ca-button-authonly":
			var account = this.accountFromDocument();

			this.m_payload_sw = new Payload();
			this.m_payload_sw.m_a_accounts      = [ account ];
			this.m_payload_sw.m_syncfsm_details = newObject('type', "authonly");
			this.m_payload_sw.m_es              = new SyncFsmExitStatus();

			logger().debug("ConfigAccount.onCommand: before openDialog: m_es: " + this.m_payload_sw.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul", "_blank", WINDOW_FEATURES, this.m_payload_sw);

			if (!window.closed)
			{
				var msg;

				logger().debug("ConfigAccount.onCommand: after openDialog: m_es: " +this.m_payload_sw.m_es.toString());

				if (this.m_payload_sw.m_es.m_exit_status == null)
				{
					logger().debug("ConfigAccount.onCommand: cs.sync.failed.unexpectedly");
					msg = stringBundleString("cs.sync.failed.unexpectedly") + "\n" +
					      stringBundleString("status.failmsg.see.bug.reporting.url")
				}
				else
					msg = this.m_payload_sw.m_es.asMessage("ca.auth.succeeded", "ca.auth.failed");

				zinAlert('ca.auth.title', msg);
			}

			this.m_payload_sw = null;

			break;

		default:
			// do nothing
			break;
	}
}

ConfigAccount.prototype.onBlur = function(id)
{
	// this.m_logger.debug("onBlur: id: " + id);

	if (id == "zindus-ca-username" && this.serverFormat() == FORMAT_GD)
	{
		var username = dId(id).value;

		dId("zindus-ca-gd-syncwith-zg").label = stringBundleString("cs.general.gd.syncwith.prefix") +
		                                               (username.length ? username : stringBundleString("cs.general.gd.syncwith.suffix"));
	}
	
	// free.fr
	//
	if (id == "zindus-ca-url" && this.serverFormat() == FORMAT_ZM)
	{
		var url        = dId(id).value;
		var is_free_fr = false;

		if (url.length > 0)
		{
			var prefset = prefsetMatchWithPreAuth(url);

			if (prefset && prefset.getProperty(PrefSet.PREAUTH_NAME) == "free.fr")
				is_free_fr = true;
		}

		if (is_free_fr)
			ConfigAccount.setRadio("zindus-ca-zm-gal-menulist", this.m_gal_radio_bimap, "no");

		xulSetAttribute('disabled', is_free_fr, "zindus-ca-zm-gal-menulist");
	}
}

ConfigAccount.prototype.initialiseView = function()
{
	dId("zindus-ca-format-google").label     = stringBundleString("format.google");
	dId("zindus-ca-format-zimbra").label     = stringBundleString("format.zimbra");
	dId("zindus-ca-gd-syncwith-label").value = stringBundleString("ca.pap.gd.syncwith.label");

	var account = this.m_payload_configsettings.m_account;

	if (account)
	{
		this.m_logger.debug("account: " + account.toString());
		this.m_logger.debug("account.format_xx: " + account.format_xx());

		ConfigAccount.setRadio("zindus-ca-format-radiogroup", this.m_server_format_bimap, account.format_xx());
		                                                      // this.m_format_bimap.lookup(null, account.get('format')));

		dId("zindus-ca-username").value = account.get(Account.username);
		dId("zindus-ca-password").value = account.get(Account.passwordlocator).getPassword();

		if (this.serverFormat() == FORMAT_GD)
		{
			if (account.get(Account.gd_sync_with))
				ConfigAccount.setRadio("zindus-ca-gd-syncwith-radiogroup", this.m_gd_sync_with_bimap, account.get(Account.gd_sync_with));
		}
	}

	// Zimbra
	//
	dId("zindus-ca-zm-gal-if-fewer").label =
			stringBundleString("cs.general.zm.gal.if.fewer", [ preference(MozillaPreferences.ZM_SYNC_GAL_IF_FEWER, 'int' ) ]);

	this.onBlur("zindus-ca-url");  // test for free.fr

	ConfigAccount.setRadio("zindus-ca-zm-gal-menulist", this.m_gal_radio_bimap,
		(account && account.get(Account.zm_sync_gal_enabled)) ? account.get(Account.zm_sync_gal_enabled) : 'if-fewer');

	// Google
	//
	this.onBlur("zindus-ca-username");

	dId("zindus-ca-url").value = (this.serverFormat() == FORMAT_GD) ? googleClientLoginUrl('use-password') :
	                                                                  (account ? account.get(Account.url) : "");

	// remember the current settings to support the user switching back+forth b/n Account formats
	//
	this.m_format_last = this.serverFormat();
	this.a_format_last[this.m_format_last] = this.accountFromDocument();

	this.setFocusForFormat();
}

ConfigAccount.prototype.updateView = function()
{
	var i;

	if (this.m_is_fsm_running)
	{
		xulSetAttribute('disabled', true, "zindus-ca-command");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		xulSetAttribute('disabled', false, "zindus-ca-command");
	}

	var is_ok_enabled = (dId("zindus-ca-username").value.length > 0 && dId("zindus-ca-url").value.length > 0 && dId("zindus-ca-password").value.length > 0);
	this.m_logger.debug("updateView: is_ok_enabled: " + is_ok_enabled);

	dId("zindus-ca-dialog").setAttribute('buttondisabledaccept', !is_ok_enabled);

	var format_current = this.serverFormat();

	if (format_current == FORMAT_GD)
	{
		xulSetAttribute('hidden', true,  "zindus-ca-url-description", "zindus-ca-url-row", "zindus-ca-zm-vbox");
		dId("zindus-ca-pap-deck").selectedIndex = 0;
	}
	else
	{
		xulSetAttribute('hidden', false, "zindus-ca-url-description", "zindus-ca-url-row", "zindus-ca-zm-vbox");
		dId("zindus-ca-pap-deck").selectedIndex = 1;
	}

	if (this.m_format_last != format_current)
	{
		this.m_logger.debug("updateView: server_format changed: format_current: " + this.m_format_bimap.lookup(format_current, null));

		this.a_format_last[this.m_format_last] = this.accountFromDocument(this.m_format_last);

		if (this.a_format_last[format_current])
		{
			dId("zindus-ca-username").value = this.a_format_last[format_current].get(Account.username);
			dId("zindus-ca-url").value      = this.a_format_last[format_current].get(Account.url);
			dId("zindus-ca-password").value = this.a_format_last[format_current].get(Account.passwordlocator).getPassword();
		}
		else
			this.serverFormatDetailsReset();

		this.m_format_last = format_current;
	}
}

ConfigAccount.prototype.setFocusForFormat = function()
{
	if (this.serverFormat() == FORMAT_GD)
		dId("zindus-ca-username").focus();
	else
		dId("zindus-ca-url").focus();
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

	if (dId("zindus-ca-format-radiogroup").selectedItem      == dId("zindus-ca-format-google"))
		ret = FORMAT_GD;
	else if (dId("zindus-ca-format-radiogroup").selectedItem == dId("zindus-ca-format-zimbra"))
		ret = FORMAT_ZM;
	else
		zinAssertAndLog(false, "mismatched case: ");

	return ret;
}

ConfigAccount.prototype.serverFormatDetailsReset = function()
{
	if (this.serverFormat() == FORMAT_GD)
		dId("zindus-ca-url").value = googleClientLoginUrl('use-password');
	else
		dId("zindus-ca-url").value = "";

	dId("zindus-ca-username").value = "";
	dId("zindus-ca-password").value = "";
}

ConfigAccount.prototype.accountFromDocument = function(format_xx)
{
	var account = new Account();

	if (format_xx)
		account.set('format', this.m_format_bimap.lookup(format_xx, null));
	else
		account.set('format', this.m_format_bimap.lookup(ConfigSettings.getValueFromRadio("zindus-ca-format-radiogroup",
	                                                                                    this.m_server_format_bimap), null));

	account.set(Account.url,      dId("zindus-ca-url").value      ? zinTrim(dId("zindus-ca-url").value)      : "" );
	account.set(Account.username, dId("zindus-ca-username").value ? zinTrim(dId("zindus-ca-username").value) : "" );
	account.set(Account.passwordlocator, ConfigAccount.newTempPasswordLocator(account.format_xx()))
	account.get(Account.passwordlocator).setPassword(zinTrim(dId("zindus-ca-password").value));

	if (account.format_xx() == FORMAT_GD)
		account.set(Account.gd_sync_with, ConfigSettings.getValueFromRadio("zindus-ca-gd-syncwith-radiogroup", this.m_gd_sync_with_bimap));
	else
		account.set(Account.zm_sync_gal_enabled, ConfigSettings.getValueFromRadio("zindus-ca-zm-gal-menulist", this.m_gal_radio_bimap));
		
	this.m_logger.debug("accountFromDocument: returns: " + account.toString());

	return account;
}

ConfigAccount.prototype.onInput = function()
{
	this.updateView();
}

ConfigAccount.setRadio = function(radiogroup_id, bimap, value)
{
	zinAssertAndLog(value, "value: " + value);
	zinAssertAndLog(bimap.isPresent(value, null), "value: " + value);

	var selected_id = bimap.lookup(value, null);
		
	dId(radiogroup_id).selectedItem = dId(selected_id);
}

ConfigAccount.newTempPasswordLocator = function(format_xx)
{
	var format = getBimapFormat('long').lookup(format_xx, null);

	return new PasswordLocator("http://temp-password-for-zindus-" + format + "-account.tld", "username");
}
