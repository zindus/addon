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
	this.m_logger           = newLogger("MailWindowOverlay");
	this.m_logger_no_prefix = newLogger("");
	this.m_delay_on_repeat  = null;
	this.m_last_sync_date   = null;
	this.m_timeoutID        = null;
	this.m_maestro          = null;
	this.m_timer_functor    = null;
}

ZinMailWindowOverlay.prototype.onLoad = function()
{
	try
	{
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			Filesystem.createDirectoriesIfRequired();  // this comes first - can't log without a directory for the logfile!

			this.m_logger_no_prefix.info("startup:  " + APP_NAME + " " + APP_VERSION_NUMBER + " " + getFriendlyTimeString());

			this.migratePrefs();

			RemoveDatastore.removeZfcsIfNecessary();

			var prefs = preferences();

			if (prefs.getCharPrefOrNull(prefs.branch(), "general." + PrefSet.GENERAL_AUTO_SYNC) != "false")
			{
				var delay_on_start     = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_START );
				this.m_delay_on_repeat = prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT );

				var x = this.statusSummary();

				this.m_last_sync_date = x['last_sync_date'];

				var delay = 1000 * randomPlusOrMinus(delay_on_start, (1/2 * delay_on_start).toFixed(0));

				this.m_logger.debug("onLoad: delay_on_start: " + delay_on_start + " actual delay (ms): " + delay);

				this.m_timeoutID = window.setTimeout(this.onTimerFire, delay, this);

				this.m_logger_no_prefix.info("sync next:   " + getFriendlyTimeString(delay));
			}
			else
				this.m_logger.debug("manual sync only - not starting timer.");

			StatusPanel.update();
		}
	}
	catch (ex)
	{
		zinAlert('msg.alert.title', APP_NAME + " ZinMailWindowOverlay onLoad() : " + ex);
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

			if (this.m_timeoutID)
			{
				this.m_logger.debug("cancelling timer...");
				window.clearTimeout(this.m_timeoutID);
			}

			if (this.m_timer_functor)
			{
				this.m_logger.debug("cancelling sync...");
				this.m_timer_functor.cancel();
			}

			this.m_logger_no_prefix.info("shutdown: " + APP_NAME + " " + APP_VERSION_NUMBER + " " + getFriendlyTimeString());
		}
	}
	catch (ex)
	{
		zinAlert('msg.alert.title', APP_NAME + " ZinMailWindowOverlay onUnLoad() : " + ex);
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

	context.m_logger_no_prefix.info("sync next:   " + getFriendlyTimeString(delay));
}

ZinMailWindowOverlay.prototype.statusSummary = function()
{
	var last_sync_date = null;
	var zfiStatus      = StatusPanel.getZfi();
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

// migrate the zindus.blah preferences
//
ZinMailWindowOverlay.prototype.migratePrefs = function()
{
	var old, value;
	var prefs = preferences();

	// delete once confident all users are on version >= 0.6.13
	// 
	var a_map = {
		"general.verboselogging":        { type: 'char', new: "general." + PrefSet.GENERAL_VERBOSE_LOGGING     },
		"general.verbose_logging":       { type: 'char', new: "general." + PrefSet.GENERAL_VERBOSE_LOGGING     },
		"general.gdsyncwith":            { type: 'char', new: "general." + PrefSet.GENERAL_GD_SYNC_WITH        },
		"general.SyncGalEnabled":        { type: 'char', new: "general." + PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED },
		"system.logfileSizeMax":         { type: 'int',  new: MozillaPreferences.AS_LOGFILE_MAX_SIZE           },
		"system.timerDelayOnStart":      { type: 'int',  new: MozillaPreferences.AS_TIMER_DELAY_ON_START       },
		"system.timerDelayOnRepeat":     { type: 'int',  new: MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT      },
		"system.SyncGalMdInterval":      { type: 'int',  new: MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL       },
		"system.SyncGalEnabledRecheck":  { type: 'int',  new: MozillaPreferences.ZM_SYNC_GAL_RECHECK           },
		"system.SyncGalEnabledIfFewer":  { type: 'char', new: MozillaPreferences.ZM_SYNC_GAL_IF_FEWER          },
		"system.preferSchemeForSoapUrl": { type: 'char', new: MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME      }
		};

	this.m_logger.debug("migrate old prefs... ");

	migratePrefName(a_map);

	// replace MANUAL_SYNC_ONLY with AUTO_SYNC
	//
	var bimap = new BiMap( [ "true", "false" ], [ "false", "true" ] );

	var new_key = "general." + PrefSet.GENERAL_AUTO_SYNC;

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
		"server.2.type":        { type: 'char', new: PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_FORMAT     },
		"server.2.url":         { type: 'char', new: PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_URL        },
		"server.2.username":    { type: 'char', new: PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_USERNAME   },
	};

	migratePrefName(a_map);

	bimap = new BiMap( [ "google", "zimbra" ], [ Account.Google, Account.Zimbra ] );

	migratePrefValue([ PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_FORMAT ], bimap);

	if ( prefs.getCharPrefOrNull(prefs.branch(), PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_URL) &&
	    !prefs.getCharPrefOrNull(prefs.branch(), PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_FORMAT))
	{
		this.m_logger.debug("account 2 had a url but no format - this account must have been created in version 0.6.19 or earlier when all accounts were assumed zimbra - set format to zimbra explicitly now..."); // issue #106
		prefs.setCharPref(prefs.branch(), PrefSet.ACCOUNT + ".2." + PrefSet.ACCOUNT_FORMAT, Account.Zimbra );
	}
}
