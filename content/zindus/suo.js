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
// $Id: suo.js,v 1.21 2009-09-01 04:28:00 cvsuser Exp $

// suo == Source Update Operation
//
Suo.ADD  = 0x1000; // these are OR-ed with FeedItem.TYPE_*
Suo.MOD  = 0x2000;
Suo.DEL  = 0x4000;
Suo.MDU  = 0x8000; // this is a fake operation - it only applies to winners and it bumps the gid VER and luid LS attributes
Suo.MASK = (Suo.ADD | Suo.MOD | Suo.DEL | Suo.MDU);

Suo.bimap_opcode = new BiMap(
	[ Suo.ADD, Suo.MOD,  Suo.DEL,  Suo.MDU            ],
	[ 'add',   'modify', 'delete', 'meta-data-update' ]);

Suo.bimap_opcode_UI = new BiMap(
	[ Suo.ADD,   Suo.MOD,      Suo.DEL      ],
	[ 'suo.add', 'suo.modify', 'suo.delete' ]);  // these are string ids from zindus.properties

Suo.ORDER_SOURCE_UPDATE = [
	Suo.MOD | FeedItem.TYPE_FL, Suo.MOD | FeedItem.TYPE_SF, Suo.MOD | FeedItem.TYPE_GG,
	Suo.ADD | FeedItem.TYPE_FL, Suo.ADD | FeedItem.TYPE_SF, Suo.ADD | FeedItem.TYPE_GG,
	Suo.DEL | FeedItem.TYPE_CN,
	Suo.MOD | FeedItem.TYPE_CN,
	Suo.ADD | FeedItem.TYPE_CN,
	Suo.DEL | FeedItem.TYPE_FL, Suo.DEL | FeedItem.TYPE_SF, Suo.DEL | FeedItem.TYPE_GG
];

function Suo(gid, sourceid_winner, sourceid_target, opcode)
{
	this.gid             = gid;
	this.sourceid_winner = sourceid_winner;
	this.sourceid_target = sourceid_target;
	this.opcode          = opcode;
	this.is_processed    = false; // used in sanity checking that all operations are processed exactly once
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

// return a comparison function for use with SuoIterator
//
Suo.match_with_bucket = function() {
	var args = arrayFromArguments(arguments);
	var fn = function(sourceid, bucket) {
		var ret = false;
		for (var i = 0; i < args.length && !ret; i++)
			ret = (bucket == args[i])
		return ret;
		};
	return fn;
}

Suo.count = function(aSuo, fn) {
	let it = new SuoIterator(aSuo);
	let ret = 0;
	for (suo in it.iterator(fn))
		ret++;
	return ret;
}

function SuoKey(sourceid, bucket, id)
{
	this.sourceid = sourceid ? sourceid : null;
	this.bucket   = bucket   ? bucket   : null;
	this.id       = id       ? id       : null;
}

SuoKey.prototype = {
	isEqual : function(key_suo) {
		return (this.sourceid == key_suo.sourceid && this.bucket == key_suo.bucket && this.id == key_suo.id);
	},
	toString : function() {
		return "sourceid: " + this.sourceid +
		       " bucket: "  + Suo.opcodeAsString(this.bucket & Suo.MASK) + '|' + FeedItem.typeAsString(this.bucket & FeedItem.TYPE_MASK) +
	           " id: "      + this.id;
	}
};

function SuoIterator(aSuo) {
	if (aSuo)
		this.iterator(null, aSuo)
}

SuoIterator.prototype = {
iterator : function(fn, aSuo) {
	if (aSuo)
		this.m_a_suo = aSuo;
	this.m_fn    = fn;
	return this;
},
generator : function(fn, aSuo) {
	var key, suo;
	this.iterator(fn, aSuo);
	for ([key, suo] in this)
		yield [key, suo];
	yield false;
},
__iterator__: function(is_keys_only) {
	var i, id, bucket, sourceid, is_do;
	var key = new SuoKey();

	zinAssert(this.m_fn && this.m_a_suo);

	for (sourceid in this.m_a_suo)
		if (sourceid in this.m_a_suo)
			for (i = 0; i < Suo.ORDER_SOURCE_UPDATE.length; i++)
			{
				bucket = Suo.ORDER_SOURCE_UPDATE[i];
				is_do  = false;

				if (bucket in this.m_a_suo[sourceid])
					is_do = this.m_fn(sourceid, bucket);

				if (is_do)
					for (id in this.m_a_suo[sourceid][bucket])
					{
						let suo = this.m_a_suo[sourceid][bucket][id];
						key.sourceid = sourceid;
						key.bucket   = bucket;
						key.id       = id;
						logger().debug("SuoIterator: yielding key: " + key.toString() + " suo: " + suo.toString());
						yield is_keys_only ? suo : [ cloneObject(key), suo ]; // clone the key so that the user can keep a reference
					}
			}
}
};
