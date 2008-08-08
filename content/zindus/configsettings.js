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

includejs("payload.js");
includejs("testharness.js");
includejs("configgd.js");
includejs("configaccount.js");

const GOOGLE_URL_CLIENT_LOGIN = "https://www.google.com/accounts/ClientLogin";
const WINDOW_FEATURES         = "chrome,centerscreen,modal=yes,dependent=yes";

function ConfigSettings()
{
	this.m_checkbox_properties = [ PrefSet.GENERAL_AUTO_SYNC,     PrefSet.GENERAL_VERBOSE_LOGGING     ];
	this.m_checkbox_ids        = [ "zindus-cs-general-auto-sync", "zindus-cs-general-verbose-logging" ];
	this.m_checkbox_bimap      = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_gal_radio_values    = [ "yes",                       "if-fewer",                       "no"                       ];
	this.m_gal_radio_ids       = [ "zindus-cs-general-gal-yes", "zindus-cs-general-gal-if-fewer", "zindus-cs-general-gal-no" ];
	this.m_gal_radio_bimap     = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	this.m_gd_sync_with_bimap  = new BiMap( [ "zg",                              "pab"                              ], 
	                                        [ "zindus-cs-general-gdsyncwith-zg", "zindus-cs-general-gdsyncwith-pab" ] );

	this.m_prefset_general     = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);
	this.m_format_bimap        = getBimapFormat('long');
	this.m_timer_timeoutID     = null;
	this.m_timer_functor       = null;
	this.m_maestro             = null;
	this.m_is_fsm_running      = false;
	this.m_logger              = newLogger("ConfigSettings"); // this.m_logger.level(Logger.NONE); // TODO for debugging
	this.m_preferences         = Singleton.instance().preferences();
	this.is_developer_mode     = (this.m_preferences.getCharPrefOrNull(this.m_preferences.branch(), "system.developer_mode") == "true");
	this.m_console_listener    = Logger.nsIConsoleListener();
	this.m_payload             = null;
	this.m_accounts            = null;
}

ConfigSettings.prototype.onLoad = function(target)
{
	if (this.is_developer_mode)
	{
		document.getElementById("zindus-cs-general-button-test-harness").removeAttribute('hidden');
		document.getElementById("zindus-cs-general-button-run-timer").removeAttribute('hidden');
	}

	this.m_prefset_general.load();

	this.initialiseView();
	this.maestroRegister(); // during which we get notified and updateView() is called...
}

ConfigSettings.prototype.maestroRegister = function()
{
	if (!ObserverService.isRegistered(Maestro.TOPIC))
	{
		this.m_maestro = new Maestro();

		ObserverService.register(this.m_maestro, Maestro.TOPIC);
	}

	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_CONFIGSETTINGS, Maestro.FSM_GROUP_SYNC);
	Logger.nsIConsoleService().registerListener(this.m_console_listener);
}

ConfigSettings.prototype.maestroUnregister = function()
{
	Logger.nsIConsoleService().unregisterListener(this.m_console_listener);
	Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_CONFIGSETTINGS);

	if (this.m_maestro && ObserverService.isRegistered(Maestro.TOPIC))
		ObserverService.unregister(this.m_maestro, Maestro.TOPIC);
}

ConfigSettings.prototype.stop_timer_fsm_and_deregister = function()
{
	if (this.m_is_fsm_running && this.m_timer_functor)
		this.m_timer_functor.cancel();

	this.maestroUnregister();
}

ConfigSettings.prototype.onCancel = function()
{
	if (this.m_payload)
	{
		this.m_logger.debug("cancelling syncwindow by setting a flag in payload");
		this.m_payload.m_is_cancelled = true;
	}
	else
		this.m_logger.debug("no syncwindow active");

	this.m_logger.debug("onCancel:");

	this.stop_timer_fsm_and_deregister();
}

ConfigSettings.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: ");

	this.updatePrefsetsFromDocument();

	this.m_prefset_general.save();

	this.stop_timer_fsm_and_deregister();

	this.m_logger.debug("onAccept: exits");
}

ConfigSettings.prototype.onCommand = function(id_target)
{
	this.m_logger.debug("onCommand: target: " + id_target);

	switch (id_target)
	{
		case "zindus-cs-general-button-sync-now":
			this.updatePrefsetsFromDocument();

			this.m_payload = new Payload();
			if (!this.is_developer_mode) // TODO
				zinAssert(this.m_accounts.length == 1);
			this.m_payload.m_syncfsm_details = newObject('accounts', this.m_accounts, 'type', "twoway",
			                                                         'prefset_general', this.m_prefset_general);
			this.m_payload.m_es = new SyncFsmExitStatus();
			this.m_payload.m_is_cancelled = false;

			logger().debug("ConfigSettings.onCommand: before openDialog: m_es: " + this.m_payload.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", WINDOW_FEATURES, this.m_payload);

			// The window could be closed if the esc key was pressed before openDialog() was called.
			// The payload could be mangled because if the AddressBook new Card window got opened before the syncwindow finishes,
			// we see SyncWindow.onAccept() exits but window.openDialog() hasn't returned!  And ... the "Sync Now" button
			// is enabled because updateView() got told that the fsm finished.  So if the user starts another fsm, the payload of
			// of the original window is lost.
			// 
			if (!window.closed && this.m_payload instanceof Payload)
			{
				var msg = "";

				logger().debug("ConfigSettings.onCommand: after openDialog: m_is_cancelled: " +
				                                              this.m_payload.m_is_cancelled + " m_es: " + this.m_payload.m_es.toString());
				if (this.m_payload.m_es.m_exit_status == null)
				{
					logger().debug("ConfigSettings.onCommand: cs.sync.failed.unexpectedly");
					msg = stringBundleString("cs.sync.failed.unexpectedly");
				}
				else if (this.m_payload.m_es.m_exit_status != 0)
					msg = this.m_payload.m_es.asMessage("cs.sync.succeeded", "cs.sync.failed");

				if (msg != "")
				{
					if (isInArray(this.m_payload.m_es.m_fail_code, [ 'failon.gd.conflict.1', 'failon.gd.conflict.2',
					                                                 'failon.gd.conflict.3', 'failon.gd.conflict.4' ]))
					{
						var payload2 = new Payload();
						payload2.m_args = newObject('fail_code', this.m_payload.m_es.m_fail_code, 'msg', msg);
						window.openDialog("chrome://zindus/content/configmsg.xul",  "_blank", WINDOW_FEATURES, payload2);
					}
					else
						zinAlert('cs.sync.title', msg, window);
				}
			}

			this.m_payload = null;
			break;

		case "zindus-cs-general-button-test-harness":
			var testharness = new TestHarness();
			testharness.run();
			break;

		case "zindus-cs-general-button-run-timer":
			this.m_timer_timeoutID = window.setTimeout(this.onTimerFire, 0, this);
			this.m_is_fsm_running = true;
			break;

		case "zindus-cs-general-button-reset":
			RemoveDatastore.removeZfcs();
			RemoveDatastore.removeLogfile();
			StatusPanel.update();
			break;

		case "zindus-cs-general-advanced-button":
			var payload = new Payload();
			payload.m_args = this.m_prefset_general;
			window.openDialog("chrome://zindus/content/configgd.xul", "_blank", WINDOW_FEATURES, payload);
	        this.m_logger.debug("gd_postal: " + this.m_prefset_general.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS));
			break;

		case "zindus-cs-account-delete":
			var rowid    = dId("zindus-cs-account-tree").currentIndex;
			var treeitem = this.accountsTreeItem(rowid);

			var url      = this.m_accounts[rowid].get('url');
			var username = this.m_accounts[rowid].get('username');

			this.m_accounts[rowid].remove();
			this.m_accounts.splice(rowid, 1);

			this.m_logger.debug("blah: account-delete: rowid: " + rowid);

			dId("zindus-cs-account-treechildren").removeChild(treeitem);

			this.deletePasswordWhenRequired(url, username);

			if (this.m_accounts.length > 0)
				if (rowid < this.m_accounts.length)
					dId("zindus-cs-account-tree").view.selection.select(rowid);
				else
					dId("zindus-cs-account-tree").view.selection.select(this.m_accounts.length - 1);

			this.updateView();
			break;

		case "zindus-cs-account-add":
		case "zindus-cs-account-edit":
			this.updatePrefsetsFromDocument(); // because prefset_general gets passed through to SyncWindow
			var rowid = dId("zindus-cs-account-tree").currentIndex;

			var payload = new Payload();
			payload.m_account = (id_target == "zindus-cs-account-add") ? null : this.m_accounts[rowid];
			payload.m_prefset_general = this.m_prefset_general;

			window.openDialog("chrome://zindus/content/configaccount.xul", "_blank", WINDOW_FEATURES, payload);

			if (payload.m_result)
			{
				var account = new Account(); // get the Account object into the scope of the current window.
				account.m_properties = payload.m_result.m_properties;

				if (id_target == "zindus-cs-account-add")
				{
					account.set('sourceid', this.accountsNextSourceId());
					account.save();
					this.m_accounts.push(account);

					rowid = this.m_accounts.length - 1;
				}
				else
				{
					zinAssert(id_target == "zindus-cs-account-edit");

					var prev_url      = this.m_accounts[rowid].get('url');
					var prev_username = this.m_accounts[rowid].get('username');

					// this.m_logger.debug("blah: url: " + account.get('url') + " username: " + account.get('username') +
					//                     " prev_url: " + prev_url + " prev_username: " + prev_username);

					account.set('sourceid', this.m_accounts[rowid].get('sourceid'));
					account.save();

					this.m_accounts[rowid] = account;

					if (account.get('url') != prev_url || account.get('username') != prev_username)
						this.deletePasswordWhenRequired(prev_url, prev_username);
				}

				var pm = new PasswordManager();
				pm.set(account.get('url'), account.get('username'), account.get('password'));

				this.accountsTreeRefresh(rowid);
				dId("zindus-cs-account-tree").view.selection.select(rowid);

				this.updateView();
			}

			break;

		default:
			// do nothing
			break;
	}

	if (isInArray(id_target, [ "zindus-cs-account-add", "zindus-cs-account-edit", "zindus-cs-account-delete" ]))
		this.m_logger.debug("blah: id_target: " + id_target + " m_accounts is: " + aToString(this.m_accounts)); // TODO
}

ConfigSettings.prototype.onTimerFire = function(context)
{
	// note that if this window is closed while the timer is running, the fsm is garbage collected
	// but the maestro is never told (because the fsm never reached the 'final' state
	// The timer functor isn't doesn't support 'cancel' the way SyncWindow does.
	// It should only be visible in the UI with debugging turned on anyways...
	//
	context.m_logger.debug("onTimerFire: ");
	context.m_timer_functor = new TimerFunctor(Maestro.ID_FUNCTOR_CONFIGSETTINGS_TIMER, null, null);
	context.m_timer_functor.run();
}

ConfigSettings.prototype.initialiseView = function()
{
	// accounts tab
	//
	this.m_accounts = AccountFactory.accountsLoadFromPrefset();
	this.accountsTreeRefresh();

	if (this.m_accounts.length > 0)
		dId("zindus-cs-account-tree").view.selection.select(0);

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		dId(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked =
		           (this.m_prefset_general.getProperty(this.m_checkbox_properties[i]) == "true");

	// general tab - Google Sync With
	//
	ConfigSettings.setRadioFromPrefset("zindus-cs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap, this.m_prefset_general,
	                         PrefSet.GENERAL_GD_SYNC_WITH, "zindus-cs-general-gdsyncwith-pab")

	// general tab - Gal radiogroup
	//
	var if_fewer = this.m_preferences.getIntPref(this.m_preferences.branch(), MozillaPreferences.ZM_SYNC_GAL_IF_FEWER );

	var msg = stringBundleString("cs.general.zm.gal.if.fewer", [ if_fewer ]);

	dId("zindus-cs-general-gal-if-fewer").label = msg;

	ConfigSettings.setRadioFromPrefset("zindus-cs-general-gal", this.m_gal_radio_bimap, this.m_prefset_general,
	                          PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, "zindus-cs-general-gal-if-fewer")
	
	// work out which tab appears on top
	//
	var selected_id = this.isServerSettingsComplete() ? "zindus-cs-tab-general" : "zindus-cs-tab-server";

	dId("zindus-cs-tabbox").selectedTab = dId(selected_id);
}

ConfigSettings.prototype.updateView = function()
{
	if (this.m_is_fsm_running)
	{
		this.m_logger.debug("updateView: fsm is running - disabling buttons"); // TODO
		ConfigSettings.setAttribute('disabled', true, "zindus-cs-command");
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete - disabling buttons");
		ConfigSettings.setAttribute('disabled', false, "zindus-cs-command");
		ConfigSettings.setAttribute('disabled', true, "zindus-cs-general-button-run-timer", "zindus-cs-general-button-sync-now");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		ConfigSettings.setAttribute('disabled', false,
		                  "zindus-cs-command", "zindus-cs-general-button-run-timer", "zindus-cs-general-button-sync-now");
	}

	var a_google = this.accountsArrayOf(FORMAT_GD);
	var a_zimbra = this.accountsArrayOf(FORMAT_ZM);

	ConfigSettings.setAttribute('hidden', a_google.length == 0, "zindus-cs-general-google-groupbox");
	ConfigSettings.setAttribute('hidden', a_zimbra.length == 0, "zindus-cs-general-zimbra-groupbox");

	if (a_google.length > 0)
	{
		dId("zindus-cs-general-gdsyncwith-zg").label    = this.gdSyncWithLabel();
		dId("zindus-cs-general-gdsyncwith-label").value = stringBundleString("cs.general.gd.syncwith.label");
	}

	// free.fr
	//
	var is_free_fr = false;

	if (a_zimbra.length > 0)
	{
		var prefset;

		for (var i = 0; i < a_zimbra.length; i++)
		{
			prefset = prefsetMatchWithPreAuth(this.m_accounts[a_zimbra[i]].get('url'));

			if (prefset && prefset.getProperty(PrefSet.PREAUTH_NAME) == "free.fr")
				is_free_fr = true;
		}
	}

	if (is_free_fr)
	{
		this.m_prefset_general.setProperty(PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, "no");

		ConfigSettings.setRadioFromPrefset("zindus-cs-general-gal", this.m_gal_radio_bimap, this.m_prefset_general,
	                          PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, null);
	}

	ConfigSettings.setAttribute('disabled', is_free_fr, "zindus-cs-general-gal");

	ConfigSettings.setAttribute('disabled', dId("zindus-cs-account-tree").currentIndex < 0,
	                                        "zindus-cs-account-edit", "zindus-cs-account-delete");

	if (!this.is_developer_mode) // TODO
		ConfigSettings.setAttribute('disabled', (this.m_accounts.length >= 1), "zindus-cs-account-add");
}

ConfigSettings.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_is_fsm_running = (fsmstate && ! fsmstate.isFinal());

	this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") +
	                                    " m_is_fsm_running: " + this.m_is_fsm_running);

	this.updateView();
}

ConfigSettings.prototype.isServerSettingsComplete = function()
{
	return this.m_accounts.length > 0;
}

ConfigSettings.getValueFromRadio = function(radiogroup_id, bimap)
{
	var selected_id  = dId(radiogroup_id).selectedItem.id;
	return bimap.lookup(null, selected_id);
}

ConfigSettings.setPrefsetFromRadio = function(radiogroup_id, bimap, prefset, property)
{
	var radio_button = ConfigSettings.getValueFromRadio(radiogroup_id, bimap);
	prefset.setProperty(property, radio_button);
}

ConfigSettings.setRadioFromPrefset = function(radiogroup_id, bimap, prefset, property, default_id)
{
	var selected_id;
	var value = prefset.getProperty(property);

	logger().debug("setRadioFromPrefset: radiogroup_id: " + radiogroup_id + " value: " + value);

	if (value && bimap.isPresent(value, null))
		selected_id = bimap.lookup(value, null);
	else
		selected_id = default_id;
		
	dId(radiogroup_id).selectedItem = dId(selected_id);
}

ConfigSettings.prototype.gdSyncWithLabel = function()
{
	var a_rowid = this.accountsArrayOf(FORMAT_GD);
	var ret     = stringBundleString("cs.general.gd.syncwith.prefix");

	if (a_rowid.length == 0)
		ret += stringBundleString("cs.general.gd.syncwith.suffix");
	else
	{
		ret += this.m_accounts[a_rowid[0]].get('username');

		if (a_rowid.length > 1)
			ret += " " + stringBundleString("cs.general.gd.syncwith.etc");
	}

	return ret;
}

ConfigSettings.prototype.updatePrefsetsFromDocument = function()
{
	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.m_checkbox_properties[i],
			dId(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked ? "true" : "false" );

	// general tab - radio elements: GAL and Google Sync With
	//
	ConfigSettings.setPrefsetFromRadio("zindus-cs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_GD_SYNC_WITH);
	ConfigSettings.setPrefsetFromRadio("zindus-cs-general-gal", this.m_gal_radio_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED);
}

ConfigSettings.setAttribute = function(attribute, flag)
{
	var i, el;
	zinAssert(typeof(flag) == 'boolean' && attribute == 'disabled' || attribute == 'hidden' && arguments.length > 2);

	for (i = 2; i < arguments.length; i++)
	{
		el = dId(arguments[i]);

		zinAssertAndLog(el, "id: " + arguments[i]);

		if (flag)
			switch(attribute) {
				case 'disabled': el.setAttribute('disabled', true); break;
				case 'hidden':   el.style.visibility = "hidden";    break;
			}
		else
			switch(attribute) {
				case 'disabled': el.removeAttribute('disabled');    break;
				case 'hidden':   el.style.visibility = "visible";   break;
			}
	}
}

ConfigSettings.prototype.accountsNextSourceId = function()
{
	var sourceid_max = SOURCEID_TB;

	for (var i = 0; i < this.m_accounts.length; i++)
		if (this.m_accounts[i].get('sourceid') > sourceid_max)
			sourceid_max = this.m_accounts[i].get('sourceid');

	sourceid_max = Number(sourceid_max) + 1;

	return sourceid_max;
}

ConfigSettings.prototype.accountsTreeRefresh = function(rowid)
{
	if (arguments.length == 0)
	{
		for (rowid = 0; rowid < this.m_accounts.length; rowid++)
			this.accountsTreeRefresh(rowid);
	}
	else
	{
		// two scenarios:
		// rowid <  this.m_accounts.length but the dId(zindus-cs-account-rowid) doesn't exist  ==> add
		// rowid <  this.m_accounts.length but the dId(zindus-cs-account-rowid)         exists ==> modify
		//
		var treechildren = dId("zindus-cs-account-treechildren");
		var treeitem     = document.createElement("treeitem");
		var treerow      = document.createElement("treerow");
		var account      = this.m_accounts[rowid];
		var treecell;

		zinAssert(rowid < this.m_accounts.length);

		treeitem.id = "zindus-cs-account-treeitem-" + account.get('sourceid');

		treecell = document.createElement("treecell");
		treecell.setAttribute("label", account.get('username'));
		treerow.appendChild(treecell);

		treecell = document.createElement("treecell");
		treecell.setAttribute("label", account.get('format'));
		treerow.appendChild(treecell);

		treeitem.appendChild(treerow);

		var treeitematrow = this.accountsTreeItem(rowid);

		// this.m_logger.debug("accountsTreeRefresh: blah: " + ((!treeitematrow) ? "adding a treeitem" : "replacing treeitem"));

		if (!treeitematrow)
			treechildren.appendChild(treeitem);
		else
			treechildren.replaceChild(treeitem, treeitematrow);
	}
}

ConfigSettings.prototype.accountsTreeItem = function(rowid)
{
	return dId("zindus-cs-account-treeitem-" + this.m_accounts[rowid].get('sourceid'));
}

ConfigSettings.prototype.deletePasswordWhenRequired = function(url, username)
{
	var pm = new PasswordManager();

	if (pm.get(url, username) && !this.accountsIsPresentUrlUsername(url, username))
		pm.del(url, username);
}

ConfigSettings.prototype.accountsIsPresentUrlUsername = function(url, username)
{
	var ret = false;

	for (var rowid = 0; rowid < this.m_accounts.length; rowid++)
		if (this.m_accounts[rowid].get('url') == url && this.m_accounts[rowid].get('username') == username)
		{
			ret = true;
			break;
		}

	return ret;
}

ConfigSettings.prototype.accountsArrayOf = function(format_xx)
{
	var format  = this.m_format_bimap.lookup(format_xx, null);
	var a_rowid = new Array();

	for (var rowid = 0; rowid < this.m_accounts.length; rowid++)
		if (this.m_accounts[rowid].format() == format)
			a_rowid.push(rowid);

	// this.m_logger.debug("accountsArrayOf: format_xx: " + format_xx + " returns: " + a_rowid.toString());

	return a_rowid;
}
