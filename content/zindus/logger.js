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

Logger.NO_PREFIX = 0x01;

function Logger(level, prefix, appender)
{
	this.m_level    = level;
	this.m_prefix   = prefix;

	if (arguments.length == 3)
		this.m_appender = appender;
	else
		this.m_appender = LogAppenderStatic.newLogAppender();
}

Logger.prototype = {
level : function() {
	if (arguments.length == 1)
		this.m_level = arguments[0];

	return this.m_level;
},
appender : function() {
	if (arguments.length == 1)
		this.m_appender = arguments[0];

	return this.m_appender;
},
debug : function(msg) {
	// this try/catch is helpful when working out what part of the code is calling logger when it shouldn't be
	// eg SyncWindow.onCancel() after the fsm has finished and called onAccept() and this file scope has disappeared.
	// try {

	var l = Logger.DEBUG;

	// } catch(ex) {
	//				dump(ex.message + " stack: \n" + ex.stack);
	//}
	if (this.level() <= l) this.log(l, msg);
},
info  : function(msg) { var l = Logger.INFO;  if (this.level() <= l) this.log(l, msg); },
warn  : function(msg) { var l = Logger.WARN;  if (this.level() <= l) this.log(l, msg); },
error : function(msg) { var l = Logger.ERROR; if (this.level() <= l) this.log(l, msg); },
fatal : function(msg) { var l = Logger.FATAL; if (this.level() <= l) this.log(l, msg); },
debug_continue : function(msg) {
	var l = Logger.DEBUG;
	if (this.level() <= l) { 
		this.log(l, msg, Logger.NO_PREFIX);
	}
},
log : function(l, msg, np) {
	this.m_appender.log(l, this.m_prefix, msg, np);
}
};

function LogAppender()
{
	var prefs = new MozillaPreferences();

	this.m_logfile_size_max  = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_LOGFILE_MAX_SIZE );
	this.m_logfile           = Filesystem.getDirectory(Filesystem.DIRECTORY_LOG); // an nsIFile object
	this.m_max_level_length  = 7;
	this.m_max_prefix_length = 15;

	this.m_logfile.append(Filesystem.FILENAME_LOGFILE);

	this.a_level = [Logger.NONE, Logger.FATAL, Logger.ERROR, Logger.WARN, Logger.INFO, Logger.DEBUG];
	this.a_word  = ['none',      'fatal',      'error',      'warn',      'info',      'debug'     ];
	this.bimap_LEVEL = new BiMap(this.a_level, this.a_word);

	this.m_buffer_prefix = new Object();

	for (let i = 0; i < this.a_level.length; i++)
		this.m_buffer_prefix[this.a_level[i]] = new Object();
}

LogAppender.prototype = {
	logToFile : null, // abstract base class
	log : function(level, prefix, msg, np) {
		var message = this.make_log_message(level, prefix, msg, np);

		if (message)
			this.log_output(level, message);
	},
	log_output : function(level, msg) {
		if (LogAppenderStatic.isLoud(level))
			dump(msg);

		this.logToFile(msg);

		if (LogAppenderStatic.isLoud(level))
			LogAppenderStatic.logToConsoleService(level, msg);
	},
	make_log_message : function(level, prefix, msg, np) {
		var ret;

		if (np == Logger.NO_PREFIX)
			ret = msg + "\n";
		else {
			if (!(prefix in this.m_buffer_prefix[level]))
				this.m_buffer_prefix[level][prefix] = new String(this.bimap_LEVEL.lookup(level, null) + ":   ")
		                .substr(0, this.m_max_level_length)
						.concat( (prefix ? (new String(prefix.substr(0, this.m_max_prefix_length) + ":                ")
						                     .substr(0, this.m_max_prefix_length + 1) + " ") : ""));

			ret = new String(this.m_buffer_prefix[level][prefix]).concat(msg, "\n");
		}

		return ret;
	},
	fileOpen : function() {
		var ret = null;

		try {
			var ioFlags = Filesystem.FLAG_PR_CREATE_FILE | Filesystem.FLAG_PR_RDONLY | Filesystem.FLAG_PR_WRONLY
			                                             | Filesystem.FLAG_PR_APPEND; // | Filesystem.FLAG_PR_SYNC;

			if (this.m_logfile.exists() && this.m_logfile.fileSize > this.m_logfile_size_max)
				ioFlags |= Filesystem.FLAG_PR_TRUNCATE;

			ret = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

			// this next line throws an exception if the logfile is already open (eg by a hung process)
			//
			ret.init(this.m_logfile, ioFlags, Filesystem.PERM_PR_IRUSR | Filesystem.PERM_PR_IWUSR, null);
		}
		catch (ex) {
			if (!LogAppenderStatic.m_is_first_logging_file_open_exception) {
				LogAppenderStatic.reportError("fileOpen: exception opening file: " + this.m_logfile.path, ex);
				LogAppenderStatic.m_is_first_logging_file_open_exception = true;
			}

			ret = null;
		}

		return ret;
	}
};

var LogAppenderStatic = {
	m_is_first_logging_file_open_exception : false,
	newLogAppender : function() {
		return new LogAppenderHoldOpen();
		// return new LogAppenderOpenClose();
	},
	isLoud : function(level) {
		return (level == Logger.WARN || level == Logger.ERROR || level == Logger.FATAL);
	},
	logToConsoleService : function(level, message) {
		// See: http://developer.mozilla.org/en/docs/nsIConsoleService
		//
		var consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
		var scriptError    = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
		var category       = "";
		var flags;

		switch (level) {
			case Logger.WARN:  flags = scriptError.warningFlag; break;
			case Logger.ERROR: flags = scriptError.errorFlag;   break;
			case Logger.FATAL: flags = scriptError.errorFlag;   break;
			default: zinAssert(false);
		}

		scriptError.init(message, null, null, null, null, flags, category);
		consoleService.logMessage(scriptError);
	},
	fileClose : function(os) {
		if (typeof(os) != "undefined" && os != null) {
			os.flush();
			os.close()
		}
	},
	reportError : function(msg, ex) {
		msg += "\nstack: " + executionStackAsString();

		dump(msg + "\n");
		dump(ex + "\n");

		if (typeof(Components) == 'object') {
			Components.utils.reportError(msg);
			Components.utils.reportError(ex);
		}
	},
	write : function (os, message) {
		try {
			os.write(message, message.length);
		} catch (ex) {
			LogAppenderStatic.reportError("logToFile: unable to write to logfile, message: " + message, ex);
		}
	}
};

function LogAppenderOpenClose() { LogAppender.call(this); } 
function LogAppenderHoldOpen()  { LogAppender.call(this); this.m_os = null; }

LogAppenderOpenClose.prototype = new LogAppender();
LogAppenderHoldOpen.prototype  = new LogAppender();

LogAppenderHoldOpen.prototype.log = function(level, prefix, msg, np)
{
	if (!this.m_os)
		this.m_os = this.fileOpen();

	LogAppender.prototype.log.call(this, level, prefix, msg, np);
}

LogAppenderOpenClose.prototype.logToFile = function(message)
{
	var os = this.fileOpen();

	if (os != null) {
		LogAppenderStatic.write(os, message);

		try {
			LogAppenderStatic.fileClose(os);
		} catch (ex) {
			LogAppenderStatic.reportError("logToFile: unable to close logfile", ex);
		}
	}
}

LogAppenderHoldOpen.prototype.logToFile = function(message)
{
	if (this.m_os != null)
		LogAppenderStatic.write(this.m_os, message);
}

LogAppenderHoldOpen.prototype.close = function()
{
	LogAppenderStatic.fileClose(this.m_os);
	this.m_os = null;
}

Logger.nsIConsoleListener = function()
{
	// see: http://developer.mozilla.org/en/docs/Console_service
	//
	var logger = Singleton.instance().logger();

	var listener = {
		observe:function( aMessage ) {
			logger.debug("console: " + aMessage.message);
		},
		QueryInterface: function (iid) {
			if (!iid.equals(Ci.nsIConsoleListener) && !iid.equals(Ci.nsISupports)) {
				throw Components.results.NS_ERROR_NO_INTERFACE;
			}
			return this;
		}
	};

	return listener;
}

Logger.nsIConsoleService = function()
{
	return Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
}
