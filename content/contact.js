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

function ZimbraContact()
{
	this.attribute = new Object();
	this.element   = new Object();
}

ZimbraContact.prototype.isMailList = function()
{
	return ((typeof(this.element["type"]) == "string") && (this.element["type"] == "group"));
}

ZimbraContact.prototype.toString = function()
{
	var key;
	var msg = "";

	for (key in this.attribute)
		msg += " this.attribute[" + key + "] = " + this.attribute[key] + "\n";

	for (key in this.element)
		msg += " this.element[" + key + "] = " + this.element[key] + "\n";

	return msg;
}

ZimbraContact.prototype.loadFromNode = function(doc, node, ns)
{
	var key = null;
	var value = null;

	gLogger.debug("77220: ZimbraContact.prototype.loadFromNode - node.nodeName == " + node.nodeName);

	zinAssert(node.nodeType == Node.ELEMENT_NODE);

	// the only attribute we know/care about is id
	// dump("77225: namednodemap.item(i)... " + " nodeName == " + node.attributes.item(i).nodeName +
	//      " nodeType == " + node.attributes.item(i).nodeType + " nodeValue == " + node.attributes.item(i).nodeValue + "\n");

	if (node.hasAttributes())
	{
		for (var i = 0; i < node.attributes.length; i++)
			this.attribute[node.attributes.item(i).nodeName] = node.attributes.item(i).nodeValue;
	}

	// parse the <a> elements: <a n="email">blah@example.com</a>
	// namespace of <cn> elements within SyncGalResponse    is NS_ACCOUNT
	// namespace of <cn> elements within GetContactResponse is NS_MAIL
	//
	// gLogger.debug("77221: nodelist_of_a.length == " + nodelist_of_a.length + "\n");
	//
	var nodelist_of_a = node.getElementsByTagNameNS(ns, "a");

	gLogger.debug("77221: nodelist_of_a.length == " + nodelist_of_a.length + "\n");

	for (var i = 0; i < nodelist_of_a.length; i++)
	{
		var elementA = nodelist_of_a.item(i);
		key = null;
		value = null;
		
		// dump("77222: elementA.nodeName == " + elementA.nodeName + " hasChildNodes() " + elementA.hasChildNodes() + " childNodes.length is " + elementA.childNodes.length + "\n");

		if (elementA.childNodes.length == 1 && elementA.childNodes.item(0).nodeType == Node.TEXT_NODE)
			value = elementA.childNodes.item(0).nodeValue;

		if (elementA.hasAttributes() && elementA.attributes.item(0).nodeName == "n")
			key = elementA.attributes.item(0).nodeValue;

		if (key && value)
			this.element[key] = value;
		else
			gLogger.warn("Unexpected response from server: key is " + key + " and value is " + value);

		// if (key && value) gLogger.dump("77224: setting contact." + key + " to " + value);
	}
}

function FunctorArrayOfContactsFromNodes(ns)
{
	this.ns = ns;
	this.a = new Array();

	// this associative array is a reverse mapping of contact ids to elements in a.  It's used for fast lookup by contact id.
	// So if this.a[6].attribute.id == 123, then this.mapId.123 == 6
	// 
	this.mapId = new Object();
}

FunctorArrayOfContactsFromNodes.prototype.run = function(doc, node)
{
	var p = new ZimbraContact();
	p.loadFromNode(doc, node, this.ns);
	this.mapId[p.attribute.id] = this.a.length;
	this.a.push(p);
}

function FunctorArrayOfTextNodeValue()
{
	this.a = new Array();
}

FunctorArrayOfTextNodeValue.prototype.run = function(doc, node)
{
	if (node.childNodes.length == 1 && node.childNodes.item(0).nodeType == Node.TEXT_NODE)
		this.a.push(new String(node.childNodes.item(0).nodeValue));
}

