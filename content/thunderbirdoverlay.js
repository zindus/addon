include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/timer.js");

window.addEventListener("load", onLoad, false);

function onLoad(event)
{
    try
    {
        dump("thunderbirdoverlay onLoad\n");
        // dump("thunderbirdoverlay onLoad - event.toString() is " + event.toString() + "\n");
        // dump("thunderbirdoverlay onLoad - event.target.id is " + event.target.id + "\n");
		// dump("thunderbirdoverlay onLoad - id of document          is: " + document.id + "\n");
		// dump("thunderbirdoverlay onLoad - id of window            is: " + window.id + "\n");
		// dump("thunderbirdoverlay onLoad - id of sync-stringbundle is: " + document.getElementById("sync-stringbundle") + "\n");

        // We dont want to do this each time a new window is opened
        var messengerWindow = document.getElementById("messengerWindow");

        if (messengerWindow)
        {
        	dump("thunderbirdoverlay onLoad in messengerWindow \n");

			var maestro = new ZinMaestro();

			if (!maestro.osIsRegistered())
			{
        		dump("thunderbirdoverlay: creating ZinMaestro and registering it with nsIObserverService\n");

				maestro.osRegister();

				var timer = new ZinTimer(5000);

				timer.start();
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
