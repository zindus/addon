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
	this.m_server_format_bimap    = new BiMap( [ FORMAT_GD,                  FORMAT_ZM                 ], 
	                                           [ "zindus-ca-format-google",  "zindus-ca-format-zimbra" ] );
	this.m_logger                 = newLogger("ConfigAccount"); // this.m_logger.level(Logger.NONE); // TODO for debugging
	this.m_preferences            = Singleton.instance().preferences();
	this.m_payload_configsettings = null;
	this.m_payload_sw     = null;
	this.m_maestro                = null;
	this.m_is_fsm_running         = false;
	this.m_prefset_general        = null;
	this.m_format_bimap           = getBimapFormat('long');
	this.m_format_last            = null;
	this.a_format_last            = new Object();

	for (var i = 0; i < A_VALID_FORMATS; i++)
		this.a_format_last[i] = null;
}

ConfigAccount.prototype.onLoad = function(target)
{
	this.m_payload_configsettings = window.arguments[0];
	this.m_prefset_general        = this.m_payload_configsettings.m_prefset_general;

	document.title = this.m_payload_configsettings.m_account ?
	                            stringBundleString("ca.edit.title", [ this.m_payload_configsettings.m_account.get('username') ] ) :
	                            stringBundleString("ca.add.title") ;

	this.initialiseView();

	zinAssert(ObserverService.isRegistered(Maestro.TOPIC))

	// during which we get notified and updateView() is called...
	//
	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_CONFIGACCOUNT, Maestro.FSM_GROUP_SYNC);
}

ConfigAccount.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

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

	this.m_payload_configsettings.m_result = this.accountFromDocument();

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
			break;

		case "zindus-ca-button-authonly":
			var account = this.accountFromDocument();

			this.m_payload_sw = new Payload();
			this.m_payload_sw.m_syncfsm_details = newObject('account', account, 'type',"authonly",'prefset_general',this.m_prefset_general);
			this.m_payload_sw.m_es = new SyncFsmExitStatus();

			Singleton.instance().logger().debug("ConfigAccount.onCommand: before openDialog: m_es: " + this.m_payload_sw.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul", "_blank", WINDOW_FEATURES, this.m_payload_sw);

			if (!window.closed)
			{
				var msg;

				Singleton.instance().logger().debug("ConfigAccount.onCommand: after openDialog: m_es: " +this.m_payload_sw.m_es.toString());

				if (this.m_payload_sw.m_es.m_exit_status == null)
				{
					Singleton.instance().logger().debug("ConfigAccount.onCommand: cs.sync.failed.unexpectedly");
					msg = stringBundleString("cs.sync.failed.unexpectedly");
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

ConfigAccount.prototype.initialiseView = function()
{
	dId("zindus-ca-format-google").label = stringBundleString("format.google");
	dId("zindus-ca-format-zimbra").label = stringBundleString("format.zimbra");

	var account = this.m_payload_configsettings.m_account;

	if (account)
	{
		ConfigAccount.setRadio("zindus-ca-format-radiogroup", this.m_server_format_bimap,
		                                                      this.m_format_bimap.lookup(null, account.get('format')));

		dId("zindus-ca-username").value = account.get('username');
		dId("zindus-ca-password").value = account.get('password');
	}

	dId("zindus-ca-url").value = (this.serverFormat() == FORMAT_GD) ? GOOGLE_URL_CLIENT_LOGIN : (account ? account.get('url') : "");

	this.m_format_last = this.serverFormat();
	this.a_format_last[this.m_format_last] = this.accountFromDocument();
}

ConfigAccount.prototype.isServerSettingsComplete = function()
{
	ret = true;

	ret = ret && (dId("zindus-ca-url").value.length      > 0);
	ret = ret && (dId("zindus-ca-username").value.length > 0);
	ret = ret && (dId("zindus-ca-password").value.length > 0);

	return ret;
}

ConfigAccount.prototype.updateView = function()
{
	var i;
	// - test connection ==> disabled when fsm is running, otherwise enabled
	// - test harness    ==> disabled when fsm is running, otherwise enabled
	// - reset           ==> disabled when fsm is running, otherwise enabled
	// - run timer       ==> disabled when fsm is running or isServerSettingsComplete, otherwise enabled
	// - sync now        ==> disabled when fsm is running or isServerSettingsComplete, otherwise enabled

	if (this.m_is_fsm_running)
	{
		ConfigSettings.setAttribute('disabled', true, "zindus-ca-command");
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete - disabling buttons");
		ConfigSettings.setAttribute('disabled', false, "zindus-ca-command");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		ConfigSettings.setAttribute('disabled', false, "zindus-ca-command");
	}

	var format_current = this.serverFormat();

	if (format_current == FORMAT_GD)
		ConfigSettings.setAttribute('hidden', true,  "zindus-ca-url-description", "zindus-ca-url-row");
	else
		ConfigSettings.setAttribute('hidden', false, "zindus-ca-url-description", "zindus-ca-url-row");

	if (this.m_format_last != format_current)
	{
		this.m_logger.debug("updateView: server_format changed: format_current: " + format_current);

		this.a_format_last[this.m_format_last] = this.accountFromDocument();

		if (this.a_format_last[format_current])
		{
			dId("zindus-ca-username").value = this.a_format_last[format_current].get('username');
			dId("zindus-ca-url").value      = this.a_format_last[format_current].get('url');
			dId("zindus-ca-password").value = this.a_format_last[format_current].get('password');
		}
		else
			this.serverFormatDetailsReset();

		this.m_format_last = format_current;
	}

	if (format_current == FORMAT_ZM)
	{
		var prefset = prefsetMatchWithPreAuth(dId("zindus-ca-url").value);

		if (prefset && prefset.isPropertyPresent(PrefSet.PREAUTH_ZM_SYNC_GAL_ENABLED))
		{
			var value = prefset.getProperty(PrefSet.PREAUTH_ZM_SYNC_GAL_ENABLED);

			// this.m_logger.debug("blah: forcing PREAUTH_ZM_SYNC_GAL_ENABLED to: " + value);

			this.m_prefset_general.setProperty(PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, value);
			// TODO set something here to indicate that the GAL option should be disabled
		}
	}
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

ConfigAccount.prototype.serverFormatDetailsRemember = function()
{
	this.m_logger.debug("serverFormatDetailsRemember: setting: m_format_last: " + this.m_format_last);

	if (!isPropertyPresent(this.a_server_type_values, this.m_format_last))
		this.a_server_type_values[this.m_format_last] = new Object();

	this.a_server_type_values[this.m_format_last].username = dId("zindus-ca-username").value;
	this.a_server_type_values[this.m_format_last].url      = dId("zindus-ca-url").value;
	this.a_server_type_values[this.m_format_last].password = dId("zindus-ca-password").value;
}

ConfigAccount.prototype.serverFormatDetailsReset = function()
{
	if (this.serverFormat() == FORMAT_GD)
		dId("zindus-ca-url").value = GOOGLE_URL_CLIENT_LOGIN;
	else
		dId("zindus-ca-url").value = "";

	dId("zindus-ca-username").value = "";
	dId("zindus-ca-password").value = "";
}

ConfigAccount.prototype.accountFromDocument = function()
{
	var account = new Account();

	account.set('url',      zinTrim(dId("zindus-ca-url").value) );
	account.set('username', zinTrim(dId("zindus-ca-username").value) );
	account.set('password', zinTrim(dId("zindus-ca-password").value) );
	account.set('format',   this.m_format_bimap.lookup(ConfigSettings.getValueFromRadio("zindus-ca-format-radiogroup",
	                                                                                    this.m_server_format_bimap), null));

	return account;
}

ConfigAccount.setRadio = function(radiogroup_id, bimap, value)
{
	zinAssertAndLog(value, "value: " + value);
	zinAssertAndLog(bimap.isPresent(value, null), "value: " + value);

	var selected_id = bimap.lookup(value, null);
		
	dId(radiogroup_id).selectedItem = dId(selected_id);
}

