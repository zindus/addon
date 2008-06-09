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

include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/timer.js");
include("chrome://zindus/content/removedatastore.js");

window.addEventListener("load", onLoad, false);
window.addEventListener("unload", onUnLoad, false);

function onLoad()
{ 
	window.zindus = new ZinMailWindowOverlay();
	window.zindus.onLoad();
}

function onUnLoad()
{
	window.zindus.onUnLoad();
}

function ZinMailWindowOverlay()
{
	this.m_logger           = ZinLoggerFactory.instance().newZinLogger("MailWindowOverlay");
	this.m_logger_no_prefix = ZinLoggerFactory.instance().newZinLogger("");
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
			this.m_logger_no_prefix.info("startup:  " + APP_NAME + " " + APP_VERSION_NUMBER + " " + ZinUtil.getFriendlyTimeString());

			this.migratePrefs();

			Filesystem.createDirectoriesIfRequired();

			RemoveDatastore.removeZfcsIfNecessary();

			var prefs = new MozillaPreferences();

			if (prefs.getCharPrefOrNull(prefs.branch(), "general." + PrefSet.GENERAL_AUTO_SYNC) != "false")
			{
				var delay_on_start     = parseInt(prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_START ));
				this.m_delay_on_repeat = parseInt(prefs.getIntPref(prefs.branch(), MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT ));

				var x = this.statusSummary();

				this.m_last_sync_date = x['last_sync_date'];

				var delay = 1000 * ZinUtil.randomPlusOrMinus(delay_on_start, (1/2 * delay_on_start).toFixed(0));

				this.m_logger.debug("onLoad: delay_on_start: " + delay_on_start + " actual delay (ms): " + delay);

				this.m_timeoutID = window.setTimeout(this.onTimerFire, delay, this);

				this.m_logger_no_prefix.info("sync next:   " + ZinUtil.getFriendlyTimeString(delay));
			}
			else
				this.m_logger.debug("manual sync only - not starting timer.");

			StatusPanel.update();
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " ZinMailWindowOverlay onLoad() : " + ex);
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
			var is_observerserver_registered = ObserverService.isRegistered(ZinMaestro.TOPIC);

			msg += "ObserverService: " + (is_observerserver_registered ? "registered" : "isn't registered");
			msg += " m_maestro: " + (this.m_maestro != null);

			if (ObserverService.isRegistered(ZinMaestro.TOPIC) && this.m_maestro)
			{
				ObserverService.unregister(this.m_maestro, ZinMaestro.TOPIC);
				msg += " ... deregistered";
			}
			else
			{
				msg += " ... do nothing";
			}

			this.m_logger.debug(msg);

			if (this.m_timeoutID)
			{
				this.m_logger.debug("cancelling sync and timer...");
				window.clearTimeout(this.m_timeoutID);
			}

			if (this.m_timer_functor)
				this.m_timer_functor.cancel();

			this.m_logger_no_prefix.info("shutdown: " + APP_NAME + " " + APP_VERSION_NUMBER + " " + ZinUtil.getFriendlyTimeString());
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " ZinMailWindowOverlay onUnLoad() : " + ex);
	}
}

ZinMailWindowOverlay.prototype.onTimerFire = function(context)
{
	context.m_logger.debug("entering onTimerFire...");
	context.m_timeoutID = null; // allows us to do sanity checking

	var x = context.statusSummary();

	if (context.m_last_sync_date == null || x['last_sync_date'] == null
	                                     || context.m_last_sync_date.toString() == x['last_sync_date'].toString())
	{
		if (!ObserverService.isRegistered(ZinMaestro.TOPIC))
		{
			context.m_maestro = new ZinMaestro();

			ObserverService.register(context.m_maestro, ZinMaestro.TOPIC);
		}
		else
			context.m_logger.debug("ObserverService is already registered so don't reregister.");

		var timer_id = ZinUtil.hyphenate('-', ZinMaestro.ID_FUNCTOR_MAILWINDOW_TIMER, Date.now());

		context.m_timer_functor = new ZinTimerFunctorSync(timer_id, context.scheduleTimer, context);

		context.m_timer_functor.run();
	}
	else
		context.scheduleTimer(context, x);
}

ZinMailWindowOverlay.prototype.scheduleTimer = function(context, x)
{
	ZinUtil.assert(arguments.length == 1 || arguments.length == 2);
	ZinUtil.assert(context.m_timeoutID == null); // ensures that we never have > 1 oustanding timer

	if (arguments.length == 1)
		x = context.statusSummary();

	var delay = x['next_sync_date'] - x['now'];

	context.m_last_sync_date = x['last_sync_date'];

	context.m_timeoutID = window.setTimeout(context.onTimerFire, delay, context);

	context.m_logger_no_prefix.info("sync next:   " + ZinUtil.getFriendlyTimeString(delay));
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
			                   1000 * ZinUtil.randomPlusOrMinus(this.m_delay_on_repeat, (1/6 * this.m_delay_on_repeat).toFixed(0)));

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

	var ret = ZinUtil.newObject("now", now, "next_sync_date", next_sync_date, "last_sync_date", last_sync_date);

	// this.m_logger.debug("statusSummary returns: " + "\n" + " now:            " + ret['now'] + "\n" +
	//                                                        " last_sync_date: " + last_sync_date + "\n" +
	//                                                        " next_sync_date: " + next_sync_date );

	return ret;
}

// migrate the zindus.blah preferences to the mozilla convention extensions.zindus.blah
// delete once confident all users are on version >= 0.6.13
//
ZinMailWindowOverlay.prototype.migratePrefs = function()
{
	var old, value;
	var prefs = new MozillaPreferences();

	var a_map = {
		"general.verboselogging":        { type: 'char', new: "general." + PrefSet.GENERAL_VERBOSE_LOGGING             }, 
		"general.verbose_logging":       { type: 'char', new: "general." + PrefSet.GENERAL_VERBOSE_LOGGING             },
		"general.gdsyncwith":            { type: 'char', new: "general." + PrefSet.GENERAL_GD_SYNC_WITH                },
		"general.SyncGalEnabled":        { type: 'char', new: "general." + PrefSet.GENERAL_ZM_SYNC_GAL_ENABLED         },
		"system.logfileSizeMax":         { type: 'int',  new: MozillaPreferences.AS_LOGFILE_MAX_SIZE      },
		"system.timerDelayOnStart":      { type: 'int',  new: MozillaPreferences.AS_TIMER_DELAY_ON_START  },
		"system.timerDelayOnRepeat":     { type: 'int',  new: MozillaPreferences.AS_TIMER_DELAY_ON_REPEAT },
		"system.SyncGalMdInterval":      { type: 'int',  new: MozillaPreferences.ZM_SYNC_GAL_MD_INTERVAL  },
		"system.SyncGalEnabledRecheck":  { type: 'int',  new: MozillaPreferences.ZM_SYNC_GAL_RECHECK      },
		"system.SyncGalEnabledIfFewer":  { type: 'char', new: MozillaPreferences.ZM_SYNC_GAL_IF_FEWER     },
		"system.preferSchemeForSoapUrl": { type: 'char', new: MozillaPreferences.ZM_PREFER_SOAPURL_SCHEME }
		};

	this.m_logger.debug("migrate old prefs... ");

	for (old in a_map)
	{
		if (a_map[old].type == 'char')
			value = prefs.getCharPrefOrNull(prefs.branch(), old);
		else
			value = prefs.getIntPrefOrNull(prefs.branch(), old);

		if (value != null)
		{
			if (a_map[old].type == 'char')
				prefs.branch().setCharPref(a_map[old].new, value);
			else
				prefs.branch().setIntPref(a_map[old].new, value);

			prefs.branch().deleteBranch(old);

			this.m_logger.debug("migrated pref: " + old + " to " + a_map[old].new + " value: " + value);
		}
	}

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
}


function zindusPrefsDialog()
{
	window.openDialog("chrome://zindus/content/prefsdialog.xul", "_blank", "chrome,modal,centerscreen");

	return true;
}
