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
// $Id: configaccount.js,v 1.44 2011-06-21 04:59:15 cvsuser Exp $

includejs("payload.js");

function ConfigAccount()
{
	this.m_server_format_values = [ FORMAT_GD,           FORMAT_ZM          ];
	this.m_server_format_ids    = [ "ca-format-google",  "ca-format-zimbra" ];
	this.m_server_format_bimap  = new BiMap( this.m_server_format_values, this.m_server_format_ids );

	this.m_gal_radio_values     = [ 'yes',           'if-fewer',           'no'           ];
	this.m_gal_radio_ids        = [ "ca-zm-gal-yes", "ca-zm-gal-if-fewer", "ca-zm-gal-no" ];
	this.m_gal_radio_bimap      = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	this.m_gd_gr_as_ab_bimap    = new BiMap( [ 'true',                       'false'                     ], 
	                                         [ 'ca-gd-gr-as-ab-yes',         'ca-gd-gr-as-ab-no'         ] );
	this.m_gd_suggested_bimap   = new BiMap( [ 'include',                    'ignore'                    ], 
	                                         [ "ca-gd-suggested-include",    "ca-gd-suggested-ignore"    ] );
	this.m_gd_sync_with_bimap   = new BiMap( [ 'zg',                         'pab'                       ], 
	                                         [ "ca-gd-syncwith-zg",          "ca-gd-syncwith-pab"        ] );

	this.m_logger               = newLogger("ConfigAccount"); // this.m_logger.level(Logger.NONE);
	this.m_payload_caller       = null;
	this.m_payload_sw           = null;
	this.m_maestro              = null;
	this.m_is_fsm_running       = false;
	this.m_account_keys         = new Object();
	this.m_format_last          = null;
	this.a_format_last          = new Object();

	for (var i = 0; i < A_VALID_FORMATS; i++)
		this.a_format_last[i] = null;
}

ConfigAccount.prototype = {
	onLoad : function(payload) {
		this.m_payload_caller = payload;

		let account  = payload.m_account;
		let accounts = payload.m_accounts ? payload.m_accounts : AccountStatic.arrayLoadFromPrefset();
		let is_loaded_by_wizard = Boolean(this.m_payload_caller.m_format);

		if (!is_loaded_by_wizard) {
			document.title = account ? stringBundleString("ca.edit.title", [ account.username ] ) : stringBundleString("ca.add.title") ;
			xulSetAttribute('hidden', false, "ca-format-groupbox");
		}

		let is_zm_enabled = !accounts ||
		                    AccountStatic.arraySliceOfFormat(accounts, FORMAT_ZM).length == 0 ||
		                    (account && account.format_xx() == FORMAT_ZM);

		xulSetAttribute('disabled', !is_zm_enabled, "ca-format-zimbra");

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

		this.m_logger.debug("onLoad: m_account_keys: " + aToString(this.m_account_keys) +
		                    " m_payload_caller.m_format: " + this.m_payload_caller.m_format);

		this.m_logger.debug("onLoad: screen width: " + screen.width + " height: " + screen.height);

		if (screen.width <= 800) {
			// Make the configaccount window fit in netbook-style screen resolution
			// The right way to this would be to use media-dependent stylesheets but tb2 doesn't support them.
			//
			document.getElementById("zindus-ca-enclosing-vbox").style.margin = "0px";
			let spacers = document.getElementsByTagName('spacer');
			for (var i = 0; i < spacers.length; ++i) {
  				this.m_logger.debug("spacer class: " + spacers[i].className);
  				if (spacers[i].className == 'zindus-spacer') {
  					spacers[i].setAttribute('hidden',   true);
				}
  			}
		}

		zinAssert(ObserverService.isRegistered(Maestro.TOPIC))

		// during which we get notified and updateView() is called...
		//
		Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_CONFIGACCOUNT, Maestro.FSM_GROUP_SYNC);
	},
	onCancel : function() {
		this.m_logger.debug("onCancel:");

		for (var i = 0; i < this.m_server_format_values.length; i++)
			ConfigSettingsStatic.removeFromPasswordDatabase(ConfigAccountStatic.newTempPasswordLocator(this.m_server_format_values[i]));

		if (this.m_payload_sw) {
			this.m_logger.debug("cancelling syncwindow by setting a flag in payload");
			this.m_payload_sw.m_is_cancelled = true;
		}
		else
			this.m_logger.debug("no syncwindow active");

		Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGACCOUNT);
	},
	onAccept : function() {
		this.m_logger.debug("onAccept: enters");

		var account = this.accountFromDocument();

		this.m_payload_caller.m_result_accounts = new Array(account);

		this.m_logger.debug("onAccept: account: " + account.toString());

		for (var i = 0; i < this.m_server_format_values.length; i++)
			if (this.m_server_format_values[i] != account.format_xx())
				ConfigSettingsStatic.removeFromPasswordDatabase(ConfigAccountStatic.newTempPasswordLocator(this.m_server_format_values[i]));

		Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGACCOUNT);

		this.m_logger.debug("onAccept: exits");
	},
	onCommand : function(id_target) {
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
						      stringBundleString("text.file.bug", [ url('reporting-bugs') ]);
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
	},
	onBlur : function(id) {
		// this.m_logger.debug("onBlur: id: " + id);

		if (id == "ca-username" && this.serverFormat() == FORMAT_GD) {
			const max_length = 30; // this roughly corresponds to the min-width style on the XUL element
			let username     = dId(id).value;

			dId("ca-gd-syncwith-zg").label = stringBundleString("brand.zindus").toLowerCase() + "/" +
			                                 (username.length ? username.substr(0, max_length) :
											                    stringBundleString("cs.general.gd.syncwith.suffix"));
		}

		// free.fr
		//
		if (id == "ca-url" && this.serverFormat() == FORMAT_ZM) {
			let url              = dId(id).value;
			let is_share_service = this.is_share_service();
			let is_free_fr       = is_url_free_fr(url);

			if (is_free_fr || is_share_service)
				ConfigAccountStatic.setRadio("ca-zm-gal-radiogroup", this.m_gal_radio_bimap, "no");

			xulSetAttribute('disabled', is_free_fr || is_share_service, "ca-zm-gal-radiogroup");
		}
	},
	initialiseView : function() {
		var account = this.m_payload_caller.m_account;
		var self    = this;

		dId("ca-format-google").label       = stringBundleString("brand.google");
		dId("ca-format-zimbra").label       = stringBundleString("brand.zimbra");
		dId("ca-gd-gr-as-ab-caption").label = stringBundleString("ca.gd.group.as.ab", [ AppInfo.app_name(AppInfo.firstcap) ]);
		dId("ca-zm-gal-if-fewer").label     = stringBundleString("cs.general.zm.gal.if.fewer",
		                                          [ preference(MozillaPreferences.ZM_SYNC_GAL_IF_FEWER, 'int' ) ]);

		xulSetHtml("ca-gd-syncwith-help",  help_url('google-what-synced'));
		xulSetHtml("ca-gd-suggested-help", help_url('suggested-contacts'));
		xulSetHtml("ca-gd-gr-as-ab-help",  help_url('gr-as-ab'));

		function initialise_elements(account) {
			with (ConfigAccountStatic) {
				let url, v;

				self.m_logger.debug("initialiseView: account: " + account.toString());

				setRadio("ca-format-radiogroup", self.m_server_format_bimap, account.format_xx());

				dId("ca-url").value      = account.url;
				dId("ca-username").value = account.username;
				dId("ca-password").value = account.passwordlocator ? account.passwordlocator.getPassword() : "";

				v = account.gd_gr_as_ab;         setRadio("ca-gd-gr-as-ab-radiogroup",  self.m_gd_gr_as_ab_bimap,  v ? v : 'false');
				v = account.gd_suggested;        setRadio("ca-gd-suggested-radiogroup", self.m_gd_suggested_bimap, v ? v : 'include');
				v = account.gd_sync_with;        setRadio("ca-gd-syncwith-radiogroup",  self.m_gd_sync_with_bimap, v ? v : 'pab');
				v = account.zm_sync_gal_enabled; setRadio("ca-zm-gal-radiogroup",       self.m_gal_radio_bimap,    v ? v : 'if-fewer');
			}
		}

		if (account)
			initialise_elements(account);
		else {
			let format = Account.Google;
			let url    = eGoogleLoginUrl.kClientLogin;;

			if (this.m_payload_caller.m_format)
				switch (this.m_payload_caller.m_format) {
					case Account.Google: break; // initialised above
					case Account.Zimbra: url = "";                                      format = Account.Zimbra; break;
					case 'Share':        url = ConfigAccountStatic.m_share_service_url; format = Account.Zimbra; break;
					default: zinAssertAndLog(false, this.m_payload_caller.m_format);
				}

			let tmp_account = new Account();
			tmp_account.format   = format;
			tmp_account.url      = url;
			tmp_account.username = "";
			tmp_account.passwordlocator = null;

			initialise_elements(tmp_account);
		}

		this.onBlur("ca-url");      // test for free.fr
		this.onBlur("ca-username"); // set the zindus/yourname@gmail.com label

		// remember the current settings to support the user switching back+forth b/n Account formats
		//
		this.m_format_last = this.serverFormat();
		this.a_format_last[this.m_format_last] = this.accountFromDocument();

		this.setFocusForFormat();
	},
	updateView : function() {
		xulSetAttribute('disabled', Boolean(this.m_is_fsm_running), "ca-command");

		let format_current = this.serverFormat();

		xulSetAttribute('visible', (format_current != FORMAT_GD), "ca-url-description", "ca-url-row");

		dId("ca-pap-deck").selectedIndex = (format_current == FORMAT_GD) ? 0 : 1;

		if (this.m_format_last != format_current) {
			this.m_logger.debug("updateView: server_format changed: format_current: " +
			                     ConfigAccountStatic.m_bimap_format.lookup(format_current, null));

			this.a_format_last[this.m_format_last] = this.accountFromDocument(this.m_format_last);

			if (this.a_format_last[format_current]) {
				dId("ca-username").value = this.a_format_last[format_current].username;
				dId("ca-url").value      = this.a_format_last[format_current].url;
				dId("ca-password").value = this.a_format_last[format_current].passwordlocator.getPassword();
			}
			else
				this.serverFormatDetailsReset();

			this.m_format_last = format_current;
		}

		// enable Ok when url, username and password are set and not identical to another account
		//
		let is_all_set   = dId("ca-username").value.length > 0 && dId("ca-url").value.length > 0 && dId("ca-password").value.length > 0;
		let is_duplicate = AccountStatic.unique_key(format_current, dId("ca-url").value, dId("ca-username").value) in this.m_account_keys;

		this.m_logger.debug("updateView: is_all_set: " + is_all_set + " is_duplicate: " + is_duplicate);

		dId("zindus-ca-is-ok-enabled").setAttribute('label', String(is_all_set && !is_duplicate));
	},
	setFocusForFormat : function() {
		let id;

		if (this.serverFormat() == FORMAT_GD || this.is_share_service())
			id = "ca-username";
		else
			id = "ca-url";

		// this.m_logger.debug("setFocusForFormat: id: " + id);

		dId("ca-username").focus();

		// geez ...
		// with tb2, dId(id).focus() works
		// with tb3, dId(id).focus() doesn't work with ca-url ... not sure why but the problem relates to style="visiblity: hidden"
		//           even though style="visibility:visible" is set before the call to .focus() it still doesn't work.
		//           through trial and error ... setting focus via the commandDispatcher works.  Blech.
		//
		if (id == "ca-url")
			document.commandDispatcher.rewindFocus();
	},
	onFsmStateChangeFunctor : function(fsmstate) {
		this.m_is_fsm_running = (fsmstate && ! fsmstate.isFinal());

		this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") +
		                                    " m_is_fsm_running: " + this.m_is_fsm_running);

		this.updateView();
	},
	serverFormat : function() {
		var ret = null;

		if (dId("ca-format-radiogroup").selectedItem      == dId("ca-format-google"))
			ret = FORMAT_GD;
		else if (dId("ca-format-radiogroup").selectedItem == dId("ca-format-zimbra"))
			ret = FORMAT_ZM;
		else
			zinAssertAndLog(false, "mismatched case: ");

		return ret;
	},
	serverFormatDetailsReset : function() {
		if (this.serverFormat() == FORMAT_GD)
			dId("ca-url").value = eGoogleLoginUrl.kClientLogin;
		else
			dId("ca-url").value = "";

		dId("ca-username").value = "";
		dId("ca-password").value = "";
	},
	accountFromDocument : function(format_xx) {
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
				account.gd_gr_as_ab  = getValueFromRadio("ca-gd-gr-as-ab-radiogroup",  this.m_gd_gr_as_ab_bimap);
				account.gd_suggested = getValueFromRadio("ca-gd-suggested-radiogroup", this.m_gd_suggested_bimap);
				account.gd_sync_with = getValueFromRadio("ca-gd-syncwith-radiogroup",  this.m_gd_sync_with_bimap);
			}
			else {
				account.zm_sync_gal_enabled = getValueFromRadio("ca-zm-gal-radiogroup", this.m_gal_radio_bimap);
				account.zm_emailed_contacts = this.is_share_service() ? "false" : "true";
			}

			// Thunderbird2 nsIPasswordManager won't delete entries where the hostname has a trailing '/'
			//
			if (account.url.charAt(account.url.length - 1) == '/')
				account.url = account.url.substring(0, account.url.length - 1)

			this.m_logger.debug("accountFromDocument: returns: " + account.toString());
		}

		return account;
	},
	onInput : function() {
		this.updateView();
	},
	is_share_service : function() {
		return (dId('ca-url').value == ConfigAccountStatic.m_share_service_url);
	}
};

var ConfigAccountStatic = {
	m_bimap_format : getBimapFormat('long'),
	m_share_service_url : preferences().getCharPrefOrNull(preferences().branch(), MozillaPreferences.ZM_SHARE_SERVICE_URL),
	setRadio : function(radiogroup_id, bimap, value) {
		zinAssertAndLog(value, "value: " + value);
		zinAssertAndLog(bimap.isPresent(value, null), "value: " + value);

		let selected_id = bimap.lookup(value, null);

		// logger().debug("radiogroup_id: " + radiogroup_id + " value: " + value + " selected_id: " + selected_id);

		dId(radiogroup_id).selectedItem = dId(selected_id);
	},
	newTempPasswordLocator : function(format_xx) {
		let format   = this.m_bimap_format.lookup(format_xx, null);
		let url      = "http://temp-password-for-zindus-%format%-account.tld";
		let username = "username";

		return new PasswordLocator(url.replace(/%format%/, format).toLowerCase(), username);
	}
};
