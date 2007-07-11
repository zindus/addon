include("chrome://zindus/content/log4js.js");

// code in this file created by leni

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

	if (typeof gLogger.loggingOutputStream != "undefined" && gLogger.loggingOutputStream != null)
	{
		gLogger.loggingOutputStream.write(message, message.length);
	}
}

// - if the .loggingActive preference is set...
// - if the file size exceeds the .loggingFileSizeMax preference it is truncated
// - logfile is opened in append mode
// - the outputStream is held in the gLogger.loggingOutputStream member variable
// - the Log.dumpAndFileLogger uses it
// - the stream is closed

Log.prototype.loggingFileOpen = function()
{
	if (gPreferences.getCharPref(gPreferences.branch(), "loggingActive") == "true")
	{
		var logfile = Filesystem.getDirectory(DIRECTORY_LOG); // returns an nsIFile object

		var ioFlags = FILESYSTEM_FLAG_PR_CREATE_FILE | FILESYSTEM_FLAG_PR_WRONLY | FILESYSTEM_FLAG_PR_APPEND | FILESYSTEM_FLAG_PR_SYNC;

		if (!logfile.exists() || !logfile.isDirectory())
			logfile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, FILESYSTEM_PERM_PR_IRUSR | FILESYSTEM_PERM_PR_IWUSR);

		logfile.append(LOGFILENAME); // dump("logfile.path == " + logfile.path + "\n");

		var loggingFileSizeMax = gPreferences.getIntPref(gPreferences.branch(), "loggingFileSizeMax");

		if (logfile.exists() && logfile.fileSize > loggingFileSizeMax)
			ioFlags |= FILESYSTEM_FLAG_PR_TRUNCATE;

		this.loggingOutputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
		                        createInstance(Components.interfaces.nsIFileOutputStream);

		this.loggingOutputStream.init(logfile, ioFlags, FILESYSTEM_PERM_PR_IRUSR | FILESYSTEM_PERM_PR_IWUSR, null);

		// gLogger.debug("logfile.fileSize == " + logfile.fileSize + " and loggingFileSizeMax == " + loggingFileSizeMax);
	}
}

Log.prototype.loggingFileClose = function()
{
	if (typeof this.loggingOutputStream != "undefined" && this.loggingOutputStream != null)
	{
		this.loggingOutputStream.flush();
		this.loggingOutputStream.close()
		this.loggingOutputStream = null;
	}
}

