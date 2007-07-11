function include(url)
{
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);

	if (loader)
	{
		// if the url doesn't exist, you don't get very good error messages - uncomment these dump() statements
		// dump("javascript loader.loadSubScript(" + url + ")...\n");
		var ret = loader.loadSubScript(url);
		// dump("javascript loader.loadSubScript(" + url + "): " + ret + "\n");
	}
}
