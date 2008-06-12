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

// simple logging api, no appenders

Logger.NONE  = 6;
Logger.FATAL = 5;
Logger.ERROR = 4;
Logger.WARN  = 3;
Logger.INFO  = 2;
Logger.DEBUG = 1;

function Logger(level, prefix, appender)
{
	this.m_level    = level;
	this.m_prefix   = prefix;

	if (arguments.length == 3)
		this.m_appender = appender;
	else
		this.m_appender = new LogAppenderOpenClose();
}

Logger.prototype.level = function()
{
	if (arguments.length == 1)
		this.m_level = arguments[0];

	return this.m_level;
}

Logger.prototype.debug = function(msg)
{
	// this try/catch is helpful when working out what part of the code is calling logger when it shouldn't be
	// eg SyncWindow.onCancel() after the fsm has finished and called onAccept() and this file scope has disappeared.
	// try {

	var l = Logger.DEBUG;

	// } catch(ex) {
	//				dump(ex.message + " stack: \n" + ex.stack);
	//}
	if (this.level() <= l) this.log(l, msg);
}
Logger.prototype.info  = function(msg) { var l = Logger.INFO;  if (this.level() <= l) this.log(l, msg); }
Logger.prototype.warn  = function(msg) { var l = Logger.WARN;  if (this.level() <= l) this.log(l, msg); }
Logger.prototype.error = function(msg) { var l = Logger.ERROR; if (this.level() <= l) this.log(l, msg); }
Logger.prototype.fatal = function(msg) { var l = Logger.FATAL; if (this.level() <= l) this.log(l, msg); }

Logger.prototype.log = function(l, msg)
{
	this.m_appender.log(l, this.m_prefix, msg);
}

// Only one appender is implemented, and it's implemented as a singleton.
// In an earlier implementation, the appender object was a member of Logger, but
// I discovered that cloneObject() just hangs when trying to clone an appender.
// Rather than looking into why clone() doesn't work on one of the xpcom objects,
// I just made the appender a singleton, which is better for speed too.
// If there was an abstract base class, LogAppenderOpenClose would have just one public method, namely log().
//
function LogAppenderOpenClose()
{
	var prefs = new MozillaPreferences();

	this.m_logfile_size_max = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_LOGFILE_MAX_SIZE );
	this.m_logfile          = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG); // returns an nsIFile object

	this.m_logfile.append(Filesystem.FILENAME_LOGFILE);
	// dump("logfile.path == " + this.m_logfile.path + "\n");

	this.bimap_LEVEL = new BiMap(
		[Logger.NONE, Logger.FATAL, Logger.ERROR, Logger.WARN, Logger.INFO, Logger.DEBUG],
		['none',         'fatal',         'error',         'warn',         'info',         'debug'        ]);
}

LogAppenderOpenClose.instance = function()
{
	if (typeof (LogAppenderOpenClose.m_instance) == "undefined")
		LogAppenderOpenClose.m_instance = new LogAppenderOpenClose();

	return LogAppenderOpenClose.m_instance;
}

LogAppenderOpenClose.prototype.log = function(level, prefix, msg)
{
	var message = "";
	var max_level_length = 7;
	var max_prefix_length = 15;
	
	message += new String(this.bimap_LEVEL.lookup(level, null) + ":   ").substr(0, max_level_length);

	if (prefix)
		message += new String(prefix.substr(0, max_prefix_length) + ":                ").substr(0, max_prefix_length + 1) + " ";

	message += msg + "\n";

	dump(message);

	this.logToFile(message);

	this.logToConsoleService(level, message);
}

LogAppenderOpenClose.prototype.logToConsoleService = function(level, message)
{
	if (level == Logger.WARN || level == Logger.ERROR || level == Logger.FATAL)
	{
		// See: http://developer.mozilla.org/en/docs/nsIConsoleService
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		var scriptError    = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
		var category       = "";
		var flags;

		switch (level)
		{
			case Logger.WARN:  flags = scriptError.warningFlag; break;
			case Logger.ERROR: flags = scriptError.errorFlag;   break;
			case Logger.FATAL: flags = scriptError.errorFlag;   break;
			default: zinAssert(false);
		}

		scriptError.init(message, null, null, null, null, flags, category);
		consoleService.logMessage(scriptError);
	}
}

LogAppenderOpenClose.prototype.logToFile = function(message)
{
	var os = this.fileOpen();

	if (typeof os != "undefined" && os != null)
	{
		os.write(message, message.length);

		this.fileClose(os);
	}
}

LogAppenderOpenClose.prototype.fileOpen = function()
{
	var ret = null;

	try
	{
		var ioFlags = Filesystem.FLAG_PR_CREATE_FILE | Filesystem.FLAG_PR_RDONLY | Filesystem.FLAG_PR_WRONLY | Filesystem.FLAG_PR_APPEND | Filesystem.FLAG_PR_SYNC;

		if (this.m_logfile.exists() && this.m_logfile.fileSize > this.m_logfile_size_max)
			ioFlags |= Filesystem.FLAG_PR_TRUNCATE;

		ret = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

		// this next line throws an exception if the logfile is already open (eg by a hung process)
		//
		ret.init(this.m_logfile, ioFlags, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR, null);

		// dump("logfile.fileSize == " + this.m_logfile.fileSize + " and m_logfile_size_max == " + this.m_logfile_size_max);
	}
	catch (ex)
	{
		if (typeof(is_first_logging_file_open_exception) == 'undefined')
		{
			dump("fileOpen: exception opening file: " + this.m_logfile.path + "\n");
			dump(ex.message + " stack: \n" + ex.stack); // TODO
			Components.utils.reportError(ex);
			is_first_logging_file_open_exception = true;
		}

		ret = null;
	}

	// dump("loggingFileOpen returns: " + (ret == null ? "null" : ret) + "\n");

	return ret;
}

LogAppenderOpenClose.prototype.fileClose = function(os)
{
	if (typeof os != "undefined" && os != null)
	{
		os.flush();
		os.close()
	}
}

function LogAppenderHoldOpen(state)
{
	this.LogAppenderOpenClose();
	this.m_os = this.fileOpen();
}

copyPrototype(LogAppenderHoldOpen, LogAppenderOpenClose);

LogAppenderHoldOpen.prototype.logToFile = function(message)
{
	if (typeof this.m_os != "undefined" && this.m_os != null)
		this.m_os.write(message, message.length);
}

LogAppenderHoldOpen.prototype.close = function(message)
{
	this.fileClose(this.m_os);
}

Logger.nsIConsoleListener = function()
{
	// see: http://developer.mozilla.org/en/docs/Console_service
	//
	var logger = Singleton.instance().logger();

	var listener = {
		observe:function( aMessage )
		{
			logger.debug("console: " + aMessage.message);
		},
		QueryInterface: function (iid) {
			if (!iid.equals(Components.interfaces.nsIConsoleListener) && !iid.equals(Components.interfaces.nsISupports)) {
				throw Components.results.NS_ERROR_NO_INTERFACE;
			}
			return this;
		}
	};

	return listener;
}

Logger.nsIConsoleService = function()
{
	return Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
}
