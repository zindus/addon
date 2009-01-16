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
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			logger('info').info(getInfoMessage('startup'));

			this.migratePrefs();

			RemoveDatastore.removeZfcsIfNecessary();

			ObserverService.register(this, this.m_topic_preference_change);

			this.timerStartup();

			StatusBar.update();
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
	var zfiStatus      = StatusBar.stateAsZfi();
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

	// 0.8.6
	// - add gd_suggested = 'include' to google accounts if necessary
	//
	if (true)
	{
		let accounts = AccountFactory.accountsLoadFromPrefset();
		let i;

		for (i = 0; i < accounts.length; i++)
			if ((accounts[i].format_xx() == FORMAT_GD) && (accounts[i].gd_suggested != 'include' || accounts[i].gd_suggested != 'ignore'))
			{
				accounts[i].gd_suggested = 'include';
				accounts[i].save();
			}
	}
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
	else
		this.m_logger.debug("manual sync only - timer not started.");
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
