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

Suo.bimap_opcode_UI = new BiMap(
	[ Suo.ADD,   Suo.MOD,      Suo.DEL      ],
	[ 'suo.add', 'suo.modify', 'suo.delete' ]);  // these are string ids from zindus.properties

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
			" opcode: "  + this.opcodeAsString();
}

Suo.prototype.opcodeAsString = function()
{
	return Suo.bimap_opcode.lookup(this.opcode);
}

Suo.opcodeAsString = function(opcode)
{
	return Suo.bimap_opcode.lookup(opcode);
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
	return this;
},
__iterator__: function(is_keys_only) {
	var i, id, bucket, sourceid, suo, is_do;
	var key = { sourceid: null, bucket: null, id: null };

	zinAssert(this.m_fn && this.m_a_suo);

	for (sourceid in this.m_a_suo)
		if (sourceid in this.m_a_suo)
			for (i = 0; i < ORDER_SOURCE_UPDATE.length; i++)
			{
				bucket = ORDER_SOURCE_UPDATE[i];
				is_do  = false;

				if (bucket in this.m_a_suo[sourceid])
					is_do = this.m_fn(sourceid, bucket);

				if (is_do)
					for (id in this.m_a_suo[sourceid][bucket])
					{
						suo = this.m_a_suo[sourceid][bucket][id];
						key.sourceid = sourceid;
						key.bucket   = bucket;
						key.id       = id;
						logger().debug("SuoIterator: AMHERE: yielding key: " + aToString(key) + " suo: " + suo.toString());
						yield is_keys_only ? suo : [ key, suo ];
					}
			}
}
};
