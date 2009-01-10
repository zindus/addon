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

// suo == Source Update Operation
//

Suo.ADD  = 0x10; // these are OR-ed with FeedItem.TYPE_*
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

Suo.bimap_opcode_UI = new BiMap(
	[ Suo.ADD,   Suo.MOD,     Suo.DEL     ],
	[ 'suo.add',  'suo.modify', 'suo.delete' ]);  // these are string ids from zindus.properties

function Suo(gid, sourceid_winner, sourceid_target, opcode)
{
	this.gid             = gid;
	this.sourceid_winner = sourceid_winner;
	this.sourceid_target = sourceid_target;
	this.opcode          = opcode;
}

Suo.prototype.toString = function()
{
	return      "gid: =" + this.gid +
			" winner: "  + this.sourceid_winner +
			" target: "  + this.sourceid_target +
			" opcode: "  + Suo.opcodeAsString(this.opcode);
}

Suo.opcodeAsString = function(opcode)
{
	return Suo.bimap_opcode.lookup(opcode);
}

Suo.opcodeAsStringPastTense = function(opcode)
{
	return Suo.bimap_opcode_past_tense.lookup(opcode);
}

Suo.opcodeAsStringForUI = function(opcode)
{
	return stringBundleString(Suo.bimap_opcode_UI.lookup(opcode));
}

function SuoIterator(aSuo) {
	if (aSuo)
		this.iterator(null, aSuo)
}

SuoIterator.prototype = {
iterator: function(fn, aSuo) {
	if (aSuo)
		this.m_a_suo = aSuo;
	this.m_fn    = fn;
	// logger().debug("SuoIterator: AMHERE 1: m_a_suo: " + aToString(this.m_a_suo));
	return this;
},
__iterator__: function(is_keys_only) {
	var i, id, bucket, sourceid, suo, is_do;

	zinAssert(this.m_fn && this.m_a_suo);

	// logger().debug("SuoIterator: AMHERE 2");

	for (sourceid in this.m_a_suo)
		if (sourceid in this.m_a_suo)
			for (i = 0; i < ORDER_SOURCE_UPDATE.length; i++)
			{
				bucket = ORDER_SOURCE_UPDATE[i];
				is_do  = false;

				// logger().debug("SuoIterator: AMHERE 3: bucket: " + bucket );

				if (bucket in this.m_a_suo[sourceid])
					is_do = this.m_fn(sourceid, bucket);

				if (is_do)
					for (id in this.m_a_suo[sourceid][bucket])
					{
						suo = this.m_a_suo[sourceid][bucket][id];
						logger().debug("SuoIterator: AMHERE: yielding id: " + id + " suo: " + suo.toString());
						yield is_keys_only ? suo : [ id, suo ];
					}
			}
}
};

