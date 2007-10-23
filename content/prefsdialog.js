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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/bimap.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/passwordmanager.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/timer.js");

function Prefs()
{
	this.m_prefset_server      = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
	this.m_prefset_general     = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.m_checkbox_properties = PrefSet.GENERAL_PROPERTIES;
	this.m_checkbox_ids        = [ "zindus-prefs-general-manual-sync-only",
								   "zindus-prefs-general-verbose-logging"  ];
	this.m_checkbox_bimap      = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_is_fsm_running      = false;
	this.m_logger              = newZinLogger("Prefs");

	var preferences = new MozillaPreferences();
	this.is_developer_mode     = (preferences.getCharPrefOrNull(preferences.branch(), "system.developer_mode") == "true");
}

Prefs.prototype.onLoad = function(target)
{
	if (this.is_developer_mode)
	{
		document.getElementById("zindus-prefs-general-button-test-harness").removeAttribute('hidden');
		document.getElementById("zindus-prefs-general-button-run-timer").removeAttribute('hidden');
		document.getElementById("zindus-prefs-general-group-advanced-settings").removeAttribute('hidden');
	}

	this.m_prefset_server.load(SOURCEID_ZM);
	this.m_prefset_general.load();

	// this.m_logger.debug("onLoad: - m_prefset_server == "  + this.m_prefset_server.toString());
	// this.m_logger.debug("onLoad: - m_prefset_general == " + this.m_prefset_general.toString());

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_PREFSDIALOG, ZinMaestro.FSM_GROUP_SYNC);

	this.initialiseView();
	this.updateView();
}

Prefs.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_PREFSDIALOG);
}

Prefs.prototype.onAccept = function()
{
	this.m_logger.debug("onAccept:");

	// server tab
	//
	var url      = document.getElementById("zindus-prefs-server-url").value;
	var username = document.getElementById("zindus-prefs-server-username").value;
	var password = document.getElementById("zindus-prefs-server-password").value;

	var prev_url      = this.m_prefset_server.getProperty(PrefSet.SERVER_URL);
	var prev_username = this.m_prefset_server.getProperty(PrefSet.SERVER_USERNAME);

	var pm = new PasswordManager();

	if ((url != prev_url || username != prev_username) && pm.get(prev_url, prev_username))
		pm.del(prev_url, prev_username);

	pm.set(url, username, password);

	this.m_prefset_server.setProperty(PrefSet.SERVER_URL,      url );
	this.m_prefset_server.setProperty(PrefSet.SERVER_USERNAME, username );

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.m_checkbox_properties[i],
			document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked ? "true" : "false" );

	this.m_prefset_server.save();
	this.m_prefset_general.save();

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_PREFSDIALOG);
}

Prefs.prototype.onHelp = function(url)
{
	this.openURL(url);
}

Prefs.prototype.onCommand = function(id_target)
{
	this.m_logger.debug("onCommand: target: " + id_target);

	switch(id_target)
	{
		case "zindus-prefs-general-button-sync-now":
			var state = new TwoWayFsmState();
			state.setCredentials(
				document.getElementById("zindus-prefs-server-url").value,
				document.getElementById("zindus-prefs-server-username").value,
				document.getElementById("zindus-prefs-server-password").value );

			var payload = new Payload();
			payload.m_syncfsm = new TwoWayFsm(state);

			var win = window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);

			var exitStatus = payload.m_result;

			if (exitStatus.m_exit_status != 0)
			{
				msg = SyncFsmExitStatus.asMessage(exitStatus, "statusSyncSucceeded", "statusSyncFailed");

				if (msg == "")
					msg = "sync failed - no detail available";

				alert(msg);
			}

			break;

		case "zindus-prefs-server-button-authonly":
			var state = new AuthOnlyFsmState();
			state.setCredentials(
				document.getElementById("zindus-prefs-server-url").value,
				document.getElementById("zindus-prefs-server-username").value,
				document.getElementById("zindus-prefs-server-password").value );

			var payload = new Payload();
			payload.m_syncfsm = new AuthOnlyFsm(state);

			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);

			var exitStatus = payload.m_result;
			msg = SyncFsmExitStatus.asMessage(exitStatus, "statusAuthSucceeded", "statusAuthFailed");

			if (msg != "")
				alert(msg);

			break;

		case "zindus-prefs-general-button-test-harness":
			var testharness = new ZinTestHarness();
			testharness.run();
			break;

		case "zindus-prefs-general-button-run-timer":
			// note that if you close the preferences window while this timer is running, the fsm is garbage collected
			// but the maestro is never told (because the fsm never reached the 'final' state
			// The timer functor isn't doesn't support 'cancel' the way SyncWindow does.
			// It should only be visible in the UI with debugging turned on anyways...
			//
			var functor = new ZinTimerFunctorSync(ZinMaestro.ID_FUNCTOR_TIMER_PREFSDIALOG, null)
			var timer = new ZinTimer(functor);
			timer.start(0);
			// timer = null;
			// functor = null;
			break;

		case "zindus-prefs-general-button-reset":
			SyncFsm.removeZfcs();
			SyncFsm.removeLogfile();
			StatusPanel.update();
			break;

		case "zindus-prefs-tab-general":
			this.updateView();
			break;

		default:
			// do nothing
			break;
	}
}

Prefs.prototype.initialiseView = function()
{
	// server tab
	//
	var a = PrefSetHelper.getUserUrlPw(this.m_prefset_server, PrefSet.SERVER_USERNAME, PrefSet.SERVER_URL);

	document.getElementById("zindus-prefs-server-username").value = a[0];
	document.getElementById("zindus-prefs-server-url").value      = a[1]; 
	document.getElementById("zindus-prefs-server-password").value = a[2];

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked =
		           (this.m_prefset_general.getProperty(this.m_checkbox_properties[i]) == "true");

	var selectedTab = this.isServerSettingsComplete() ? "zindus-prefs-tab-general" : "zindus-prefs-tab-server";

	document.getElementById("zindus-prefs-tabbox").selectedTab = document.getElementById(selectedTab);
}

Prefs.prototype.isServerSettingsComplete = function()
{
	ret = true;
	ret = ret && (document.getElementById("zindus-prefs-server-url").value.length      > 0);
	ret = ret && (document.getElementById("zindus-prefs-server-username").value.length > 0);
	ret = ret && (document.getElementById("zindus-prefs-server-password").value.length > 0);

	return ret;
}

Prefs.prototype.updateView = function()
{
	var i;
	// - test connection ==> disabled when fsm is running, otherwise enabled
	// - test harness    ==> disabled when fsm is running, otherwise enabled
	// - reset           ==> disabled when fsm is running, otherwise enabled
	// - run timer       ==> disabled when fsm is running or isServerSettingsComplete, otherwise enabled
	// - sync now        ==> disabled when fsm is running or isServerSettingsComplete, otherwise enabled

	if (this.m_is_fsm_running)
	{
		this.m_logger.debug("updateView: fsm running");
		document.getElementById("zindus-prefs-cmd-sync").setAttribute('disabled', true);
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete");
		document.getElementById("zindus-prefs-general-button-run-timer").setAttribute('disabled', true);
		document.getElementById("zindus-prefs-general-button-sync-now").setAttribute('disabled', true);
	}
	else
	{
		this.m_logger.debug("updateView: removing disabled attributes");
		document.getElementById("zindus-prefs-cmd-sync").removeAttribute('disabled');
		document.getElementById("zindus-prefs-general-button-run-timer").removeAttribute('disabled');
		document.getElementById("zindus-prefs-general-button-sync-now").removeAttribute('disabled');
	}
}

Prefs.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") );

	if (fsmstate && ! fsmstate.isFinal())
	{
		this.m_logger.debug("onFsmStateChangeFunctor: fsm is running");
		this.m_is_fsm_running = true;
		this.updateView();
	}
	else
	{
		this.m_logger.debug("onFsmStateChangeFunctor: fsm either wasn't running or just finished");
		this.m_is_fsm_running = false;
		this.updateView();
	}
}

// See: http://developer.mozilla.org/en/docs/Opening_a_Link_in_the_Default_Browser
//
Prefs.prototype.openURL = function(url)
{
	var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
	var uriToOpen = ioservice.newURI(url, null, null);

	var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
	                      .getService(Components.interfaces.nsIExternalProtocolService);

	extps.loadURI(uriToOpen, null);
}
