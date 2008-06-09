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

// 1 arg:  ==> construct a Zuio given a key
// 2 args: ==> construct a Zuio given (key, zid)
//
function Zuio()
{
	if (arguments.length == 1)
		this.setFromKey(arguments[0]);
	else if (arguments.length == 2)
		this.setFromPair(arguments[0], arguments[1]);
	else
		ZinUtil.assert(false);
}

Zuio.prototype.toString = function()
{
	return  "(" + this.id + " " + this.zid + ")";
}

Zuio.prototype.key = function()
{
	return Zuio.key(this.id, this.zid);
}

Zuio.key = function(id, zid)
{
	ZinUtil.assertAndLog(id, "id: " + id);

	var ret = id + "";
	
	if (zid && zid.length > 0 && zid != "null") // the != "null" caters for when zid is used a key to a hash - for x[null] the key is "null"
		ret += "#" + zid;

	return ret;
}

Zuio.prototype.setFromPair = function(id, zid)
{
	ZinUtil.assert(id);

	this.id  = id;
	this.zid = zid;
}

Zuio.prototype.setFromKey = function(key)
{
	var key_as_string = String(key);

	ZinUtil.assertAndLog(key && key_as_string.length > 0, "key: " + key);

	var a = key_as_string.split("#");

	if (a.length == 1)
		this.setFromPair(a[0], null);
	else if (a.length == 2)
		this.setFromPair(a[0], a[1]);
	else 
		ZinUtil.assert(false);
}
