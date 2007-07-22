function include(url)
{
	var msg = "include: " + (typeof url == 'string' ? url : "non-string") + "\n";
	dump(msg);
	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	consoleService.logStringMessage("zindus: " + msg);

	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
	var ret;

	if (loader)
	{
		var is_exception = false;

		try {
			ret = loader.loadSubScript(url);
		}
		catch (ex)
		{
			is_exception = true;

			if (typeof alert == 'function')
				alert(ex.message + " stack: \n" + ex.stack);
			else
				print(ex.message + " stack: \n" + ex.stack);
		}

		if (is_exception) // this is the code from Assert()
			try
			{
				throw new Error("Internal error in extension: assert failed");
			}
			catch(ex)
			{
				if (typeof alert == 'function')
					alert(ex.message + " stack: \n" + ex.stack);
				else
					print(ex.message + " stack: \n" + ex.stack);

				throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
			}
	}
}
