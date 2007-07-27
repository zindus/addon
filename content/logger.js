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

include("chrome://zindus/content/log4js.js");  // see: http://log4js.sourceforge.net
include("chrome://zindus/content/filesystem.js");
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

	// dodgy: here we test for the strings, rather than the class constants...
	// if (level == Log.WARN || level == Log.ERROR || level == Log.FATAL)

	if (level == "WARN" || level == "ERROR" || level == "FATAL")
	{
		// See: http://developer.mozilla.org/en/docs/nsIConsoleService
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		var scriptError    = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
		var category       = "";
		var flags;

		switch (level)
		{
			case "WARN":  flags = scriptError.warningFlag; break;
			case "ERROR": flags = scriptError.errorFlag;   break;
			case "FATAL": flags = scriptError.errorFlag;   break;
			default: zinAssert(false);
		}

		// dump("msg: " + msg + "\n");
		// dump("flags: " + flags + "\n");
		// dump("nsIScriptError: " + scriptError.toString() + "\n");

		scriptError.init(msg, null, null, null, null, flags, category);
		consoleService.logMessage(scriptError);

		// consoleService.logStringMessage("test an nsIConsoleService message: ")
		// Components.utils.reportError("test a Components.utils.reportError message: ");
	}
}

// - if the file size exceeds the .loggingFileSizeMax preference it is truncated
// - logfile is opened in append mode
// - the outputStream is held in the gLogger.loggingOutputStream member variable
// - the Log.dumpAndFileLogger uses it
// - the stream is closed

function loggingFileOpen()
{
	var ret = null;
	var prefs = new MozillaPreferences();

	try
	{
		var ioFlags = Filesystem.FLAG_PR_CREATE_FILE | Filesystem.FLAG_PR_WRONLY | Filesystem.FLAG_PR_APPEND | Filesystem.FLAG_PR_SYNC;
		var logfile = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG); // returns an nsIFile object

		logfile.append(LOGFILE_NAME); // dump("logfile.path == " + logfile.path + "\n");

		var loggingFileSizeMax = prefs.getIntPref(prefs.branch(), "system.loggingFileSizeMax");

		if (logfile.exists() && logfile.fileSize > loggingFileSizeMax)
			ioFlags |= Filesystem.FLAG_PR_TRUNCATE;

		ret = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

		// this next line throws an exception if the logfile is already open (eg by a hung process)
		//
		ret.init(logfile, ioFlags, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR, null);

		// gLogger.debug("logfile.fileSize == " + logfile.fileSize + " and loggingFileSizeMax == " + loggingFileSizeMax);
	}
	catch (e)
	{
		if (typeof(is_first_logging_file_open_exception) == 'undefined')
		{
			Components.utils.reportError("am here 1");
			Components.utils.reportError(e);
			is_first_logging_file_open_exception = true;
		}

		ret = null;
	}

	// dump("loggingFileOpen returns: " + (ret == null ? "null" : ret) + "\n");

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

if (typeof(loggingLevel) != 'object' || !loggingLevel)
{
	var preferences = new MozillaPreferences();

	loggingLevel = (preferences.getCharPrefOrNull(preferences.branch(), "general.verboselogging") == "true") ? Log.DEBUG : Log.INFO;
	gLogger      = newLogger("global");
}

function newLogger(prefix)
{
	var logger = new Log(loggingLevel, Log.dumpAndFileLogger, prefix);

	return logger;
}
