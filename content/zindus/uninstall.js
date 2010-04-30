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
// $Id: uninstall.js,v 1.2 2010-04-30 01:29:49 cvsuser Exp $

var UnInstall = {
	uninstallObserver : {
		observe: function(aSubject, aTopic, aData) {
			const uuid = "{ad7d8a66-253b-11dc-977c-000c29a3126e}";

			try {
				let item = aSubject.QueryInterface(Ci.nsIUpdateItem);

				if (item.id == uuid && aData == "item-uninstalled") {
					// gBrowser.selectedTab = gBrowser.addTab(url-goes-here);

					let accounts = AccountStatic.arrayLoadFromPrefset();
					let pm = PasswordManager.new();
					let i;

					for (i = 0; i < accounts.length; i++) {
						accounts[i].passwordlocator.delPassword();

						logger().debug("uninstall: removed password for url: " + accounts[i].url + " username: " + accounts[i].username);

						if (accounts[i].format_xx() == FORMAT_GD) {
							let pl = new PasswordLocator(accounts[i].passwordlocator);
							pl.url(eGoogleLoginUrl.kAuthToken);
							pl.delPassword();
							logger().debug("uninstall: removed authtoken for username: " + accounts[i].username);
						}
					}

					logger().debug("uninstall: about to delete preferences");

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
