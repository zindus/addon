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
 * Portions created by Initial Developer are Copyright (C) 2007-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Leni Mayo
 *
 * ***** END LICENSE BLOCK *****/

with (ZindusScopeRegistry.getScope())
{
	ZindusScopeRegistry.includejs("const.js");
	ZindusScopeRegistry.includejs("util.js");
	ZindusScopeRegistry.includejs("bimap.js");
	ZindusScopeRegistry.includejs("enum.js");
	ZindusScopeRegistry.includejs("mozillapreferences.js");
	ZindusScopeRegistry.includejs("filesystem.js");
	ZindusScopeRegistry.includejs("passwordmanager.js");
	ZindusScopeRegistry.includejs("prefset.js");
	ZindusScopeRegistry.includejs("logger.js");
	ZindusScopeRegistry.includejs("singleton.js");
	ZindusScopeRegistry.includejs("windowcollection.js");
	ZindusScopeRegistry.includejs("statusbar.js");
	ZindusScopeRegistry.includejs("bigstring.js");
	ZindusScopeRegistry.includejs("account.js");
	ZindusScopeRegistry.includejs("maestro.js");
	ZindusScopeRegistry.includejs("syncfsm.js");
	ZindusScopeRegistry.includejs("syncfsmexitstatus.js");
	ZindusScopeRegistry.includejs("syncfsmchaindata.js");
	ZindusScopeRegistry.includejs("syncfsmobserver.js");
	ZindusScopeRegistry.includejs("observerservice.js");
	ZindusScopeRegistry.includejs("timer.js");
	ZindusScopeRegistry.includejs("configsettings.js");
	ZindusScopeRegistry.includejs("googlerule.js");
	ZindusScopeRegistry.includejs("userprompt.js");
	ZindusScopeRegistry.includejs("appinfo.js");
}
