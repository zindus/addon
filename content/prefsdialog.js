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

function Prefs()
{
	this.m_prefset_server  = new PrefSet(PrefSet.SERVER,  PrefSet.SERVER_PROPERTIES);
	this.m_prefset_general = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.checkbox_properties = [ PrefSet.GENERAL_SHOW_PROGRESS,        PrefSet.GENERAL_MAP_PAB        ];
	this.checkbox_ids        = [ "zindus-prefs-general-show-progress", "zindus-prefs-general-map-PAB" ];
	this.checkbox_bimap      = new BiMap(this.checkbox_properties, this.checkbox_ids);
}

Prefs.prototype.onLoad = function(target)
{
	this.m_prefset_server.load(SOURCEID_ZM);
	this.m_prefset_general.load(1);

	gLogger = new Log(Log.DEBUG, Log.dumpAndFileLogger);

	gLogger.debug("Prefs.onLoad: - m_prefset_server == "  + this.m_prefset_server.toString()  + "\n");
	gLogger.debug("Prefs.onLoad: - m_prefset_general == " + this.m_prefset_general.toString() + "\n");

	ZinMaestro.notifyFunctorRegister(this, this.onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_2, ZinMaestro.FSM_GROUP_SYNC);

	this.updateView();
}

Prefs.prototype.updateView = function()
{
	// TODO
	// - sanity checking on the whole thing - perhaps enable the ok button when all is well
	// - selected tab depends on whether the user has initialised a server or not

	document.getElementById("zindus-prefs-tabbox").selectedTab = document.getElementById("zindus-prefs-tab-general");

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
		           (this.m_prefset_general.getProperty(this.checkbox_properties[i]) == "yes");
}

Prefs.prototype.onCancel = function()
{
	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_2);
}

Prefs.prototype.onAccept = function()
{
	gLogger.debug("Prefs.onAccept:\n");

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
			document.getElementById(this.checkbox_bimap.lookup(this.checkbox_properties[i], null)).checked ? "yes" : "no" );

	this.m_prefset_server.save();
	this.m_prefset_general.save();

	ZinMaestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_2);
}

Prefs.prototype.onCommand = function(id_target)
{
	gLogger.debug("Prefs.onCommand - target is " + id_target + "\n");

	switch(id_target)
	{
		case "zindus-prefs-general-button-sync-now":
			var state = new TwoWayFsmState();
			state.setCredentials();

			var payload = new Payload();
			payload.m_id_fsm  = ZinMaestro.FSM_ID_TWOWAY;
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
			payload.m_id_fsm  = ZinMaestro.FSM_ID_AUTHONLY;
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

		case "zindus-prefs-general-button-reset":
			// TODO - this needs a guard around it so that the fsm can't run during...
			resetAll();
			break;

		default:
			// do nothing
			break;
	}
}

Prefs.doObserverAuthOnly = function()
{
	var lastsyncstatus = document.getElementById("zindus-broadaster-lastsyncstatus").lastsyncstatus;
	var lastsyncdate    = document.getElementById("zindus-broadaster-lastsyncstatus").getAttribute('value');

	gLogger.debug("Prefs.doObserverAuthOnly: lastsyncdate: "               + lastsyncdate + "\n");
	gLogger.debug("Prefs.doObserverAuthOnly: lastsyncstatus.summarycode: " + lastsyncdate.summarycode + "\n");
	gLogger.debug("Prefs.doObserverAuthOnly: lastsyncstatus.detail: "      + lastsyncdate.detail + "\n");
}

Prefs.prototype.onFsmStateChangeFunctor = function(fsmstate)
{
	if (fsmstate && fsmstate.state.oldstate != "final")
	{
		gLogger.debug("Prefs onFsmStateChangeFunctor: fsmstate is non-null - setting disabled attribute on command\n");
		document.getElementById("zindus-prefs-cmd-sync").setAttribute('disabled', true);
	}
	else
	{
		gLogger.debug("Prefs onFsmStateChangeFunctor: fsmstate is null - removing disabled attribute on command\n");
		document.getElementById("zindus-prefs-cmd-sync").removeAttribute('disabled');
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

	var aAddressBook = ZimbraFsm.getTbAddressbooks();

	for each (abName in aAddressBook)
		ZimbraAddressBook.deleteAddressBook(ZimbraAddressBook.getAddressBookUri(abName));

	// zap the logfile
	//
	file = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG);
	file.append(LOGFILENAME);

	if (file.exists() || !file.isDirectory())
	{
		gLogger.loggingFileClose();
		file.remove(false);
		gLogger.loggingFileOpen();
	}
}

