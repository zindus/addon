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

ZinFeedCollection.ITER_ALL          = 1;   // call functor for all items in the collection
ZinFeedCollection.ITER_NON_RESERVED = 2;   // call functor for all items in the collection except those in KEYS_RESERVED

ZinFeedItem.ITER_ALL                = 3;   // 
ZinFeedItem.ITER_GID_ITEM           = 4;   // don't call functor when key == ZinFeedItem.ATTR_KEY or key == ZinFeedItem.ATTR_VER

ZinFeedItem.KEY_AUTO_INCREMENT      = "1#zindus-housekeeping"; // this key is the one with the 'next' attribute
ZinFeedItem.KEY_STATUSPANEL         = "2#zindus-housekeeping"; // this key is used in the StatusPanel's ZinFeedCollection
ZinFeedItem.KEYS_RESERVED           = newObject(ZinFeedItem.KEY_AUTO_INCREMENT, null, ZinFeedItem.KEY_STATUSPANEL, null);

ZinFeedItem.ATTR_KEY  = 'key';
ZinFeedItem.ATTR_MS   = 'ms';
ZinFeedItem.ATTR_LS   = 'ls';   // last sync - concatenation of gid version, ms, DEL etc eg. 1#-134217729### or 1##1801#1801#
ZinFeedItem.ATTR_VER  = 'ver';  // only an attribute in the gid
ZinFeedItem.ATTR_REV  = 'rev';
ZinFeedItem.ATTR_DEL  = 'del';
ZinFeedItem.ATTR_ID   = 'id';
ZinFeedItem.ATTR_L    = 'l';
ZinFeedItem.ATTR_TPI  = 'tpi';  // thunderbird pref id - see http://www.xulplanet.com/references/xpcomref/ifaces/nsIAbDirectory.html
ZinFeedItem.ATTR_TYPE = 'type';
ZinFeedItem.ATTR_NAME = 'name';
ZinFeedItem.ATTR_RID  = 'rid';  // <link> elements have this attribute - it's the id of the object in the remote users's account
ZinFeedItem.ATTR_ZID  = 'zid';  // <link> elements have this attribute - it's the remote user's zimbraId
ZinFeedItem.ATTR_LKEY = 'lkey'; // TYPE_SF elements have this attribute - it's the key of the <link> element
ZinFeedItem.ATTR_FKEY = 'fkey'; // TYPE_SF elements have this attribute - it's the key of the foreign <folder> element
ZinFeedItem.ATTR_SKEY = 'skey'; // TYPE_LN and foreign TYPE_FL elements have this attribute - it's the key of the TYPE_SF element
ZinFeedItem.ATTR_PERM = 'perm'; // 
ZinFeedItem.ATTR_CS   = 'cs';   // checksum
ZinFeedItem.ATTR_CSGD = 'csgd'; // gd checksum for type == gd items - persisted but not used in compare()
ZinFeedItem.ATTR_EDIT = 'edit'; // gd edit url - used for deletes
ZinFeedItem.ATTR_PRES = 'pres'; // temporary (not persisted) - item was present during some previous iteration

ZinFeedItem.TYPE_CN   = 0x01; // contact
ZinFeedItem.TYPE_FL   = 0x02; // folder
ZinFeedItem.TYPE_LN   = 0x04; // link
ZinFeedItem.TYPE_SF   = 0x08; // link-folder - a hybrid of <link> and remote <folder> managed by zindus
ZinFeedItem.TYPE_MASK = (ZinFeedItem.TYPE_CN | ZinFeedItem.TYPE_FL | ZinFeedItem.TYPE_LN | ZinFeedItem.TYPE_SF);

ZinFeedItem.TYPE_BIMAP = new BiMap(
		[ZinFeedItem.TYPE_CN, ZinFeedItem.TYPE_FL, ZinFeedItem.TYPE_LN, ZinFeedItem.TYPE_SF],
		['cn',                'fl',                'ln'               , 'sf'               ]);

function ZinFeedCollection()
{
	this.m_collection = new Object();
	this.m_filename   = null; // this is a string containing the filename (like "fred.txt"), not an nsIFile
	this.m_logger     = newZinLogger("ZinFeedCollection"); this.m_logger.level(ZinLogger.NONE);
}

ZinFeedCollection.prototype.clone = function()
{
	// we can't run zinCloneObject() on 'this' because it contains a logger
	// which contains a reference to an appender which doesn't clone.
	//
	var ret = new ZinFeedCollection();

	ret.m_collection = zinCloneObject(this.m_collection);
	ret.m_filename = zinCloneObject(this.m_filename);

	return ret;
}

ZinFeedCollection.prototype.filename = function()
{
	if (arguments.length == 1)
		this.m_filename = arguments[0];

	this.m_logger.debug("filename: " + this.m_filename);
	return this.m_filename;
}

ZinFeedCollection.prototype.nsifile = function()
{
	zinAssert(this.m_filename);

	var ret = Filesystem.getDirectory(Filesystem.DIRECTORY_DATA);

	ret.append(this.m_filename);

	return ret;
}

ZinFeedCollection.prototype.length = function()
{
	return aToLength(this.m_collection);
}

ZinFeedCollection.prototype.get = function(key)
{
	zinAssert(typeof(key) != 'undefined' && typeof(key) != 'object');
	return (this.isPresent(key) ? this.m_collection[key] : null);
}

ZinFeedCollection.prototype.set = function(zfi)
{
	zinAssert(zfi != null && typeof(zfi) == 'object');

	// migration-note: remove ATTR_ID when xpi update indicates that no clients are on versions earlier than 0.6.19.20080320.111511
	// ATTR_ID is only in the assertion below to allow status.txt versions pre 0.6.19.20080320.111511 to load - they had an id= but no key=
	//
	zinAssertAndLog(zfi.isPresent(ZinFeedItem.ATTR_KEY) ||
	                zfi.isPresent(ZinFeedItem.ATTR_ID),
					"zfi: " + zfi.toString());

	this.m_collection[zfi.m_properties[ZinFeedItem.ATTR_KEY]] = zfi;
}

ZinFeedCollection.prototype.del = function(key)
{
	zinAssert(this.isPresent(key));
	delete this.m_collection[key];
}

ZinFeedCollection.prototype.isPresent = function(key)
{
	return typeof(this.m_collection[key]) != 'undefined';
}

ZinFeedCollection.prototype.forEach = function(functor, flavour)
{
	var fContinue;

	if (arguments.length == 1)
		flavour = ZinFeedCollection.ITER_NON_RESERVED;
	else if (arguments.length == 2)
		zinAssert(flavour == ZinFeedCollection.ITER_ALL || flavour == ZinFeedCollection.ITER_NON_RESERVED);

	for (var key in this.m_collection)
	{
		zinAssert(this.isPresent(key));

		if (flavour == ZinFeedCollection.ITER_NON_RESERVED && (isPropertyPresent(ZinFeedItem.KEYS_RESERVED, key)))
			fContinue = true;
		else
			fContinue = functor.run(this.m_collection[key]);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

ZinFeedCollection.prototype.findFirst = function(functor_is_found)
{
	var functor_is_found_arg1 = arguments[ZinFeedCollection.prototype.findFirst.length];

	var functor = {
		zfiFound: null,
		run: function(zfi)
		{
			if (functor_is_found(zfi, functor_is_found_arg1))
				this.zfiFound = zfi;

			return this.zfiFound == null;
		}
	};

	this.forEach(functor);

	return functor.zfiFound ? functor.zfiFound.key() : null;
}

ZinFeedCollection.prototype.load = function()
{
	var functor =
	{
		m_zfc: this,
		m_zfi: new ZinFeedItem(),
		m_logger: this.m_logger,
		run: function(line)
		{
			// this.m_logger.debug("line.length: " + line.length + " line: " + line);

			if (line.charAt(0) == '#')
				; // do nothing
			else if (line.length == 0)
			{
				// this.m_logger.debug("setting this.m_zfc.m_collection[" + this.m_zfi.m_properties[ZinFeedItem.ATTR_KEY] + "]");

				this.m_zfc.set(this.m_zfi);
				this.m_zfi = new ZinFeedItem();
			}
			else
			{
				var eq  = line.indexOf('=');

				this.m_zfi.set([line.substring(0, eq)], line.substring(eq + 1));

				// this.m_logger.debug("m_zfi.m_properties[" + line.substring(0, eq) + "] = " + line.substring(eq + 1));
			}
		}
	};

	var file = this.nsifile();
	this.m_logger.debug("about to parse file: " + file.path);

	if (file.exists() && !file.isDirectory())
		Filesystem.fileReadByLine(file.path, functor);
}

ZinFeedCollection.prototype.save = function()
{
	var content = this.toString("\n");

	// put an addtional newline at the end of the file because nsILineInputStream.readLine doesn't return TRUE 
	// on the very last newline so the functor used in load() doesn't get called.
	//
	content += "\n";

	var file = this.nsifile();

	Filesystem.writeToFile(file, content);
}

// this method used to simply interate through m_collection but that leaves the output unsorted
// now it sorts the collection:
// - by type (a_sort_order)
// - by zid
// - by ascending key
//
ZinFeedCollection.prototype.toString = function(eol_char_arg)
{
	var ret = "";
	var i, key,zid;

	var a_key = new Object();

	var a_sort_order = [ null,
						 ZinFeedItem.typeAsString(ZinFeedItem.TYPE_FL),
						 ZinFeedItem.typeAsString(ZinFeedItem.TYPE_LN),
	                     ZinFeedItem.typeAsString(ZinFeedItem.TYPE_SF),
						 ZinFeedItem.typeAsString(ZinFeedItem.TYPE_CN) ];

	for (i = 0; i < a_sort_order.length; i++)
		a_key[a_sort_order[i]] = new Object();

	for (key in this.m_collection)
	{
		zfi = this.get(key);

		if (zfi.isPresent(ZinFeedItem.ATTR_TYPE))
			type = zfi.get(ZinFeedItem.ATTR_TYPE);
		else
			type = null;

		zuio = new Zuio(zfi.get(ZinFeedItem.ATTR_KEY));

		if (!isPropertyPresent(a_key[type], zuio.zid))
			a_key[type][zuio.zid] = new Array();

		a_key[type][zuio.zid].push(isNaN(zuio.id) ? zuio.id : Number(zuio.id));
	}

	var numeric_compare_function = function(a, b)
	{
		if(a > b)
			return 1;
		if(a < b)
			return -1;
		return 0;
	};

	for (i = 0; i < a_sort_order.length; i++)
		for (zid in a_key[a_sort_order[i]])
		{
			a_sorted_ids = a_key[a_sort_order[i]][zid];
			a_sorted_ids.sort(numeric_compare_function);

			for (j = 0; j < a_sorted_ids.length; j++)
				ret += this.m_collection[Zuio.key(a_sorted_ids[j], zid)].toString(eol_char_arg)+"\n";
		}

	return ret;
}

// The constructor takes one of three styles of arguments:
// - 0 arguments
// - 2 arguments                where the first argument is type and
//                                    the second argument is an object: eg new ZinFeedItem(ZinFeedItem.TYPE_FL, attributes)
// - an odd number of arguments where the first argument is type, followed by zero or more 
//                                    pairs of property/values: eg new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_KEY, 33);
//
function ZinFeedItem()
{
	this.m_properties = new Object();

	if (arguments.length == 2)
	{
		zinAssert(arguments[0] && typeof(arguments[1]) == 'object' && isPropertyPresent(arguments[1], ZinFeedItem.ATTR_KEY));

		this.set(ZinFeedItem.ATTR_TYPE, ZinFeedItem.typeAsString(arguments[0]));
		this.set(arguments[1]);
	}
	else if (arguments.length > 0)
	{
		zinAssert(arguments.length % 2 == 1);

		for (var i = 1; i < arguments.length; i+=2)
		{
			zinAssertAndLog(typeof(arguments[i]) != 'undefined',   " undefined key for: " + arguments[0]);
			zinAssertAndLog(typeof(arguments[i+1]) != 'undefined', " undefined value for attribute: " + arguments[i]);
			this.m_properties[arguments[i]] = arguments[i+1];
		}

		zinAssert(!isPropertyPresent(this.m_properties, ZinFeedItem.ATTR_TYPE));
		zinAssertAndLog(isPropertyPresent(this.m_properties, ZinFeedItem.ATTR_KEY),
		                   " ATTR_KEY missing from: " + aToString(this.m_properties));

		if (arguments[0] != null)
			this.m_properties[ZinFeedItem.ATTR_TYPE] = ZinFeedItem.typeAsString(arguments[0]);
	}
}

ZinFeedItem.prototype.get = function(key)
{
	zinAssertAndLog(this.isPresent(key), " key not present: " + key +
	                                     " key: " + (isPropertyPresent(this.m_properties, 'key') ? this.m_properties['key'] : "undefined"));

	return this.m_properties[key];
}

ZinFeedItem.prototype.getOrNull = function(key)
{
	return this.isPresent(key) ? this.m_properties[key] : null;
}

ZinFeedItem.prototype.del = function(key)
{
	zinAssert(this.isPresent(key));
	delete this.m_properties[key];
}

// - if one argument:  an object (iterated for properties)
// - if two arguments: name = value
//
ZinFeedItem.prototype.set = function(arg1, arg2)
{
	if (arguments.length == 2)
	{
		zinAssert(typeof(arg2) != 'object' && arg2 != null);

		this.m_properties[arg1] = arg2;
	}
	else if (arguments.length == 1 && (typeof(arg1) == 'object'))
	{
		// this is handy for creating/updating an existing ZinFeedItem based on a response from a zimbra server
		//
		zinAssert(this.isPresent(ZinFeedItem.ATTR_TYPE) &&
		          isPropertyPresent(arg1, ZinFeedItem.ATTR_KEY) &&
				  !isPropertyPresent(arg1, ZinFeedItem.ATTR_TYPE));

		for each (var j in ZinFeedItem.attributesForType(this.type()))
			this.setWhenValueDefined(j, arg1[j]);
	}
	else
		zinAssert(false);
}

ZinFeedItem.prototype.isPresent = function(key)
{
	return typeof(this.m_properties[key]) != 'undefined';
}

ZinFeedItem.prototype.length = function()
{
	return aToLength(this.m_properties);
}

ZinFeedItem.prototype.id = function()
{
	return this.get(ZinFeedItem.ATTR_ID);
}

ZinFeedItem.prototype.name = function()
{
	return this.get(ZinFeedItem.ATTR_NAME);
}

ZinFeedItem.prototype.key = function()
{
	return this.get(ZinFeedItem.ATTR_KEY);
}

ZinFeedItem.prototype.keyParent = function()
{
	var zuio = new Zuio(this.get(ZinFeedItem.ATTR_KEY));

	return Zuio.key(this.get(ZinFeedItem.ATTR_L), zuio.zid);
}

ZinFeedItem.prototype.isForeign = function()
{
	var zuio = new Zuio(this.get(ZinFeedItem.ATTR_KEY));

	return (zuio.zid != null);
}

ZinFeedItem.prototype.type = function()
{
	return ZinFeedItem.TYPE_BIMAP.lookup(null, this.get(ZinFeedItem.ATTR_TYPE));
}

ZinFeedItem.prototype.setWhenValueDefined = function(arg1, arg2)
{
	if (typeof(arg2) != 'undefined')
		this.m_properties[arg1] = arg2;
}

ZinFeedItem.prototype.forEach = function(functor, flavour)
{
	var fContinue;
	zinAssert(arguments.length == 2 && (flavour == ZinFeedItem.ITER_ALL || flavour == ZinFeedItem.ITER_GID_ITEM));

	for (var i in this.m_properties)
	{
		if (flavour == ZinFeedItem.ITER_GID_ITEM && (i == ZinFeedItem.ATTR_KEY || i == ZinFeedItem.ATTR_VER))
			fContinue = true;
		else
			fContinue = functor.run(i, this.m_properties[i]);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

ZinFeedItem.prototype.toString = function(eol_char_arg)
{
	var ret = "";
	var do_first = { type: null, key: null, id: null, l: null, name: null, ms: null, rev: null };
	var name;

	for (name in do_first)
		if (isPropertyPresent(this.m_properties, name))
			ret += name + "=" + this.m_properties[name] + ((arguments.length == 0 || typeof(eol_char_arg) != 'string') ? " " :eol_char_arg);

	for (name in this.m_properties)
		if (!isPropertyPresent(do_first, name))
			ret += name + "=" + this.m_properties[name] + ((arguments.length == 0 || typeof(eol_char_arg) != 'string') ? " " :eol_char_arg);

	return ret;
}

ZinFeedItem.prototype.increment = function(key)
{
	zinAssert(this.isPresent(key));

	var value = this.get(key);

	zinAssert(!isNaN(value));

	var ret = parseInt(value);

	this.set(key, ret + 1);

	return ret;
}

ZinFeedItem.prototype.decrement = function(key)
{
	zinAssert(this.isPresent(key));

	var value = this.get(key);

	zinAssert(!isNaN(value));

	var ret = parseInt(value);

	this.set(key, ret - 1);

	return ret;
}

ZinFeedItem.typeAsString = function(type)
{
	return ZinFeedItem.TYPE_BIMAP.lookup(type, null);
}

ZinFeedItem.attributesForType = function(type)
{
	var ret = [ ZinFeedItem.ATTR_KEY, ZinFeedItem.ATTR_ID, ZinFeedItem.ATTR_MS, ZinFeedItem.ATTR_L ];

	switch (type) {
		case ZinFeedItem.TYPE_CN: ret = ret.concat(ZinFeedItem.ATTR_REV);                         break;
		case ZinFeedItem.TYPE_FL: ret = ret.concat(ZinFeedItem.ATTR_NAME, ZinFeedItem.ATTR_PERM); break;
		case ZinFeedItem.TYPE_LN: ret = ret.concat(ZinFeedItem.ATTR_NAME, ZinFeedItem.ATTR_ZID, ZinFeedItem.ATTR_RID); break;
		default: zinAssertAndLog(false, "unmatched case: " + type);
	}

	return ret;
}
