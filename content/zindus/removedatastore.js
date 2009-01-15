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
 * The Initial Developer of the Original Code is Toolware Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007-2008
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// this class is just a namespace to group a bunch of functions that do similar things
//
function RemoveDatastore()
{
}

RemoveDatastore.removeZfc = function(filename)
{
	var directory = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.DATA);
	var file;

	logger().debug("removeZfc: " + filename);

	// remove files in the data directory
	//
	if (directory.exists() && directory.isDirectory())
	{
		file = directory;
		file.append(filename);

		if (file.exists())
			file.remove(false);
	}
}

RemoveDatastore.removeZfcs = function(a_exclude)
{
	var directory = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.DATA);
	var file;

	logger().debug("removeZfcs: " + (a_exclude ? ("excluding: " + aToString(a_exclude)) : ""));

	// remove files in the data directory
	//
	if (directory.exists() && directory.isDirectory())
	{
		var iter = directory.directoryEntries;

		while (iter.hasMoreElements())
		{
			file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);

			if (!a_exclude || !isPropertyPresent(a_exclude, file.leafName))
				file.remove(false);
		}
	}
}

// Save the contents of the logfile then truncate it.
// Often folk have a problem, "reset" to fix it, then email support and without logfile.txt.old we don't know
// what the original problem was.
// The reason this is a three step: 1. remove old 2. copy new to old 3. truncate new
// and not simply "move" is because we hold open filehandles to the logfile (LogAppender) for performance.
//
RemoveDatastore.removeLogfile = function()
{
	var file_new = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.LOG);
	var file_old = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.LOG);
	var name_old = Filesystem.eFilename.LOGFILE + ".old";

	file_new.append(Filesystem.eFilename.LOGFILE);
	file_old.append(name_old);

	if (file_new.exists() && !file_new.isDirectory())
	{
		try {
			file_old.remove(false);
		}
		catch (ex) {
		}

		try {
			file_new.copyTo(null, name_old);
		}
		catch (ex) {
			logger().error("RemoveDatastore:removeLogfile: unable to copy: " + file_new.path + " to: " + name_old + " error: " + ex);
		}

		Filesystem.writeToFile(file_new, ""); // truncate
	}
}

RemoveDatastore.removeZfcsIfNecessary = function()
{
	var data_format_version = null;
	var zfiStatus      = StatusBar.stateAsZfi();
	var msg            = "";
	var is_out_of_date = false;

	if (zfiStatus)
		data_format_version = zfiStatus.getOrNull('appversion');

	msg += "Software works with datastore version: " + APP_VERSION_DATA_CONSISTENT_WITH + " (or newer).  Here: " + data_format_version;

	var is_status_file_exists = StatusBar.stateAsZfc().nsifile().exists();

	if (!zfiStatus && is_status_file_exists)
		msg += " but the status file exists";

	if ((!zfiStatus && is_status_file_exists) ||
	    (zfiStatus && !data_format_version)   ||
	    (data_format_version && compareToolkitVersionStrings(data_format_version, APP_VERSION_DATA_CONSISTENT_WITH) == -1))
	{
		msg += " - out of date";

		is_out_of_date = true;
	}
	else
		msg += " - ok";

	logger().debug(msg);

	if (is_out_of_date)
	{
		logger().info("data format was out of date - removing data files and forcing slow sync");

		RemoveDatastore.removeZfcs();
	}
}

