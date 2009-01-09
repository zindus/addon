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

// zuio == Zimbra Uniquely Identified Object
//

function Zuio()
{
	this.m_id  = null;
	this.m_zid = null;

	if (arguments.length == 1)
		this.setFromKey(arguments[0]);
	else if (arguments.length == 2)
		this.setFromPair(arguments[0], arguments[1]);
	else
		zinAssert(false);
}

Zuio.prototype = {
toString : function() {
	return  "(" + this.m_id + " " + this.m_zid + ")";
},
key : function() {
	return Zuio.key(this.m_id, this.m_zid);
},
setFromPair : function(id, zid) {
	zinAssert(id);

	this.m_id  = id;
	this.m_zid = zid;
},
setFromKey : function(key) {
	var key_as_string = String(key);

	zinAssertAndLog(key && key_as_string.length > 0, "key: " + key);

	var a = key_as_string.split("#");

	if (a.length == 1)
		this.setFromPair(a[0], null);
	else if (a.length == 2)
		this.setFromPair(a[0], a[1]);
	else 
		zinAssert(false);
},
id : function() {
	return this.m_id;
},
zid : function() {
	return this.m_zid;
}
};

Zuio.key = function(id, zid)
{
	zinAssertAndLog(id, id);

	var ret = id + "";
	
	if (zid && zid.length > 0 && zid != "null") // the != "null" caters for when zid is used a key to a hash - for x[null] the key is "null"
		ret += "#" + zid;

	return ret;
}

