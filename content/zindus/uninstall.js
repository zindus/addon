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
// $Id: uninstall.js,v 1.1 2010-04-30 00:41:38 cvsuser Exp $

var UnInstall = {
	uninstallObserver : {
		observe: function(aSubject, aTopic, aData) {
			const uuid = "{ad7d8a66-253b-11dc-977c-000c29a3126e}";

			try {
				let item = aSubject.QueryInterface(Ci.nsIUpdateItem);

				if (item.id == uuid && aData == "item-uninstalled") {
					// gBrowser.selectedTab = gBrowser.addTab(url-goes-here);
					preferences().deleteBranch(preferences().branch());
				}
			} catch (e) {
			}
		}
	},
	addObserver : function() {
		ObserverService.service().addObserver(this.uninstallObserver, "em-action-requested", false);
	}
};
