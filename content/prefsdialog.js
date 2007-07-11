include("chrome://zindus/content/const.js");
include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/bimap.js");
include("chrome://zindus/content/payload.js");
include("chrome://zindus/content/passwordmanager.js");
include("chrome://zindus/content/mozillapreferences.js");
include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/syncfsmexitstatus.js");
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

	dump("Prefs.onLoad: - m_prefset_server == "  + this.m_prefset_server.toString()  + "\n");
	dump("Prefs.onLoad: - m_prefset_general == " + this.m_prefset_general.toString() + "\n");

	var maestro = new ZinMaestro();
	maestro.notifyFunctorRegister(onFsmStateChangeFunctor, ZinMaestro.ID_FUNCTOR_2, ZinMaestro.FSM_GROUP_SYNC);

	this.updateView();
}

Prefs.prototype.updateView = function()
{
	// TODO
	// - sanity checking on the whole thing - perhaps enable the ok button when all is well
	// - selected tab depends on whether the user has initialised a server or not

	document.getElementById("zindus-prefs-tabbox").selectedTab = document.getElementById("zindus-prefs-tab-server");

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
	var maestro = new ZinMaestro();
	maestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_2);
}

Prefs.prototype.onAccept = function()
{
	dump("Prefs.onAccept:\n");

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

	var maestro = new ZinMaestro();
	maestro.notifyFunctorUnregister(ZinMaestro.ID_FUNCTOR_2);
}

Prefs.prototype.onCommand = function(id_target)
{
	var payload;

	dump("Prefs.onCommand - target is " + id_target + "\n");

	switch(id_target)
	{
		case "zindus-prefs-general-button-sync-now":
			payload = new Payload(Payload.SYNC);
			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);
			break;

		case "zindus-prefs-server-button-authonly":
			payload = new Payload(Payload.AUTHONLY);

			payload.m_args = newObject( 'soapURL',  document.getElementById("zindus-prefs-server-url").value,
			                            'username', document.getElementById("zindus-prefs-server-username").value,
			                            'password', document.getElementById("zindus-prefs-server-password").value );

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
			payload = new Payload(Payload.TESTHARNESS);
			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);
			break;

		case "zindus-prefs-general-button-reset":
			payload = new Payload(Payload.RESET);
			window.openDialog("chrome://zindus/content/syncwindow.xul",  "_blank", "chrome", payload);
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

	dump("Prefs.doObserverAuthOnly: lastsyncdate: "               + lastsyncdate + "\n");
	dump("Prefs.doObserverAuthOnly: lastsyncstatus.summarycode: " + lastsyncdate.summarycode + "\n");
	dump("Prefs.doObserverAuthOnly: lastsyncstatus.detail: "      + lastsyncdate.detail + "\n");
}

function onFsmStateChangeFunctor(fsmstate)
{
	if (fsmstate && fsmstate.state.oldstate != "final")
	{
		dump("Prefs onFsmStateChangeFunctor: fsmstate is non-null - setting disabled attribute on command\n");
		document.getElementById("zindus-prefs-cmd-sync").setAttribute('disabled', true);
	}
	else
	{
		dump("Prefs onFsmStateChangeFunctor: fsmstate is null - removing disabled attribute on command\n");
		document.getElementById("zindus-prefs-cmd-sync").removeAttribute('disabled');
	}
}
