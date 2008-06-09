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

FeedCollection.ITER_ALL          = 1;   // call functor for all items in the collection
FeedCollection.ITER_NON_RESERVED = 2;   // call functor for all items in the collection except those in KEYS_RESERVED

FeedItem.ITER_ALL                = 3;   // 
FeedItem.ITER_GID_ITEM           = 4;   // don't call functor when key == FeedItem.ATTR_KEY or key == FeedItem.ATTR_VER

FeedItem.KEY_AUTO_INCREMENT      = "1#zindus-housekeeping"; // this key is the one with the 'next' attribute
FeedItem.KEY_STATUSPANEL         = "2#zindus-housekeeping"; // this key is used in the StatusPanel's FeedCollection
FeedItem.KEYS_RESERVED           = newObject(FeedItem.KEY_AUTO_INCREMENT, null, FeedItem.KEY_STATUSPANEL, null);

FeedItem.ATTR_KEY  = 'key';
FeedItem.ATTR_MS   = 'ms';
FeedItem.ATTR_LS   = 'ls';   // last sync - concatenation of gid version, ms, DEL etc eg. 1#-134217729### or 1##1801#1801#
FeedItem.ATTR_VER  = 'ver';  // only an attribute in the gid
FeedItem.ATTR_REV  = 'rev';
FeedItem.ATTR_DEL  = 'del';
FeedItem.ATTR_ID   = 'id';
FeedItem.ATTR_L    = 'l';
FeedItem.ATTR_TPI  = 'tpi';  // thunderbird pref id - see http://www.xulplanet.com/references/xpcomref/ifaces/nsIAbDirectory.html
FeedItem.ATTR_TYPE = 'type';
FeedItem.ATTR_NAME = 'name';
FeedItem.ATTR_RID  = 'rid';  // <link> elements have this attribute - it's the id of the object in the remote users's account
FeedItem.ATTR_ZID  = 'zid';  // <link> elements have this attribute - it's the remote user's zimbraId
FeedItem.ATTR_LKEY = 'lkey'; // TYPE_SF elements have this attribute - it's the key of the <link> element
FeedItem.ATTR_FKEY = 'fkey'; // TYPE_SF elements have this attribute - it's the key of the foreign <folder> element
FeedItem.ATTR_SKEY = 'skey'; // TYPE_LN and foreign TYPE_FL elements have this attribute - it's the key of the TYPE_SF element
FeedItem.ATTR_PERM = 'perm'; // 
FeedItem.ATTR_CS   = 'cs';   // checksum
FeedItem.ATTR_CSGD = 'csgd'; // gd checksum for type == gd items - persisted but not used in compare()
FeedItem.ATTR_EDIT = 'edit'; // gd edit url - used for deletes
FeedItem.ATTR_PRES = 'pres'; // temporary (not persisted) - item was present during some previous iteration
FeedItem.ATTR_KEEP = 'keep'; // temporary (not persisted) - retain the item during cleanup (eg an unprocessed delete).

FeedItem.TYPE_CN   = 0x01; // contact
FeedItem.TYPE_FL   = 0x02; // folder
FeedItem.TYPE_LN   = 0x04; // link
FeedItem.TYPE_SF   = 0x08; // link-folder - a hybrid of <link> and remote <folder> managed by zindus
FeedItem.TYPE_MASK = (FeedItem.TYPE_CN | FeedItem.TYPE_FL | FeedItem.TYPE_LN | FeedItem.TYPE_SF);

FeedItem.TYPE_BIMAP = new BiMap(
		[FeedItem.TYPE_CN, FeedItem.TYPE_FL, FeedItem.TYPE_LN, FeedItem.TYPE_SF],
		['cn',                'fl',                'ln'               , 'sf'               ]);

function FeedCollection()
{
	this.m_collection = new Object();
	this.m_filename   = null; // this is a string containing the filename (like "fred.txt"), not an nsIFile
	this.m_logger     = newLogger("FeedCollection"); this.m_logger.level(Logger.NONE);
}

FeedCollection.prototype.clone = function()
{
	// we can't run cloneObject() on 'this' because it contains a logger
	// which contains a reference to an appender which doesn't clone.
	//
	var ret = new FeedCollection();

	ret.m_collection = cloneObject(this.m_collection);
	ret.m_filename   = cloneObject(this.m_filename);

	return ret;
}

FeedCollection.prototype.filename = function()
{
	if (arguments.length == 1)
		this.m_filename = arguments[0];

	this.m_logger.debug("filename: " + this.m_filename);
	return this.m_filename;
}

FeedCollection.prototype.nsifile = function()
{
	zinAssert(this.m_filename);

	var ret = Filesystem.getDirectory(Filesystem.DIRECTORY_DATA);

	ret.append(this.m_filename);

	return ret;
}

FeedCollection.prototype.length = function()
{
	return aToLength(this.m_collection);
}

FeedCollection.prototype.get = function(key)
{
	zinAssertAndLog(typeof(key) != 'undefined' && typeof(key) != 'object', "key: " + key);
	return (this.isPresent(key) ? this.m_collection[key] : null);
}

FeedCollection.prototype.set = function(zfi)
{
	zinAssert(zfi != null && typeof(zfi) == 'object');

	// migration-note: remove ATTR_ID when xpi update indicates that no clients are on versions earlier than 0.6.19.20080320.111511
	// ATTR_ID is only in the assertion below to allow status.txt versions pre 0.6.19.20080320.111511 to load - they had an id= but no key=
	//
	zinAssertAndLog(zfi.isPresent(FeedItem.ATTR_KEY) ||
	                zfi.isPresent(FeedItem.ATTR_ID),
					"zfi: " + zfi.toString());

	this.m_collection[zfi.m_properties[FeedItem.ATTR_KEY]] = zfi;
}

FeedCollection.prototype.del = function(key)
{
	zinAssert(this.isPresent(key));
	delete this.m_collection[key];
}

FeedCollection.prototype.isPresent = function(key)
{
	return typeof(this.m_collection[key]) != 'undefined';
}

FeedCollection.prototype.forEach = function(functor, flavour)
{
	var fContinue;

	if (arguments.length == 1)
		flavour = FeedCollection.ITER_NON_RESERVED;
	else if (arguments.length == 2)
		zinAssert(flavour == FeedCollection.ITER_ALL || flavour == FeedCollection.ITER_NON_RESERVED);

	for (var key in this.m_collection)
	{
		zinAssert(this.isPresent(key));

		if (flavour == FeedCollection.ITER_NON_RESERVED && (isPropertyPresent(FeedItem.KEYS_RESERVED, key)))
			fContinue = true;
		else
			fContinue = functor.run(this.m_collection[key]);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

FeedCollection.prototype.findFirst = function(functor_is_found)
{
	var functor_is_found_arg1 = arguments[FeedCollection.prototype.findFirst.length];

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

FeedCollection.prototype.load = function()
{
	var functor =
	{
		m_zfc: this,
		m_zfi: new FeedItem(),
		m_logger: this.m_logger,
		run: function(line)
		{
			// this.m_logger.debug("line.length: " + line.length + " line: " + line);

			if (line.charAt(0) == '#')
				; // do nothing
			else if (line.length == 0)
			{
				// this.m_logger.debug("setting this.m_zfc.m_collection[" + this.m_zfi.m_properties[FeedItem.ATTR_KEY] + "]");

				this.m_zfc.set(this.m_zfi);
				this.m_zfi = new FeedItem();
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

FeedCollection.prototype.save = function()
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
FeedCollection.prototype.toString = function(eol_char_arg)
{
	var ret = "";
	var i, key,zid;

	var a_key = new Object();

	var a_sort_order = [ null,
						 FeedItem.typeAsString(FeedItem.TYPE_FL),
						 FeedItem.typeAsString(FeedItem.TYPE_LN),
	                     FeedItem.typeAsString(FeedItem.TYPE_SF),
						 FeedItem.typeAsString(FeedItem.TYPE_CN) ];

	for (i = 0; i < a_sort_order.length; i++)
		a_key[a_sort_order[i]] = new Object();

	for (key in this.m_collection)
	{
		zfi = this.get(key);

		if (zfi.isPresent(FeedItem.ATTR_TYPE))
			type = zfi.get(FeedItem.ATTR_TYPE);
		else
			type = null;

		zuio = new Zuio(zfi.get(FeedItem.ATTR_KEY));

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
//                                    the second argument is an object: eg new FeedItem(FeedItem.TYPE_FL, attributes)
// - an odd number of arguments where the first argument is type, followed by zero or more 
//                                    pairs of property/values: eg new FeedItem(FeedItem.TYPE_FL, FeedItem.ATTR_KEY, 33);
//
function FeedItem()
{
	this.m_properties = new Object();

	if (arguments.length == 2)
	{
		zinAssert(arguments[0] && typeof(arguments[1]) == 'object' && isPropertyPresent(arguments[1], FeedItem.ATTR_KEY));

		this.set(FeedItem.ATTR_TYPE, FeedItem.typeAsString(arguments[0]));
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

		zinAssert(!isPropertyPresent(this.m_properties, FeedItem.ATTR_TYPE));
		zinAssertAndLog(isPropertyPresent(this.m_properties, FeedItem.ATTR_KEY),
		                   " ATTR_KEY missing from: " + aToString(this.m_properties));

		if (arguments[0] != null)
			this.m_properties[FeedItem.ATTR_TYPE] = FeedItem.typeAsString(arguments[0]);
	}
}

FeedItem.prototype.get = function(key)
{
	zinAssertAndLog(this.isPresent(key), " key not present: " + key +
	                                     " key: " + (isPropertyPresent(this.m_properties, 'key') ? this.m_properties['key'] : "undefined"));

	return this.m_properties[key];
}

FeedItem.prototype.getOrNull = function(key)
{
	return this.isPresent(key) ? this.m_properties[key] : null;
}

FeedItem.prototype.del = function(key)
{
	zinAssert(this.isPresent(key));
	delete this.m_properties[key];
}

// - if one argument:  an object (iterated for properties)
// - if two arguments: name = value
//
FeedItem.prototype.set = function(arg1, arg2)
{
	if (arguments.length == 2)
	{
		zinAssert(typeof(arg2) != 'object' && arg2 != null);

		this.m_properties[arg1] = arg2;
	}
	else if (arguments.length == 1 && (typeof(arg1) == 'object'))
	{
		// this is handy for creating/updating an existing FeedItem based on a response from a zimbra server
		//
		zinAssert(this.isPresent(FeedItem.ATTR_TYPE) &&
		          isPropertyPresent(arg1, FeedItem.ATTR_KEY) &&
				  !isPropertyPresent(arg1, FeedItem.ATTR_TYPE));

		for each (var j in FeedItem.attributesForType(this.type()))
			this.setWhenValueDefined(j, arg1[j]);
	}
	else
		zinAssert(false);
}

FeedItem.prototype.isPresent = function(key)
{
	return typeof(this.m_properties[key]) != 'undefined';
}

FeedItem.prototype.length = function()
{
	return aToLength(this.m_properties);
}

FeedItem.prototype.id = function()
{
	return this.get(FeedItem.ATTR_ID);
}

FeedItem.prototype.name = function()
{
	return this.get(FeedItem.ATTR_NAME);
}

FeedItem.prototype.key = function()
{
	return this.get(FeedItem.ATTR_KEY);
}

FeedItem.prototype.keyParent = function()
{
	var zuio = new Zuio(this.get(FeedItem.ATTR_KEY));

	return Zuio.key(this.get(FeedItem.ATTR_L), zuio.zid);
}

FeedItem.prototype.isForeign = function()
{
	var zuio = new Zuio(this.get(FeedItem.ATTR_KEY));

	return (zuio.zid != null);
}

FeedItem.prototype.type = function()
{
	return FeedItem.TYPE_BIMAP.lookup(null, this.get(FeedItem.ATTR_TYPE));
}

FeedItem.prototype.setWhenValueDefined = function(arg1, arg2)
{
	if (typeof(arg2) != 'undefined')
		this.m_properties[arg1] = arg2;
}

FeedItem.prototype.forEach = function(functor, flavour)
{
	var fContinue;
	zinAssert(arguments.length == 2 && (flavour == FeedItem.ITER_ALL || flavour == FeedItem.ITER_GID_ITEM));

	for (var i in this.m_properties)
	{
		if (flavour == FeedItem.ITER_GID_ITEM && (i == FeedItem.ATTR_KEY || i == FeedItem.ATTR_VER))
			fContinue = true;
		else
			fContinue = functor.run(i, this.m_properties[i]);

		zinAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

FeedItem.prototype.toString = function(eol_char_arg)
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

FeedItem.prototype.increment = function(key)
{
	zinAssert(this.isPresent(key));

	var value = this.get(key);

	zinAssert(!isNaN(value));

	var ret = parseInt(value);

	this.set(key, ret + 1);

	return ret;
}

FeedItem.prototype.decrement = function(key)
{
	zinAssert(this.isPresent(key));

	var value = this.get(key);

	zinAssert(!isNaN(value));

	var ret = parseInt(value);

	this.set(key, ret - 1);

	return ret;
}

FeedItem.typeAsString = function(type)
{
	return FeedItem.TYPE_BIMAP.lookup(type, null);
}

FeedItem.attributesForType = function(type)
{
	var ret = [ FeedItem.ATTR_KEY, FeedItem.ATTR_ID, FeedItem.ATTR_MS, FeedItem.ATTR_L ];

	switch (type) {
		case FeedItem.TYPE_CN: ret = ret.concat(FeedItem.ATTR_REV);                         break;
		case FeedItem.TYPE_FL: ret = ret.concat(FeedItem.ATTR_NAME, FeedItem.ATTR_PERM); break;
		case FeedItem.TYPE_LN: ret = ret.concat(FeedItem.ATTR_NAME, FeedItem.ATTR_ZID, FeedItem.ATTR_RID); break;
		default: zinAssertAndLog(false, "unmatched case: " + type);
	}

	return ret;
}
