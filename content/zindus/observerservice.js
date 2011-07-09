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

var ObserverService = {
	TOPIC_PREFERENCE_CHANGE : "ZindusPreferenceChange",
	service : function() {
		return Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	},
	isRegistered : function(topic) {
		var enumerator = this.service().enumerateObservers(topic);
		var count      = 0;

		while (enumerator.hasMoreElements()) {
			try {
				let o = enumerator.getNext().QueryInterface(Ci.nsIObserver);
				// dump("observerServiceIsRegistered: o: " + aToString(o) + "\n");
				count++;
			}
			catch (e) {
				zinAlert('text.alert.title', "exception while enumerating: e: " + e);
			}
		}

		return count > 0;
	},
	notify : function(topic, subject, data) {
		this.service().notifyObservers(subject, topic, data);
	},
	register : function(obj, topic) {
		logger().debug("ObserverService.register: " + topic);
		this.service().addObserver(obj, topic, false);
	},
	unregister : function(obj, topic) {
		logger().debug("ObserverService.unregister: " + topic);
		this.service().removeObserver(obj, topic);
	}
};
