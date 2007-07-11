const DIRECTORY_PROFILE   = "00001";
const DIRECTORY_LOG       = "zindus-log";
const DIRECTORY_MAPPING   = "zindus-mappings";

// from prio.h
const FILESYSTEM_PERM_PR_IRUSR  = 0400;  // Read  by owner
const FILESYSTEM_PERM_PR_IWUSR  = 0200;  // Write by owner

const FILESYSTEM_FLAG_PR_RDONLY      = 0x01;
const FILESYSTEM_FLAG_PR_WRONLY      = 0x02;
const FILESYSTEM_FLAG_PR_CREATE_FILE = 0x08;
const FILESYSTEM_FLAG_PR_APPEND      = 0x10;
const FILESYSTEM_FLAG_PR_TRUNCATE    = 0x20;
const FILESYSTEM_FLAG_PR_SYNC        = 0x40;

function Filesystem()
{
}

Filesystem.getDirectoryParent = function(code)
{
	cnsAssert(code == DIRECTORY_PROFILE);

	var ret;

	try
	{
		// See http://www.mozilla.org/support/thunderbird/profile#locate
		if (code == DIRECTORY_PROFILE)
			ret = Components.classes["@mozilla.org/file/directory_service;1"]
		                 .getService(Components.interfaces.nsIProperties)
		                 .get("ProfD", Components.interfaces.nsIFile);
	}
	catch (ex)
	{
		alert("Filesystem::getDirectoryParent : " + ex);
	}

	// dump("Filesystem::getDirectoryParent returns an nsIFile object: " + ret.path + "\n");

	return ret;
}

Filesystem.getDirectory = function(code)
{
	var aRelativeTo = new Object();
	aRelativeTo[DIRECTORY_LOG]      = DIRECTORY_PROFILE;
	aRelativeTo[DIRECTORY_MAPPING]  = DIRECTORY_PROFILE;

	cnsAssert(typeof aRelativeTo[code] != 'undefined');

	var parent = this.getDirectoryParent(aRelativeTo[code]);
	var ret = parent.clone();
	ret.append(code);

	return ret;
}

Filesystem.getLogDir = function()
{
	var file = this.getDirectory(DIRECTORY_MAPPING);

	file.append(DIRECTORY_LOG);

	return file;
}

Filesystem.createLogDir = function()
{
	this.createDir(DIRECTORY_LOG);
}

Filesystem.createMappingDir = function()
{
	this.createDir(DIRECTORY_MAPPING);
}

Filesystem.createDir = function(name)
{
	var file = this.getDirectory(DIRECTORY_MAPPING);

	file.append(name);

	if (!file.exists() || !file.isDirectory()) 
	{   
		file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, FILESYSTEM_PERM_PR_IRUSR | FILESYSTEM_PERM_PR_IWUSR);
	}
}

Filesystem.writeToPath = function(path, content) 
{
	var retval = false;

	try 
	{
		// leni note - sunny had some privilige escalation code here
		// might need to use it in order to write the mapping to the profile directory (rather than the extension directory).
		//
		var file = Components.classes["@mozilla.org/file/local;1"].
		                      createInstance(Components.interfaces.nsILocalFile);

		file.initWithPath(path);

		retval = this.writeToFile(file, content);
	}
	catch (e) 
	{
		alert(e);
	}

	return retval;
}

Filesystem.writeToFile = function(file, content) 
{
	var retval = false;

	try 
	{
		// leni note - sunny had some privilige escalation code here
		// might need to use it in order to write the mapping to the profile directory (rather than the extension directory).
		//

		if (!file.exists()) 
			file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FILESYSTEM_PERM_PR_IRUSR | FILESYSTEM_PERM_PR_IWUSR);

		// Write with nsIFileOutputStream.
		var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
		                              createInstance(Components.interfaces.nsIFileOutputStream);

		outputStream.init(file, FILESYSTEM_FLAG_PR_WRONLY | FILESYSTEM_FLAG_PR_TRUNCATE,
		                        FILESYSTEM_PERM_PR_IRUSR | FILESYSTEM_PERM_PR_IWUSR, null);
		outputStream.write(content, content.length);
		outputStream.flush();
		outputStream.close();

		retval = true;
	}
	catch (e) 
	{
		alert(e);
	}

	return retval;
}

Filesystem.fileReadByLine = function(path, functor)
{
	var file = Components.classes["@mozilla.org/file/local;1"].
	                      createInstance(Components.interfaces.nsILocalFile);

	file.initWithPath(path);

	if (file.exists())
	{
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].
		                         createInstance(Components.interfaces.nsIFileInputStream);

		istream.init(file, FILESYSTEM_FLAG_PR_RDONLY,  FILESYSTEM_PERM_PR_IRUSR, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);

		var line = {};

		while (istream.readLine(line))
		{
			functor.run(line.value); 
			line.value = null;
		} 

		// leni TODO - I wonder why sunny put this here...?
		//
		if (line.value)
			functor.run(line.value);

		istream.close();
	} 
}
