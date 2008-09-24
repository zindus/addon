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

const WINDOW_FEATURES = "chrome,centerscreen,modal=yes,dependent=yes";

function ConfigSettings()
{
	this.m_checkbox_properties  = [ PrefSet.GENERAL_AS_AUTO_SYNC,  PrefSet.GENERAL_AS_VERBOSE_LOGGING  ];
	this.m_checkbox_ids         = [ "zindus-cs-general-auto-sync", "zindus-cs-general-verbose-logging" ];
	this.m_checkbox_bimap       = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_gd_sync_with_bimap   = new BiMap( [ "zg",                              "pab"                              ], 
	                                         [ "zindus-cs-general-gdsyncwith-zg", "zindus-cs-general-gdsyncwith-pab" ] );

	this.m_prefset_general      = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_AS_PROPERTIES);
	this.m_prefset_general_orig = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_AS_PROPERTIES);
	this.m_format_bimap         = getBimapFormat('long');
	this.m_timer_timeoutID      = null;
	this.m_timer_functor        = null;
	this.m_maestro              = null;
	this.m_is_fsm_running       = false;
	this.is_developer_mode      = (preference("system.developer_mode", 'char') == "true");
	this.m_console_listener     = Logger.nsIConsoleListener();
	this.m_payload              = null;
	this.m_accounts             = null;
	this.m_logger               = newLogger("ConfigSettings"); // this.m_logger.level(Logger.NONE);
}

ConfigSettings.prototype.onLoad = function(target)
{
	if (this.is_developer_mode)
	{
		document.getElementById("zindus-cs-general-button-test-harness").removeAttribute('hidden');
		document.getElementById("zindus-cs-general-button-run-timer").removeAttribute('hidden');
	}

	this.m_prefset_general.load();
	this.m_prefset_general_orig.load();

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

	this.m_prefset_general_orig.save();

	this.m_logger.debug("onCancel:");

	this.stop_timer_fsm_and_deregister();
}

ConfigSettings.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	this.updatePrefsetsFromDocument();

	this.m_prefset_general.save();

	this.stop_timer_fsm_and_deregister();

	var is_notify_preference_change = false;

	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		if (this.m_prefset_general.getProperty(this.m_checkbox_properties[i]) !=
		    this.m_prefset_general_orig.getProperty(this.m_checkbox_properties[i]))
				is_notify_preference_change = true;

	if (is_notify_preference_change)
		ObserverService.notify(ObserverService.TOPIC_PREFERENCE_CHANGE, null, null);

	this.m_logger.debug("onAccept: exits");
}

ConfigSettings.prototype.onCommand = function(id_target)
{
	this.m_logger.debug("onCommand: target: " + id_target);
	var is_accounts_changed = false;
	var rowid;

	switch (id_target)
	{
		case "zindus-cs-general-button-sync-now":
			this.updatePrefsetsFromDocument();
			var stopwatch = new StopWatch("Configsettings");
			stopwatch.mark("start")

			if (!this.is_developer_mode) // TODO
				zinAssert(this.m_accounts.length == 1);

			this.m_payload = new Payload();
			this.m_payload.m_a_accounts      = this.m_accounts;
			this.m_payload.m_syncfsm_details = newObject('type', "twoway");
			this.m_payload.m_es              = new SyncFsmExitStatus();
			this.m_payload.m_is_cancelled    = false;

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

				stopwatch.mark("finish")

				logger().debug("ConfigSettings.onCommand: after openDialog: m_is_cancelled: " +
				                                              this.m_payload.m_is_cancelled + " m_es: " + this.m_payload.m_es.toString());
				if (this.m_payload.m_es.m_exit_status == null)
				{
					logger().debug("ConfigSettings.onCommand: cs.sync.failed.unexpectedly");
					msg = stringBundleString("cs.sync.failed.unexpectedly") + "\n" +
					      stringBundleString("status.failmsg.see.bug.reporting.url")
				}
				else if (this.m_payload.m_es.m_exit_status != 0)
				{
					var failcode = this.m_payload.m_es.failcode();

					if (isInArray(failcode, GoogleRuleTrash.FAIL_CODES))
					{
						var payload2 = new Payload();
						var chrome_uri;

						payload2.m_args = newObject('m_es', this.m_payload.m_es);

						switch(failcode)
						{
							case 'failon.gd.conflict.1': 
							case 'failon.gd.conflict.2': 
							case 'failon.gd.conflict.3': chrome_uri = "chrome://zindus/content/googleruleunique.xul"; break;
							case 'failon.gd.conflict.4': chrome_uri = "chrome://zindus/content/googleruleempty.xul";  break;
							default: zinAssertAndLog(false, failcode);
						}

						window.openDialog(chrome_uri, "_blank", WINDOW_FEATURES, payload2);
					}
					else
						msg = this.m_payload.m_es.asMessage("cs.sync.succeeded", "cs.sync.failed");
				}

				if (msg != "")
					zinAlert('cs.sync.title', msg, window);
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
			StatusBar.update();
			break;

		case "zindus-cs-general-advanced-button":
			window.openDialog("chrome://zindus/content/configgd.xul", "_blank", WINDOW_FEATURES, null);
			break;

		case "zindus-cs-account-delete":
			rowid           = dId("zindus-cs-account-tree").currentIndex;
			var old_account = this.m_accounts[rowid];

			this.m_logger.debug("account-delete: rowid: " + rowid + " username: " + old_account.get(Account.username));

			this.m_accounts[rowid].remove();
			this.m_accounts.splice(rowid, 1);

			this.deletePasswordWhenRequired(old_account);

			is_accounts_changed = true;
			break;

		case "zindus-cs-account-add":
		case "zindus-cs-account-edit":
			var c_zimbra = this.accountsArrayOf(FORMAT_ZM).length;

			this.updatePrefsetsFromDocument(); // because prefset_general gets passed through to SyncWindow

			rowid = dId("zindus-cs-account-tree").currentIndex;

			var payload = new Payload();
			payload.m_is_zm_enabled = rowid == -1 || this.m_accounts[rowid].format_xx() == FORMAT_ZM || (c_zimbra == 0);
			payload.m_account = (id_target == "zindus-cs-account-add") ? null : this.m_accounts[rowid];

			window.openDialog("chrome://zindus/content/configaccount.xul", "_blank", WINDOW_FEATURES, payload);

			if (payload.m_result)
			{
				var account = new Account(payload.m_result); // bring the Account object into the scope of the current window.

				if (id_target == "zindus-cs-account-add")
				{
					this.m_accounts.push(account);

					if (account.format_xx() == FORMAT_ZM)
						rowid = c_zimbra; // Zimbra accounts appear above Google accounts
					else
						rowid = this.m_accounts.length - 1;
				}
				else
				{
					zinAssert(id_target == "zindus-cs-account-edit");

					var old_account = this.m_accounts[rowid];

					this.m_accounts[rowid] = account;

					// TODO
					// if (account.get(Account.url)      != old_account.get(Account.url) ||
					//    account.get(Account.username) != old_account.get(Account.username))
					this.deletePasswordWhenRequired(old_account);
				}

				var old_pl = new PasswordLocator(account.get(Account.passwordlocator));
				var new_pl = new PasswordLocator(account.get(Account.url), account.get(Account.username));

				new_pl.setPassword(old_pl.getPassword());
				old_pl.delPassword();

				account.set(Account.passwordlocator, new_pl);

				is_accounts_changed = true;
			}

			break;

		case "zindus-cs-general-auto-sync":
		case "zindus-cs-general-verbose-logging":
			this.updatePrefsetsFromDocument();
			this.m_prefset_general.save();

			this.m_logger.level(Singleton.instance().get_loglevel_from_preference());
			Singleton.instance().logger().level(Singleton.instance().get_loglevel_from_preference());

			break;

		default:
			// do nothing
			break;
	}

	if (is_accounts_changed)
	{
		this.m_logger.debug("blah: accounts have changed.");

		this.m_accounts = this.accountsSortAndSave(this.m_accounts);

		this.m_logger.debug("blah: 2.");

		if (id_target == "zindus-cs-account-delete")
		{
			// remove the last account from preferences because it has shifted up...
			//
			account = new Account();
			account.sourceid(Account.indexToSourceId(this.m_accounts.length));
			account.remove();

			// set rowid so that the right row gets selected below
			//
			if (this.m_accounts.length > 0)
			{
				if (rowid == this.m_accounts.length)
					rowid = this.m_accounts.length - 1;
			}
			else
				rowid = null;
		}

		this.accountsTreeRefresh();

		// this.m_logger.debug("blah: selecting rowid: " + rowid);

		if (rowid != null)
			dId("zindus-cs-account-tree").view.selection.select(rowid);

		this.updateView();

		if (isInArray(id_target, [ "zindus-cs-account-add", "zindus-cs-account-edit", "zindus-cs-account-delete" ]))
			this.m_logger.debug("blah: id_target: " + id_target + " m_accounts is: " + Account.arrayToString(this.m_accounts));
	}
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
}

ConfigSettings.prototype.updateView = function()
{
	if (this.m_is_fsm_running)
	{
		xulSetAttribute('disabled', true, "zindus-cs-command");
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete - disabling buttons");
		xulSetAttribute('disabled', false, "zindus-cs-command");
		xulSetAttribute('disabled', true, "zindus-cs-general-button-run-timer", "zindus-cs-general-button-sync-now");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		xulSetAttribute('disabled', false,
		                  "zindus-cs-command", "zindus-cs-general-button-run-timer", "zindus-cs-general-button-sync-now");
	}

	var a_google = this.accountsArrayOf(FORMAT_GD);
	var a_zimbra = this.accountsArrayOf(FORMAT_ZM);

	xulSetAttribute('hidden', a_google.length == 0, "zindus-cs-general-advanced-button");

	xulSetAttribute('disabled', dId("zindus-cs-account-tree").currentIndex < 0,
	                                        "zindus-cs-account-edit", "zindus-cs-account-delete");

	if (!this.is_developer_mode) // TODO
		xulSetAttribute('disabled', (this.m_accounts.length >= 1), "zindus-cs-account-add");
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
	var el = dId(radiogroup_id);

	zinAssertAndLog(el, "radiogroup_id: " + radiogroup_id);

	var selected_id = el.selectedItem.id;

	return bimap.lookup(null, selected_id);
}

ConfigSettings.setPrefsetFromRadio = function(radiogroup_id, bimap, prefset, property)
{
	var value = ConfigSettings.getValueFromRadio(radiogroup_id, bimap);
	prefset.setProperty(property, value);
	logger().debug("setPrefsetFromRadio: set prefset key: " + property + " value: " + value);
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
		ret += this.m_accounts[a_rowid[0]].get(Account.username);

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
}

ConfigSettings.prototype.getDomainFromUrl = function(url)
{
	// http://gunblad3.blogspot.com/2008/05/uri-url-parsing.html
	// 0  ==> url,      2  ==> protocol,    4  ==> username, 5 ==> password, 6 ==> host, 7 ==> port, 8 ==> pathname, 9 ==> urlparamseparator
	// 10 ==> urlparam, 11 ==> querystring, 12 ==> fragment
	//
	var re = /^((\w+):\/\/\/?)?((\w+):?(\w+)?@)?([^\/\?:]+):?(\d+)?(\/?[^\?#;\|]+)?([;\|])?([^\?#]+)?\??([^#]+)?#?(\w*)/;
	var a  = re.exec(url);
	zinAssert(a.length > 6);
	return a[6];
}

ConfigSettings.prototype.accountsTreeRefresh = function()
{
	var account, rowid, treeitem, treerow, treecell;

	var treechildren = dId("zindus-cs-account-treechildren");

	// delete the tree
	//
	for (rowid = 0; rowid <= this.m_accounts.length; rowid++) // try to delete one more than the number of elements in m_accounts
	{
		treeitem = dId(this.accountsTreeItemId(rowid));

		if (treeitem)
			treechildren.removeChild(treeitem);
	}

	// populate the tree with the accounts
	//
	for (rowid = 0; rowid < this.m_accounts.length; rowid++)
	{
		treeitem = document.createElement("treeitem");
		treerow  = document.createElement("treerow");
		account  = this.m_accounts[rowid];

		zinAssert(rowid < this.m_accounts.length);

		treeitem.id = this.accountsTreeItemId(rowid);

		treecell = document.createElement("treecell");
		treecell.setAttribute("label", account.get(Account.username));
		treerow.appendChild(treecell);

		treecell = document.createElement("treecell");
		treecell.setAttribute("label", account.format_xx() == FORMAT_GD ? stringBundleString("format.google") : 
		                               this.getDomainFromUrl(account.get(Account.url)));
		treerow.appendChild(treecell);

		this.m_logger.debug("accountsTreeRefresh: treeitem at rowid: " + rowid + " account: " + account.get(Account.username) + " " + account.get('format'));

		treeitem.appendChild(treerow);

		treechildren.appendChild(treeitem);
	}
}

ConfigSettings.prototype.accountsTreeItemId = function(rowid)
{
	return "zindus-cs-account-treeitem-" + rowid;
}

ConfigSettings.prototype.deletePasswordWhenRequired = function(account)
{
	var url      = account.get(Account.url);
	var username = account.get(Account.username);
	var pm       = new PasswordManager();

	if (!this.accountsIsPresentUrlUsername(url, username))
		pm.del(url, username);

	// always delete the authtoken because the password may have changed
	//
	if (account.format_xx() == FORMAT_GD)
	{
		url = googleClientLoginUrl('use-authtoken');

		pm.del(url, username);
	}
}

ConfigSettings.prototype.accountsIsPresentUrlUsername = function(url, username)
{
	var ret = false;

	for (var rowid = 0; rowid < this.m_accounts.length; rowid++)
		if (this.m_accounts[rowid].get(Account.url) == url && this.m_accounts[rowid].get(Account.username) == username)
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

	return a_rowid;
}

ConfigSettings.prototype.accountsSortAndSave = function(accounts)
{
	var ret = new Array();
	var i;

	// move Zimbra accounts to the top so that they get synced first
	//
	// we do this because of this scenario:
	// 1. slow sync ==> Google then Zimbra.
	// 2. Slow Sync with Google, account has conflicts, user resolves by deleting some Thunderbird contacts (eg duplicates)
	// 3. Slow Sync with Zimbra, contacts that the user may have deleted in Thunderbird to resolve Google conflict get added
	//    because they exist at Zimbra (ouch!)
	// 4. Next sync (a fast sync) ==> the same conflict that got resolved earlier!
	//    If the user had the patience to fix the conflict a second time it'd stay fixed
	//    but still not acceptable.
	// 
	// Having Zimbra accounts sync first means that the Google conflicts appear second so if the user deletes a contact and syncs again,
	// the deletes are propagated to Zimbra
	//
	for (i = 0; i < accounts.length; i++)
		if (accounts[i].format_xx() == FORMAT_ZM)
			ret.push(accounts[i]);

	for (i = 0; i < accounts.length; i++)
		if (accounts[i].format_xx() == FORMAT_GD)
			ret.push(accounts[i]);

	for (var i = 0; i < accounts.length; i++)
	{
		ret[i].sourceid(Account.indexToSourceId(i));
		ret[i].save();
	}

	return ret;
}

ConfigSettings.open = function()
{
	var is_already_open = false;

	var id = 'zindus-config-settings';
	var zwc = new WindowCollection([ id ]);
	zwc.populate();

	zinAssertAndLog(zwc.length(id) <= 1, zwc.length(id));

	if (zwc.length(id) == 1)
	{
		var zwc_functor = {
			run: function(win) {
				var el = win.document.getElementById(id);

				if (el && !el.closed)
				{
					logger().debug("settings focus to the ConfigSettings window that's already open");
					win.focus();
					is_already_open = true;
				}
			}
		};
		zwc.forEach(zwc_functor);
	}

	if (!is_already_open)
		window.openDialog('chrome://zindus/content/configsettings.xul', '_blank', WINDOW_FEATURES);
}
