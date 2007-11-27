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
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

// simple logging api, no appenders

ZinLogger.NONE  = 6;
ZinLogger.FATAL = 5;
ZinLogger.ERROR = 4;
ZinLogger.WARN  = 3;
ZinLogger.INFO  = 2;
ZinLogger.DEBUG = 1;

function ZinLogger(level, prefix, appender)
{
	this.m_level    = level;
	this.m_prefix   = prefix;

	if (arguments.length == 3)
		this.m_appender = appender;
	else
		this.m_appender = new ZinLogAppenderOpenClose();
}

ZinLogger.prototype.level = function()
{
	if (arguments.length == 1)
		this.m_level = arguments[1];

	return this.m_level;
}

ZinLogger.prototype.debug = function(msg) { var l = ZinLogger.DEBUG; if (this.level() <= l) this.log(l, msg); }
ZinLogger.prototype.info  = function(msg) { var l = ZinLogger.INFO;  if (this.level() <= l) this.log(l, msg); }
ZinLogger.prototype.warn  = function(msg) { var l = ZinLogger.WARN;  if (this.level() <= l) this.log(l, msg); }
ZinLogger.prototype.error = function(msg) { var l = ZinLogger.ERROR; if (this.level() <= l) this.log(l, msg); }
ZinLogger.prototype.fatal = function(msg) { var l = ZinLogger.FATAL; if (this.level() <= l) this.log(l, msg); }

ZinLogger.prototype.log = function(l, msg)
{
	this.m_appender.log(l, this.m_prefix, msg);
}

// Only one appender is implemented, and it's implemented as a singleton.
// In an earlier implementation, the appender object was a member of ZinLogger, but
// I discovered that zinCloneObject() just hangs when trying to clone an appender.
// Rather than looking into why clone() doesn't work on one of the xpcom objects,
// I just made the appender a singleton, which is better for speed too.
// If there was an abstract base class, ZinLogAppenderOpenClose would have just one public method, namely log().
//
function ZinLogAppenderOpenClose()
{
	var prefs = new MozillaPreferences();

	this.m_logfile_size_max = prefs.getIntPref(prefs.branch(), "system.logfileSizeMax");
	this.m_logfile          = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG); // returns an nsIFile object

	this.m_logfile.append(Filesystem.FILENAME_LOGFILE);
	// dump("logfile.path == " + this.m_logfile.path + "\n");

	this.bimap_LEVEL = new BiMap(
		[ZinLogger.NONE, ZinLogger.FATAL, ZinLogger.ERROR, ZinLogger.WARN, ZinLogger.INFO, ZinLogger.DEBUG],
		['none',         'fatal',         'error',         'warn',         'info',         'debug'        ]);
}

ZinLogAppenderOpenClose.instance = function()
{
	if (typeof (ZinLogAppenderOpenClose.m_instance) == "undefined")
		ZinLogAppenderOpenClose.m_instance = new ZinLogAppenderOpenClose();

	return ZinLogAppenderOpenClose.m_instance;
}

ZinLogAppenderOpenClose.prototype.log = function(level, prefix, msg)
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

ZinLogAppenderOpenClose.prototype.logToConsoleService = function(level, message)
{
	if (level == ZinLogger.WARN || level == ZinLogger.ERROR || level == ZinLogger.FATAL)
	{
		// See: http://developer.mozilla.org/en/docs/nsIConsoleService
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		var scriptError    = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
		var category       = "";
		var flags;

		switch (level)
		{
			case ZinLogger.WARN:  flags = scriptError.warningFlag; break;
			case ZinLogger.ERROR: flags = scriptError.errorFlag;   break;
			case ZinLogger.FATAL: flags = scriptError.errorFlag;   break;
			default: zinAssert(false);
		}

		scriptError.init(message, null, null, null, null, flags, category);
		consoleService.logMessage(scriptError);
	}
}

ZinLogAppenderOpenClose.prototype.logToFile = function(message)
{
	var os = this.fileOpen();

	if (typeof os != "undefined" && os != null)
	{
		os.write(message, message.length);

		this.fileClose(os);
	}
}

ZinLogAppenderOpenClose.prototype.fileOpen = function()
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
	catch (e)
	{
		if (typeof(is_first_logging_file_open_exception) == 'undefined')
		{
			dump("fileOpen: exception opening file: " + this.m_logfile.path + "\n");
			Components.utils.reportError(e);
			is_first_logging_file_open_exception = true;
		}

		ret = null;
	}

	// dump("loggingFileOpen returns: " + (ret == null ? "null" : ret) + "\n");

	return ret;
}

ZinLogAppenderOpenClose.prototype.fileClose = function(os)
{
	if (typeof os != "undefined" && os != null)
	{
		os.flush();
		os.close()
	}
}

if (typeof(loggingLevel) != 'object' || !loggingLevel)
{
	var prefs = new MozillaPreferences();

	loggingLevel = (prefs.getCharPrefOrNull(prefs.branch(), "general.verboselogging") == "true") ? ZinLogger.DEBUG : ZinLogger.INFO;
	gLogger      = newZinLogger("global");
}

function newZinLogger(prefix)
{
	return new ZinLogger(loggingLevel, prefix);
}

function ZinLogAppenderHoldOpen(state)
{
	this.ZinLogAppenderOpenClose();
	this.m_os = this.fileOpen();
}

copyPrototype(ZinLogAppenderHoldOpen, ZinLogAppenderOpenClose);

ZinLogAppenderHoldOpen.prototype.logToFile = function(message)
{
	if (typeof this.m_os != "undefined" && this.m_os != null)
		this.m_os.write(message, message.length);
}

ZinLogAppenderHoldOpen.prototype.close = function(message)
{
	this.fileClose(this.m_os);
}

