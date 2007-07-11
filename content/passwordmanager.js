function PasswordManager()
{
	this.m_pm = null;

    this.createInstance();
}

PasswordManager.prototype.createInstance = function()
{
	this.m_pm = Components.classes["@mozilla.org/passwordmanager;1"].createInstance();
}

PasswordManager.prototype.get = function(server, login)
{
	var value = null;

	try
	{
		var hostname = { value: "" };
		var username = { value: "" };
		var password = { value: "" };

		var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManagerInternal);

		pm.findPasswordEntry(server, login, "", hostname, username, password);

		value = password.value;
	}
	catch (ex)
	{
		// do nothing - if (server, login) doesn't exist the component throws an exception
	}

	return value;
}

PasswordManager.prototype.del = function(server, login)
{
	var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManager);

	pm.removeUser(server, login);
}

PasswordManager.prototype.set = function(server, login, password)
{
	try
	{
		var pm = this.m_pm.QueryInterface(Components.interfaces.nsIPasswordManager);

		// Here we have to remove the old password first, because
		// addUser does not update it

		pm.removeUser(server, login);
	}
	catch (ex)
	{
		// Do nothing here; an exception will be thrown if this is a new server/login combination
	}

	this.m_pm.addUser(server, login, password);
}
