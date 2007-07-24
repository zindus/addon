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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
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
	zinAssert(c == 1); // exactly one of the keys must be non-null

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

	return [ obj, key ];
}

BiMap.prototype.lookup = function(key_a, key_b)
{
	var obj, key;

	[ obj, key ] = this.getObjAndKey(key_a, key_b);

	zinAssert(isPropertyPresent(obj, key));

	return obj[key];
}

BiMap.prototype.isPresent = function(key_a, key_b)
{
	var ret;

	[ obj, key ] = this.getObjAndKey(key_a, key_b);

	return isPropertyPresent(obj, key);
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
