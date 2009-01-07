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

// Two styles of argument to the constructor:
// var enm = new ZinEnum(kA, kB, kC) or
// var enm = new ZinEnum({ kA: 0x01, kB : 0x02, kC : 0x04 });

function ZinEnum() {
	var i, key, value;

	zinAssert(arguments.length > 0 && (typeof(arguments[0] == 'object' || (arguments.length % 2 == 0))));

	this.m_properties = new Object();
	this.m_reverse    = new Object();

	if (typeof(arguments[0]) == 'object')
		for (key in arguments[0])
			this.m_properties[key] = arguments[0][key];
	else
		for (i = 0; i < arguments.length; i++)
			this.m_properties[arguments[i]] = i+1;

	for (key in this.m_properties)
	{
		this.__defineGetter__(key, this.getter(key));

		value = this.m_properties[key];

		zinAssertAndLog(!(value in this.m_reverse), value);

		this.m_reverse[value] = key;
	}
}

ZinEnum.prototype = {
initialise: function(properties) {
	zinAssert(typeof(properties) == 'object');
	var key;

	this.m_properties = properties;
	this.m_reverse = new Object();

	for (key in this.m_properties)
	{
		this.__defineGetter__(key, this.getter(key));

		let value = this.m_properties[key];

		zinAssertAndLog(!(value in this.m_reverse), value);
		this.m_reverse[value] = key;
	}
},
getter: function(key) {
	return function() { return this.m_properties[key]; };
},
generator: function() {
	for (var key in this.m_properties)
		yield [ key, this.m_properties[key] ];

	yield false;
},
isPresent : function (value) {
	return value in this.m_reverse;
},
keyFromValue : function (value) {
	zinAssertAndLog(this.isPresent(value), value);
	return this.m_reverse[value];
},
toString : function () {
	return aToString(this.m_properties);
},
__iterator__: function(is_keys_only) {
	for (var key in this.m_properties)
		yield is_keys_only ? this.m_properties[key] : [ key, this.m_properties[key] ];
}
};
