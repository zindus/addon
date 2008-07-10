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

function ConfigGd()
{
	this.m_payload         = null;
	this.m_prefset_general = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_PROPERTIES);

	this.m_gd_sync_postal_address_bimap = new BiMap( [ "true",                       "false"                       ], 
	                                                 [ "zindus-cgd-postal-true", "zindus-cgd-postal-false" ] );
}

ConfigGd.prototype.onLoad = function(target)
{
	this.m_payload = window.arguments[0];

	this.m_prefset_general.setProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS, 
		this.m_payload.m_args.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS));

	this.initialiseView();
	this.updateView();
}

ConfigGd.prototype.onCancel = function()
{
}

ConfigGd.prototype.onAccept = function()
{
	this.m_payload.m_args.setProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS,
	        this.m_prefset_general.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS));
}

ConfigGd.prototype.initialiseView = function()
{
	ConfigSettings.setRadioFromPrefset("zindus-cgd-postal-radiogroup", this.m_gd_sync_postal_address_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS, "zindus-cgd-postal-false")
}

ConfigGd.prototype.onCommand = function(id_target)
{
	switch (id_target)
	{
		case "zindus-cgd-postal-true":
		case "zindus-cgd-postal-false":
			this.updateView();
			break;
	}
}

ConfigGd.prototype.updateView = function()
{
	ConfigSettings.setPrefsetFromRadio("zindus-cgd-postal-radiogroup", this.m_gd_sync_postal_address_bimap,
	                          this.m_prefset_general, PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS);

	ConfigSettings.setAttribute('hidden', !(this.m_prefset_general.getProperty(PrefSet.GENERAL_GD_SYNC_POSTAL_ADDRESS) == "true"),
	                                      "zindus-prefs-gd-sync-postal-example");
}

