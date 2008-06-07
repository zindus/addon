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
			var a = arg.split("#");
			zinAssert(a.length == Lso.aPartsAll.length);
			for (i = 0; i < Lso.aPartsAll.length; i++)
				if (a[i].length > 0)
					this.m_properties[Lso.aPartsAll[i]] = a[i];
			break;
		default:
			zinAssert(false);
	}
}

Lso.aPartsZfi = [ ZinFeedItem.ATTR_CS, ZinFeedItem.ATTR_MS, ZinFeedItem.ATTR_REV, ZinFeedItem.ATTR_DEL ];
Lso.aPartsAll = [ ZinFeedItem.ATTR_VER ].concat(Lso.aPartsZfi);

// MS and REV drive  change detection for zm
// REV        drives change detection for gd
// CS         drives change detection for tb
//
Lso.prototype.compareFormat = function()
{
	var ret = null;

	if (this.m_properties[ZinFeedItem.ATTR_CS] != "")
		ret = FORMAT_TB;
	else if (this.m_properties[ZinFeedItem.ATTR_MS] != "")
		ret = FORMAT_ZM;
	else if (this.m_properties[ZinFeedItem.ATTR_REV] != "")
		ret = FORMAT_GD;
	else
		zinAssertAndLog(false, "m_properties: " + aToString(this.m_properties));

	// ZinLoggerFactory.instance().logger().debug("Lso.compareFormat: blah: returns: " + ret);

	return ret;
}

// returns 0 ==> the properties in this object match the corresponding properties in the zfi.
// returns 1 ==> the properties in the zfi suggest that it's newer than the properties in this object.
//  By "suggest", we mean:
//  * if the ms and rev parts aren't empty (and the cs part is):
//	  * the ms  attribute is greater than the ms  part of the ls attribute or
//	  * the rev attribute is greater than the rev part of the ls attribute or
//	  * the ms and rev attributes equal the corresponding parts of the ls attribute and 
//      the DEL attribute is different from the DEL part of the ls attribute 
//  * if the cs part isn't empty (and the ms part is):
//    * the cs attribute is different from the corresponding part of the ls attribute or
//    * the cs attributes is the same as the corresponding parts of the ls attribute and
//      the DEL attribute is different from the DEL part of the ls attribute 
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
	{
		var MS  = ZinFeedItem.ATTR_MS;
		var CS  = ZinFeedItem.ATTR_CS;
		var REV = ZinFeedItem.ATTR_REV;
		var DEL = ZinFeedItem.ATTR_DEL;

		if (this.m_properties[MS] != "") zinAssert(this.m_properties[CS] == "");
		if (this.m_properties[CS] != "") zinAssert(this.m_properties[MS] == "");

		var format = this.compareFormat();

		switch (format)
		{
			case FORMAT_TB:
				isGreaterThan = (Lso.normalise(zfi, CS) != this.m_properties[CS]) ||
					  			(Lso.normalise(zfi, DEL) != this.m_properties[DEL]) ;
				break;
			case FORMAT_ZM:
				isGreaterThan =
				            (Number(Lso.normalise(zfi, MS))  > Number(this.m_properties[MS]))  ||
			                (Number(Lso.normalise(zfi, REV)) > Number(this.m_properties[REV])) ||
			                ( 
								(Lso.normalise(zfi, MS) == this.m_properties[MS]) &&
			                  	(Lso.normalise(zfi, REV) == this.m_properties[REV]) &&
					  			(Lso.normalise(zfi, DEL) != this.m_properties[DEL])
							);
				break;
			case FORMAT_GD:
				isGreaterThan =
			                (Lso.normalise(zfi, REV) > this.m_properties[REV]) ||
			                ( 
			                  	(Lso.normalise(zfi, REV) == this.m_properties[REV]) &&
					  			(Lso.normalise(zfi, DEL) != this.m_properties[DEL])
							);
				break;
			default:
				zinAssert(false, "unmatched case: " + format);
		}
	}

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
			ret += "#" + this.m_properties[Lso.aPartsAll[i]];

	return ret;
}

Lso.normalise = function(zfi, attr)
{
	return zfi.isPresent(attr) ? zfi.get(attr) : "";
}

