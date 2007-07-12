include("chrome://zindus/content/logger.js");

ZinFeedCollection.ITER_ALL        = 0;   // various flavours of foreach
ZinFeedCollection.ITER_UNRESERVED = 1;   // only call functor when key == id and id > ID_MAX_RESERVED

ZinFeedItem.ITER_ALL              = 0;   // 
ZinFeedItem.ITER_SOURCEID         = 1;   // don't call functor when key == id or key == ZinFeedItem.ATTR_VER

ZinFeedItem.ID_AUTO_INCREMENT = 0;      // this id is the one with the 'next' attribute
ZinFeedItem.ID_MAX_RESERVED   = 256;    // the 'next' attribute of the AUTO_INCREMENT item starts at this value + 1.

ZinFeedItem.ATTR_MS   = 'ms';
ZinFeedItem.ATTR_MD   = 'md';
ZinFeedItem.ATTR_LS   = 'ls';   // last sync - concatenation of gid version, ms, md, DEL and OFI eg. 3-1234-1168484761-1-0
ZinFeedItem.ATTR_VER  = 'ver';  // only an attribute in the gid
ZinFeedItem.ATTR_REV  = 'rev';
ZinFeedItem.ATTR_DEL  = 'del';
ZinFeedItem.ATTR_ID   = 'id';
ZinFeedItem.ATTR_TPI  = 'tpi';  // thunderbird pref id - see http://www.xulplanet.com/references/xpcomref/ifaces/nsIAbDirectory.html
ZinFeedItem.ATTR_TYPE = 'type';

ZinFeedItem.TYPE_FL   = 0x01; // folder
ZinFeedItem.TYPE_CN   = 0x02; // contact
ZinFeedItem.TYPE_MASK = (ZinFeedItem.TYPE_FL | ZinFeedItem.TYPE_CN);

ZinFeedItem.TYPE_BIMAP = new BiMap(
		[ZinFeedItem.TYPE_FL, ZinFeedItem.TYPE_CN],
		['fl',                'cn',            ]);

function ZinFeedCollection(has_reserved_range)
{
	this.m_collection  = new Object();
	this.has_reserved_range = has_reserved_range;
}

ZinFeedCollection.fileName = function()
{
	var ret = "";

	for (var i = 0; i < arguments.length; i++)
	{
		if (i > 0)
			ret += "-";

		ret += arguments[i];
	}

	ret += ".txt";

	return ret;
}

ZinFeedCollection.prototype.length = function()
{
	return aToLength(this.m_collection);
}

ZinFeedCollection.prototype.get = function(id)
{
	return (this.isPresent(id) ? this.m_collection[id] : null);
}

ZinFeedCollection.prototype.set = function(zfi)
{
	cnsAssert(zfi != null && zfi.isPresent(ZinFeedItem.ATTR_ID));
	this.m_collection[zfi.m_properties[ZinFeedItem.ATTR_ID]] = zfi;
}

ZinFeedCollection.prototype.del = function(id)
{
	cnsAssert(this.isPresent(id));
	delete this.m_collection[id];
}

ZinFeedCollection.prototype.isPresent = function(id)
{
	return typeof(this.m_collection[id]) != 'undefined';
}

ZinFeedCollection.prototype.forEach = function(functor, flavour)
{
	var fContinue;
	cnsAssert(arguments.length == 2 && (flavour == ZinFeedCollection.ITER_ALL || flavour == ZinFeedCollection.ITER_UNRESERVED));

	for (var id in this.m_collection)
	{
		cnsAssert(this.isPresent(id));

		if (flavour == ZinFeedCollection.ITER_UNRESERVED && (id <= ZinFeedItem.ID_MAX_RESERVED))
			fContinue = true;
		else
			fContinue = functor.run(this.m_collection[id]);

		cnsAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

ZinFeedCollection.prototype.load = function(filename)
{
	var functor =
	{
		run: function(line)
		{
			// gLogger.debug("line.length: " + line.length);
			// gLogger.debug("line: " + line);

			if (line.charAt(0) == '#')
				; // do nothing
			else if (line.length == 0)
			{
				// gLogger.debug("setting this.m_zfc.m_collection[" + this.m_zfi.m_properties[ZinFeedItem.ATTR_ID] + "]");

				this.m_zfc.set(this.m_zfi);
				this.m_zfi = new ZinFeedItem();
			}
			else
			{
				var eq  = line.indexOf('=');

				this.m_zfi.set([line.substring(0, eq)], line.substring(eq + 1));

				// gLogger.debug("this.m_zfi.m_properties[" + line.substring(0, eq) + "] = " + line.substring(eq + 1));
			}
		}
	};

	functor.m_zfc  = this;
	functor.m_zfi = new ZinFeedItem();

	var file = Filesystem.getDirectory(Filesystem.DIRECTORY_MAPPING);
	file.append(filename);
	// gLogger.debug("about to parse file: " + file.path);

	if (file.exists() && !file.isDirectory())
		Filesystem.fileReadByLine(file.path, functor);
}

ZinFeedCollection.prototype.save = function(filename)
{
	var content = this.toString("\n");

	// need an addtional newline at the end of the file because nsILineInputStream.readLine doesn't return TRUE on the very last newline
	// so the functor used in load() doesn't get called.
	content += "\n";

	var file = Filesystem.getDirectory(Filesystem.DIRECTORY_MAPPING);

	if (!file.exists() || !file.isDirectory())
	{
		gLogger.debug("435656: about to create: " + file.path);

		file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
	}

	file.append(filename);

	Filesystem.writeToFile(file, content);
}

ZinFeedCollection.prototype.toString = function(eol_char_arg)
{
	var ret = "";
	var id;

	for (id in this.m_collection)
		ret += this.m_collection[id].toString(eol_char_arg) + "\n";

	return ret;
}

// The constructor takes one of three styles of arguments:
// - 0 arguments
// - 2 arguments                where the first argument is type and
//                                    the second argument is an object: eg new ZinFeedItem(ZinFeedItem.TYPE_FL, attributes)
// - an odd number of arguments where the first argument is type, followed by zero or more 
//                                    pairs of property/values: eg new ZinFeedItem(ZinFeedItem.TYPE_FL, ZinFeedItem.ATTR_ID, 33);
//
function ZinFeedItem()
{
	this.m_properties = new Object();

	if (arguments.length == 2)
	{
		cnsAssert(arguments[0] && typeof(arguments[1]) == 'object' && isPropertyPresent(arguments[1], ZinFeedItem.ATTR_ID));

		this.set(ZinFeedItem.ATTR_TYPE, ZinFeedItem.typeAsString(arguments[0]));
		this.set(arguments[1]);
	}
	else if (arguments.length > 0)
	{
		cnsAssert(arguments.length % 2 == 1);

		for (var i = 1; i < arguments.length; i+=2)
			this.m_properties[arguments[i]] = arguments[i+1];

		cnsAssert(!isPropertyPresent(this.m_properties, ZinFeedItem.ATTR_TYPE));
		cnsAssert(isPropertyPresent(this.m_properties, ZinFeedItem.ATTR_ID));

		if (arguments[0] != null)
			this.m_properties[ZinFeedItem.ATTR_TYPE] = ZinFeedItem.typeAsString(arguments[0]);
	}
}

ZinFeedItem.prototype.get = function(key)
{
	if (!this.isPresent(key))
	{
		gLogger.error("ZinFeedItem.get: key not present: " + key);
		cnsAssert(false);
	}

	return this.m_properties[key];
}

ZinFeedItem.prototype.getOrNull = function(key)
{
	return this.isPresent(key) ? this.m_properties[key] : null;
}

ZinFeedItem.prototype.del = function(key)
{
	cnsAssert(this.isPresent(key));
	delete this.m_properties[key];
}

// - if one argument:  an object (iterated for properties)
// - if two arguments: name = value
//
ZinFeedItem.prototype.set = function(arg1, arg2)
{
	if (arguments.length == 2)
	{
		cnsAssert(typeof(arg2) != 'object' && arg2 != null);

		this.m_properties[arg1] = arg2;
	}
	else if (arguments.length == 1 && (typeof(arg1) == 'object'))
	{
		// this is handy for creating/updating an existing ZinFeedItem based on a response from a zimbra server
		//
		cnsAssert(this.isPresent(ZinFeedItem.ATTR_TYPE) &&
		          isPropertyPresent(arg1, ZinFeedItem.ATTR_ID) &&
				  !isPropertyPresent(arg1, ZinFeedItem.ATTR_TYPE));

		for each (var j in ZinFeedItem.zimbraAttributesForType(this.type()))
			this.setWhenValueDefined(j, arg1[j]);
	}
	else
		cnsAssert(false);
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
	cnsAssert(arguments.length == 2 && (flavour == ZinFeedItem.ITER_ALL || flavour == ZinFeedItem.ITER_SOURCEID));

	for (var i in this.m_properties)
	{
		if (flavour == ZinFeedItem.ITER_SOURCEID && (i == ZinFeedItem.ATTR_ID || i == ZinFeedItem.ATTR_VER))
			fContinue = true;
		else
			fContinue = functor.run(i, this.m_properties[i]);

		cnsAssert(typeof(fContinue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (!fContinue)
			break;
	}
}

ZinFeedItem.prototype.toString = function(eol_char_arg)
{
	var ret = "";

	for (var name in this.m_properties)
		ret += name + "=" + this.m_properties[name] + ((arguments.length == 0 || typeof(eol_char_arg) != 'string') ? " " : eol_char_arg);

	return ret;
}

ZinFeedItem.typeAsString = function(type)
{
	return ZinFeedItem.TYPE_BIMAP.lookup(type, null);
}

ZinFeedItem.zimbraAttributesForType = function(type)
{
	var ret;

	switch (type) {
		case ZinFeedItem.TYPE_FL: ret = [ZinFeedItem.ATTR_ID, ZinFeedItem.ATTR_MS, 'l', 'name'];                     break;
		case ZinFeedItem.TYPE_CN: ret = [ZinFeedItem.ATTR_ID, ZinFeedItem.ATTR_MS, 'l', ZinFeedItem.ATTR_MD, ZinFeedItem.ATTR_REV]; break;
		// not implemented: TYPE_FL ...  ['id', 'l', ZinFeedItem.ATTR_MD, FEED_ITEM_ATTR_REV, 'fileAsStr']
		default: cnsAssert(false);
	}

	return ret;
}

function ZinFeed()
{
}

ZinFeed.autoIncrement = function(zfi, key)
{
	cnsAssert(typeof(zfi) == 'object' && zfi != null && zfi.isPresent(key));

	var ret = parseInt(zfi.get(key));

	cnsAssert(ret > 0);

	zfi.set(key, ret + 1);

	return ret;
}

// ZinFeed.getBimapTopLevelFolderLuidName = function(zfc)
// if attr == 'name' this method returns a bimap of 'id' and 'name'.
ZinFeed.getTopLevelFolderLuidBimap = function(zfc, attr, iter_flavour)
{
	var functor =
	{
		m_a_id:   new Array(),
		m_a_attr: new Array(),
		type_fl:  ZinFeedItem.typeAsString(ZinFeedItem.TYPE_FL),

		run: function(zfi)
		{
			if (zfi.get(ZinFeedItem.ATTR_TYPE) == this.type_fl &&
			    zfi.get('l') == '1' &&
				zfi.get('id') != ZIMBRA_ID_TRASH)
			{
				this.m_a_id.push(zfi.get(ZinFeedItem.ATTR_ID));
				this.m_a_attr.push(zfi.get(attr));
			}

			return true;
		}
	};

	zfc.forEach(functor, iter_flavour);

	var bimap = new BiMap(functor.m_a_id, functor.m_a_attr);

	gLogger.debug("blah: 8855888555: bimap: " + bimap.toString());

	return bimap;
}

ZinFeed.getContactIdsForParent = function(zfc, l)
{
	var functor =
	{
		m_a_result: new Array(),
		type_cn:    ZinFeedItem.typeAsString(ZinFeedItem.TYPE_CN),

		run: function(zfi)
		{
			if (zfi.get(ZinFeedItem.ATTR_TYPE) == this.type_cn && zfi.isPresent('l') && zfi.get('l') == 1)
				this.m_a_result.push(zfi.get(ZinFeedItem.ATTR_ID));

			return true;
		}
	};

	zfc.forEach(functor, ZinFeedCollection.ITER_UNRESERVED);

	gLogger.debug("554466 - getContactIdsForParent() returns: " + functor.m_a_result.toString());

	return functor.m_a_result;
}
