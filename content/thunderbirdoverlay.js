include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/prefset.js");
include("chrome://zindus/content/timer.js");
include("chrome://zindus/content/logger.js");

window.addEventListener("load", onLoad, false);

function onLoad(event)
{
	var logger = new Log(Log.DEBUG, Log.dumpAndFileLogger);

	try
	{
		logger.debug("thunderbirdoverlay: onLoad entered");

		// We dont want to do this each time a new window is opened
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			logger.debug("thunderbirdoverlay: in messengerWindow");

			var maestro = new ZinMaestro();

			if (!maestro.osIsRegistered())
			{
				logger.debug("thunderbirdoverlay: creating ZinMaestro and registering it with nsIObserverService");

				maestro.osRegister();

				var prefset = new PrefSet(PrefSet.GENERAL,  PrefSet.GENERAL_PROPERTIES);
				prefset.load(SOURCEID_TB);

				if (prefset.getProperty(PrefSet.GENERAL_MANUAL_SYNC_ONLY) != "true")
				{
					logger.debug("thunderbirdoverlay: starting timer...\n");
					var timer = new ZinTimer(ZinTimer.REPEATING, 10);
					timer.start();
				}
				else
        				logger.debug("thunderbirdoverlay: not starting timer...\n");
			}
        }
	}
	catch (ex)
	{
		alert("thunderbirdoverlay onLoad() : " + ex);
	}
}

function zindusPrefsDialog()
{
	window.openDialog("chrome://zindus/content/prefsdialog.xul", "_blank", "chrome,modal,centerscreen");

	return true;
}
