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

include("chrome://zindus/content/maestro.js");
include("chrome://zindus/content/timer.js");

window.addEventListener("load", onLoad, false);
window.addEventListener("unload", onUnLoad, false);

function onLoad(event)
{
	try
	{
		var logger = newZinLogger("thunderbirdoverlay");

		logger.info("startup: " + APP_NAME + " " + APP_VERSION_NUMBER + " " + getUTCAndLocalTime());

		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			logger.debug("in messengerWindow");

			Filesystem.createDirectoriesIfRequired();

			window.wd = new Object();

			var prefs = new MozillaPreferences();

			if (prefs.getCharPrefOrNull(prefs.branch(), "general.manualsynconly") != "true")
			{
				window.wd.delay_on_repeat = parseInt(prefs.getIntPref(prefs.branch(), "system.timerDelayOnRepeat"));
				logger.debug("delay_on_repeat: " + window.wd.delay_on_repeat);

				var x = timerDueDate();
				var delay;

				window.wd.last_sync_date = x['last_sync_date'];

				if (x['next_sync_date'].toString() == x['now'].toString())
					delay = randomPlusOrMinus(450, 150);  // somewhere between 5 and 10 minutes // TODO seconds to milliseconds
				else 
					delay = (x['next_sync_date'] - x['now']);

				window.wd.timeoutID = window.setTimeout(onTimerFire, delay);

				logger.info("sync next:   " + getUTCAndLocalTime(delay));
			}
			else
				logger.debug("manual sync only - not starting timer.");

			StatusPanel.update(window);
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " thunderbirdoverlay onLoad() : " + ex);
	}
}

function zindusPrefsDialog()
{
	window.openDialog("chrome://zindus/content/prefsdialog.xul", "_blank", "chrome,modal,centerscreen");

	return true;
}

function onUnLoad(event)
{
	var logger = newZinLogger("thunderbirdoverlay");

	try
	{
		var messengerWindow = document.getElementById("messengerWindow");

		if (messengerWindow)
		{
			logger.debug("in messengerWindow - about to unload");

			if (ObserverService.isRegistered(ZinMaestro.TOPIC) && isPropertyPresent(window.wd, "maestro"))
			{
				logger.debug("unregistering observer");
				ObserverService.unregister(window.wd.maestro, ZinMaestro.TOPIC);
			}
			else
				logger.debug("ObserverService isn't registered so don't unregister.");

			if (isPropertyPresent(window.wd, "timeoutID"))
			{
				logger.debug("cancelling timer");
				window.wd.functor.cancel();
				window.clearTimeout(window.wd.timeoutID);
			}
		}
	}
	catch (ex)
	{
		alert(APP_NAME + " thunderbirdoverlay onUnLoad() : " + ex);
	}
}

function onTimerFire()
{
	var logger = newZinLogger("onTimerFire");
	logger.debug("entering onTimerFire...");

	var x = timerDueDate();

	if (window.wd.last_sync_date.toString() == x['last_sync_date'].toString())
	{
		if (!ObserverService.isRegistered(ZinMaestro.TOPIC))
		{
			window.wd.maestro = new ZinMaestro();

			ObserverService.register(window.wd.maestro, ZinMaestro.TOPIC);
		}
		else
			logger.debug("ObserverService is already registered so don't reregister.");

		logger.debug("about to call functor...");

		window.wd.functor = new ZinTimerFunctorSync(hyphenate('-', ZinMaestro.ID_FUNCTOR_TIMER_OVERLAY, Date.parse(new Date(Date.now()))));

		window.wd.functor.run();
	}
	else
	{
		logger.debug("last_sync_date changed since timer was set - resetting timer");

		var delay = x['next_sync_date'] - x['now'];

		window.wd.last_sync_date = x['last_sync_date'];

		window.wd.timeoutID = window.setTimeout(onTimerFire, delay);

		logger.info("sync next:   " + getUTCAndLocalTime(delay));
	}
}

function timerDueDate()
{
	var last_sync_date = null;
	var zfiStatus      = StatusPanel.getZfi();
	var now            = new Date(Date.now());
	var next_sync_date = now;
	var logger = newZinLogger("onTimerFire");

	if (zfiStatus)
	{
		last_sync_date = new Date(zfiStatus.getOrNull('date'));

		logger.debug("last_sync_date in milliseconds: " + Date.parse(last_sync_date));
	}

	if (last_sync_date)
	{
		if (Date.parse(last_sync_date) > Date.parse(now)) // something wierd happened with time - last_sync_date is in the future!
		{
			next_sync_date = now;

			logger.debug("something wierd happened with time - last_sync_date is in the future.  next_sync_date: " + next_sync_date);
		}
		else 
		{
			next_sync_date = new Date(Date.parse(last_sync_date) +
			                   1000 * randomPlusOrMinus(window.wd.delay_on_repeat, (1/6 * window.wd.delay_on_repeat).toFixed(0)));

			if (Date.parse(now) > Date.parse(next_sync_date))
			{
				next_sync_date = now;
				logger.debug("next sync is overdue, setting to now.  next_sync_date: " + next_sync_date);
			}
			else
				logger.debug("next sync being set to last sync plus delay.  next_sync_date: " + next_sync_date);
		}
	}
	else
	{
		next_sync_date = now;
		logger.debug("last sync date unavailable, next sync being set to now.  next_sync_date: " + next_sync_date);
	}

	var ret = newObject("now", now, "next_sync_date", next_sync_date, "last_sync_date", last_sync_date);

	newZinLogger().debug("timerDueDate returns: " + "\n" +
	                     " now:            " + ret['now'] + "\n" +
						 " last_sync_date: " + last_sync_date + "\n" +
						 " next_sync_date: " + next_sync_date );

	return ret;
}
