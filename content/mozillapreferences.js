// see: http://developer.mozilla.org/en/docs/Code_snippets:Preferences
//

function MozillaPreferences()
{
    this.m_branch        = null;
	this.m_defaultbranch = null;
}

MozillaPreferences.prototype.branch = function()
{
	if (this.m_branch == null)
	{
		try
		{
			var instance = Components.classes["@mozilla.org/preferences-service;1"].
		                                       getService(Components.interfaces.nsIPrefService);
	
			this.m_branch = instance.getBranch(EXTENSION_NAME + ".");
		}
		catch(ex)
		{
			alert("Preferences::getService : " + ex);
		}
	}

	return this.m_branch;
}

MozillaPreferences.prototype.defaultbranch = function()
{
	if (this.m_defaultbranch == null)
	{
		try
		{
			var instance = Components. classes["@mozilla.org/preferences-service;1"].
		                                        getService(Components.interfaces.nsIPrefService);
	
			this.m_defaultbranch = instance.getDefaultBranch(EXTENSION_NAME + ".");
		}
		catch(ex)
		{
			alert("Preferences::getService : " + ex);
		}
	}

	return this.m_defaultbranch;
}

MozillaPreferences.prototype.setIntPref = function(branch, key, value)
{
	var intValue = parseInt(value);

	cnsAssert(!isNaN(intValue));

	// dump("33443366: setIntPref sets preference " + key + ", and " + typeof(intValue) + " " + intValue + "\n");

	if (branch)
		branch.setIntPref(key, intValue);
}

MozillaPreferences.prototype.setCharPref = function(branch, key, value)
{
	if (branch)
		branch.setCharPref(key, value);
}

MozillaPreferences.prototype.getCharPref = function(branch, key, value)
{
	var ret = null;

	if (branch)
	{
		try
		{
			ret = branch.getCharPref(key);
		}
		catch(ex)
		{
			this.reportCatch(ex, key);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}

	// dump("33443366: getCharPref gets preference " + key + " == " + ret + "\n");

	return ret;
}

MozillaPreferences.prototype.getIntPref = function(branch, key, value)
{
	var ret = null;

	if (branch)
	{
		try
		{
			var tmp = branch.getIntPref(key);

			if (!isNaN(tmp))
			{
				ret = parseInt(tmp);
			}
		}
		catch(ex)
		{
			this.reportCatch(ex, key);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}

	// dump("33443366: getIntPref gets preference " + key + " == " + ret + "\n");

	return ret;
}

MozillaPreferences.prototype.reportCatch = function(ex, key)
{
	if (typeof alert == 'function')
		alert(ex.message + " with key " + key + " stack: \n" + ex.stack);
	else
		print(ex.message + " with key " + key + " stack: \n" + ex.stack);
}
