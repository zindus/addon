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

// lso == Last Sync Object
//

function Lso(arg)
{
	var i;
	this.m_properties = new Object();

	for (i = 0; i < Lso.aPartsAll.length; i++)
		this.m_properties[Lso.aPartsAll[i]] = "";

	switch (typeof(arg))
	{
		case 'object': // populate properties from the (ms, md etc) attributes of a zfi object
			var zfi = arg;
			for (i = 0; i < Lso.aPartsZfi.length; i++)
				if (zfi.isPresent(Lso.aPartsZfi[i]))	
					this.m_properties[Lso.aPartsZfi[i]] = zfi.get(Lso.aPartsZfi[i]);
			break;
		case 'string': // populate properties from a ZinFeedItem.ATTR_LS string
			var a = arg.split("-");
			zinAssert(a.length == Lso.aPartsAll.length);
			for (i = 0; i < Lso.aPartsAll.length; i++)
				if (a[i].length > 0)
					this.m_properties[Lso.aPartsAll[i]] = a[i];
			break;
		default:
			zinAssert(false);
	}
}

Lso.aPartsZfi = [ ZinFeedItem.ATTR_MS, ZinFeedItem.ATTR_MD, ZinFeedItem.ATTR_DEL ];
Lso.aPartsAll = [ ZinFeedItem.ATTR_VER ].concat(Lso.aPartsZfi);

Lso.normalise = function(zfi, attr)
{
	return zfi.isPresent(attr) ? zfi.get(attr) : "";
}

Lso.prototype.toString = function()
{
	var ret = "";
	var isFirst = true;

	for (var i = 0; i < Lso.aPartsAll.length; i++)
		if (isFirst)
		{
			ret += this.m_properties[Lso.aPartsAll[i]];
			isFirst = false;
		}
		else
			ret += "-" + this.m_properties[Lso.aPartsAll[i]];

	return ret;
}

// returns 0 ==> the properties in this object match the corresponding properties in the zfi.
// returns 1 ==> the properties in the zfi suggest that it's newer than the properties in this object.
//  By "suggest", we mean:
//	* the ms attribute is greater than the ms part of the ls attribute or
//	* the md attribute is greater than the md part of the ls attribute or
//	* the ms and md attributes equal the corresponding parts of the ls attribute and 
//    the DEL attribute is different from the DEL part of the ls attribute 
// returns -1 otherwise
//
Lso.prototype.compare = function(zfi)
{
	var ret;
	var isExactMatch = true;
	var isGreaterThan = null;
	var aParts = Lso.aPartsZfi;

	for (i = 0; i < aParts.length && isExactMatch; i++)
	{
		// logger.debug("blah: Lso.[i]: " + aParts[i] + " lhs: " + Lso.normalise(zfi, aParts[i]) + " rhs: " + this.m_properties[aParts[i]]);

		isExactMatch = (Lso.normalise(zfi, aParts[i]) == this.m_properties[aParts[i]]);
	}

	if (!isExactMatch)
		isGreaterThan = (Lso.normalise(zfi, ZinFeedItem.ATTR_MS) > this.m_properties[ZinFeedItem.ATTR_MS]) ||
		                (Lso.normalise(zfi, ZinFeedItem.ATTR_MD) > this.m_properties[ZinFeedItem.ATTR_MD]) ||
		                ( 
							(Lso.normalise(zfi, ZinFeedItem.ATTR_MD) == this.m_properties[ZinFeedItem.ATTR_MD]) &&
		                  	(Lso.normalise(zfi, ZinFeedItem.ATTR_MS) == this.m_properties[ZinFeedItem.ATTR_MS]) &&
				  			(Lso.normalise(zfi, ZinFeedItem.ATTR_DEL) != this.m_properties[ZinFeedItem.ATTR_DEL])
						);

	if (isExactMatch)
		ret = 0;
	else if (isGreaterThan)
		ret = 1;
	else
		ret = -1;

	return ret;
}

Lso.prototype.get = function(key)
{
	zinAssert(isPropertyPresent(this.m_properties, key) && this.m_properties[key] != null);

	return this.m_properties[key];
}

Lso.prototype.set = function(key, value)
{
	zinAssert(isPropertyPresent(this.m_properties, key));

	this.m_properties[key] = value;
}
