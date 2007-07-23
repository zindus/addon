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
		logger.debug("\n\n==== thunderbirdoverlay: onLoad entered: " + getTime());

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

				var preferences = new MozillaPreferences();

				var prefset = new PrefSet(PrefSet.GENERAL,  PrefSet.GENERAL_PROPERTIES);
				prefset.load();

				if (prefset.getProperty(PrefSet.GENERAL_MANUAL_SYNC_ONLY) != "true")
				{
					var delay_on_repeat = parseInt(preferences.getIntPref(preferences.branch(), "system.timerDelay"));
					var delay_on_start  = Math.floor(Math.random() * (delay_on_repeat + 1)); // randomise clients to avoid hammering server

					logger.debug("thunderbirdoverlay: starting timer: delay_on_start:" + delay_on_start +
					                                                " delay_on_repeat: " + delay_on_repeat);

					var functor = new ZinTimerFunctorSync(ZinMaestro.ID_FUNCTOR_TIMER_OVERLAY, delay_on_repeat);
					var timer = new ZinTimer(functor);
					timer.start(delay_on_start);
				}
				else
					logger.debug("thunderbirdoverlay: not starting timer.");
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
