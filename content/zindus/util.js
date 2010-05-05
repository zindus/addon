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
 * Portions created by Initial Developer are Copyright (C) 2007-2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/
// $Id: util.js,v 1.77 2010-05-05 02:16:26 cvsuser Exp $

function zinAssertCatch(ex)
{
	let msg = "Please report this assertion failure (include filenames and line numbers) to support@zindus.com:\n" +
			    APP_NAME + " version " + APP_VERSION_NUMBER + "\nSee: " + url('reporting-bugs') + "\n";

	msg += ex.message + "\n";

	if (isSingletonInScope()) {
		let logger = newLogger("Utils");
		logger.fatal(msg);
		logger.fatal(executionStackFilter(ex.stack));
	}

	if (typeof(zinAlert) == 'function')
		zinAlert('text.alert.title', msg + " stack: \n" + executionStackFilter(ex.stack));
	else
		print(ex.message + " stack: \n" + executionStackFilter(ex.stack));

	let zwc = new WindowCollection([ 'zindus-sw' ]);
	zwc.populate();
	let zwc_functor = {
		run: function(win) {
			win.document.getElementById('zindus-sw').cancelDialog();
		}
	};
	zwc.forEach(zwc_functor);

	throw new Error(msg + "\n\n stack:\n" + executionStackFilter(ex.stack));
}

function zinAssert(expr)
{
	if (!expr || arguments.length != 1) {
		try {
			if (arguments.length != 1)
				throw new Error("Invalid number of arguments to zinAssert(). ");
			else
				throw new Error();
		}
		catch(ex) {
			zinAssertCatch(ex);
		}
	}
}

function zinAssertAndLog(expr, msg)
{
	if (!expr)
	{
		// sometimes use a function as the second param to delay calculation if the msg is a costly .toString() sort of string
		//
		if (typeof(msg) == 'function')
			msg = msg();

		newLogger("Utils").error(msg)
		zinAssert(expr);
	}
}

function executionStackAsString()
{
	var ret = "";

	try {throw new Error();} catch(ex) {ret = new String(ex.stack);}

	return executionStackFilter(ret);
}

function executionStackFilter(str)
{
	let ret;

	if (str) {
		ret = str;
		ret = ret.replace(new RegExp("^.*@", "mg"),"");
		ret = ret.replace(new RegExp(":0", "mg"),"");
	}
	else {
		ret = "no execution stack available";

		logger().error(ret + "\narguments.callee.caller:\n" + arguments.callee.caller.toString());
	}

	return ret;
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
	return stringBundleStringFrom("zindus-stringbundle", id_string, args);
}

function stringBundleStringFrom(string_bundle_id, id_string, args)
{
	var stringbundle = dId(string_bundle_id);
	var ret = "";
	var is_exception = false;

	zinAssert(arguments.length == 2 || arguments.length == 3);
	zinAssertAndLog(id_string != "status" && id_string != "statusnull", "id_string: " + id_string); 
	zinAssert(typeof(args) == 'undefined' || args instanceof Array || typeof(args.length) == 'number');

	if (stringbundle == null)
	{
		ret = "Unable to load string bundle: " + string_bundle_id + " " + executionStackAsString();

		if (isSingletonInScope())
			logger().error(ret);
	}
	else try
	{
		if (!args)
			ret = stringbundle.getString(APP_NAME + "." + id_string);
		else
			ret = stringbundle.getFormattedString(APP_NAME + "." + id_string, args);
	}
	catch (e)
	{
		if (isSingletonInScope())
			logger().error("stringBundleString: id_string: " + id_string + " exception: " + e);
		else
			dump("stringBundleString: logger() undefined: id_string: " + id_string + " exception: " + e);

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
	var ret = new BigString();
	var first = true;

	if (obj == null)
		ret.concat("Null");
	else if (typeof(obj) == 'function' && typeof(obj.QueryInterface) == 'function')
		ret.concat("xpcom object");
	else if ((obj instanceof Suo) || (obj instanceof SuoKey))
		ret.concat(obj.toString());
	else
		for (var x in obj)
		{
			if (!first)
				ret.concat(", ");
			else
				first = false;

			ret.concat(x + ": ");

			var was_exception_thrown = false;

			if (obj[x] == null)
				ret.concat("Null");
			else if (typeof(obj[x]) == 'object')
				try {
					ret.concat("{ " + aToString(obj[x]) + " }");
				} catch (e)
				{
					dump("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
					logger().error("Too much recursion: typeof e.stack: " + typeof e.stack + " last 2000: " + e.stack.substr(-2000));
					logger().error("ret: " + ret.toString());
				}
			else if (typeof(obj[x]) == 'function')
				ret.concat("Function");
			else
				ret.concat(obj[x]);

			zinAssert(!was_exception_thrown);
		}

	return ret.toString();
}

function keysIn()
{
	var ret = new Object();

	for (var i = 0; i < arguments.length; i++)
		for (j in arguments[i])
			ret[j] = true;

	return ret;
}

function keysToString(obj)
{
	var is_first = true;
	var ret = "";

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

function firstDifferingObjectKey(obj1, obj2)
{
	var ret = null;
	var i;

	if (!ret)
		for (i in obj1)
			if (!(i in obj2))
			{
				ret = i;
				break;
			}

	if (!ret)
		for (i in obj2)
			if (!(i in obj1))
			{
				ret = i;
				break;
			}

	return ret;
}

// return true iff the both the keys and the values in both objects match
// 
function isMatchObjects(obj1, obj2)
{
	var is_match = true;

	is_match = is_match && (firstDifferingObjectKey(obj1, obj2) == null);

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
		if (!(a[i] in obj))
		{
			ret = false;
			break;
		}

	return ret;
}

function keysForMatchingValues(a1, a2)
{
	var ret = new Object();

	for (key in a1)
		if ((key in a2) && a1[key] == a2[key])
			ret[key] = a1[key];

	return ret;
}

function isAnyValue(a, value)
{
	zinAssert(typeof(value) == 'boolean');

	var ret = false;
	
	for (var i in a)
	{
		if (a[i] == value)
		{
			ret = true;
			break;
		}
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

function newObjectWithKeys()
{
	var ret = new Object();

	for (var i = 0; i < arguments.length; i++)
		ret[arguments[i]] = 0;

	return ret;
}

function newObjectWithKeysMatchingValues()
{
	var ret = new Object();

	for (var i = 0; i < arguments.length; i++)
		ret[arguments[i]] = arguments[i];

	return ret;
}

function newLogger(prefix)
{
	return new Logger(singleton().logger().level(), prefix);
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
	return (sourceid == SOURCEID_TB || Number(sourceid) > SOURCEID_TB);
}

function isValidFormat(format)
{
	return isInArray(format, A_VALID_FORMATS);
}

function getBimapFormat(type)
{
	var a1, a2;

	switch (type)
	{
		case 'short': a1 = [ FORMAT_TB, FORMAT_GD, FORMAT_ZM ];  a2 = [ 'tb', 'gd', 'zm' ];               break;
		case 'long':  a1 = [            FORMAT_GD, FORMAT_ZM ];  a2 = [ Account.Google, Account.Zimbra ]; break;
		default:      zinAssertAndLog(false, "mismatched: type: " + type);
	}

	return new BiMap(a1, a2);
}

function format_xx_to_localisable_string(format_xx)
{
	var ret;

	switch(format_xx)
	{
		case FORMAT_TB: ret = AppInfo.app_name(AppInfo.firstcap);   break;
		case FORMAT_GD: ret = stringBundleString("brand.google");   break;
		case FORMAT_ZM: ret = stringBundleString("brand.zimbra");   break;
		default:        zinAssertAndLog(false, "mismatched: format_xx: " + format_xx);
	}

	return ret;
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
	var a_a = String(string_a).split(".");
	var a_b = String(string_b).split(".");
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

	logger().debug("compareToolkitVersionStrings(" + string_a + ", " + string_b + ") returns: " + ret);

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

function zmPermFromZfi(perm)
{
	var ret = ZM_PERM_NONE;

	if (perm) {
		perm = String(perm);

		if (perm.length > 0) {
			if (perm.indexOf('r') >= 0)
				ret |= ZM_PERM_READ;

			if (perm.indexOf('w') >= 0 && perm.indexOf('i'))
				ret |= ZM_PERM_WRITE;
		}
	}

	// logger().debug("zmPermFromZfi: perm: " + perm + " returns: " + ret);

	return ret;
}

function arrayFromArguments(args, start_at)
{
	var ret = new Array();
	var start = start_at ? start_at : 0;

	for (var i = start; i < args.length; i++)
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
		zinAssertAndLog(typeof(str) == "string", function () { return "typeof: " + typeof(str) + " : " + str.toString(); } );

		ret = str.replace(/^\s+|\s+$/g, "");
	}
	else
		ret = str;

	return ret;
}; 

function zinIsWhitespace(str)
{
	return ! /\S/.test(str);
}

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
// syntax components: scheme:user@host:port//path?Query#fragment
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
	return (typeof(singleton) == 'function' && typeof(singleton()) == 'object'
	                                        && typeof(singleton().logger()) == 'object'
											&& typeof(singleton().logger().error) == 'function');
}

function is_url_free_fr (url) {
	let ret = false;

	if (url.length > 0) {
		let prefset = prefsetMatchWithPreAuth(url);

		if (prefset && prefset.getProperty(PrefSet.PREAUTH_NAME) == "free.fr")
			ret = true;
	}

	return ret;
}

function prefsetMatchWithPreAuth(url)
{
	var a_preauth = preferences().getImmediateChildren(preferences().branch(), PrefSet.PREAUTH + '.');
	var prefset   = new PrefSet(PrefSet.PREAUTH, PrefSet.PREAUTH_PROPERTIES);
	var is_match  = false;

	for (var i = 0; i < a_preauth.length; i++)
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

	return ret;
}

function ZinMin(a, b) { return a < b ? a : b; }
function ZinMax(a, b) { return a > b ? a : b; }

function dId() // variable arguments: either: (win, id) or (id)
{
	var doc, id;

	if (arguments.length == 1)
	{
		doc = document;
		id  = arguments[0];
	}
	else if (arguments.length == 2)
	{
		doc = arguments[0].document;
		id = arguments[1];
	}
	else
		zinAssert(false); // programming error

	if (!('getElementById' in doc))
		zinAssertAndLog(false, executionStackAsString());

	return doc.getElementById(id);
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
	var prefs = preferences();
	var value;

	for (var old in a_map) {
		if (a_map[old].type == 'char')
			value = prefs.getCharPrefOrNull(prefs.branch(), old);
		else
			value = prefs.getIntPrefOrNull(prefs.branch(), old);

		if (value != null) {
			if (a_map[old].type == 'char')
				prefs.branch().setCharPref(a_map[old].new, value);
			else
				prefs.branch().setIntPref(a_map[old].new, value);

			prefs.branch().deleteBranch(old);

			logger().debug("migrated pref: " + old + " to " + a_map[old].new + " value: " + value);
		}
	}
}

function migratePrefValue(a_key, bimap)
{
	var key, value;

	for (var i = 0; i < a_key.length; i++)
	{
		key = a_key[i];

		value = preferences().getCharPrefOrNull(preferences().branch(), key);

		if (value != null && bimap.isPresent(value, null))
		{
			preferences().setCharPref(preferences().branch(), key, bimap.lookup(value, null) );

			logger().debug("migrated pref key: " + key + " old value: " + value + " to new value: " + bimap.lookup(value, null));
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
	let versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
	let is_prompts     = (typeof(AppInfo) == 'object') &&
	                     ((AppInfo.app_name() == 'firefox') ||
				          (((AppInfo.app_name() == 'thunderbird') || (AppInfo.app_name() == 'seamonkey')) &&
						    versionChecker.compare(AppInfo.app_version(), "3") >= 0));

	if (is_prompts) {
		if (!win)
			win = null;

		// logger().debug("zinAlert: title_string_id: " + title_string_id + " msg: " + msg);

		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
		prompts.alert(win, stringBundleString(title_string_id), msg);

		// logger().debug("zinAlert: done");
	}
	else {
		alert(msg);
	}
}

function textToHtml(text)
{
	var html = convertCER(String(text), CER_TO_ENTITY);

	html = html.replace(/\n/mg, "<br/>");
	html = html.replace(/ ( )/mg, " &#160;");

	return html;
}

function logger(arg)   { return singleton().logger(arg);   }
function preferences() { return singleton().preferences(); }
function preference(key, type)
{
	var p = singleton().preferences();
	var ret;

	switch (type)
	{
		case 'char': ret = p.getCharPrefOrNull(p.branch(), key); break;
		case 'int':  ret = p.getIntPref(p.branch(), key);        break;
		case 'bool': ret = p.getBoolPrefOrNull(p.branch(), key); break;
		default: zinAssertAndLog(false, function() { return "key: " + key + " type: " + type; } );
	}

	return ret;
}

function getInfoMessage(type, arg1)
{
	var ret;

	switch(type)
	{
		case 'start':    ret = "sync start:   " + getFriendlyTimeString() + " account(s): " + arg1;                    break;
		case 'finish':   ret = "sync finish:  " + getFriendlyTimeString();                                             break;
		case 'backoff':  ret = "sync backoff: " + getFriendlyTimeString();                                             break;
		case 'next':     ret = "sync next:    " + getFriendlyTimeString(arg1);                                         break;
		case 'repeat':   ret = "sync repeat:  " + getFriendlyTimeString() + " account: " + arg1;                       break;
		case 'startup':  ret = "startup:      " + getFriendlyTimeString() + " " + APP_NAME + " " + APP_VERSION_NUMBER; break;
		case 'shutdown': ret = "shutdown:     " + getFriendlyTimeString() + " " + APP_NAME + " " + APP_VERSION_NUMBER; break;
		default:         zinAssertAndLog(false, type);
	}

	return ret;
}

function xulSetAttribute(attribute, flag)
{
	var i, el;
	zinAssert(typeof(flag) == 'boolean' && isInArray(attribute, [ 'disabled', 'hidden', 'visible' ]) && arguments.length > 2);

	for (i = 2; i < arguments.length; i++)
	{
		el = dId(arguments[i]);

		zinAssertAndLog(el, "id: " + arguments[i]);

		if (flag)
			switch(attribute) {
				case 'disabled': el.setAttribute('disabled', true); break;
				case 'hidden':   el.setAttribute('hidden',   true); break;
				case 'visible':  el.style.visibility = "visible";   break;
			}
		else
			switch(attribute) {
				case 'disabled': el.removeAttribute('disabled');    break;
				case 'hidden':   el.removeAttribute('hidden');      break;
				case 'visible':  el.style.visibility = "hidden";    break;
			}
	}
}

function xulSetHtml(id, value)
{
	var el = dId(id);

	zinAssertAndLog(el, id);
	// logger().debug("xulSetHtml: id: " + id + " value: " + value);

	// <noscript> was used here because it's a structural html element that can contain other elements
	// and we don't need to remove any default styling 
	// ... but subsequently I found wierd issues on redraw that don't happen when <p> is used - probably because there is
	// styling associated with <p>.
	//
	var html = document.createElementNS(Xpath.NS_XHTML, "p");

	try {
		html.innerHTML = value;
	}
	catch (ex) {
		logger().error("xulSetHtml: something dodgy about the value eg malformed html: id: " + id + " value: " + value);
		zinAssertAndLog(false, "" + ex);
	}

	if (!el.hasChildNodes())
		el.appendChild(html);
	else
		el.replaceChild(html, el.firstChild);
}

function gdAdjustHttpHttps(url)
{
	return url.replace(/^https?/, preference(MozillaPreferences.GD_SCHEME_DATA_TRANSFER, 'char'));
}

function url(key)
{
	let ret;

	switch(key) {
	case 'reporting-bugs':      ret = 'http://www.zindus.com/faq-thunderbird/#toc-reporting-bugs';                                  break;
	case 'what-is-soapURL':     ret = 'http://www.zindus.com/faq-thunderbird-zimbra/#toc-what-is-soapURL';                          break;
	case 'faq-thunderbird':     ret = 'http://www.zindus.com/faq-thunderbird/';                                                     break;
	case 'thunderbird-3':       ret = 'http://www.zindus.com/faq-thunderbird/#roadmap-thunderbird-3';                               break;
	case 'share-tos':           ret = 'http://www.zindus.com/service/tos.html';                                                     break;
	case 'share-faq':           ret = 'http://www.zindus.com/faq-share';                                                            break;
	case 'google-bug-997':      ret = 'http://zindus.com/i/google-bug-997/';                                                        break;
	case 'zimbra-bug-c-token':  ret = 'http://www.zimbra.com/forums/developers/29667-soap-how-demand-change.html';                  break;
	case 'slow-sync':           ret = 'http://zindus.com/i/slow-sync';                                                              break;
	case 'gr-as-ab':            ret = 'http://www.zindus.com/blog/2009/11/09/sync-google-groups-with-thunderbird-addressbooks/';    break;
	case 'suggested-contacts':  ret = 'http://www.zindus.com/blog/2009/01/19/google-suggested-contacts-include-or-ignore/';         break;
	case 'google-what-synced':  ret = 'http://www.zindus.com/faq-thunderbird-google/#toc-what-is-synchronized';                     break;
	case 'google-postal-xml':   ret = 'http://www.zindus.com/blog/2008/06/17/thunderbird-google-postal-address-sync-part-two/';     break;
	case 'google-stay-in-sync': ret = 'http://www.zindus.com/blog/2008/10/06/the-google-thunderbird-address-book-staying-in-sync/'; break;
	case 'zimbra-6-birthday':   ret = 'http://www.zindus.com/blog/2010/04/29/zimbra-6x-birthday-field/';                            break;
	default: zinAssertAndLog(false, key);
	}

	return ret;
}

function help_url(key) {
	return help_href(url(key));
}
function help_href(href) {
	return '<a target="_blank" ' +
	       'onclick="with (ZindusScopeRegistry.getScope()) { openURL(\'' + href + '\');}" ' +
		   'style="color:blue; text-decoration:underline" href="' + href + '">'+stringBundleString("text.help")+'</a>';
}

// Not all Unicode characters are valid XML Characters - some characters are excluded.  See
// From: http://www.w3.org/TR/2000/REC-xml-20001006#NT-Char
// 	Char ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
// This function returns a new string with the excluded characters removed
//
function stripInvalidXMLCharsFromString(str)
{
	zinAssert(str && str.length > 0);

	var c;
	var ret = "";
	var c2028 = String("\u2028").charCodeAt(0); // see below.  FIXME: remove when mozilla fixes this bug
	var c2029 = String("\u2029").charCodeAt(0); // see below.  FIXME: remove when mozilla fixes this bug

	for (var i = 0; i < str.length; i++)
	{
		c = str.charCodeAt(i);

		if (((c == 0x9) || (c == 0xA) || (c == 0xD) ||
		    ((c >= 0x20) && (c <= 0xD7FF)) || ((c >= 0xE000) && (c <= 0xFFFD)) || ((c >= 0x10000) && (c <= 0x10FFFF)))
			&& c != c2028 && c != c2029)
			ret += str.charAt(i);
	}

	return ret;
}

// Workaround for mozilla bug:
// https://bugzilla.mozilla.org/show_bug.cgi?id=478905
// http://groups.google.com/group/mozilla.dev.tech.xml/browse_thread/thread/60ff2a453c96af06
// Internal Issue #180
// remove this function when the bug is fixed.
//
function stripCharsToWorkaroundBug478905(str)
{
	return str.replace(/\u2028|\u2029/g, "");
}

function stringAsUnicodeEscapeSequence(str)
{
	zinAssert(str && str.length > 0);

	function decimalToHex(d, padding) {
		let hex = d.toString(16);
		while (hex.length < padding)
			hex = "0" + hex;
		return hex;
	}

	var c;
	var ret = "";

	for (var i = 0; i < str.length; i++)
	{
		c = str.charCodeAt(i);

		if ((c >= 0x20) && (c <= 0x007E))
			ret += str.charAt(i);
		else
			ret += "\\u" + decimalToHex(c,4);
	}

	return ret;
}



function chunk_size(name, flex)
{
	const a_chunk = { 'cards'     : 500,
	                  'feed'      : 500,
	                  'bigstring' : 500,
	                  'strcmp'    : 5000 };

	zinAssertAndLog(name in a_chunk, name);

	if (!flex)
		flex = 1;
	else
		zinAssert(flex > 0);

	return a_chunk[name] * flex;
}

function http_status_from_xhr(xhr)
{
	var ret = null;

	try {
		// when the server is down:
		// - in Tb2, an exception is thrown when xhr.status is referenced
		// - in Tb3, xhr.status is zero

		ret = xhr.status;
	}
	catch (ex) {
		; // do nothing
	}

	return ret;
}

function set_http_request_headers(xhr, headers)
{
	zinAssert(xhr && headers);

	for (var key in headers)
		xhr.setRequestHeader(key,  headers[key]);
}

function str_with_trailing(str, chr)
{
	if (str.charAt(str.length - 1) != chr)
		str += '/';

	return str;
}

// the status + progress panels are visibile and updated in windows containing these ids.
//
function show_status_panel_in()
{
	return (AppInfo.app_name() == 'firefox') ? [ 'browser-bottombox' ] : [ 'folderPaneBox', 'addressbookWindow' ];
}

function AddToPrototype(o, p)
{
  for (var i in p.prototype)
    o.prototype[i] = p.prototype[i];
}
