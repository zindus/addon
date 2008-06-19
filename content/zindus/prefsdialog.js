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

ZindusScopeRegistry.includejs("payload.js");
ZindusScopeRegistry.includejs("testharness.js");
ZindusScopeRegistry.includejs("prefsadvanced.js");

const GOOGLE_URL_CLIENT_LOGIN = "https://www.google.com/accounts/ClientLogin";

function Prefs()
{
	this.m_prefset_server      = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
	this.m_prefset_general     = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.m_checkbox_properties = [ PrefSet.GENERAL_AUTO_SYNC, PrefSet.GENERAL_VERBOSE_LOGGING ];
	this.m_checkbox_ids        = [ "zindus-prefs-general-auto-sync",
								   "zindus-prefs-general-verbose-logging"  ];
	this.m_checkbox_bimap      = new BiMap(this.m_checkbox_properties, this.m_checkbox_ids);

	this.m_gal_radio_values    = [                          "yes",                          "if-fewer",                          "no" ];
	this.m_gal_radio_ids       = [ "zindus-prefs-general-gal-yes", "zindus-prefs-general-gal-if-fewer", "zindus-prefs-general-gal-no" ];
	this.m_gal_radio_bimap     = new BiMap(this.m_gal_radio_values, this.m_gal_radio_ids);

	this.m_gd_sync_with_bimap  = new BiMap( [ "zg",                                 "pab"                                 ], 
	                                        [ "zindus-prefs-general-gdsyncwith-zg", "zindus-prefs-general-gdsyncwith-pab" ] );

	this.m_server_type_bimap   = new BiMap( [ "google",                           "zimbra"                          ], 
	                                        [ "zindus-prefs-server-type-google",  "zindus-prefs-server-type-zimbra" ] );

	this.m_timer_timeoutID     = null;
	this.m_timer_functor       = null;
	this.m_maestro             = null;
	this.m_is_fsm_running      = false;
	this.m_logger              = newLogger("Prefs"); // this.m_logger.level(Logger.NONE); // TODO for debugging

	this.m_preferences         = Singleton.instance().preferences();
	this.is_developer_mode     = (this.m_preferences.getCharPrefOrNull(this.m_preferences.branch(), "system.developer_mode") == "true");

	this.m_server_type_last    = null;
	this.a_server_type_values  = new Object();

	this.m_console_listener    = Logger.nsIConsoleListener();
	this.m_payload             = null;
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

	this.initialiseView();
	this.maestroRegister(); // during which we get notified and updateView() is called...
}

Prefs.prototype.maestroRegister = function()
{
	if (!ObserverService.isRegistered(Maestro.TOPIC))
	{
		this.m_maestro = new Maestro();

		ObserverService.register(this.m_maestro, Maestro.TOPIC);
	}

	Maestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, Maestro.ID_FUNCTOR_PREFSDIALOG, Maestro.FSM_GROUP_SYNC);
	Logger.nsIConsoleService().registerListener(this.m_console_listener);
}

Prefs.prototype.maestroUnregister = function()
{
	Logger.nsIConsoleService().unregisterListener(this.m_console_listener);
	Maestro.notifyFunctorUnregister(Maestro.ID_FUNCTOR_PREFSDIALOG);

	if (this.m_maestro && ObserverService.isRegistered(Maestro.TOPIC))
		ObserverService.unregister(this.m_maestro, Maestro.TOPIC);
}

Prefs.prototype.stop_timer_fsm_and_deregister = function()
{
	if (this.m_is_fsm_running && this.m_timer_functor)
		this.m_timer_functor.cancel();

	this.maestroUnregister();
}

Prefs.prototype.onCancel = function()
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

Prefs.prototype.onAccept = function()
{
	var selected_id, radio_button;

	this.m_logger.debug("onAccept: ");

	// server tab - url, username and password
	//
	var url      = document.getElementById("zindus-prefs-server-url").value;
	var username = zinTrim(document.getElementById("zindus-prefs-server-username").value);
	var password = document.getElementById("zindus-prefs-server-password").value;

	var prev_url      = this.m_prefset_server.getProperty(PrefSet.SERVER_URL);
	var prev_username = this.m_prefset_server.getProperty(PrefSet.SERVER_USERNAME);

	var pm = new PasswordManager();

	if ((url != prev_url || username != prev_username) && pm.get(prev_url, prev_username))
		pm.del(prev_url, prev_username);

	pm.set(url, username, password);

	this.updatePrefsetsFromDocument();

	this.m_prefset_server.save();
	this.m_prefset_general.save();

	this.stop_timer_fsm_and_deregister();

	this.m_logger.debug("onAccept: exits");
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
			this.updatePrefsetsFromDocument();

			this.m_payload = new Payload();
			this.m_payload.m_syncfsm_details = this.getSyncFsmDetails(this.serverType(), "twoway");
			this.m_payload.m_es = new SyncFsmExitStatus();
			this.m_payload.m_is_cancelled = false;

			Singleton.instance().logger().debug("Prefs.onCommand: before openDialog: m_es: " + this.m_payload.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "dependent=yes,chrome=yes,modal=yes", this.m_payload);

			// The window could be closed if the esc key was pressed before openDialog() was called.
			// The payload could be mangled because if the AddressBook new Card window got opened before the syncwindow finishes,
			// we see SyncWindow.onAccept() exits but window.openDialog() hasn't returned!  And ... the "Sync Now" button
			// is enabled because updateView() got told that the fsm finished.  So if the user starts another fsm, the payload of
			// of the original window is lost.
			// 
			if (!window.closed && this.m_payload instanceof Payload)
			{
				Singleton.instance().logger().debug("Prefs.onCommand: after openDialog: m_is_cancelled: " +
				                                              this.m_payload.m_is_cancelled + " m_es: " + this.m_payload.m_es.toString());
				if (this.m_payload.m_es.m_exit_status == null)
				{
					Singleton.instance().logger().debug("Prefs.onCommand: statusSyncFailedUnexpectedly");
					msg = stringBundleString("statusSyncFailedUnexpectedly");
				}
				else if (this.m_payload.m_es.m_exit_status != 0)
					msg = this.m_payload.m_es.asMessage("statusSyncSucceeded", "statusSyncFailed");

				if (msg != "")
				{
					if (this.m_payload.m_es.m_fail_code == 'FailOnGdConflict1' ||
					    this.m_payload.m_es.m_fail_code == 'FailOnGdConflict2' ||
						this.m_payload.m_es.m_fail_code == 'FailOnGdEmptyContact')
					{
						var payload2 = new Payload();
						payload2.m_args = newObject('fail_code', this.m_payload.m_es.m_fail_code, 'msg', msg);
						window.openDialog("chrome://zindus/content/prefsmsg.xul",  "_blank", "dependent=yes,chrome=yes,modal=yes",payload2);
					}
					else
						alert(msg);
				}
			}

			this.m_payload = null;

			break;

		case "zindus-prefs-server-button-authonly":
			this.updatePrefsetsFromDocument();

			this.m_payload = new Payload();
			this.m_payload.m_syncfsm_details = this.getSyncFsmDetails(this.serverType(), "authonly");
			this.m_payload.m_es = new SyncFsmExitStatus();

			Singleton.instance().logger().debug("Prefs.onCommand: before openDialog: m_es: " + this.m_payload.m_es.toString());

			window.openDialog("chrome://zindus/content/syncwindow.xul", "_blank", "chrome,modal", this.m_payload);

			if (!window.closed)
			{
				Singleton.instance().logger().debug("Prefs.onCommand: after openDialog: m_es: " + this.m_payload.m_es.toString());

				if (this.m_payload.m_es.m_exit_status == null)
				{
					Singleton.instance().logger().debug("Prefs.onCommand: statusSyncFailedUnexpectedly");
					msg = stringBundleString("statusSyncFailedUnexpectedly");
				}
				else
					msg = this.m_payload.m_es.asMessage("statusAuthSucceeded", "statusAuthFailed");

				alert(msg);
			}

			this.m_payload = null;

			break;

		case "zindus-prefs-general-button-test-harness":
			var testharness = new TestHarness();
			testharness.run();
			break;

		case "zindus-prefs-general-button-run-timer":
			this.m_timer_timeoutID = window.setTimeout(this.onTimerFire, 0, this);
			this.m_is_fsm_running = true;
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

		case "zindus-prefs-general-advanced-button":
			var payload = new Payload();
			payload.m_args = this.m_prefset_general;
			window.openDialog("chrome://zindus/content/prefsadvanced.xul", "_blank", "chrome", payload);
	        this.m_logger.debug("gd_postal: " + this.m_prefset_general.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS));
			break;

		default:
			// do nothing
			break;
	}
}

Prefs.prototype.getSyncFsmDetails = function(format, type)
{
	var password = document.getElementById("zindus-prefs-server-password").value;

	// this.m_logger.debug("getSyncFsmDetails: blah: prefset_server: " + this.m_prefset_server.toString());

	return newObject('format',          format,
	                 'type',            type,
	                 'password',        password,
	                 'sourceid',        SOURCEID_AA,
	                 'prefset_general', this.m_prefset_general,
	                 'prefset_server',  this.m_prefset_server);
}

Prefs.prototype.onTimerFire = function(context)
{
	// note that if you close the preferences window while this timer is running, the fsm is garbage collected
	// but the maestro is never told (because the fsm never reached the 'final' state
	// The timer functor isn't doesn't support 'cancel' the way SyncWindow does.
	// It should only be visible in the UI with debugging turned on anyways...
	//
	context.m_logger.debug("onTimerFire: ");
	context.m_timer_functor = new TimerFunctor(Maestro.ID_FUNCTOR_PREFSDIALOG_TIMER, null, null);
	context.m_timer_functor.run();
}

Prefs.prototype.initialiseView = function()
{
	var selected_id;

	// server tab - url, username and password
	//
	// server tab - server type
	//
	Prefs.setRadioFromPrefset("zindus-prefs-server-type-radiogroup", this.m_server_type_bimap, this.m_prefset_server,
	                          PrefSet.SERVER_TYPE, "zindus-prefs-server-type-google")

	document.getElementById("zindus-prefs-server-username").value = this.m_prefset_server.getProperty(PrefSet.SERVER_USERNAME);
	document.getElementById("zindus-prefs-server-password").value = PrefSet.getPassword(this.m_prefset_server);
	document.getElementById("zindus-prefs-server-url").value      = (this.serverType() == FORMAT_GD) ? GOOGLE_URL_CLIENT_LOGIN : 
	                                                                  this.m_prefset_server.getProperty(PrefSet.SERVER_URL);

	this.m_server_type_last = this.serverType();
	this.serverTypeDetailsRemember();

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked =
		           (this.m_prefset_general.getProperty(this.m_checkbox_properties[i]) == "true");

	// general tab - Google Sync With
	//
	Prefs.setRadioFromPrefset("zindus-prefs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap, this.m_prefset_general,
	                         PrefSet.GENERAL_GD_SYNC_WITH, "zindus-prefs-general-gdsyncwith-pab")
	this.setGdSyncWithLabel();

	// general tab - Gal radiogroup
	//
	var if_fewer = this.m_preferences.getIntPref(this.m_preferences.branch(), MozillaPreferences.ZM_SYNC_GAL_IF_FEWER );

	var msg = stringBundleString("prefsGalIfFewer", [ if_fewer ]);

	document.getElementById("zindus-prefs-general-gal-if-fewer").label = msg;

	Prefs.setRadioFromPrefset("zindus-prefs-general-gal-enabled", this.m_gal_radio_bimap, this.m_prefset_general,
	                          PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, "zindus-prefs-general-gal-if-fewer")
	
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
		this.setAttribute('disabled', true, "zindus-prefs-cmd-sync");
	}
	else if (!this.isServerSettingsComplete())
	{
		this.m_logger.debug("updateView: server settings incomplete - disabling buttons");
		this.setAttribute('disabled', false, "zindus-prefs-cmd-sync");
		this.setAttribute('disabled', true, "zindus-prefs-general-button-run-timer", "zindus-prefs-general-button-sync-now");
	}
	else
	{
		this.m_logger.debug("updateView: enabling buttons");
		this.setAttribute('disabled', false,
		                  "zindus-prefs-cmd-sync", "zindus-prefs-general-button-run-timer", "zindus-prefs-general-button-sync-now");
	}

	var server_type_current = this.serverType();

	if (server_type_current == FORMAT_GD)
	{
		this.setAttribute('hidden', true, "zindus-prefs-server-url-description", "zindus-prefs-server-url-row", "zindus-prefs-general-gal");
		this.setAttribute('hidden', false, "zindus-prefs-general-gdsyncwith-vbox", "zindus-prefs-general-advanced-hbox");

		this.setGdSyncWithLabel();
	}
	else
	{
		this.setAttribute('hidden', false, "zindus-prefs-server-url-description", "zindus-prefs-server-url-row","zindus-prefs-general-gal");
		this.setAttribute('hidden', true, "zindus-prefs-general-gdsyncwith-vbox", "zindus-prefs-general-advanced-hbox");
	}

	if (this.m_server_type_last != server_type_current)
	{
		this.m_logger.debug("updateView: server_type changed: server_type_current: " + server_type_current);

		this.serverTypeDetailsRemember();

		if (isPropertyPresent(this.a_server_type_values, server_type_current))
		{
			document.getElementById("zindus-prefs-server-username").value = this.a_server_type_values[server_type_current].username;
			document.getElementById("zindus-prefs-server-url").value      = this.a_server_type_values[server_type_current].url;
			document.getElementById("zindus-prefs-server-password").value = this.a_server_type_values[server_type_current].password;
		}
		else
			this.serverTypeDetailsReset();

		this.m_server_type_last = this.serverType();
	}

	if (server_type_current == FORMAT_ZM)
	{
		var prefset = prefsetMatchWithPreAuth(document.getElementById("zindus-prefs-server-url").value);

		if (prefset && prefset.isPropertyPresent(PrefSet.PREAUTH_ZM_SYNC_GAL_ENABLED))
		{
			var value = prefset.getProperty(PrefSet.PREAUTH_ZM_SYNC_GAL_ENABLED);

			// this.m_logger.debug("blah: forcing PREAUTH_ZM_SYNC_GAL_ENABLED to: " + value);

			this.m_prefset_general.setProperty(PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, value);

			Prefs.setRadioFromPrefset("zindus-prefs-general-gal-enabled", this.m_gal_radio_bimap, this.m_prefset_general,
	                          PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED, "zindus-prefs-general-gal-if-fewer")

			this.setAttribute('disabled', true,
			                  "zindus-prefs-general-gal-yes", "zindus-prefs-general-gal-if-fewer", "zindus-prefs-general-gal-no");
		}
		else
			this.setAttribute('disabled', false,
			                   "zindus-prefs-general-gal-yes", "zindus-prefs-general-gal-if-fewer", "zindus-prefs-general-gal-no");
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
	const Cc = Components.classes;
	const Ci = Components.interfaces;
	var ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var uriToOpen = ioservice.newURI(url, null, null);
	var extps     = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

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

Prefs.prototype.serverTypeDetailsRemember = function()
{
	this.m_logger.debug("serverTypeDetailsRemember: setting: m_server_type_last: " + this.m_server_type_last);

	if (!isPropertyPresent(this.a_server_type_values, this.m_server_type_last))
		this.a_server_type_values[this.m_server_type_last] = new Object();

	this.a_server_type_values[this.m_server_type_last].username = document.getElementById("zindus-prefs-server-username").value;
	this.a_server_type_values[this.m_server_type_last].url      = document.getElementById("zindus-prefs-server-url").value;
	this.a_server_type_values[this.m_server_type_last].password = document.getElementById("zindus-prefs-server-password").value;
}

Prefs.prototype.serverTypeDetailsReset = function()
{
	if (this.serverType() == FORMAT_GD)
		document.getElementById("zindus-prefs-server-url").value = GOOGLE_URL_CLIENT_LOGIN;
	else
		document.getElementById("zindus-prefs-server-url").value = "";

	document.getElementById("zindus-prefs-server-username").value = "";
	document.getElementById("zindus-prefs-server-password").value = "";
}

Prefs.getValueFromRadio = function(radiogroup_id, bimap)
{
	var selected_id  = document.getElementById(radiogroup_id).selectedItem.id;
	return bimap.lookup(null, selected_id);
}

Prefs.setPrefsetFromRadio = function(radiogroup_id, bimap, prefset, property)
{
	var radio_button = Prefs.getValueFromRadio(radiogroup_id, bimap);
	prefset.setProperty(property, radio_button);
}

Prefs.setRadioFromPrefset = function(radiogroup_id, bimap, prefset, property, default_id)
{
	var selected_id;
	var value = prefset.getProperty(property);

	if (value && bimap.isPresent(value, null))
		selected_id = bimap.lookup(value, null);
	else
		selected_id = default_id;
		
	document.getElementById(radiogroup_id).selectedItem = document.getElementById(selected_id);

	// Singleton.instance().logger().debug("setRadioFromPrefset: radiogroup_id: " + radiogroup_id + " set to: " + selected_id);
}

Prefs.prototype.setGdSyncWithLabel = function()
{
	var zg_addressbook;

	zg_addressbook = stringBundleString("prefsGeneralGdSyncWithZgPrefix") +
	                       (this.isServerSettingsComplete() ?
	                       document.getElementById("zindus-prefs-server-username").value :
	                       stringBundleString("prefsGeneralGdSyncWithZgSuffix"));

	document.getElementById("zindus-prefs-general-gdsyncwith-zg").label = zg_addressbook;
}

Prefs.prototype.updatePrefsetsFromDocument = function()
{
	var selected_id, radio_button;

	// server tab - url, username and password
	//
	var url      = document.getElementById("zindus-prefs-server-url").value;
	var username = zinTrim(document.getElementById("zindus-prefs-server-username").value);

	this.m_prefset_server.setProperty(PrefSet.SERVER_URL,      url );
	this.m_prefset_server.setProperty(PrefSet.SERVER_USERNAME, username );

	// server tab - server type
	//
	Prefs.setPrefsetFromRadio("zindus-prefs-server-type-radiogroup", this.m_server_type_bimap,
	                          this.m_prefset_server, PrefSet.SERVER_TYPE);

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.m_checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.m_checkbox_properties[i],
			document.getElementById(this.m_checkbox_bimap.lookup(this.m_checkbox_properties[i], null)).checked ? "true" : "false" );

	// general tab - radio elements: GAL and Google Sync With
	//
	Prefs.setPrefsetFromRadio("zindus-prefs-general-gdsyncwith-radiogroup", this.m_gd_sync_with_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_GD_SYNC_WITH);
	Prefs.setPrefsetFromRadio("zindus-prefs-general-gal-enabled", this.m_gal_radio_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED);
}

Prefs.prototype.setAttribute = function(attribute, flag)
{
	var i;
	zinAssert(typeof(flag) == 'boolean' && attribute == 'disabled' || attribute == 'hidden' && arguments.length > 2);

	for (i = 2; i < arguments.length; i++)
		if (flag)
			switch(attribute) {
				case 'disabled': document.getElementById(arguments[i]).setAttribute('disabled', true); break;
				case 'hidden':   document.getElementById(arguments[i]).style.visibility = "hidden";    break;
			}
		else
			switch(attribute) {
				case 'disabled': document.getElementById(arguments[i]).removeAttribute('disabled');    break;
				case 'hidden':   document.getElementById(arguments[i]).style.visibility = "visible";   break;
			}
}
