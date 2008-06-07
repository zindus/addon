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

function ObserverService()
{
}

ObserverService.service = function()
{
	return Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
}

ObserverService.isRegistered = function(topic)
{
	var os = ObserverService.service();
	var enumerator = os.enumerateObservers(topic);
	var count = 0;

	while (enumerator.hasMoreElements())
	{
		try {
			var o = enumerator.getNext().QueryInterface(Components.interfaces.nsIObserver);

			// dump("observerServiceIsRegistered: blah: o: " + aToString(o) + "\n");

			count++;
		}
		catch (e) {
			alert("exception while enumerating: e: " + e);
		}
	}

	return count > 0;
}

ObserverService.notify = function(topic, subject, data)
{
	// dump("ObserverService.notify: data: " + data);

	ObserverService.service().notifyObservers(subject, topic, data);
}

ObserverService.register = function(obj, topic)
{
	ZinLoggerFactory.instance().logger().debug("ObserverService.register: " + topic);

	ObserverService.service().addObserver(obj, topic, false);
}

ObserverService.unregister = function(obj, topic)
{
	ZinLoggerFactory.instance().logger().debug("ObserverService.unregister: " + topic);

	ObserverService.service().removeObserver(obj, topic);
}

