/* ***** BEGIN LICENSE BLOCK *****
 * 
 * "The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Zindus Sync.
 * 
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

Filesystem.DIRECTORY_PROFILE   = 1; // used to distinguish from DIRECTORY_EXTENSION to - since deleted
Filesystem.DIRECTORY_LOG       = "zindus-log";
Filesystem.DIRECTORY_MAPPING   = "zindus-mappings";

// from prio.h
Filesystem.PERM_PR_IRUSR  = 0400;  // Read  by owner
Filesystem.PERM_PR_IWUSR  = 0200;  // Write by owner

Filesystem.FLAG_PR_RDONLY      = 0x01;
Filesystem.FLAG_PR_WRONLY      = 0x02;
Filesystem.FLAG_PR_CREATE_FILE = 0x08;
Filesystem.FLAG_PR_APPEND      = 0x10;
Filesystem.FLAG_PR_TRUNCATE    = 0x20;
Filesystem.FLAG_PR_SYNC        = 0x40;

function Filesystem()
{
}

Filesystem.getDirectoryParent = function(code)
{
	cnsAssert(code == Filesystem.DIRECTORY_PROFILE);

	var ret;

	try
	{
		// See http://www.mozilla.org/support/thunderbird/profile#locate
		if (code == Filesystem.DIRECTORY_PROFILE)
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
	aRelativeTo[Filesystem.DIRECTORY_LOG]      = Filesystem.DIRECTORY_PROFILE;
	aRelativeTo[Filesystem.DIRECTORY_MAPPING]  = Filesystem.DIRECTORY_PROFILE;

	cnsAssert(typeof aRelativeTo[code] != 'undefined');

	var parent = this.getDirectoryParent(aRelativeTo[code]);
	var ret = parent.clone();
	ret.append(code);

	return ret;
}

Filesystem.getLogDir = function()
{
	var file = this.getDirectory(Filesystem.DIRECTORY_MAPPING);

	file.append(Filesystem.DIRECTORY_LOG);

	return file;
}

Filesystem.createLogDir = function()
{
	this.createDir(Filesystem.DIRECTORY_LOG);
}

Filesystem.createMappingDir = function()
{
	this.createDir(Filesystem.DIRECTORY_MAPPING);
}

Filesystem.createDir = function(name)
{
	var file = this.getDirectory(Filesystem.DIRECTORY_MAPPING);

	file.append(name);

	if (!file.exists() || !file.isDirectory()) 
	{   
		file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR);
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
			file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR);

		// Write with nsIFileOutputStream.
		var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
		                              createInstance(Components.interfaces.nsIFileOutputStream);

		outputStream.init(file, Filesystem.FLAG_PR_WRONLY | Filesystem.FLAG_PR_TRUNCATE,
		                        Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR, null);
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

		istream.init(file, Filesystem.FLAG_PR_RDONLY,  Filesystem.PERM_PR_IRUSR, 0);
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
		{
			gLogger.error("Filesystem.fileReadByLine: shouldn't be here");
			cnsAssert(false);
			functor.run(line.value);
		}

		istream.close();
	} 
}
