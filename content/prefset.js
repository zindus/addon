include("chrome://zindus/content/utils.js");
include("chrome://zindus/content/mozillapreferences.js");

function PrefSet(prefprefix, a)
{
	this.m_id            = -1;
	this.m_prefprefix    = prefprefix;
	this.m_properties    = new Object();

	for (var i in a)
		this.m_properties[a[i]] = PrefSet.DEFAULT_VALUE;
}

PrefSet.DEFAULT_VALUE         = null;

PrefSet.SERVER                = "server";
PrefSet.SERVER_URL            = "url";
PrefSet.SERVER_USERNAME       = "username";
PrefSet.SERVER_PROPERTIES     = [ PrefSet.SERVER_URL, PrefSet.SERVER_USERNAME ];

PrefSet.GENERAL               = "general";
// PrefSet.GENERAL_SHOW_PROGRESS = "showprogress";
PrefSet.GENERAL_MAP_PAB       = "mappab";
PrefSet.GENERAL_PROPERTIES    = [ PrefSet.GENERAL_MAP_PAB ];

// load() supports an optional branch parameter because 
// a) the collection need only create one branch object and pass it to each .load() method
// b) at some point we might like to distinguish between user-defined and default preferences,
//
PrefSet.prototype.load = function(id, branch)
{
	var i, mp, prefs;
	var retval = false;

	cnsAssert((arguments.length == 1) || (arguments.length == 2));

	if (arguments.length == 1)
	{
		mp = new MozillaPreferences();
		prefs = mp.branch();
	}
	else
	{
		prefs = branch;
	}

	for (i in this.m_properties)
	{
		try
		{
			this.m_properties[i] = new String(prefs.getCharPref(this.makePrefKey(id, i)));
		}
		catch (ex)
		{
			// do nothing
			// dump("PrefSet::load(" + id + ") - did not load preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
		}

		// dump("PrefSet.prototype.load - loaded preference " + this.makePrefKey(id, i) + " == " + this.m_properties[i] + "\n");
	}

	this.m_id = id;
	retval = true;
	
	return retval;
}

PrefSet.prototype.save = function()
{
	var mp = new MozillaPreferences();
	var prefs = mp.branch();
	var i;
	var retval = false;

	cnsAssert(this.m_id >= 0);

	dump("PrefSet.prototype.save\n");

	try
	{
		for (i in this.m_properties)
		{
			prefs.setCharPref(this.makePrefKey(this.m_id, i), this.m_properties[i]);

			dump("PrefSet.prototype.save - saved preference " + this.makePrefKey(this.m_id, i) + " == " + this.m_properties[i] + "\n");
		}

		retval = true;
	}
	catch (ex)
	{
		// do nothing
		// dump("PrefSet::save(" + this.m_id + ") - did not save preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
	}
	
	return retval;
}

PrefSet.prototype.remove = function()
{
	var mp = new MozillaPreferences();
	var prefs = mp.branch();
	var retval = false;

	cnsAssert(this.m_id >= 0);

	// dump("PrefSet.prototype.remove\n");

	try
	{
		prefs.deleteBranch(this.makePrefKey(this.m_id));

		// dump("PrefSet.prototype.remove - deleted preferences for " + this.makePrefKey(this.m_id) + "\n");

		retval = true;
	}
	catch (ex)
	{
		// do nothing
		// dump("PrefSet::save(" + this.m_id + ") - did not save preference for this.m_properties[" + i + "] - ex is " + ex + "\n");
	}
	
	return retval;
}

PrefSet.prototype.toString = function()
{
	var ret = "";
	var str;

	ret += " m_id: " + this.m_id;
	ret += " m_properties: {";

	for (i in this.m_properties)
	{
		str = this.m_properties[i] == PrefSet.DEFAULT_VALUE ? "<no-pref-value>" : this.m_properties[i];
		ret += " " + i + ": \"" + str + "\"";
	}

	ret += " }";

	return ret;
}

PrefSet.prototype.isaProperty = function(property)
{
	return (typeof(this.m_properties[property]) != "undefined");
}

PrefSet.prototype.getProperty = function(property)
{
	cnsAssert(arguments.length == 1);
	return this.m_properties[property];
}

PrefSet.prototype.setProperty = function(property, value)
{
	this.m_properties[property] = value;
}

PrefSet.prototype.getId = function()
{
	return this.m_id;
}

PrefSet.prototype.makePrefKey = function(id, property)
{
	var ret = "";

	ret += this.m_prefprefix + "." + id;

	if (arguments.length == 2)
	{
		ret +=  "." + property;
	}

	return ret;
}

