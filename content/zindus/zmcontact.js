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

function ZmContact()
{
	this.attribute = new Object();
	this.element   = new Object();
}

ZmContact.prototype.isMailList = function()
{
	return ((typeof(this.element["type"]) == "string") && (this.element["type"] == "group"));
}

ZmContact.prototype.toString = function()
{
	var key;
	var msg = "";

	for (key in this.attribute)
		msg += " this.attribute[" + key + "] = " + this.attribute[key] + "\n";

	for (key in this.element)
		msg += " this.element[" + key + "] = " + this.element[key] + "\n";

	return msg;
}

ZmContact.prototype.loadFromNode = function(doc, node, ns)
{
	var key = null;
	var value = null;

	// logger().debug("loadFromNode: node.nodeName == " + node.nodeName);

	zinAssert(node.nodeType == Node.ELEMENT_NODE);

	if (node.hasAttributes())
	{
		for (var i = 0; i < node.attributes.length; i++)
			this.attribute[node.attributes.item(i).nodeName] = node.attributes.item(i).nodeValue;
	}

	// parse the <a> elements: <a n="email">blah@example.com</a>
	// namespace of <cn> elements within SyncGalResponse    is NS_ACCOUNT
	// namespace of <cn> elements within GetContactResponse is NS_MAIL
	//
	var nodelist_of_a = node.getElementsByTagNameNS(ns, "a");

	// logger().debug("nodelist_of_a.length == " + nodelist_of_a.length");

	for (var i = 0; i < nodelist_of_a.length; i++)
	{
		var elementA = nodelist_of_a.item(i);
		key = null;
		value = null;

		if (!elementA || !elementA.childNodes)
		{
			logger().warn("Unexpected response from server: <a> element didn't have attributes - skipping the rest of this contact.");
			logger().warn("the xml received from the server is: " + xmlDocumentToString(node));
			break;
		}

		if (elementA.hasChildNodes() && elementA.childNodes.length == 1 && elementA.childNodes.item(0).nodeType == Node.TEXT_NODE)
			value = elementA.childNodes.item(0).nodeValue;

		if (elementA.hasAttributes() && elementA.attributes.length == 1 && elementA.attributes.item(0).nodeName == "n")
			key = elementA.attributes.item(0).nodeValue;

		if (key && value)
			this.element[key] = value;
		else if (elementA.hasAttribute("ct"))
			; // if it has a ct (content-type) attribute, Tb2: ignore it Tb3: look for n="image" and get+store the image(s)
		else
			logger().warn("This contact contains something that isn't understood: " + xmlDocumentToString(node));

		// if (key && value) logger().debug("ZmContact: setting contact: key: " + key + " to " + value);
	}
}

function ZmContactFunctorToMakeArrayFromNodes(ns)
{
	this.ns = ns;
	this.a = new Array();

	// this associative array is a reverse mapping of contact ids to elements in a.  It's used for fast lookup by contact id.
	// So if this.a[6].attribute.id == 123, then this.mapId.123 == 6
	//
	this.mapId = new Object();
}

ZmContactFunctorToMakeArrayFromNodes.prototype.run = function(doc, node)
{
	var p = new ZmContact();
	p.loadFromNode(doc, node, this.ns);
	this.mapId[p.attribute.id] = this.a.length;
	this.a.push(p);
}
