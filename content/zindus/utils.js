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
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

function zinAssert(expr)
{
	if (!expr)
	{
		try
		{
			throw new Error("Please report this assertion failure (include filenames and line numbers) to support@zindus.com: ");
		}
		catch(ex)
		{
			if (typeof newZinLogger == 'function')
			{
				var logger = newZinLogger("Utils");
				
				logger.fatal(ex.message);
				logger.fatal(ex.stack);
			}

			if (typeof alert == 'function')
				alert(ex.message + " stack: \n" + ex.stack);
			else
				print(ex.message + " stack: \n" + ex.stack);

			var win = getWindowContainingElementId('zindus-syncwindow');

			if (win)
				win.document.getElementById('zindus-syncwindow').acceptDialog();

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}
}


function zinAssertAndLog(expr, msg)
{
	if (!expr)
	{
		newZinLogger("Utils").error(msg)
		zinAssert(expr);
	}
}

function zinCloneObject(obj)
{
	var ret;

	if (typeof(obj) == 'object' && obj != null)
	{
		ret = new Object();

		for (var i in obj)
			ret[i] = zinCloneObject(obj[i]);
	}
	else
	{
		ret = obj;
	}

	return ret;
}

// determine whether there are any duplicates in the collection
// two prefsets are duplicates if they have the same value for each property in "properties"
//
function FunctorAnyDuplicatesInPrefsetCollection(properties)
{
	this.m_properties = properties;
	this.m_duplicate  = false;
	this.m_sofar      = new Object;
}

// The match is case-insensitive.
//
FunctorAnyDuplicatesInPrefsetCollection.prototype.run = function(prefset)
{
	var key = "";

	if (!this.m_duplicate) // once we've found a duplicate, stop looking
	{
		for (var i in this.m_properties)
		{
			key += "###" + prefset.getProperty(this.m_properties[i]).toUpperCase();
		}

		if (this.m_sofar[key] == null)
		{
			this.m_sofar[key] = true;
			dump("FunctorAnyDuplicatesInPrefsetCollection - adding key: " + key + "\n");
		}
		else
		{
			this.m_duplicate = true;
			dump("FunctorAnyDuplicatesInPrefsetCollection - found duplicate key: " + key + "\n");
		}
	}
}

function stringBundleString(id_string, args)
{
	var stringbundle = document.getElementById("zindus-stringbundle");
	var ret = "";
	var is_exception = false;

	zinAssert(arguments.length == 1 || arguments.length == 2);
	zinAssertAndLog(stringbundle != null, "unknown string id: " + id_string);

	try
	{
		if (arguments.length == 1)
			ret = stringbundle.getString(APP_NAME + "." + id_string);
		else if (arguments.length == 2)
			ret = stringbundle.getFormattedString(APP_NAME + "." + id_string, args); // untested!
	}
	catch (e)
	{
		if (typeof(gLogger) == 'object' && typeof(gLogger.error) == 'function')
			gLogger.error("stringBundleString: id_string: " + id_string + " exception: " + e);
		else
			dump("stringBundleString: gLogger undefined: id_string: " + id_string + " exception: " + e);

		is_exception = true;
	}

	zinAssert(!is_exception);

	return ret;
}

function xmlDocumentToString(doc)
{
	zinAssert(doc != null);

	var serializer = new XMLSerializer();
	var str = serializer.serializeToString(doc);

	return str;
}

function conditionalGetElementByTagNameNS(doc, ns, tag, object, property)
{
	var nodelist = doc.getElementsByTagNameNS(ns, tag);

	if (nodelist.length > 0 && nodelist.item(0).hasChildNodes() && nodelist.item(0).firstChild.nodeValue)
		object[property] = nodelist.item(0).firstChild.nodeValue;
}

function attributesFromNode(node)
{
	zinAssert(node.nodeType == Node.ELEMENT_NODE);

	var ret = new Object();
	
	if (node.hasAttributes())
		for (var i = 0; i < node.attributes.length; i++)
			ret[node.attributes.item(i).nodeName] = node.attributes.item(i).nodeValue;

	return ret;
}

// return a printable string for an associatve array
//
function aToString(obj)
{
	var ret = "";

	for (var x in obj)
	{
		ret += x + ": ";

		var was_exception_thrown = false;

		if (typeof(obj[x]) == 'object')
			try {
				ret += "{ " + aToString(obj[x]) + " }, ";
			} catch (e)
			{
				dump("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
				gLogger.error("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
			}
		else
			ret += obj[x] + ", ";

		zinAssert(!was_exception_thrown);
	}

	return ret;
}

function aToLength(obj)
{
	var count = 0;

	for (x in obj)
		count++;

	return count;
}

function isInArray(item, a)
{
	zinAssert(typeof a == 'object' && typeof a.indexOf == 'function');

	return a.indexOf(item) != -1;
}

// isIn(id_fsm, [ blah1, blah2 ] )

function isPropertyPresent(obj, property)
{
	zinAssert(typeof(obj) == 'object');
	zinAssert(arguments.length == 2); // this function has two arguments!

	return (typeof(obj[property]) != 'undefined');
}

// takes either:
// one argument - an array with an even number of elements
// an even number of arguments
//
function newObject()
{
	var ret = new Object();
	var args;

	if (arguments.length == 1)
	{
		zinAssert(typeof(arguments[0]) == 'object');

		args = arguments[0];
	}
	else
		args = arguments;

	for (var i = 0; i < args.length; i+=2)
		ret[args[i]] = args[i+1];

	return ret;
}

function propertyFromObject(obj)
{
	var ret = null;

	for (var i in obj)
	{
		ret = i;
		break;
	}

	zinAssert(ret != null);

	return ret;
}

function getTime()
{
	var now = new Date();

	return now.getTime();
}

function getFriendlyTimeString(increment)
{
	var date = new Date();

	if (arguments.length == 1)
		date.setUTCMilliseconds(date.getUTCMilliseconds() + increment);

	return date.toLocaleString();
}

function hyphenate()
{
	var ret = "";
	var isFirst = true;
	var separator = arguments[0];
	var args;
	var startAt;

	zinAssert(arguments.length >= 2);

	if (typeof arguments[1] == 'array')
	{
		args = arguments[i];
		startAt = 0;
	}
	else
	{
		args = arguments;
		startAt = 1;
	}

	for (var i = startAt; i < args.length; i++)
	{
		zinAssert(typeof(args[i]) == 'string' || typeof(args[i]) == 'number');

		if (isFirst)
		{
			isFirst = false;
			ret += args[i];
		}
		else
			ret += separator + args[i];
	}

	return ret;
}

function isSourceId(sourceid)
{
	return (sourceid == SOURCEID_ZM || sourceid == SOURCEID_TB);
}

// see:
// http://www.sitepoint.com/blogs/2006/01/17/javascript-inheritance/
//
function copyPrototype(child, parent)
{ 
	var sConstructor = parent.toString(); 
	var aMatch       = sConstructor.match( /\s*function (.*)\(/ ); 

	if (aMatch != null)
		child.prototype[aMatch[1]] = parent;

	for (var i in parent.prototype)
		child.prototype[i] = parent.prototype[i]; 
}

function dateSuffixForFolder()
{
	var d = new Date();

	return " " + hyphenate("-", d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + 
	       "-" + hyphenate("-", d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

// eg 24 +/- 4 is a number between 16 and 28...
//
function randomPlusOrMinus(central, varies_by)
{
	var ret = central - varies_by + Math.floor(Math.random() * (2 * varies_by + 1));

	// newZinLogger("Utils").debug("randomPlusOrMinus(" + central + ", " + varies_by + ") returns: " + ret);

	return ret;
}

// Compare two Toolkit version strings as defined at:
// http://developer.mozilla.org/en/docs/Toolkit_version_format
// return:
//    -1 a <  b
//    0  a == b
//    1  a >  b
// This routine doesn't implement the full comparison as required by the spec above,
// but for zindus version numbers, which are <number>.<number> etc it gives the same result.
// More detail...
// The spec says that "version part" is itself parsed as a sequence of <number-a><string-b><number-c><string-d>
// whereas our        "version part" is simply                         <number>
// And in the spec, version parts are compared bytewise whereas here we compare two numbers.
//
compareToolkitVersionStrings = function(string_a, string_b)
{
	var a_a = string_a.split(".");
	var a_b = string_b.split(".");
	var max_parts = (a_a.length > a_b.length) ? a_a.length : a_b.length;
	var ret = 0;

	for (var i = 0; (i < max_parts) && (ret == 0); i++)
	{
		var part_string_a = "1" + ((i < a_a.length) ? a_a[i] : "0"); // prefix with a digit because "043" wouldn't equal parseInt("043");
		var part_string_b = "1" + ((i < a_b.length) ? a_b[i] : "0");

		var part_int_a = parseInt(part_string_a, 10);
		var part_int_b = parseInt(part_string_b, 10);

		zinAssert(part_int_a.toString() == part_string_a); // assert that the parts really are only numbers
		zinAssert(part_int_b.toString() == part_string_b); // otherwise, our simplified comparison here is no good

		if (part_int_a > part_int_b)
			ret = 1;
		else if (part_int_a < part_int_b)
			ret = -1;
	}

	newZinLogger("").debug("compareToolkitVersionStrings(" + string_a + ", " + string_b + ") returns: " + ret);

	return ret;
}
