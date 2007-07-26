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

include("chrome://zindus/content/const.js");
include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/bimap.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/logger.js");
include("chrome://zindus/content/passwordmanager.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsm.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
include("chrome://zindus/content/timer.js");

var is_developer_mode = false; // true ==> expose buttons in the UI
var gLogger      = null;

function Prefs()
{
	this.m_prefset_server  = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
	this.m_prefset_general = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.checkbox_properties = PrefSet.GENERAL_PROPERTIES;
	this.checkbox_ids        = [ "zindus-prefs-general-map-PAB",
	                             "zindus-prefs-general-manual-sync-only",
								 "zindus-prefs-general-verbose-logging"  ];
	this.checkbox_bimap      = new BiMap(this.checkbox_properties, this.checkbox_ids);

	this.is_fsm_running = false;
}

Prefs.prototype.onLoad = function(target)
{
	if (is_developer_mode)
	{
		document.getElementById("zindus-prefs-general-button-test-harness").removeAttribute('hidden');
		document.getElementById("zindus-prefs-general-button-run-timer").removeAttribute('hidden');
	}

	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	consoleService.logStringMessage("test an nsIConsoleService message: ")

	Components.utils.reportError("test a Components.utils.reportError message: ");

	this.m_prefset_server.load(SOURCEID_ZM);
	this.m_prefset_general.load();

	gLogger = new Log(Log.DEBUG, Log.dumpAndFileLogger);

	gLogger.debug("Prefs.onLoad: - m_prefset_server == "  + this.m_prefset_server.toString());
	gLogger.debug("Prefs.onLoad: - m_prefset_general == " + this.m_prefset_general.toString());

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_PREFSDIALOG, ZinMaestro.FSM_GROUP_SYNC);

	this.initialiseView();
	this.updateView();
}

Prefs.prototype.onCancel = function()
{
	gLogger.debug("Prefs.onCancel:");

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_PREFSDIALOG);
}

Prefs.prototype.onAccept = function()
{
	gLogger.debug("Prefs.onAccept:");

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
	for (var i = 0; i < this.checkbox_properties.length; i++)
		this.m_prefset_general.setProperty(this.checkbox_properties[i],
			document.getElementById(this.checkbox_bimap.lookup(this.checkbox_properties[i], null)).checked ? "true" : "false" );

	this.m_prefset_server.save();
	this.m_prefset_general.save();

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_PREFSDIALOG);
}

Prefs.prototype.onCommand = function(id_target)
{
	gLogger.debug("Prefs.onCommand: target: " + id_target);

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
			win.hidechrome = true;

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

			// if the prefs dialog was cancelled while we were syncing, string bundles wont be available, so we try/catch...
			//
			try {
				var exitStatus = payload.m_result;
				var msg = "";

				if (exitStatus.m_exit_status == 0)
					msg += stringBundleString("statusAuthSucceeded");
				else
				{
					msg += stringBundleString("statusAuthFailed");
					msg += "\n";
					msg += SyncFsmExitStatus.failCodeAsString(exitStatus.m_fail_code);

					if (exitStatus.m_fail_code == SyncFsmExitStatus.FailOnFault)
						msg += "\n" + exitStatus.m_fail_detail;
					else if (exitStatus.m_fail_code == SyncFsmExitStatus.FailOnCancel)
						msg += "\n" + stringBundleString("statusFailOnCancelDetail");
					else if (exitStatus.m_fail_code == SyncFsmExitStatus.FailOnService)
						msg += "\n" + stringBundleString("statusFailOnServiceDetail");
				}

				alert(msg);
			} catch (ex)
			{
				// do nothing
			}

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
			var functor = new ZinTimerFunctorSync(ZinMaestro.ID_FUNCTOR_TIMER_PREFSDIALOG, null);
			var timer = new ZinTimer(functor);
			timer.start(0);
			break;

		case "zindus-prefs-general-button-reset":
			// TODO - this needs a guard around it so that the timer can't run during...
			resetAll();
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
	// TODO
	// - sanity checking on the whole thing - perhaps enable the ok button when all is well

	// server tab
	//
	document.getElementById("zindus-prefs-server-url").value      = this.m_prefset_server.getProperty(PrefSet.SERVER_URL);
	document.getElementById("zindus-prefs-server-username").value = this.m_prefset_server.getProperty(PrefSet.SERVER_USERNAME);

	var pm = new PasswordManager();
	var pw = pm.get(this.m_prefset_server.getProperty(PrefSet.SERVER_URL),
	                this.m_prefset_server.getProperty(PrefSet.SERVER_USERNAME) );
	if (pw)
		document.getElementById("zindus-prefs-server-password").value = pw;

	// general tab - checkbox elements
	//
	for (var i = 0; i < this.checkbox_properties.length; i++)
		document.getElementById(this.checkbox_bimap.lookup(this.checkbox_properties[i], null)).checked =
		           (this.m_prefset_general.getProperty(this.checkbox_properties[i]) == "true");

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

	if (this.is_fsm_running)
	{
		document.getElementById("zindus-prefs-cmd-sync").setAttribute('disabled', true);
	}
	else if (!this.isServerSettingsComplete())
	{
		document.getElementById("zindus-prefs-general-button-run-timer").setAttribute('disabled', true);
		document.getElementById("zindus-prefs-general-button-sync-now").setAttribute('disabled', true);
	}
	else
	{
		document.getElementById("zindus-prefs-cmd-sync").removeAttribute('disabled');
		document.getElementById("zindus-prefs-general-button-run-timer").removeAttribute('disabled');
		document.getElementById("zindus-prefs-general-button-sync-now").removeAttribute('disabled');
	}
}

Prefs.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	if (fsmstate)
		if (fsmstate.newstate == "start")
		{
			gLogger.debug("Prefs onFsmStateChangeFunctor: fsm started");
			this.is_fsm_running = true;
			this.updateView();
		}
		else if (fsmstate.oldstate == "final")
		{
			gLogger.debug("Prefs onFsmStateChangeFunctor: fsm finished");
			this.is_fsm_running = false;
			this.updateView();
		}
}

function resetAll()
{
	gLogger.debug("syncwindow resetAll()");

	var file;
	var directory = Filesystem.getDirectory(Filesystem.DIRECTORY_MAPPING);

	// zap everything in the mapping directory
	//
	if (directory.exists() && directory.isDirectory())
	{
		var iter = directory.directoryEntries;
 
		while (iter.hasMoreElements())
		{
			file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);

			file.remove(false);
		}
	}

	var aAddressBook = SyncFsm.getTbAddressbooks();

	for each (abName in aAddressBook)
		ZimbraAddressBook.deleteAddressBook(ZimbraAddressBook.getAddressBookUri(abName));

	// zap the logfile
	//
	file = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG);
	file.append(LOGFILE_NAME);

	if (file.exists() || !file.isDirectory())
		file.remove(false);
}

