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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

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

Suo.bimap_opcode_past_tense = new BiMap(
	[ Suo.ADD,   Suo.MOD,    Suo.DEL   ],
	[ 'added',   'modified', 'deleted' ]);

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

Suo.opcodeAsStringPastTense = function(opcode)
{
	return Suo.bimap_opcode_past_tense.lookup(opcode);
}

function SuoCollection()
{
	this.m_collection  = new Object();
}

SuoCollection.prototype.assertValidKey = function(key)
{
	zinAssert(isPropertyPresent(key, "sourceid") && isPropertyPresent(key, "bucket") && isPropertyPresent(key, "id"));
}

SuoCollection.prototype.get = function(key)
{
	zinAssert(isPropertyPresent(this.m_collection, key.sourceid) &&
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
