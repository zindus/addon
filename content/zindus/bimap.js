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

function BiMap(array_a, array_b)
{
	zinAssert(typeof(array_a) == 'object' && typeof(array_b) == 'object');

	this.m_array_a = array_a;
	this.m_array_b = array_b;

	this.m_a = new Object();
	this.m_b = new Object();

	zinAssert(array_a.length == array_b.length);

	for (var i = 0; i < array_a.length; i++)
	{
		zinAssert(typeof(array_a[i]) == 'string' || typeof(array_a[i]) == 'number');
		zinAssert(typeof(array_b[i]) == 'string' || typeof(array_b[i]) == 'number');
		zinAssert(!isPropertyPresent(this.m_a, array_a[i]));  // no duplicates allowed in either array
		zinAssert(!isPropertyPresent(this.m_b, array_b[i]));

		this.m_a[array_a[i]] = array_b[i];
		this.m_b[array_b[i]] = array_a[i];
	}
}

BiMap.prototype.getObjAndKey = function(key_a, key_b)
{
	var c = 0;
	c += (key_a == null) ? 0 : 1;
	c += (key_b == null) ? 0 : 1;
	zinAssertAndLog(c == 1, "key_a: " + key_a + " key_b: " + key_b + " " + this.toString()); // exactly one of the keys must be non-null

	var obj, key;

	if (key_a != null)
	{
		obj = this.m_a;
		key = key_a;
	}
	else
	{
		obj = this.m_b;
		key = key_b;
	}

	// this used to return [ obj, key ] but that didn't prove to be portable
	// (some linux javascript interpreters (JavaScript-C 1.6 pre-release 1 2006-04-04  report an error with this sort of assigment:
	// [ a, b ] = blah();
	//
	var ret = new Object();
	ret.obj = obj;
	ret.key = key;
	return ret;
}

BiMap.prototype.lookup = function(key_a, key_b)
{
	var tmp = this.getObjAndKey(key_a, key_b);

	zinAssert(isPropertyPresent(tmp.obj, tmp.key));

	return tmp.obj[tmp.key];
}

BiMap.prototype.isPresent = function(key_a, key_b)
{
	var tmp = this.getObjAndKey(key_a, key_b);

	return isPropertyPresent(tmp.obj, tmp.key);
}

BiMap.prototype.toString = function()
{
	var ret = "";
	var isFirst = true;

	for (i in this.m_a)
	{
		if (isFirst)
			isFirst = false;
		else
			ret += ", ";

		ret += i + ": " + this.m_a[i];
	}

	return ret;
}
