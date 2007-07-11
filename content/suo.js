// suo == Source Update Operation
//

Suo.ADD  = 0x10; // these are OR-ed with ZinFeedItem.TYPE_*
Suo.MOD  = 0x20;
Suo.DEL  = 0x40;
Suo.MDU  = 0x80; // this is a fake operation - it only applies to winners and it bumps the gid VER and luid LS attributes
Suo.MASK = (Suo.ADD | Suo.MOD | Suo.DEL | Suo.MDU);

Suo.bimap_opcode = new BiMap(
	[ Suo.ADD, Suo.MOD,  Suo.DEL,  Suo.MDU            ],
	[ 'add',   'modify', 'delete', 'meta-data-update' ]);

function Suo(gid, sourceid_winner, sourceid_target, opcode)
{
	this.gid             = gid;
	this.sourceid_winner = sourceid_winner;
	this.sourceid_target = sourceid_target;
	this.opcode          = opcode;
}

Suo.prototype.toString = function()
{
	return      "gid: " + this.gid +
			" winner: " + this.sourceid_winner +
			" target: " + this.sourceid_target +
			" opcode: " + Suo.opcodeAsString(this.opcode);
}

Suo.opcodeAsString = function(opcode)
{
	return Suo.bimap_opcode.lookup(opcode);
}

function SuoCollection()
{
	this.m_collection  = new Object();
}

SuoCollection.prototype.assertValidKey = function(key)
{
	cnsAssert(isPropertyPresent(key, "sourceid") && isPropertyPresent(key, "bucket") && isPropertyPresent(key, "id"));
}

SuoCollection.prototype.get = function(key)
{
	cnsAssert(isPropertyPresent(this.m_collection, key.sourceid) &&
	          isPropertyPresent(this.m_collection[key.sourceid], key.bucket) &&
	          isPropertyPresent(this.m_collection[key.sourceid][key.bucket][key.id]));

	return this.m_collection[key.sourceid][key.bucket][key.id];
}

SuoCollection.prototype.set = function(key, suo)
{
	this.assertValidKey(key);

	if (!isPropertyPresent(this.m_collection, key.sourceid))
		this.m_collection[key.sourceid] = new Object();

	if (!isPropertyPresent(this.m_collection[key.sourceid], key.bucket))
		this.m_collection[key.sourceid][key.bucket] = new Object();

	this.m_collection[key.sourceid][key.bucket][key.id] = suo;
}

function SuoCollectionIterator(sc, iterator_type)
{
	this.sc = sc;
}

SuoCollectionIterator.prototype.getNext = function()
{
	return key; // key.sourceid key.bucket key.id
}
