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

function PrefsMsg()
{
	this.m_payload         = null;
}

PrefsMsg.prototype.onLoad = function(target)
{
	this.m_payload = window.arguments[0];

	var html = convertCER(String(this.m_payload.m_args.msg), CER_TO_ENTITY);

	html = html.replace(/\n/mg, "<br/>");
	html = html.replace(/ ( )/mg, " &#160;");
	html += stringBundleString("statusFailOnGdSeeFaq").replace("%fail_code%", this.m_payload.m_args.fail_code);

	// <noscript> is used here because it's a structural html element that can contain other elements
	//
	var el = document.createElementNS("http://www.w3.org/1999/xhtml", "noscript");

	el.innerHTML = html;

	document.getElementById("zindus-prefs-msg-description").appendChild(el);
}
