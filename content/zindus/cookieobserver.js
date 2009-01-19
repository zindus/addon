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
 * Portions created by Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

function CookieObserver(host)
{
	this.m_host   = host;
	this.m_cookie = null;
	this.m_topic  = "cookie-changed";
}

CookieObserver.prototype = {
	observe : function(subject, topic, data) {
    	if (topic == this.m_topic && (data == "added" || data == "changed")) {
			var nsICookie2 = subject.QueryInterface(Components.interfaces.nsICookie2);

			if (nsICookie2.host == this.m_host && nsICookie2.name == "ZM_AUTH_TOKEN")
				this.m_cookie = nsICookie2.value;
		}
	}
};
