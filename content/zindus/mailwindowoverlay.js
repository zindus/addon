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
 * Portions created by Initial Developer are Copyright (C) 2007-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/
// $Id: mailwindowoverlay.js,v 1.69 2010-09-12 16:11:45 cvsuser Exp $

includejs("uninstall.js");

function ZinMailWindowOverlay()
{
	Filesystem.createDirectoriesIfRequired();  // this comes first - can't log without a directory for the logfile!

	this.m_logger           = newLogger("MailWindowOverlay");
	this.m_delay_on_repeat  = null;
	this.m_last_sync_date   = null;
	this.m_timeoutID        = null;
	this.m_maestro          = null;
	this.m_timer_functor    = null;
	this.m_topic_preference_change = ObserverService.TOPIC_PREFERENCE_CHANGE;
}

ZinMailWindowOverlay.prototype.onLoad = function()
{
	try
	{
		let app_name = AppInfo.app_name();
		let messengerWindow;

		if (app_name == AppInfo.eApp.spicebird)
			messengerWindow = document.getElementById("framework-window");
		else if (app_name == AppInfo.eApp.firefox)
			messengerWindow = document.getElementById("main-window");
		else
			messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			logger('info').info(getInfoMessage('startup'));

			this.migratePrefs();
			this.migratePasswords();

			Filesystem.removeZfcsIfNecessary();

			ObserverService.register(this, this.m_topic_preference_change);

			this.timerStartup();

			StatusBarState.update();

			UnInstall.addObserver();
		}
	}
	catch (ex)
	{
		zinAlert('text.alert.title', APP_NAME + " ZinMailWindowOverlay onLoad() : " + ex);
	}
}

ZinMailWindowOverlay.prototype.onUnLoad = function()
{
	try
	{
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			var msg = "";
			var is_observerserver_registered = ObserverService.isRegistered(Maestro.TOPIC);

			msg += "ObserverService: " + (is_observerserver_registered ? "registered" : "isn't registered");
			msg += " m_maestro: " + (this.m_maestro != null);

			if (is_observerserver_registered && this.m_maestro)
			{
				ObserverService.unregister(this.m_maestro, Maestro.TOPIC);
				msg += " ... deregistered";
			}
			else
			{
				msg += " ... do nothing";
			}

			this.m_logger.debug(msg);

			if (ObserverService.isRegistered(this.m_topic_preference_change))
				ObserverService.unregister(this, this.m_topic_preference_change);

			this.timerShutdown();

			logger('info').info(getInfoMessage('shutdown'));
		}
	}
	catch (ex)
	{
		zinAlert('text.alert.title', APP_NAME + " ZinMailWindowOverlay onUnLoad() : " + ex);
	}
}

ZinMailWindowOverlay.prototype.onTimerFire = function(context)
{
	context.m_logger.debug("onTimerFire enters");

	context.m_timeoutID = null; // allows us to do sanity checking

	var x = context.statusSummary();

	if (context.m_last_sync_date == null || x['last_sync_date'] == null
	                                     || context.m_last_sync_date.toString() == x['last_sync_date'].toString())
	{
		if (!ObserverService.isRegistered(Maestro.TOPIC))
		{
			context.m_maestro = new Maestro();

			ObserverService.register(context.m_maestro, Maestro.TOPIC);
		}
		else
			context.m_logger.debug("ObserverService is already registered so don't reregister.");

		var timer_id = hyphenate('-', Maestro.ID_FUNCTOR_MAILWINDOW_TIMER, Date.now());

		context.m_logger.debug("onTimerFire creates new TimerFunctor with id: " + timer_id);

		context.m_timer_functor = new TimerFunctor(timer_id, context.scheduleTimer, context);

		context.m_timer_functor.run();
	}
	else
		context.scheduleTimer(context, x);
}

ZinMailWindowOverlay.prototype.scheduleTimer = function(context, x)
{
	zinAssert(arguments.length == 1 || arguments.length == 2);
	zinAssert(context.m_timeoutID == null); // ensures that we never have > 1 oustanding timer

	if (arguments.length == 1)
		x = context.statusSummary();

	var delay = x['next_sync_date'] - x['now'];

	context.m_last_sync_date = x['last_sync_date'];

	context.m_timeoutID = window.setTimeout(context.onTimerFire, delay, context);

	logger('info').info(getInfoMessage('next', delay));
}

ZinMailWindowOverlay.prototype.statusSummary = function()
{
	var last_sync_date = null;
	var zfiStatus      = StatusBarState.toZfi();
	var now            = new Date();
	var next_sync_date = now;

	if (zfiStatus)
	{
		last_sync_date = new Date();
		last_sync_date.setTime(zfiStatus.getOrNull('date'));
	}

	if (last_sync_date)
	{
		if ((last_sync_date - now) > 0) // something wierd happened with time - last_sync_date is in the future!
		{
			next_sync_date = new Date();
			next_sync_date.setUTCMilliseconds(now.getUTCMilliseconds() + 1000 * 3600); // schedule for an hour ahead - ie, back off...
			this.m_logger.warn("Something wierd happened - time seems to have gone backwards! " +
			                   "\n" + " current time:   " + now +
			                   "\n" + " last_sync_date: " + last_sync_date + 
							   "\n" + " next_sync_date: " + next_sync_date);
		}
		else 
		{
			next_sync_date = new Date();
			next_sync_date.setUTCMilliseconds(last_sync_date.getUTCMilliseconds() + 
			                   1000 * randomPlusOrMinus(this.m_delay_on_repeat, (1/6 * this.m_delay_on_repeat).toFixed(0)));

			if ((now - next_sync_date) > 0)
			{
				next_sync_date = now;
				this.m_logger.debug("next sync is overdue, using now: " + next_sync_date);
			}
			else
				this.m_logger.debug("next sync is last sync plus delay: " + next_sync_date);
		}
	}
	else
	{
		next_sync_date = now;
		this.m_logger.debug("last sync date unavailable, next sync is now: " + next_sync_date);
	}

	var ret = newObject("now", now, "next_sync_date", next_sync_date, "last_sync_date", last_sync_date);

	// this.m_logger.debug("statusSummary returns: " + "\n" + " now:            " + ret['now'] + "\n" +
	//                                                        " last_sync_date: " + last_sync_date + "\n" +
	//                                                        " next_sync_date: " + next_sync_date );

	return ret;
}

ZinMailWindowOverlay.prototype.observe = function(subject, topic, data)
{
    if (topic == this.m_topic_preference_change)
	{
		this.m_logger.debug("ZinMailWindowOverlay: observe: topic: " + topic);

		this.m_logger.level(singleton().get_loglevel_from_preference());

		this.timerShutdown();
		this.timerStartup();
	}
}

// migrate the zindus.blah preferences
//
ZinMailWindowOverlay.prototype.migratePrefs = function()
{
	var old, value, a_map;
	var prefs = preferences();

	this.m_logger.debug("migrate old prefs... ");

	// 0.8.15 and above
	// if we've installed an earlier version of the addon, redo the migration
	//
	{
		let a_keys = preferences().getImmediateChildren(preferences().branch(), MozillaPreferences.AS_MIGRATION + '.');
		let i, j;

		for (i in a_keys) {
			let a_str = preference(MozillaPreferences.AS_MIGRATION + '.' + i, 'char').split(':');

			zinAssert(a_str.length == 2);

			if (a_str[0] == "9") // this is for 0.8.14.* testing release users - remove after 0.8.15.* release has been out for a while
				preferences().branch().setCharPref(MozillaPreferences.AS_MIGRATION + '.' + i, hyphenate(':', APP_VERSION_NUMBER, a_str[1]));
			else if (compareToolkitVersionStrings(a_str[0], APP_VERSION_NUMBER) == 1)
				preferences().branch().setCharPref(MozillaPreferences.AS_MIGRATION + '.' + i, hyphenate(':', 0, a_str[1]));
		}
	}
	
	// 0.7.7 replace MANUAL_SYNC_ONLY with AUTO_SYNC
	//
	var bimap = new BiMap( [ "true", "false" ], [ "false", "true" ] );

	var new_key = "general." + PrefSet.GENERAL_AS_AUTO_SYNC;

	for (old in { "general.manualsynconly": 0, "general.manual_sync_only": 0 }) 
	{
		value = prefs.getCharPrefOrNull(prefs.branch(), old);

		if (value != null)
		{
			prefs.branch().setCharPref(new_key, bimap.lookup(value, null) );

			prefs.branch().deleteBranch(old);

			this.m_logger.debug("migrated pref: " + old + " " + value + " to " + new_key + " " + bimap.lookup(value, null));
		}
	}

	// delete once confident all users are on version >= 0.7.9
	// 
	a_map = {
		"server.2.type":        { type: 'char', new: PrefSet.ACCOUNT + ".2." + eAccount.format   },
		"server.2.url":         { type: 'char', new: PrefSet.ACCOUNT + ".2." + eAccount.url      },
		"server.2.username":    { type: 'char', new: PrefSet.ACCOUNT + ".2." + eAccount.username }
	};

	migratePrefName(a_map);

	bimap = new BiMap( [ "google", "zimbra" ], [ Account.Google, Account.Zimbra ] );

	migratePrefValue([ PrefSet.ACCOUNT + ".2." + eAccount.format ], bimap);

	if ( prefs.getCharPrefOrNull(prefs.branch(), PrefSet.ACCOUNT + ".2." + eAccount.url) &&
	    !prefs.getCharPrefOrNull(prefs.branch(), PrefSet.ACCOUNT + ".2." + eAccount.format))
	{
		this.m_logger.debug("account 2 had a url but no format - this account must have been created in version 0.6.19 or earlier when all accounts were assumed zimbra - set format to zimbra explicitly now..."); // issue #106
		prefs.setCharPref(prefs.branch(), PrefSet.ACCOUNT + ".2." + eAccount.format, Account.Zimbra );
	}

	// 0.7.11 - move gd_sync_with and zm_sync_gal_enabled from zindus.general to zindus.account.2 (they are now per-account preferences)
	//

	if (prefs.getCharPrefOrNull(prefs.branch(), "account.2.url"))
	{
	    var format = prefs.getCharPrefOrNull(prefs.branch(), "account.2.format");

		function migrate_old(p, log, oldkey, newkey, default_value) {
			var value = p.getCharPrefOrNull(p.branch(), oldkey);

			if (value)
			{
				log.debug("migrated " + oldkey + "to " + newkey + " value: " + value);
				p.setCharPref(p.branch(), newkey, value);
			}

			if (!p.getCharPrefOrNull(p.branch(), newkey))
			{
				log.debug("set " + newkey + " value: " + default_value);
				p.setCharPref(p.branch(), newkey,  default_value);
			}
		}

		if (format == Account.Google)
		{
			migrate_old(prefs, this.m_logger, "general.gd_sync_with", "account.2.gd_sync_with", 'pab');
		}

		if (format == Account.Zimbra)
		{
			migrate_old(prefs, this.m_logger, "general.zm_sync_gal_enabled", "account.2.zm_sync_gal_enabled", 'if-fewer');
		}

		prefs.branch().deleteBranch("general.gd_sync_with");
		prefs.branch().deleteBranch("general.zm_sync_gal_enabled");
	}

	let accounts = AccountStatic.arrayLoadFromPrefset();
	var i;

	// 0.8.6
	// - add gd_suggested = 'include' to google accounts if necessary
	//
	if (true)
		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD) && (!accounts[i].gd_suggested || !accounts[i].gd_suggested.match(/include|ignore/)))
			{
				this.m_logger.debug("about to add 'include': current gd_suggested: " + accounts[i].gd_suggested + " toString: " + accounts[i].toString());

				accounts[i].gd_suggested = 'include';
				accounts[i].save();
			}

	// 0.8.10
	// - add zm_emailed_contacts == 'true' to zimbra accounts
	//
	if (true)
		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_ZM) &&
			    (!accounts[i].zm_emailed_contacts || !accounts[i].zm_emailed_contacts.match(/true|false/))) {
				let account = accounts[i];

				this.m_logger.debug("set 'zm_emailed_contacts': current zm_emailed_contacts: " +
				                      account.zm_emailed_contacts + " toString: " + account.toString());

				account.zm_emailed_contacts = 'true';
				account.save();
			}

	// 0.8.13
	// - add gd_gr_as_ab == 'false' to google accounts if necessary
	//
	if (true)
		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD) && (!accounts[i].gd_gr_as_ab || !accounts[i].gd_gr_as_ab.match(/true|false/)))
			{
				let account = accounts[i];
				this.m_logger.debug("set 'gd_gr_as_ab': current gd_gr_as_ab: " + account.gd_gr_as_ab + " toString: " + account.toString());

				account.gd_gr_as_ab = 'false';
				account.save();
			}

	// 0.8.13
	// - NOTUSED
	// - We only want the AS_IS_FIRSTRUN preference to be true in brand-new installations, not in upgrades to existing installations
	//   So here we set it to false if the user had an account.
	//   This approach isn't perfect because a user might a) install the addon, b) create an account c) restart tb
	//   d) do their first sync.  But most people won't do c) so the approach is 'good enough'.
	//
	if (false) {
		if (preference(MozillaPreferences.AS_IS_FIRSTRUN, 'bool') && accounts.length > 0) {
			this.m_logger.debug("AS_IS_FIRSTRUN was true but we set it to false because an account was present");
			prefs.setBoolPref(prefs.branch(), MozillaPreferences.AS_IS_FIRSTRUN, false);
		}
	}

	// 0.8.15
	// - remove logfile.txt.old ... move to a configurable rotation scheme
	// 
	if (true) {
		let name =  Filesystem.eFilename.LOGFILE + ".old";
		let file = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.LOG);
		file.append(name);
		if (file.exists() && !file.isDirectory())
			try {
				file.remove(false);
				this.m_logger.debug("removed: " + file.path);
			} catch (ex) { }
	}
}

ZinMailWindowOverlay.prototype.migratePasswords = function()
{
	var accounts = AccountStatic.arrayLoadFromPrefset();
	var pm       = PasswordManager.new();
	var log      = this.m_logger;
	var i, j;

	var password_version_old = preferences().getCharPrefOrNull(preferences().branch(), MozillaPreferences.AS_PASSWORD_VERSION);
	var password_version_new = null;

	this.m_logger.debug("migrate old password/logins: password_version_old: " + password_version_old);

	pm.m_migrate_hostnames = false;  // disable conversions that apply to tb2

	// 0.8.6
	// Bugs in pre-0.8.6 versions created temporary passwords that shouldn't have been left in the password database.
	// Here we remove them.
	//
	if (("@mozilla.org/passwordmanager;1" in Components.classes) && (password_version_old == "notset"))
	{
		let url = "https://www.google.com/accounts/ClientLogin/AuthToken";

		pm.del(url, "username");

		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD))
				pm.del(url, accounts[i].username);
	}

	if (("@mozilla.org/login-manager;1" in Components.classes) && (password_version_old == "notset" || password_version_old == "pm-2"))
	{
		// passwordmanager doesn't seem to delete the bogus 'username' entry correctly, so we try again here on the first
		// run after an upgrade to tb3.
		//
		let url      = "https://www.google.com";
		let username = "username";
		let logins   = pm.nsILoginManager().getAllLogins({});

		for (i = 0; i < logins.length; i++)
			if (logins[i].hostname == url && logins[i].username == username &&
			    (logins[i].formSubmitURL == null || logins[i].formSubmitURL == "") &&
			    (logins[i].httpRealm == null || logins[i].httpRealm == ""))
			{
				pm.nsILoginManager().removeLogin(logins[i]);
				this.m_logger.debug("migrate: removed bogus login: url: " + url + " username: " + username);
			}
	}

	// migrate the hostnames/urls used in password manager and loginmanager
	// to ensure a smooth path to 
	if (password_version_old == "notset" && ("@mozilla.org/passwordmanager;1" in Components.classes))
	{
		password_version_new = "pm-2";

		this.m_logger.debug("migrating from password_version: notset to: " + password_version_new);

		function migrate_password(old_url, new_url, username, password) {
			log.debug("migrating username: " + username + " old_url: " + old_url + " to: " + new_url);
			pm.set(PasswordManager.m_bimap_google_hostname.lookup(old_url, null), username, password);
			pm.del(old_url, username);
		}

		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD))
			{
				let username = accounts[i].passwordlocator.username();
				let url, password;

				url      = eGoogleLoginUrl.kAuthToken;
				password = pm.get(url, username);
				if (password)
					migrate_password(url, PasswordManager.m_bimap_google_hostname.lookup(url, null), username, password);

				url      = eGoogleLoginUrl.kClientLogin;
				password = pm.get(url, username);
				if (password)
					migrate_password(url, PasswordManager.m_bimap_google_hostname.lookup(url, null), username, password);

			}
	}
	else if (password_version_old == "notset" && ("@mozilla.org/login-manager;1" in Components.classes))
	{
		// Thunderbird3's auto-migration of nsIPasswordManager entries to nsILoginManager logins is lossy
		// Here we apply a heuristic to try and recover
		//
		password_version_new = "lm-2";
		this.m_logger.debug("migrating from password_version: notset to: " + password_version_new);

		var login_manager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		var logins        = login_manager.getAllLogins({});

		function migrate_login_from_notset(logininfo) {
			let type = (logininfo.password.length < 100 ? eGoogleLoginUrl.kClientLogin : eGoogleLoginUrl.kAuthToken );

			log.debug("migrating logininfo type: " + eGoogleLoginUrl.keyFromValue(type) + " to version lm-2: hostname: " +
			            logininfo.hostname + " username: " + logininfo.username);

			pm.set(type, logininfo.username, logininfo.password);
			login_manager.removeLogin(logininfo);
		}

		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD))
				for (j = 0; j < logins.length; j++)
					if (logins[j].username == accounts[i].passwordlocator.username() &&
					    logins[j].hostname == "https://www.google.com" && (logins[j].httpRealm === null))
						migrate_login_from_notset(logins[j]);
	}
	else if (password_version_old == "pm-2" && ("@mozilla.org/login-manager;1" in Components.classes))
	{
		password_version_new = "lm-2";
		this.m_logger.debug("migrating from password_version: pm-2 to: " + password_version_new);

		var login_manager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		var logins        = login_manager.getAllLogins({});

		function migrate_login_from_pm_2(logininfo) {
			let url = PasswordManager.m_bimap_google_hostname.lookup(null, logininfo.hostname);

			log.debug("migrating logininfo hostname: " + logininfo.hostname + " to version lm-2: username: " + logininfo.username);

			pm.set(url, logininfo.username, logininfo.password);
			login_manager.removeLogin(logininfo);
		}

		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD))
				for (j = 0; j < logins.length; j++)
					if (logins[j].username == accounts[i].passwordlocator.username() &&
						(logins[j].httpRealm === null) &&
					    (logins[j].hostname == PasswordManager.m_bimap_google_hostname.lookup(eGoogleLoginUrl.kClientLogin, null) ||
					     logins[j].hostname == PasswordManager.m_bimap_google_hostname.lookup(eGoogleLoginUrl.kAuthToken, null)))
						migrate_login_from_pm_2(logins[j]);
	}

	if (password_version_new)
		preferences().setCharPref(preferences().branch(), MozillaPreferences.AS_PASSWORD_VERSION, password_version_new);
}

ZinMailWindowOverlay.prototype.timerStartup = function()
{
	var prefs = preferences();

	if (prefs.getCharPrefOrNull(prefs.branch(), PrefSet.GENERAL + '.' + PrefSet.GENERAL_AS_AUTO_SYNC) != "false")
	{
		var delay_on_start     = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_START );
		this.m_delay_on_repeat = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT );

		var x = this.statusSummary();

		this.m_last_sync_date = x['last_sync_date'];

		var delay = 1000 * randomPlusOrMinus(delay_on_start, (1/2 * delay_on_start).toFixed(0));

		this.m_logger.debug("onLoad: delay_on_start: " + delay_on_start + " actual delay (ms): " + delay);

		this.m_timeoutID = window.setTimeout(this.onTimerFire, delay, this);

		logger('info').info(getInfoMessage('next', delay));
	}
	else {
		this.m_logger.debug("manual sync only - timer not started.");
	}
}

ZinMailWindowOverlay.prototype.timerShutdown = function()
{
	if (this.m_timeoutID)
	{
		this.m_logger.debug("cancelling timer...");
		window.clearTimeout(this.m_timeoutID);
		this.m_timeoutID = null;
	}

	if (this.m_timer_functor)
	{
		this.m_logger.debug("cancelling sync...");
		this.m_timer_functor.cancel();
		this.m_timer_functor = null;
	}
}
