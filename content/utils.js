function cnsAssert(expr)
{
	if (!expr)
	{
		try
		{
			throw new Error("Internal error in extension: assert failed");
		}
		catch(ex)
		{
			if (typeof alert == 'function')
				alert(ex.message + " stack: \n" + ex.stack);
			else
				print(ex.message + " stack: \n" + ex.stack);

			throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
		}
	}
}

function cnsCloneObject(obj)
{
	var ret;

	if (typeof(obj) == 'object' && obj != null)
	{
		ret = new Object();

		for (var i in obj)
			ret[i] = cnsCloneObject(obj[i]);
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

function stringBundleString(id_string)
{
	var stringbundle = document.getElementById("zindus-stringbundle");
	var ret = "";
	var is_exception = false;

	cnsAssert(stringbundle != null);

	try
	{
		ret = stringbundle.getString(EXTENSION_NAME + "." + id_string);
	}
	catch (e)
	{
		gLogger.error("Exception: e");
		is_exception = true;
	}

	cnsAssert(!is_exception);

	return ret;
}

function xmlDocumentToString(doc)
{
	// dump("xmlDocumentToString: typeof doc == " + typeof doc + "\n");
	// dump("xmlDocumentToString: doc == " + doc + "\n");
	cnsAssert(doc != null);

	var serializer = new XMLSerializer();
	// dump("771. in xmlDocumentToString(), serializer is " + serializer + "\n");
    var str = serializer.serializeToString(doc);
	// dump("772. in xmlDocumentToString(), str is " + str + "\n");

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
	cnsAssert(node.nodeType == Node.ELEMENT_NODE);

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

		cnsAssert(!was_exception_thrown);
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
	cnsAssert(typeof a == 'array');

	return a.indexOf(item) != -1;
}

// isIn(id_fsm, [ blah1, blah2 ] )

function isPropertyPresent(obj, property)
{
	cnsAssert(arguments.length == 2); // this function has two arguments!

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
		cnsAssert(typeof(arguments[0]) == 'object');

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

	cnsAssert(ret != null);

	return ret;
}

function getTime()
{
	var now = new Date();

	return now.getTime();
}

function hyphenate()
{
	var ret = "";
	var isFirst = true;
	var separator = arguments[0];

	for (var i = 1; i < arguments.length; i++)
	{
		cnsAssert(typeof(arguments[i]) == 'string' || typeof(arguments[i]) == 'number');

		if (isFirst)
		{
			isFirst = false;
			ret += arguments[i];
		}
		else
			ret += separator + arguments[i];
	}

	return ret;
}
