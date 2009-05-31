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
// $Id: windowcollection.js,v 1.15 2009-05-31 22:56:38 cvsuser Exp $

function WindowCollection(a_id)
{
	this.m_h_a = new Object();

	for (var i = 0; i < a_id.length; i++)
		this.m_h_a[a_id[i]] = new Array();
}

WindowCollection.prototype.length = function(id)
{
	zinAssertAndLog(isPropertyPresent(this.m_h_a, id), id);

	return this.m_h_a[id].length;
}

WindowCollection.prototype.forEach = function(functor)
{
	zinAssert(typeof(functor.run) == "function");

	for (var id in this.m_h_a)
		for (var i = 0; i < this.m_h_a[id].length; i++)
		{
			var win = this.m_h_a[id][i];

			if (!win.closed)
				functor.run(win);
		}
}

// This routine is about trying to work out which windows to hide/unhide a statuspanel and update a progresspanel
// Input:  an associative array where each key is a window id
// Output: updates the associative array in place.  Each value is an array of windows where the window contains the id given in the key
// eg. lets say thunderbird has two messengerWindow's open, one showing Inbox, the other showing Sent
//     input:  h['folderPaneBox']
//     output: h['folderPaneBox'] = [ window-object-of-inbox, window-object-of-sent ]
// 
// Good background reading:
//   http://developer.mozilla.org/en/docs/Working_with_windows_in_chrome_code
// which links to this page, which offers the code snippet below:
//   http://developer.mozilla.org/en/docs/nsIWindowMediator
//
WindowCollection.prototype.populate = function()
{
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);

	var windowtype = "";
	var enumerator = wm.getEnumerator(windowtype);

	while (enumerator.hasMoreElements())
	{
		var win = enumerator.getNext(); // win is [Object ChromeWindow] (just like window)

		for (var id in this.m_h_a)
			if (!win.closed && win.document.getElementById(id))
			{
				// logger().debug("found a window with id: " + id + (win.document.title ? win.document.title : "no title"));
				this.m_h_a[id].push(win);
				break;
			}
			else
				; // logger().debug("id: " + id + " not present in window title: " + (win.document.title ? win.document.title : "no title") + " id: " + (win.id ? win.id : "no id"));
	}
}
