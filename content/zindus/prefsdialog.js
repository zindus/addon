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

include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/bimap.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/removedatastore.js");
include("chrome://zindus/content/passwordmanager.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/testharness.js");
include("chrome://zindus/content/timer.js");

const GOOGLE_URL_CLIENT_LOGIN = "https://www.google.com/accounts/ClientLogin";

function Prefs()
{
	this.m_prefset_server      = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
	this.m_prefset_general     = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.m_checkbox_properties = [ PrefSet.GENERAL_MANUAL_SYNC_ONLY, PrefSet.GENERAL_VERBOSE_LOGGING ];
	this.m_checkbox_ids        = [ "zindus-prefs-general-manual-sync-only",
								   "zindus-prefs-general-verbose-logging"  ];
	this.m_checkbox_bimap      = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_gal_radio_values    = [                          "yes",                          "if-fewer",                          "no" ];
	this.m_gal_radio_ids       = [ "zindus-prefs-general-gal-yes", "zindus-prefs-general-gal-if-fewer", "zindus-prefs-general-gal-no" ];
	this.m_gal_radio_bimap     = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	// this.m_gd_sync_with_bimap  = new BiMap( [ "zg",                                 "pab"                                 ], 
	//                                         [ "zindus-prefs-general-gdsyncwith-zg", "zindus-prefs-general-gdsyncwith-pab" ] );
	this.m_server_type_bimap   = new BiMap( [ "google",                           "zimbra"                          ], 
	                                        [ "zindus-prefs-server-type-google",  "zindus-prefs-server-type-zimbra" ] );

	this.m_timeoutID           = null;
	this.m_maestro             = null;
	this.m_is_fsm_running      = false;
	this.m_logger              = newZinLogger("Prefs"); this.m_logger.level(ZinLogger.NONE);

	this.m_preferences         = new MozillaPreferences();
	this.is_developer_mode     = (this.m_preferences.getCharPrefOrNull(this.m_preferences.branch(), "system.developer_mode") == "true");

	this.m_server_type_last    = null;
	this.a_server_type_values  = new Object();
}

Prefs.prototype.onLoad = function(target)
{
	if (this.is_developer_mode)
	{
		document.getElementById("zindus-prefs-general-button-test-harness").removeAttribute('hidden');
		document.getElementById("zindus-prefs-general-button-run-timer").removeAttribute('hidden');
	}

	this.m_prefset_server.load(SOURCEID_AA);
	this.m_prefset_general.load();

	// this.m_logger.debug("onLoad: - m_prefset_server == "  + this.m_prefset_server.toString());
	// this.m_logger.debug("onLoad: - m_prefset_general == " + this.m_prefset_general.toString());

	this.maestroRegister()
	this.initialiseView();
	this.updateView();
}

Prefs.prototype.maestroRegister = function()
{
	if (!ObserverService.isRegistered(ZinMaestro.TOPIC))
	{
		this.m_maestro = new ZinMaestro();

		ObserverService.register(this.m_maestro, ZinMaestro.TOPIC);
	}

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_PREFSDIALOG, ZinMaestro.FSM_GROUP_SYNC);
}

Prefs.prototype.maestroUnregister = function()
{
	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_PREFSDIALOG);

	if (this.m_maestro && ObserverService.isRegistered(ZinMaestro.TOPIC))
		ObserverService.unregister(this.m_maestro, ZinMaestro.TOPIC);
}

Prefs.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

	this.maestroUnregister();

	if (this.m_timeoutID)
		window.clearTimeout(this.m_timeoutID);
}

Prefs.prototype.onAccept = function()
{
	var selected_id, radio_button;

	this.m_logger.debug("onAccept:");

	// server tab - url, username and password
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

	// server tab - server type
	//
	this.setPrefsetFromRadio("zindus-prefs-server-type-radiogroup", this.m_server_type_bimap,
	                          this.m_prefset_server, PrefSet.SERVER_TYPE);

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.m_checkbox_properties[i],
			document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked ? "true" : "false" );

	// general tab - radio elements: GAL and Google Sync With
	//
	// this.setPrefsetFromRadio("zindus-prefs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap,
	//                          this.m_prefset_general, PrefSet.GENERAL_GD_SYNC_WITH);
	this.setPrefsetFromRadio("zindus-prefs-general-gal-enabled", this.m_gal_radio_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_SYNC_GAL_ENABLED);

	this.m_prefset_server.save();
	this.m_prefset_general.save();

	this.maestroUnregister();
}

Prefs.prototype.onHelp = function(url)
{
	this.openURL(url);
}

Prefs.prototype.onCommand = function(id_target)
{
	this.m_logger.debug("onCommand: target: " + id_target);
	var msg = "";

	switch(id_target)
	{
		case "zindus-prefs-general-button-sync-now":
			var payload = new Payload();
			payload.m_syncfsm = this.getSyncFsm(
									this.serverType(),
									"twoway",
									document.getElementById("zindus-prefs-server-url").value,
									document.getElementById("zindus-prefs-server-username").value,
									document.getElementById("zindus-prefs-server-password").value );
			payload.m_es = new SyncFsmExitStatus();

			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);

			if (payload.m_es.m_exit_status == null)
			{
				gLogger.debug("Prefs.onCommand: statusSyncFailedUnexpectedly");
				msg = stringBundleString("statusSyncFailedUnexpectedly");
			}
			else if (payload.m_es.m_exit_status != 0)
				msg = payload.m_es.asMessage("statusSyncSucceeded", "statusSyncFailed");
			
			if (msg != "")
				alert(msg);

			break;

		case "zindus-prefs-server-button-authonly":
			var payload = new Payload();
			payload.m_syncfsm = this.getSyncFsm(
									this.serverType(),
									"authonly",
									document.getElementById("zindus-prefs-server-url").value,
									document.getElementById("zindus-prefs-server-username").value,
									document.getElementById("zindus-prefs-server-password").value );
			payload.m_es = new SyncFsmExitStatus();

			gLogger.debug("Prefs.onCommand: before openDialog: payload.m_es: " + payload.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul", "_blank", "chrome", payload);

			gLogger.debug("Prefs.onCommand: after openDialog: payload.m_es: " + payload.m_es.toString());

			if (payload.m_es.m_exit_status == null)
			{
				gLogger.debug("Prefs.onCommand: statusSyncFailedUnexpectedly");
				msg = stringBundleString("statusSyncFailedUnexpectedly");
			}
			else
				msg = payload.m_es.asMessage("statusAuthSucceeded", "statusAuthFailed");

			alert(msg);

			break;

		case "zindus-prefs-general-button-test-harness":
			var testharness = new ZinTestHarness();
			testharness.run();
			break;

		case "zindus-prefs-general-button-run-timer":
			this.m_timeoutID = window.setTimeout(this.onTimerFire, 0, this);
			break;

		case "zindus-prefs-general-button-reset":
			RemoveDatastore.removeZfcs();
			RemoveDatastore.removeLogfile();
			StatusPanel.update();
			break;

		case "zindus-prefs-server-type-google":
		case "zindus-prefs-server-type-zimbra":
		case "zindus-prefs-tab-general":
			this.updateView();
			break;

		default:
			// do nothing
			break;
	}
}

Prefs.prototype.getSyncFsm = function(format, type, serverurl, username, password)
{
	var syncfsm;
	var id_fsm = null

	// this.m_logger.debug("getSyncFsm: serverurl: " + serverurl + " username: " + username + " password: " + password);

	if      (format == FORMAT_ZM && type == "twoway")    { syncfsm = new SyncFsmZm(); id_fsm = ZinMaestro.FSM_ID_ZM_TWOWAY;   }
	else if (format == FORMAT_ZM && type == "authonly")  { syncfsm = new SyncFsmZm(); id_fsm = ZinMaestro.FSM_ID_ZM_AUTHONLY; }
	else if (format == FORMAT_GD && type == "twoway")    { syncfsm = new SyncFsmGd(); id_fsm = ZinMaestro.FSM_ID_GD_TWOWAY;   }
	else if (format == FORMAT_GD && type == "authonly")  { syncfsm = new SyncFsmGd(); id_fsm = ZinMaestro.FSM_ID_GD_AUTHONLY; }
	else zinAssertAndLog(false, "mismatched case: format: " + format + " type: " + type);

	syncfsm.initialise(id_fsm);
	syncfsm.setCredentials(serverurl, username, password);

	return syncfsm;
}

Prefs.prototype.onTimerFire = function(context)
{
	// note that if you close the preferences window while this timer is running, the fsm is garbage collected
	// but the maestro is never told (because the fsm never reached the 'final' state
	// The timer functor isn't doesn't support 'cancel' the way SyncWindow does.
	// It should only be visible in the UI with debugging turned on anyways...
	//
	context.m_logger.debug("onTimerFire: in here");
	context.m_timeoutID = null;
	var functor = new ZinTimerFunctorSync(ZinMaestro.ID_FUNCTOR_PREFSDIALOG_TIMER, null, null);
	functor.run();
}

Prefs.prototype.initialiseView = function()
{
	var selected_id;

	// server tab - url, username and password
	//
	var a = PrefSetHelper.getUserUrlPw(this.m_prefset_server, PrefSet.SERVER_USERNAME, PrefSet.SERVER_URL);

	document.getElementById("zindus-prefs-server-username").value = a[0];
	document.getElementById("zindus-prefs-server-url").value      = a[1]; 
	document.getElementById("zindus-prefs-server-password").value = a[2];

	// server tab - server type
	//
	this.setRadioFromPrefset("zindus-prefs-server-type-radiogroup", this.m_server_type_bimap, this.m_prefset_server,
	                          PrefSet.SERVER_TYPE, "zindus-prefs-server-type-zimbra")

	this.m_server_type_last = this.serverType();
	this.rememberLastServerType(this.m_server_type_last);

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked =
		           (this.m_prefset_general.getProperty(this.m_checkbox_properties[i]) == "true");

	// general tab - Google Sync With
	//
	// this.setRadioFromPrefset("zindus-prefs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap, this.m_prefset_general,
	//                          PrefSet.GENERAL_GD_SYNC_WITH, "zindus-prefs-general-gdsyncwith-pab")

	// general tab - Gal radiogroup
	//
	var if_fewer = this.m_preferences.getIntPref(this.m_preferences.branch(), "system.SyncGalEnabledIfFewer");

	var msg = stringBundleString("prefsGalIfFewerPartOne") + " " + if_fewer + " " + stringBundleString("prefsGalIfFewerPartTwo");

	document.getElementById("zindus-prefs-general-gal-if-fewer").label = msg;

	this.setRadioFromPrefset("zindus-prefs-general-gal-enabled", this.m_gal_radio_bimap, this.m_prefset_general,
	                          PrefSet.GENERAL_SYNC_GAL_ENABLED, "zindus-prefs-general-gal-if-fewer")
	
	// work out which tab appears on top
	//
	selected_id = this.isServerSettingsComplete() ? "zindus-prefs-tab-general" : "zindus-prefs-tab-server";

	document.getElementById("zindus-prefs-tabbox").selectedTab = document.getElementById(selected_id);

	this.m_logger.debug("initialiseView: isServerSettingsComplete: " + this.isServerSettingsComplete());
	this.m_logger.debug("initialiseView: selectedTab: " + selected_id);
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

	var server_type_current = this.serverType();

	// document.getElementById("zindus-prefs-general-syncwith-vbox").style.position = "relative";
	// document.getElementById("zindus-prefs-general-gal").style.position = "relative";
	// document.getElementById("zindus-prefs-general-syncwith-vbox").style.zindex = "1";
	// document.getElementById("zindus-prefs-general-gal").style.zindex = "2";

	if (server_type_current == FORMAT_GD)
	{
		document.getElementById("zindus-prefs-server-url-description").style.visibility = "hidden";
		document.getElementById("zindus-prefs-server-url-row").style.visibility = "hidden";
		document.getElementById("zindus-prefs-general-gal").style.visibility = "hidden";
		// document.getElementById("zindus-prefs-general-syncwith-vbox").style.visibility = "visible";
	}
	else
	{
		document.getElementById("zindus-prefs-server-url-description").style.visibility = "visible";
		document.getElementById("zindus-prefs-server-url-row").style.visibility = "visible";
		document.getElementById("zindus-prefs-general-gal").style.visibility = "visible";
		// document.getElementById("zindus-prefs-general-syncwith-vbox").style.visibility = "hidden";
	}

	if (this.m_server_type_last != server_type_current)
	{
		this.m_logger.debug("updateView: server_type changed: server_type_current: " + server_type_current);

		this.rememberLastServerType(this.m_server_type_last);

		if (isPropertyPresent(this.a_server_type_values, server_type_current))
		{
			document.getElementById("zindus-prefs-server-username").value = this.a_server_type_values[server_type_current].username;
			document.getElementById("zindus-prefs-server-url").value      = this.a_server_type_values[server_type_current].url;
			document.getElementById("zindus-prefs-server-password").value = this.a_server_type_values[server_type_current].password;
		}
		else
		{
			if (server_type_current == FORMAT_GD)
				document.getElementById("zindus-prefs-server-url").value = GOOGLE_URL_CLIENT_LOGIN;
			else
				document.getElementById("zindus-prefs-server-url").value = "";

			document.getElementById("zindus-prefs-server-username").value = "";
			document.getElementById("zindus-prefs-server-password").value = "";
		}

		this.m_server_type_last = this.serverType();
	}
}

Prefs.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	this.m_logger.debug("onFsmStateChangeFunctor: fsmstate: " + (fsmstate ? fsmstate.toString() : "null") );

	if (fsmstate && ! fsmstate.isFinal())
	{
		// this.m_logger.debug("onFsmStateChangeFunctor: fsm is running");
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

Prefs.prototype.serverType = function()
{
	ret = null;

	if (document.getElementById("zindus-prefs-server-type-radiogroup").selectedItem ==
	    document.getElementById("zindus-prefs-server-type-google"))
		ret = FORMAT_GD;
	else if (document.getElementById("zindus-prefs-server-type-radiogroup").selectedItem ==
	         document.getElementById("zindus-prefs-server-type-zimbra"))
		ret = FORMAT_ZM;
	else
		zinAssertAndLog(false, "mismatched case: ");

	return ret;
}

Prefs.prototype.rememberLastServerType = function(server_type)
{
	this.m_logger.debug("rememberLastServerType: setting: m_server_type_last: " + this.m_server_type_last);

	if (!isPropertyPresent(this.a_server_type_values, this.m_server_type_last))
		this.a_server_type_values[this.m_server_type_last] = new Object();

	this.a_server_type_values[this.m_server_type_last].username = document.getElementById("zindus-prefs-server-username").value;
	this.a_server_type_values[this.m_server_type_last].url      = document.getElementById("zindus-prefs-server-url").value;
	this.a_server_type_values[this.m_server_type_last].password = document.getElementById("zindus-prefs-server-password").value;
}

Prefs.prototype.setPrefsetFromRadio = function(radiogroup_id, bimap, prefset, property)
{
	var selected_id  = document.getElementById(radiogroup_id).selectedItem.id;
	radio_button = bimap.lookup(null, selected_id);
	prefset.setProperty(property, radio_button);
}

Prefs.prototype.setRadioFromPrefset = function(radiogroup_id, bimap, prefset, property, default_id)
{
	var selected_id;
	var value = prefset.getProperty(property);

	if (value && bimap.isPresent(value, null))
		selected_id = bimap.lookup(value, null);
	else
		selected_id = default_id;
		
	document.getElementById(radiogroup_id).selectedItem = document.getElementById(selected_id);

	this.m_logger.debug("setRadioFromPrefset: radiogroup_id: " + radiogroup_id + " set to: " + selected_id);
}
