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
// $Id: configsettings.js,v 1.40 2009-06-28 10:45:13 cvsuser Exp $

includejs("payload.js");
includejs("testharness.js");
// includejs('share_service/configzss.js'); // IS_DEVELOPER_MODE

const WINDOW_FEATURES = "chrome,centerscreen,modal=yes,dependent=yes";

function ConfigSettings()
{
	this.m_checkbox_properties  = [ PrefSet.GENERAL_AS_AUTO_SYNC,  PrefSet.GENERAL_AS_VERBOSE_LOGGING  ];
	this.m_checkbox_ids         = [ "cs-auto-sync", "cs-verbose-logging" ];
	this.m_checkbox_bimap       = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_gd_sync_with_bimap   = new BiMap( [ "zg",                              "pab"                              ], 
	                                         [ "cs-gdsyncwith-zg", "cs-gdsyncwith-pab" ] );

	this.m_prefset_general      = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_AS_PROPERTIES);
	this.m_prefset_general_orig = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_AS_PROPERTIES);
	this.m_format_bimap         = getBimapFormat('long');
	this.m_timer_timeoutID      = null;
	this.m_timer_functor        = null;
	this.m_maestro              = null;
	this.m_is_fsm_running       = false;
	this.m_is_developer_mode    = preference("system.as_developer_mode", 'bool');
	this.m_console_listener     = Logger.nsIConsoleListener();
	this.m_payload              = null;
	this.m_accounts             = null;
	this.m_logger               = newLogger("ConfigSettings"); // this.m_logger.level(Logger.NONE);
	this.m_addressbook          = AddressBook.new();
	this.m_czss                 = (false) ? new ConfigZss() : null;  // IS_DEVELOPER_MODE
}

ConfigSettings.prototype.onLoad = function(target)
{
	if (this.m_is_developer_mode)
		xulSetAttribute('hidden', false, "cs-button-test-harness", "cs-button-run-timer");

	this.m_prefset_general.load();
	this.m_prefset_general_orig.load();

	this.initialiseView();
	this.maestroRegister(); // during which we get notified and updateView() is called...

	let payload = new Payload();
	let self = this;
	Payload.prototype.account = function() {
		return (self.m_accounts.length == 0) ? null : self.m_accounts[0];
	}
	payload.m_account  = this.m_accounts.length == 0 ? null : this.m_accounts[0];
	payload.m_localised_pab = this.m_addressbook.getPabName();
	if (this.m_czss)
		this.m_czss.onLoad(payload);
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

	if (this.m_czss)
		this.m_czss.onCancel();

	this.m_prefset_general_orig.save();

	this.m_logger.debug("onCancel:");

	this.stop_timer_fsm_and_deregister();
}

ConfigSettings.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept: enters");

	let ret = this.m_czss ? this.m_czss.onAccept() : true;

	if (ret) {
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
	}

	this.m_logger.debug("onAccept: exits with return value: " + ret);

	return ret;
}

ConfigSettings.prototype.onCommand = function(id_target)
{
	var is_accounts_changed = false;
	var do_sync_now_after_wizard = false;
	var rowid;

	this.m_logger.debug("onCommand: target: " + id_target);

	switch (id_target)
	{
		case "cs-button-sync-now":
			this.updatePrefsetsFromDocument();
			var stopwatch = new StopWatch("Configsettings");
			stopwatch.mark("start")

			this.m_payload = new Payload();
			this.m_payload.m_a_accounts      = this.m_accounts;
			this.m_payload.m_syncfsm_details = newObject('type', "twoway", 'is_attended', true);
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
				let msg = "";

				stopwatch.mark("finish")

				logger().debug("ConfigSettings.onCommand: after openDialog: m_is_cancelled: " +
				                                              this.m_payload.m_is_cancelled + " m_es: " + this.m_payload.m_es.toString());
				if (this.m_payload.m_es.m_exit_status == null)
				{
					logger().debug("ConfigSettings.onCommand: status.failon.unexpected");
					msg = stringBundleString("status.failon.unexpected") + "\n\n" +
					      stringBundleString("text.file.bug", [ BUG_REPORT_URI ]);
				}
				else if (this.m_payload.m_es.m_exit_status != 0)
				{
					var failcode = this.m_payload.m_es.failcode();

					if (isInArray(failcode, GoogleRuleTrash.FAIL_CODES))
					{
						let payload2 = new Payload();
						let chrome_uri;

						payload2.m_args = newObject('m_es', this.m_payload.m_es);

						switch(failcode) {
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

			if (this.m_czss)
				this.m_czss.initialiseView();

			this.m_payload = null;
			break;

		case "cs-button-test-harness": {
			let testharness = new TestHarness();
			testharness.run();
			break;
			}

		case "cs-button-run-timer":
			this.m_timer_timeoutID = window.setTimeout(this.onTimerFire, 0, this);
			this.m_is_fsm_running = true;
			break;

		case "cs-button-reset":
			Filesystem.removeZfcs();
			Filesystem.removeLogfile();
			StatusBarState.update();
			if (this.m_czss)
				this.m_czss.initialiseView();
			break;

		case "cs-button-advanced":
			window.openDialog("chrome://zindus/content/configgoogle.xul", "_blank", WINDOW_FEATURES, null);
			break;

		case "cs-account-delete":
			rowid           = dId("cs-account-tree").currentIndex;
			let old_account = this.m_accounts[rowid];

			Filesystem.removeZfc(FeedCollection.zfcFileNameFromSourceid(old_account.sourceid)); // so that the sharing grants are gone

			this.m_logger.debug("account-delete: rowid: " + rowid + " username: " + old_account.username);

			this.m_accounts[rowid].remove();
			this.m_accounts.splice(rowid, 1);

			this.cleanUpPasswordDb(old_account);

			is_accounts_changed = true;

			break;

		case "czss-share-signup-wizard":
		case "cs-account-add":
		case "cs-account-edit": {
			rowid = dId("cs-account-tree").currentIndex;

			let payload = new Payload();
			payload.m_accounts = this.m_accounts;
			payload.m_account  = (id_target == "cs-account-edit") ? this.m_accounts[rowid] : null;
			payload.m_format   = null;

			if (id_target == "czss-share-signup-wizard") {
				payload.m_startpage = "cw-page-signup-1-username";
				window.openDialog("chrome://zindus/content/share_service/configwizard.xul", "_blank", WINDOW_FEATURES, payload);
			}
			else
				window.openDialog("chrome://zindus/content/configaccount.xul", "_blank", WINDOW_FEATURES, payload);

			if (payload.m_result_accounts)
			{
				let account = null;

				if (id_target == "cs-account-add" || id_target == "cs-account-edit")
					account = new Account(payload.m_result_accounts[0]);

				// remember that the account object(s) in m_result_accounts must be brought into the scope of the current window.
				//
				switch (id_target) {
					case "czss-share-signup-wizard": {
						let i;
						for (i = 0; i < payload.m_result_accounts.length; i++)
							this.m_accounts.push(new Account(payload.m_result_accounts[i]));
						}
						do_sync_now_after_wizard = payload.m_result_sync_now;
						break;

					case "cs-account-add":
						this.m_accounts.push(account);
						break;

					case "cs-account-edit":
						let old_account = this.m_accounts[rowid];

						this.m_accounts[rowid] = account;

						this.cleanUpPasswordDb(old_account);
						break;

					default:
						zinAssert(false);
				}

				if (id_target != "cs-account-edit")
				{
					if (payload.m_result_accounts[payload.m_result_accounts.length-1] == FORMAT_ZM)
						rowid = 0; // Zimbra accounts appear above Google accounts
					else
						rowid = this.m_accounts.length - 1;
				}

				if (id_target == "cs-account-add" || id_target == "cs-account-edit")
					ConfigSettingsStatic.resetPasswordLocator(account);

				is_accounts_changed = true;
			}

			break;
			}

		case "cs-auto-sync":
		case "cs-verbose-logging":
			this.updatePrefsetsFromDocument();
			this.m_prefset_general.save();

			this.m_logger.level(singleton().get_loglevel_from_preference());
			singleton().logger().level(singleton().get_loglevel_from_preference());

			ObserverService.notify(ObserverService.TOPIC_PREFERENCE_CHANGE, null, null);

			break;

		default:
			// do nothing
			break;
	}

	if (is_accounts_changed)
	{
		// if the accounts came from the wizard then they're saved again here - no big deal...
		//
		this.m_accounts = ConfigSettingsStatic.accountsSortAndSave(this.m_accounts);

		if (id_target == "cs-account-delete")
		{
			// remove the last account from preferences because it has shifted up...
			//
			let account = new Account();
			account.sourceid = AccountStatic.indexToSourceId(this.m_accounts.length);
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

		if (rowid != null)
			dId("cs-account-tree").view.selection.select(rowid);

		this.updateView();

		if (this.m_czss)
			if (do_sync_now_after_wizard)
				this.onCommand("cs-button-sync-now");
			else
				this.m_czss.initialiseView();

		if (isInArray(id_target, [ "cs-account-add", "cs-account-edit", "cs-account-delete", "czss-share-signup-wizard" ]))
			this.m_logger.debug("id_target: " + id_target + " m_accounts is: " + AccountStatic.arrayToString(this.m_accounts));
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
	this.m_accounts = AccountStatic.arrayLoadFromPrefset();
	this.accountsTreeRefresh();

	if (this.m_accounts.length > 0)
		dId("cs-account-tree").view.selection.select(0);

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
		xulSetAttribute('disabled', true, "cs-command");
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete - disabling buttons");
		xulSetAttribute('disabled', false, "cs-command");
		xulSetAttribute('disabled', true, "cs-button-run-timer", "cs-button-sync-now");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		xulSetAttribute('disabled', false, "cs-command", "cs-button-run-timer", "cs-button-sync-now");
	}

	var c_google = AccountStatic.arraySliceOfFormat(this.m_accounts, FORMAT_GD).length;

	xulSetAttribute('visible', (c_google != 0), "cs-button-advanced");
	xulSetAttribute('disabled', (dId("cs-account-tree").currentIndex < 0), "cs-account-edit", "cs-account-delete");
}

ConfigSettings.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_is_fsm_running = (fsmstate && ! fsmstate.isFinal());

	// this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") +
	//                                    " m_is_fsm_running: " + this.m_is_fsm_running);

	this.updateView();
}

ConfigSettings.prototype.isServerSettingsComplete = function()
{
	return this.m_accounts.length > 0;
}

ConfigSettings.prototype.updatePrefsetsFromDocument = function()
{
	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.m_checkbox_properties[i],
			dId(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked ? "true" : "false" );
}

ConfigSettings.prototype.accountsTreeRefresh = function()
{
	var account, rowid, treeitem, treerow, treecell, value;

	var treechildren = dId("cs-account-treechildren");

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

		// Email
		//
		ConfigSettingsStatic.appendCell(treerow, account.username);

		// Addressbook
		//
		if (nsIXULAppInfo().app_name != 'firefox') {
			if (account.format_xx() == FORMAT_GD)
				value = account.gd_sync_with == 'zg' ? FolderConverter.PREFIX_PRIMARY_ACCOUNT : this.m_addressbook.getPabName();
			else
				value = "        *";

			ConfigSettingsStatic.appendCell(treerow, value);
		}

		this.m_logger.debug("accountsTreeRefresh: treeitem at rowid: " + rowid + " account: " + account.username + " " + account.get('format'));

		treeitem.appendChild(treerow);

		treechildren.appendChild(treeitem);
	}
}

ConfigSettings.prototype.accountsTreeItemId = function(rowid)
{
	return "cs-account-treeitem-" + rowid;
}

ConfigSettings.prototype.cleanUpPasswordDb = function(account)
{
	this.m_logger.debug("cleanUpPasswordDb: account url: " + account.url + " username: " + account.username);

	if (!this.accountsIsPresentUrlUsername(account.url, account.username))
		ConfigSettingsStatic.removeFromPasswordDatabase(account.url, account.username);

	if (account.format_xx() == FORMAT_GD) // always delete the authtoken because the password may have changed
		ConfigSettingsStatic.removeFromPasswordDatabase(eGoogleLoginUrl.kAuthToken, account.username);
}

ConfigSettings.prototype.accountsIsPresentUrlUsername = function(url, username)
{
	var ret = false;

	for (var rowid = 0; rowid < this.m_accounts.length; rowid++)
		if (this.m_accounts[rowid].url == url && this.m_accounts[rowid].username == username)
		{
			ret = true;
			break;
		}

	return ret;
}

ConfigSettings.open = function()
{
	var is_already_open = false;

	var id = 'zindus-cs-dialog';
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

var ConfigSettingsStatic = {
	m_pm : PasswordManager.new(),
	getValueFromRadio : function(radiogroup_id, bimap) {
		var el = dId(radiogroup_id);

		zinAssertAndLog(el, "radiogroup_id: " + radiogroup_id);

		var selected_id = el.selectedItem.id;

		return bimap.lookup(null, selected_id);
	},
	setPrefsetFromRadio : function(radiogroup_id, bimap, prefset, property) {
		var value = this.getValueFromRadio(radiogroup_id, bimap);
		prefset.setProperty(property, value);
		logger().debug("setPrefsetFromRadio: set prefset key: " + property + " value: " + value);
	},
	setRadioFromPrefset : function(radiogroup_id, bimap, prefset, property, default_id) {
		var selected_id;
		var value = prefset.getProperty(property);

		logger().debug("setRadioFromPrefset: radiogroup_id: " + radiogroup_id + " value: " + value);

		if (value && bimap.isPresent(value, null))
			selected_id = bimap.lookup(value, null);
		else
			selected_id = default_id;
		
		dId(radiogroup_id).selectedItem = dId(selected_id);
	},
	appendCell : function(treerow, value, properties) {
		var treecell = document.createElement("treecell");

		treecell.setAttribute("label", value);

		if (properties)
			treecell.setAttribute("properties", properties);

		treerow.appendChild(treecell);
	},
	resetPasswordLocator : function (account) {
		// the PasswordLocator in the account returned by ConfigAccount is temporary
		// here we make change it to the permanent one and remove the temporary one
		//
		let old_pl = new PasswordLocator(account.passwordlocator);

		account.passwordlocator = new PasswordLocator(account.url, account.username);
		account.passwordlocator.setPassword(old_pl.getPassword());

		this.removeFromPasswordDatabase(old_pl);
	},
	removeFromPasswordDatabase : function() {
		var url, username;

		if (arguments.length == 1) {
			zinAssert(arguments[0] instanceof PasswordLocator);
			url      = arguments[0].url();
			username = arguments[0].username();
		}
		else {
			zinAssert(typeof(arguments[0]) == 'string' && typeof(arguments[1]) == 'string');
			url      = arguments[0];
			username = arguments[1];
		}

		this.m_pm.del(url, username);
	},
	accountsSortAndSave : function(accounts) {
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

		for (i = 0; i < accounts.length; i++) {
			ret[i].sourceid = AccountStatic.indexToSourceId(i);
			ret[i].save();
		}

		return ret;
	}
};
