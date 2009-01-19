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

function ConfigGd()
{
	this.m_prefset_gd = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_GD_PROPERTIES);

	this.m_bimap = new Object();
	this.m_bimap['postal']    = new BiMap( [ "true",                "false"                 ], 
	                                       [ "cgd-postal-true",     "cgd-postal-false"      ] );
	this.m_bimap['conflict']  = new BiMap( [ "ask-me",              "dont-ask"              ], 
	                                       [ "cgd-conflict-ask-me", "cgd-conflict-dont-ask" ] );

	this.m_map = {
		0: { group: "cgd-postal",   bimap: 'postal',    prefset_key: PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS, default: "cgd-postal-false" },
		1: { group: "cgd-conflict", bimap: 'conflict',  prefset_key: PrefSet.GENERAL_GD_RULE_DONT_ASK,       default: "ask-me"         } };
}

ConfigGd.prototype.onLoad = function(target)
{
	this.m_prefset_gd.load();

	this.initialiseView();
}

ConfigGd.prototype.onAccept = function()
{
	var a = this.m_map;
	for (var k in a)
		ConfigSettings.setPrefsetFromRadio(a[k].group, this.m_bimap[a[k].bimap], this.m_prefset_gd, a[k].prefset_key);

	this.m_prefset_gd.save();
}

ConfigGd.prototype.initialiseView = function()
{
	xulSetHtml('cgd-more-information-on-postal', stringBundleString("gr.more.information", [
			    'http://www.zindus.com/blog/2008/06/17/thunderbird-google-postal-address-sync-part-two/' ]) );

	xulSetHtml('cgd-more-information-on-rules', stringBundleString("gr.more.information", [
			    'http://www.zindus.com/blog/2008/10/06/the-google-thunderbird-address-book-staying-in-sync' ]) );

	var a = this.m_map;
	for (var k in a)
		ConfigSettings.setRadioFromPrefset(a[k].group, this.m_bimap[a[k].bimap], this.m_prefset_gd, a[k].prefset_key, a[k].default);
}
