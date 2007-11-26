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

// Bits of "exit status" reported to the outside world:
// ZinMaestro.FSM_ID_TWOWAY:
// - last sync success: (time, maybe other stuff like conflicts...)
// - last sync:         (time, success/fail and optional failure reason)
//
// Other thoughts (not implemented)
// - ZinMaestro.FSM_ID_TWOWAY:   next sync: when scheduled - currently you have to grep the logfile to find out
// - ZinMaestro.FSM_ID_AUTHONLY: last auth: (time, success/fail and optional failure reason)
//

function StatusPanel()
{
}

// save SyncFsmExitStatus to zfcStatus
//
StatusPanel.save = function(es)
{
	var zfcStatus = new ZinFeedCollection();
	zfcStatus.filename(Filesystem.FILENAME_STATUS);
	var date = new Date().toLocaleString();
	var zfiStatus = new ZinFeedItem(null, ZinFeedItem.ATTR_ID, ZinFeedItem.ID_STATUS,
									  'date', date,
									  'exitstatus', es.m_exit_status,
									  'conflicts', es.m_count_conflicts,
									  'appversion', APP_VERSION_NUMBER );

	zfcStatus.set(zfiStatus);
	zfcStatus.save();
}

StatusPanel.getZfi = function()
{
	var zfcStatus = new ZinFeedCollection();
	var zfiStatus = null;

	zfcStatus.filename(Filesystem.FILENAME_STATUS);
	zfcStatus.load();

	if (zfcStatus.isPresent(ZinFeedItem.ID_STATUS))
		zfiStatus = zfcStatus.get(ZinFeedItem.ID_STATUS);

	return zfiStatus;
}

StatusPanel.update = function(zwc)
{
	var logger    = newZinLogger("StatusPanel");
	var zfiStatus = StatusPanel.getZfi();

	if (zfiStatus)
	{
		var exitstatus = zfiStatus.getOrNull('exitstatus');
		var conflicts  = zfiStatus.getOrNull('conflicts');
		var tooltip    = zfiStatus.getOrNull('date');
		var status     = null;
		var tooltip_prefix;

		if (exitstatus != 0)
		{
			status = "error"
			tooltip_prefix = stringBundleString("statusLastSyncFailed");
		}
		else if (conflicts > 0)
		{
			status = "alert";
			tooltip_prefix = stringBundleString("statusLastSync") + ": " + conflicts + " " + stringBundleString("statusLastSyncConflicts");
		}
		else
		{
			status = "insync";
			tooltip_prefix = stringBundleString("statusLastSync");
		}

		tooltip = tooltip_prefix + ": " + tooltip;
	}
	else
	{
		status = "alert";
		tooltip = stringBundleString("statusLastSyncNever");
	}

	logger.debug("update: status: " + status + " tooltip: " + tooltip);

	var obj = { alert : '!', error : 'X', insync : 'Y' };

	if (arguments.length == 0)
	{
		zwc = new ZinWindowCollection(SHOW_STATUS_PANEL_IN);
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
