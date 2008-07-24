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

function ConfigMsg()
{
	this.m_payload         = null;
}

ConfigMsg.prototype.onLoad = function(target)
{
	this.m_payload = window.arguments[0];

	var html = convertCER(String(this.m_payload.m_args.msg), CER_TO_ENTITY);

	html = html.replace(/\n/mg, "<br/>");
	html = html.replace(/ ( )/mg, " &#160;");
	html += stringBundleString("status.failmsg.gd.see.faq", [ this.fail_code_to_string(this.m_payload.m_args.fail_code ) ] );

	// <noscript> is used here because it's a structural html element that can contain other elements
	//
	var el = document.createElementNS(Xpath.NS_XHTML, "noscript");

	el.innerHTML = html;

	dId("zindus-cm-description").appendChild(el);
}

// The reason the url is added here in the window as opposed to being part of the detail of the error message
// is that the error message is passed through convertCER (which changes < to an entity) whereas we want the url to be clickable.
// The issue is that error messages are plain text, whereas here we are displaying html.
//
ConfigMsg.prototype.fail_code_to_string = function(fail_code)
{
	var url;

	if (isInArray(fail_code, [ 'failon.gd.conflict1', 'failon.gd.conflict2', 'failon.gd.empty.contact' ]))
	{
		url = "http://www.zindus.com/faq-thunderbird-google/";
		ret = '<a href="' + url + '#' + fail_code + '">' + url + '</a>';
	}
	else if (isInArray(fail_code, [ 'failon.gd.conflict3' ]))
	{
		url = "http://www.zindus.com/faq-thunderbird/#toc-reporting-bugs";
		ret = '<a href="' + url + '">' + url + '</a>';
	}
	else
		zinAssertAndLog(false, "mismatched case: fail_code: " + fail_code);

	return ret;
}
