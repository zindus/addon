function BiMap(array_a, array_b)
{
	cnsAssert(typeof(array_a) == 'object' && typeof(array_b) == 'object');

	this.m_array_a = array_a;
	this.m_array_b = array_b;

	this.m_a = new Object();
	this.m_b = new Object();

	cnsAssert(array_a.length == array_b.length);

	for (var i = 0; i < array_a.length; i++)
	{
		cnsAssert(typeof(array_a[i]) == 'string' || typeof(array_a[i]) == 'number');
		cnsAssert(typeof(array_b[i]) == 'string' || typeof(array_b[i]) == 'number');
		cnsAssert(!isPropertyPresent(this.m_a, array_a[i]));  // no duplicates allowed in either array
		cnsAssert(!isPropertyPresent(this.m_b, array_b[i]));

		this.m_a[array_a[i]] = array_b[i];
		this.m_b[array_b[i]] = array_a[i];
	}
}

BiMap.prototype.getObjAndKey = function(key_a, key_b)
{
	var c = 0;
	c += (key_a == null) ? 0 : 1;
	c += (key_b == null) ? 0 : 1;
	cnsAssert(c == 1); // exactly one of the keys must be non-null

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

	cnsAssert(isPropertyPresent(obj, key));

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
