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

RemoveDatastore.removeZfcs = function(filename)
{
	logger().debug("removeZfcs: " + (filename ? filename : "all files"));

	var file;
	var directory = Filesystem.getDirectory(Filesystem.DIRECTORY_DATA);

	// remove files in the data directory
	//
	if (directory.exists() && directory.isDirectory())
	{
		if (filename)
		{
			file = directory;
			file.append(filename);

			if (file.exists())
				file.remove(false);
		}
		else
		{
			var iter = directory.directoryEntries;
 
			while (iter.hasMoreElements())
			{
				file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);

				file.remove(false);
			}
		}
	}
}

// remove the logfile
//
RemoveDatastore.removeLogfile = function()
{
	var file = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG);

	file.append(Filesystem.FILENAME_LOGFILE);

	if (file.exists() && !file.isDirectory())
	{
		// Save the old logfile.  Often folk have a problem, "reset" to fix it, then email support and we don't know
		// what happened because the logfile is gone.
		//
		var oldfile = Filesystem.FILENAME_LOGFILE + ".old";

		try {
			file.moveTo(null, oldfile);
		}
		catch (ex)
		{
			logger().error("RemoveDatastore:removeLogfile: unable to rename: " + file.path + " to: " + oldfile + " error: " + ex);
		}
	}
}

RemoveDatastore.removeZfcsIfNecessary = function()
{
	var data_format_version = null;
	var zfiStatus  = StatusPanel.getZfi();
	var msg = "";
	var is_out_of_date = false;

	if (zfiStatus)
		data_format_version = zfiStatus.getOrNull('appversion');

	msg += "Software works with datastore version: " + APP_VERSION_DATA_CONSISTENT_WITH + " (or newer).  Here: " + data_format_version;

	var is_status_file_exists = StatusPanel.getZfc().nsifile().exists();

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

