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

// Bits of "exit status" reported to the outside world:
// - last sync success: (time, maybe other stuff like conflicts...)
// - last sync:         (time, success/fail and optional failure reason)
//
// Other thoughts (not implemented)
// - TWOWAY:   next sync: when scheduled - currently you have to grep the logfile to find out
// - AUTHONLY: last auth: (time, success/fail and optional failure reason)
//

function StatusPanel()
{
}

// save SyncFsmExitStatus to zfcStatus
//
StatusPanel.save = function(es)
{
	var zfcStatus = StatusPanel.getZfc();
	var now       = new Date();
	var zfiStatus = new FeedItem(null, FeedItem.ATTR_KEY, FeedItem.KEY_STATUSPANEL,
									  'date', now.getTime(), // used to use stringified dates here but it turns out they're not portable
									  'exitstatus', es.m_exit_status,
									  'conflicts', es.m_count_conflicts,
									  'appversion', APP_VERSION_NUMBER );

	zfcStatus.set(zfiStatus);
	zfcStatus.save();
}

StatusPanel.getZfc = function()
{
	var ret = new FeedCollection();
	ret.filename(Filesystem.FILENAME_STATUS);

	return ret;
}

StatusPanel.getZfi = function()
{
	var zfcStatus = StatusPanel.getZfc();
	var zfiStatus = null;

	zfcStatus.load();

	if (zfcStatus.isPresent(FeedItem.KEY_STATUSPANEL))
		zfiStatus = zfcStatus.get(FeedItem.KEY_STATUSPANEL);

	return zfiStatus;
}

StatusPanel.update = function(zwc)
{
	var logger    = newLogger("StatusPanel");
	var zfiStatus = StatusPanel.getZfi();

	if (zfiStatus)
	{
		var exitstatus = zfiStatus.getOrNull('exitstatus');
		var conflicts  = zfiStatus.getOrNull('conflicts');
		var status     = null;
		var tooltip, tooltip_prefix;

		var last_sync_date = new Date();
		last_sync_date.setTime(zfiStatus.getOrNull('date'));
		tooltip = last_sync_date.toLocaleString();

		if (exitstatus != 0)
		{
			status = "error"
			tooltip_prefix = stringBundleString("sp.last.sync.failed");
		}
		else if (conflicts > 0)
		{
			status = "alert";
			tooltip_prefix = stringBundleString("sp.last.sync") + ": " + conflicts + " " +
			                 stringBundleString("sp.last.sync.conflicts");
		}
		else
		{
			status = "insync";
			tooltip_prefix = stringBundleString("sp.last.sync");
		}

		tooltip = tooltip_prefix + ": " + tooltip;
	}
	else
	{
		status = "alert";
		tooltip = stringBundleString("sp.last.sync.never");
	}

	var obj = { alert : '!', error : 'X', insync : 'Y' };

	logger.debug("update: status: " + obj[status] + " (" + status + ") tooltip: " + tooltip);

	if (arguments.length == 0)
	{
		zwc = new WindowCollection(SHOW_STATUS_PANEL_IN);
		zwc.populate();
	}

	var functor = {
		run: function(win) {
			for (var x in obj)
			{
				win.document.getElementById("zindus-statuspanel-" + x).hidden = (status != x);
				win.document.getElementById("zindus-statuspanel-" + x).value  = obj[x];
			}

			win.document.getElementById("zindus-statuspanel").tooltipText = tooltip;
			win.document.getElementById("zindus-statuspanel").hidden = false;
		}
	};

	zwc.forEach(functor);
}
