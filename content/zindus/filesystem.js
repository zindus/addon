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
 * Portions created by Initial Developer are Copyright (C) 2007-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Leni Mayo
 *
 * ***** END LICENSE BLOCK *****/

var Filesystem = {
	m_charset            : "UTF-8",
	m_a_directory        : new Object(),
	m_a_parent_directory : null,
	eDirectory : new ZinEnum( {
		PROFILE : 'profile',   // C:\Documents and Settings\user\Application Data\Thunderbird\Profiles\blah
		APP     : APP_NAME,    //                                                                      blah\zindus
		LOG     : 'log',       //                                                                      blah\zindus\log
		DATA    : 'data',      //                                                                      blah\zindus\data
		PHOTO   : 'Photos'     //                                                                      blah\Photos
	}),
	eFilename : new ZinEnum( {
		LOGFILE   : 'logfile.txt',
		LASTSYNC  : 'lastsync.txt',
		GID       : 'gid.txt',
		STATUS    : 'status.txt',
		TEST      : 'test.txt',
		CONTACTS  : 'contacts.sqlite'
	}),
	ePerm : new ZinEnum( {     // from prio.h
		PR_IRUSR  : 0400,    // Read    by owner
		PR_IWUSR  : 0200,    // Write   by owner
		PR_IXUSR  : 0100,    // Execute by owner
		PR_IRWXU  : 0700     // R/W/X by owner
	}),
	eFlag : new ZinEnum( {     // from prio.h
		PR_RDONLY      : 0x01, // seems silly that mozilla doesn't expose these constants via an interface!
		PR_WRONLY      : 0x02,
		PR_CREATE_FILE : 0x08,
		PR_APPEND      : 0x10,
		PR_TRUNCATE    : 0x20,
		PR_SYNC        : 0x40
	}),
	nsIFileForDirectory : function(name) {
		zinAssertAndLog(this.eDirectory.isPresent(name), name);

		if (!this.m_a_parent_directory)
			with(Filesystem.eDirectory)
				this.m_a_parent_directory = newObject(APP,   PROFILE,
				                                      LOG,   APP,
													  DATA,  APP,
													  PHOTO, PROFILE);

		if (!(name in this.m_a_directory))
			if (name == this.eDirectory.PROFILE) {
				// http://developer.mozilla.org/en/docs/Code_snippets:File_I/O
				this.m_a_directory[name] = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties)
				                                  .get("ProfD", Ci.nsIFile);
				this.m_a_directory[name].clone();
			}
			else
			{
				this.m_a_directory[name] = this.nsIFileForDirectory(this.m_a_parent_directory[name]);
				this.m_a_directory[name].append(name);
			}

		return this.m_a_directory[name].clone();
	},
	createDirectoryIfRequired : function(name) {
		var nsifile = this.nsIFileForDirectory(name);

		if (!nsifile.exists() || !nsifile.isDirectory())
			try {
				nsifile.create(Ci.nsIFile.DIRECTORY_TYPE, this.ePerm.PR_IRWXU);
			}
			catch (e) {
				let msg = stringBundleString("text.filesystem.create.directory.failed", [ nsifile.path, e ] );
				zinAlert('text.alert.title', msg);
			}
	},
	createDirectoriesIfRequired : function() {
		for (var name in newObjectWithKeys(this.eDirectory.APP, this.eDirectory.LOG, this.eDirectory.DATA, this.eDirectory.PHOTO))
			this.createDirectoryIfRequired(name)
	},
	writeToFile : function(file, content, flag) {
		var ret = false;

		try {
			if (!file.exists())
				file.create(Ci.nsIFile.NORMAL_FILE_TYPE, this.ePerm.PR_IRUSR | this.ePerm.PR_IWUSR);

			if (flag && flag == 'binary') {
				// when writing photos, we just want the bytes in the file
				// from https://developer.mozilla.org/En/Code_snippets:File_I/O#Writing_a_Binary_File
				//
				let fos = Cc["@mozilla.org/network/safe-file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
				fos.init(file, this.eFlag.PR_WRONLY | this.eFlag.PR_TRUNCATE, this.ePerm.PR_IRUSR | this.ePerm.PR_IWUSR, null);
				fos.write(content, content.length);

				if (fos instanceof Ci.nsISafeOutputStream)
					fos.finish();
				else
					fos.close();
			}
			else {
				// when writing text,   we want UTF-8
				// from https://developer.mozilla.org/En/Code_snippets:File_I/O#Writing_to_a_File
				//
				let fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
				fos.init(file, this.eFlag.PR_WRONLY | this.eFlag.PR_TRUNCATE, this.ePerm.PR_IRUSR | this.ePerm.PR_IWUSR, null);

				fos.QueryInterface(Ci.nsIOutputStream);

				let cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
				cos.init(fos, this.m_charset, 0, 0x0000);
				cos.writeString(content);
				cos.flush();
				cos.close();
			}

			ret = true;
		}
		catch (e) {
			zinAlert('text.alert.title', e);
		}

		return ret;
	},
	fileReadByLine : function(path, functor) {
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

		file.initWithPath(path);

		if (file.exists()) {
			let fis = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
			let cis = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);

			fis.init(file, this.eFlag.PR_RDONLY,  this.ePerm.PR_IRUSR, 0);
			cis.init(fis, this.m_charset, 0, 0xFFFD);
			cis.QueryInterface(Ci.nsIUnicharLineInputStream);

			let line = {};

			while (cis.readLine(line)) {
				functor.run(line.value);
				line.value = null;
			}

			zinAssert(!line.value); // just to confirm that this loop works as documented

			cis.close();
		}
	},
	readBinaryFile : function(nsifile) {
		let fstream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
		let bstream = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);

		fstream.init(nsifile, 1, 0, false);
		bstream.setInputStream(fstream);

		let ret = bstream.readByteArray(fstream.available());

		bstream.close();
		fstream.close();

		return ret;
	},
	// the remove* methods...
	removeZfc : function(filename) {
		let directory = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.DATA);

		logger().debug("removeZfc: " + filename);

		if (directory.exists() && directory.isDirectory()) {
			let file = directory;
			file.append(filename);

			if (file.exists())
				file.remove(false);
		}
	},
	removeZfcs : function(re_exclude) {
		re_exclude = re_exclude ? re_exclude : /sqlite/;

		for (var name in newObjectWithKeys(this.eDirectory.DATA)) {
			let directory = Filesystem.nsIFileForDirectory(name);

			if (directory.exists() && directory.isDirectory()) {
				let iter = directory.directoryEntries;

				while (iter.hasMoreElements()) {
					let file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);

					if (!re_exclude.test(file.leafName) && !file.isDirectory())
						file.remove(false);
				}
			}
		}
	},
	removeZfcsIfNecessary : function() {
		var data_version   = null;
		var zfiStatus      = StatusBarState.toZfi();
		var msg            = "";
		var is_out_of_date = false;

		if (zfiStatus)
			data_version = zfiStatus.getOrNull('appversion');

		msg += "Software works with datastore version: " + APP_VERSION_DATA_CONSISTENT_WITH + " (or newer).  Here: " + data_version;

		var is_status_file_exists = StatusBarState.toZfc().nsifile().exists();

		if (!zfiStatus && is_status_file_exists)
			msg += " but the status file exists";

		if ((!zfiStatus && is_status_file_exists) || (zfiStatus && !data_version) ||
		    (data_version && compareToolkitVersionStrings(data_version, APP_VERSION_DATA_CONSISTENT_WITH) == -1))
		{
			msg += " - out of date";

			is_out_of_date = true;
		}
		else
			msg += " - ok";

		logger().debug(msg);

		if (is_out_of_date) {
			logger().info("data format was out of date - removing data files and forcing slow sync");

			Filesystem.removeZfcs();
		}
	}
};
