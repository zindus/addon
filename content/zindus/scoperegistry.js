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

// See: http://weblogs.mozillazine.org/weirdal/archives/008101.html

const ZindusScopeRegistry = {
	m_default_scope : 'fred',
	m_subscript_loader: Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader),
	m_a_registered_scopes: {},
	getScope: function (scope_id) {
		if (!scope_id)
			scope_id = this.m_default_scope;

		if (typeof this.m_a_registered_scopes[scope_id] == "undefined")
			this.m_a_registered_scopes[scope_id] = {};

		return this.m_a_registered_scopes[scope_id];
	},
	includejs: function (url, scope_id) {
		url = 'chrome://zindus/content/' + url;
		this.include(url, scope_id);
	},
	include: function (url, scope_id) {
		if (!scope_id)
			scope_id = this.m_default_scope;

		if (scope_id != "none") {
			var scope_obj = this.getScope(scope_id);
			this.m_subscript_loader.loadSubScript(url, scope_obj);
		} else {
			this.m_subscript_loader.loadSubScript(url);
		}
	}
};
