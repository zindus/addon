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

function zinAssert(expr)
{
	if (!expr || arguments.length != 1)
	{
		try
		{
			throw new Error("Please report this assertion failure (include filenames and line numbers) to support@zindus.com:\n" +
				            APP_NAME + " version " + APP_VERSION_NUMBER + "\n" +
				            "See http://www.zindus.com/faq-thunderbird/#toc-reporting-bugs\n");
		}
		catch(ex)
		{
			if (isSingletonInScope())
			{
				var logger = newLogger("Utils");
				logger.fatal(ex.message);
				logger.fatal(ex.stack);
			}

			if (typeof zinAlert == 'function')
				zinAlert('msg.alert.title', ex.message + " stack: \n" + ex.stack);
			else
				print(ex.message + " stack: \n" + ex.stack);

			var zwc = new WindowCollection([ 'zindus-sw' ]);
			zwc.populate();
			var zwc_functor = {
				run: function(win) {
					win.document.getElementById('zindus-sw').cancelDialog();
				}
			};
			zwc.forEach(zwc_functor);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}
}

function zinAssertAndLog(expr, msg)
{
	if (!expr)
	{
		newLogger("Utils").error(msg)
		zinAssert(expr);
	}
}

function cloneObject(obj)
{
	var ret;

	if (typeof(obj) == 'object' && obj != null)
	{
		ret = new Object();

		for (var i in obj)
			ret[i] = cloneObject(obj[i]);
	}
	else
	{
		ret = obj;
	}

	return ret;
}

function stringBundleString(id_string, args)
{
	var string_bundle_id = "zindus-stringbundle";

	var stringbundle = dId(string_bundle_id);
	var ret = "";
	var is_exception = false;

	zinAssert(arguments.length == 1 || arguments.length == 2);
	zinAssertAndLog(id_string != "status" && id_string != "statusnull", "id_string: " + id_string); 
	zinAssert(typeof(args) == 'undefined' || args instanceof Array);

	if (stringbundle == null)
	{
		ret = "Unable to load string-bundle: " + string_bundle_id;

		if (isSingletonInScope())
			Singleton.instance().logger().error(ret);
	}
	else try
	{
		if (arguments.length == 1)
			ret = stringbundle.getString(APP_NAME + "." + id_string);
		else if (arguments.length == 2)
			ret = stringbundle.getFormattedString(APP_NAME + "." + id_string, args);
	}
	catch (e)
	{
		if (isSingletonInScope())
			Singleton.instance().logger().error("stringBundleString: id_string: " + id_string + " exception: " + e);
		else
			dump("stringBundleString: Singleton.instance().logger() undefined: id_string: " + id_string + " exception: " + e);

		is_exception = true;
	}

	zinAssertAndLog(!is_exception, "id_string: " + id_string);

	return ret;
}

function xmlDocumentToString(doc)
{
	zinAssert(doc != null);

	var serializer = new XMLSerializer();

	var str = null;
	
	try
	{
		str = serializer.serializeToString(doc);
	}
	catch (e)
	{
		zinAssert(false);
	}

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
	var first = true;

	if (obj == null)
		ret = "Null";
	else if (typeof(obj) == 'function' && typeof(obj.QueryInterface) == 'function')
		ret += "xpcom object";
	else
		for (var x in obj)
		{
			if (!first)
				ret += ", ";
			else
				first = false;

			ret += x + ": ";

			var was_exception_thrown = false;

			if (obj[x] == null)
				ret += "Null";
			else if (typeof(obj[x]) == 'object')
				try {
					ret += "{ " + aToString(obj[x]) + " }";
				} catch (e)
				{
					dump("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
					Singleton.instance().logger().error("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
					Singleton.instance().logger().error("ret: " + ret);
				}
			else if (typeof(obj[x]) == 'function')
				ret += "Function";
			else
				ret += obj[x];

			zinAssert(!was_exception_thrown);
		}

	return ret;
}

function keysToString(obj)
{
	ret = "";
	var is_first = true;

	for (var i in obj)
	{
		if (is_first)
			is_first = false;
		else
			ret += " ";

		ret += i;
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
	zinAssertAndLog(typeof(obj) == 'object', "argument[0] of this function should be a hash!"); // catch programming errors
	zinAssertAndLog(arguments.length == 2,   "this function takes two arguments!");

	return (typeof(obj[property]) != 'undefined');
}

// return true iff the keys in both objects match
//
function isMatchObjectKeys(obj1, obj2)
{
	var i;
	var ret = true;

	if (ret)
		for (i in obj1)
			if (!isPropertyPresent(obj2, i))
			{
				ret = false;
				// newLogger("Utils").debug("isMatchObjectKeys: mismatched key: " + i);
				break;
			}

	if (ret)
		for (i in obj2)
			if (!isPropertyPresent(obj1, i))
			{
				ret = false;
				// newLogger("Utils").debug("isMatchObjectKeys: mismatched key: " + i);
				break;
			}

	return ret;
}

// return true iff the both the keys and the values in both objects match
// 
function isMatchObjects(obj1, obj2)
{
	var is_match = true;

	is_match = is_match &&isMatchObjectKeys(obj1, obj2);

	if (is_match)
		for (var i in obj1)
			if (obj1[i] != obj2[i])
			{
				is_match = false;
				break;
			}

	return is_match;
}

// return true iff each element in the array has a matching key in the object
//
function isMatchArrayElementInObject(a, obj)
{
	var ret = true;

	for (var i = 0; i < a.length; i++)
		if (!isPropertyPresent(obj, a[i]))
		{
			ret = false;
			break;
		}

	return ret;
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

function newLogger(prefix)
{
	return new Logger(Singleton.instance().loglevel(), prefix);
}

function isObjectEmpty(obj)
{
	var ret = true;

	for (var i in obj)
	{
		ret = false;
		break;
	}

	return ret;
}

function firstKeyInObject(obj)
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

	if (arguments[1] instanceof Array)
	{
		args = arguments[1];
		startAt = 0;
	}
	else
	{
		args = arguments;
		startAt = 1;
	}

	for (var i = startAt; i < args.length; i++)
	{
		zinAssertAndLog(typeof(args[i]) == 'string' ||
		                     typeof(args[i]) == 'number', args[i] + " is not a string or number, typeof: " + typeof(args[i]));

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

function isValidSourceId(sourceid)
{
	return (sourceid == SOURCEID_TB || sourceid == SOURCEID_AA);
}

function isValidFormat(format)
{
	return isInArray(format, A_VALID_FORMATS);
}

function getBimapFormat(type)
{
	var a1 = [ FORMAT_TB, FORMAT_GD, FORMAT_ZM ];
	var a2;

	if (type == 'short')
		a2 = [ 'tb', 'gd', 'zm' ];
	else if (type == 'long')
		a2 = [ stringBundleString("format.thunderbird"), stringBundleString("format.google"), stringBundleString("format.zimbra") ];
	else
		zinAssertAndLog(false, "mismatched: type: " + type);
		
	return new BiMap(a1, a2);
}

function isValidUrl(url)
{
	var is_valid = true;
	var xhr      = new XMLHttpRequest();

	try {
		xhr.open("HEAD", url, false);
	}
	catch(e) {
		is_valid = false;
	}

	return is_valid;
}

// This of setting up the prototype chain for derived classes is taken from:
//   http://www.sitepoint.com/blogs/2006/01/17/javascript-inheritance/
// Elsewhere we use the approach described at:
//   http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Guide:The_Employee_Example
// but a gotcha of the approach of:
//  function A ();
//  function B ();
//  B.prototype = new A();
// is that A's constructor is called when the .js file is loaded.
// And of course the scope chain when the file is loaded is likely different from when B's constructor is called.
// In particular, if the file is loaded from the .xul, then the document isn't fully loaded when document.blah is referenced.
// To avoid this trickness, if A's constructor references 'document' or 'window' we use copyPrototype()
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

	// newLogger("Utils").debug("randomPlusOrMinus(" + central + ", " + varies_by + ") returns: " + ret);

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
function compareToolkitVersionStrings(string_a, string_b)
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

	Singleton.instance().logger().debug("compareToolkitVersionStrings(" + string_a + ", " + string_b + ") returns: " + ret);

	return ret;
}

// turn obj into a string and pad it out to a given length with spaces - helpul in lining up output in the absence of s/printf
//
function strPadTo(obj, length)
{
	var ret = "";
	var str = new String(obj);

	if (str.length >= length)
		ret = str;
	else
	{
		var count = length - str.length;

		for (var i = 0; i < count; i++)
			ret += " ";

		ret = str + ret;
	}

	return ret;
}

function zmPermFromZfi(zfi)
{
	var perm = zfi.getOrNull(FeedItem.ATTR_PERM);
	var ret  = ZM_PERM_NONE;

	if (perm && perm.length > 0)
	{
		if (perm.indexOf('r') >= 0)
			ret |= ZM_PERM_READ;

		if (perm.indexOf('w') >= 0 && perm.indexOf('i'))
			ret |= ZM_PERM_WRITE;
	}

	// Singleton.instance().logger().debug("zmPermFromZfi: zfi: " + zfi.key() + " " + perm + " returns: " + ret);

	return ret;
}

function arrayfromArguments(args, start_at)
{
	var ret = new Array();

	for (var i = start_at; i < args.length; i++)
		ret.push(args[i]);

	return ret;
}

// Trim leading and trailing whitespace from a string.
// http://javascript.crockford.com/remedial.html

function zinTrim(str)
{
	var ret;

	if (str)
	{
		zinAssert(typeof(str) == "string");

		ret = str.replace(/^\s+|\s+$/g, "");
	}
	else
		ret = str;

	return ret;
}; 

// Javascript doesn't have a native sleep
// this is a workaround
// Handy during testing...
//
function zinSleep(milliseconds)
{
	var start = new Date();
	var current = null;

	do {
		current = new Date();
	}
	while (current - start < milliseconds);
} 

function leftOfChar(str, c)
{
	if (arguments.length == 1)
		c = '#';

	zinAssert(str && c && c.length == 1);

	return str.substr(0, str.indexOf(c));
}

// rfc3986 refers to the part to the right of the hash as "fragment"
//
function rightOfChar(str, c)
{
	if (arguments.length == 1)
		c = '#';

	zinAssert(str && c && c.length == 1);

	return str.substr(str.indexOf(c) + 1);
}

function isSingletonInScope()
{
	return (typeof(Singleton) == 'function' && typeof(Singleton.instance()) == 'object'
	                                        && typeof(Singleton.instance().logger()) == 'object'
											&& typeof(Singleton.instance().logger().error) == 'function');
}

function prefsetMatchWithPreAuth(url)
{
	var prefs     = Singleton.instance().preferences();
	var a_preauth = prefs.getImmediateChildren(prefs.branch(), PrefSet.PREAUTH + '.');
	var prefset   = new PrefSet(PrefSet.PREAUTH, PrefSet.PREAUTH_PROPERTIES);
	var is_match  = false;

	for (i = 0; i < a_preauth.length; i++)
	{
		prefset.load(a_preauth[i]);

		is_match = url.match(new RegExp(prefset.getProperty(PrefSet.PREAUTH_REGEXP))) != null;

		if (is_match)
			break;
	}

	return is_match ? prefset : null;
}

// Convert Character Entity References: &lt; &gt; etc to/from characters: < >
// See: http://www.w3.org/TR/html401/charset.html#h-5.3.2
//
function convertCER(str, dirn)
{
	zinAssertAndLog(typeof(str) == 'string' && (dirn & CER_TO_CHAR || dirn & CER_TO_ENTITY), "str: " + str + "dirn: " + dirn);

	const a_char   = [ '&',     '<',    '>',    '"'      ]; // ampersand must come first, otherwise &lt; becomes &amp;lt;
	const a_entity = [ '&amp;', '&lt;', '&gt;', '&quot;' ];
	var ret = str;
	var i;

	if (typeof(convertCER.a_regexp) == 'undefined')
	{
		convertCER.a_regexp = new Object();

		for (i = 0; i < a_char.length; i++)
		{
			convertCER.a_regexp[a_char[i]]   = new RegExp(a_char[i],   "gm");
			convertCER.a_regexp[a_entity[i]] = new RegExp(a_entity[i], "gm");
		}
	}

	for (i = 0; i < a_char.length; i++)
		if (dirn & CER_TO_CHAR)
			ret = ret.replace(convertCER.a_regexp[a_entity[i]], a_char[i]);
		else // (dirn & CER_TO_ENTITY)
			ret = ret.replace(convertCER.a_regexp[a_char[i]], a_entity[i]);

	// Singleton.instance().logger().debug("convertCER: blah: input: " + str + " and returns: " + ret);

	return ret;
}

function intMin(a, b)
{
	return a < b ? a : b;
}

function dId(id)
{
	return document.getElementById(id);
}

function includejs(url, scope_id)
{
	ZindusScopeRegistry.includejs(url, scope_id);
}

// See: http://developer.mozilla.org/en/docs/Opening_a_Link_in_the_Default_Browser
//
function openURL(url)
{
	var ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var uriToOpen = ioservice.newURI(url, null, null);
	var extps     = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

	extps.loadURI(uriToOpen, null);
}

function migratePrefName(a_map)
{
	var prefs = Singleton.instance().preferences();

	for (var old in a_map)
	{
		if (a_map[old].type == 'char')
			value = prefs.getCharPrefOrNull(prefs.branch(), old);
		else
			value = prefs.getIntPrefOrNull(prefs.branch(), old);

		if (value != null)
		{
			if (a_map[old].type == 'char')
				prefs.branch().setCharPref(a_map[old].new, value);
			else
				prefs.branch().setIntPref(a_map[old].new, value);

			prefs.branch().deleteBranch(old);

			Singleton.instance().logger().debug("migrated pref: " + old + " to " + a_map[old].new + " value: " + value);
		}
	}
}

function migratePrefValue(a_key, bimap)
{
	var prefs = Singleton.instance().preferences();
	var key;

	for (var i = 0; i < a_key.length; i++)
	{
		key = a_key[i];

		value = prefs.getCharPrefOrNull(prefs.branch(), key);

		if (value != null && bimap.isPresent(value, null))
		{
			Singleton.instance().logger().debug("blah: key: " + key + " value: " + value);

			prefs.setCharPref(prefs.branch(), key, bimap.lookup(value, null) );

			Singleton.instance().logger().debug("migrated pref key: " + key + " old value: " + value
			                                                                + " to new value: " + bimap.lookup(value, null));
		}
	}
}

function numeric_compare(a, b)
{
	if(a > b)
		return 1;
	if(a < b)
		return -1;
	return 0;
}

// The idea here was to replace window.alert with nsIPromptService
// But under Thunderbird 2, windowing is buggy - if the parent windows closes quickly
// eg a Sync Now followed by ESC ESC in quick succession, the prompt is displayed without it's parent!
// We'll go on using window.alert until Thunderbird 3 rolls out and we drop support for Tb2.
// In Tb3, the behaviour appears to be correct, ie the prompt closes if it's parent window is closed.
//
function zinAlert(title_string_id, msg, win)
{
	alert(msg);
	return;

	if (!win)
		win = null;

	Singleton.instance().logger().debug("zinAlert: blah: title_string_id: " + title_string_id + " msg: " + msg);

	var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	prompts.alert(win, stringBundleString(title_string_id), msg);

	Singleton.instance().logger().debug("zinAlert: blah: done");
}
