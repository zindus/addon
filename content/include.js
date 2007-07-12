function include(url)
{
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
	var ret;

	if (loader)
	{
		// if the url doesn't exist, you don't get very good error messages - uncomment these dump() statements
		// dump("javascript loader.loadSubScript(" + url + ")...\n");
		var is_exception = false;
		try {
			ret = loader.loadSubScript(url);
		}
		catch (e)
		{
			is_exception = true;
		}

		// dump("javascript loader.loadSubScript(" + url + "): " + ret + "\n");

		if (is_exception)
		{
			// this is the code from Assert()
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
}
