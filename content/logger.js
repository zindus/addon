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

include("chrome://zindus/content/log4js.js");
include("chrome://zindus/content/mozillapreferences.js");

/**
 * Static dump logger method.  This logger uses dump() to output the message
 * @param {String} msg The message to display
 * @param level The priority level of this log event
 */
Log.dumpLogger = function(msg,level) { dump(level+" - "+msg+"\n"); }

/**
 * Static logger method.  This logger sends the message both to dump() and to an nsIFileOutputStream
 * @param {String} msg The message to display
 * @param level The priority level of this log event
 */
// leni note - this method is static, so it has to reference gLogger, rather than "this"
Log.dumpAndFileLogger = function(msg,level)
{
	var message = level + " - " + msg + "\n"

    dump(message);

	var os = loggingFileOpen();

	if (typeof os != "undefined" && os != null)
	{
		os.write(message, message.length);

		loggingFileClose(os);
	}
}

// - if the .loggingActive preference is set...
// - if the file size exceeds the .loggingFileSizeMax preference it is truncated
// - logfile is opened in append mode
// - the outputStream is held in the gLogger.loggingOutputStream member variable
// - the Log.dumpAndFileLogger uses it
// - the stream is closed

function loggingFileOpen()
{
	var ret = null;
	var prefs = new MozillaPreferences();

	if (prefs.getCharPref(prefs.branch(), "loggingActive") == "true")
	{
		try
		{
			var logfile = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG); // returns an nsIFile object

			var ioFlags = Filesystem.FLAG_PR_CREATE_FILE | Filesystem.FLAG_PR_WRONLY | Filesystem.FLAG_PR_APPEND | Filesystem.FLAG_PR_SYNC;

			if (!logfile.exists() || !logfile.isDirectory())
				logfile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR);

			logfile.append(LOGFILE_NAME); // dump("logfile.path == " + logfile.path + "\n");

			var loggingFileSizeMax = prefs.getIntPref(prefs.branch(), "loggingFileSizeMax");

			if (logfile.exists() && logfile.fileSize > loggingFileSizeMax)
				ioFlags |= Filesystem.FLAG_PR_TRUNCATE;

			ret = Components.classes["@mozilla.org/network/file-output-stream;1"].
		                        createInstance(Components.interfaces.nsIFileOutputStream);

			// TODO - test this
			// this next line throws an exception if the logfile is already open (eg by a hung process)
			//
			ret.init(logfile, ioFlags, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR, null);

			// gLogger.debug("logfile.fileSize == " + logfile.fileSize + " and loggingFileSizeMax == " + loggingFileSizeMax);
		}
		catch (e)
		{
			if (typeof(is_first_logging_file_open_exception) == 'undefined')
			{
				Components.utils.reportError(e);
				is_first_logging_file_open_exception = true;
			}

			ret = null;
		}
	}

	return ret;
}

function loggingFileClose(os)
{
	if (typeof os != "undefined" && os != null)
	{
		os.flush();
		os.close()
	}
}

function newLogger(prefix)
{
	var logger = new Log(Log.DEBUG, Log.dumpAndFileLogger, prefix);

	return logger;
}
