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

function GdContact(doc)
{
	this.m_logger         = newZinLogger("GdContact");

	if (arguments.length == 1)
		this.m_document = doc;
	else
		this.m_document = document.implementation.createDocument("","",null);
		
	this.m_entry          = null;
	this.m_meta           = null;
	this.m_contact        = null;
	this.m_ns_gd_length   = this.ns_gd("").length;
	this.m_entry_children = null; // key ==> localName, value is the node - populated by runFunctor and fieldAdd() - saves searching

	// m_phone_keys == { home: null, work: null, work_fax: null, ... }
	//
	this.m_phone_keys = new Object();

	for (var key in ZinContactConverter.instance().m_common_to[FORMAT_GD][FORMAT_TB])
		if (this.leftOfHash(key) == "phoneNumber")
			this.m_phone_keys[this.rightOfHash(key)] = true;
}

GdContact.prototype.toStringXml = function()
{
	zinAssert(this.m_entry);

	return xmlDocumentToString(this.m_entry);
}

GdContact.prototype.toString = function()
{
	var key;
	var msg = "\n";

	for (key in this.m_meta)
		msg += " meta:    " + key + ": " + this.m_meta[key] + "\n";
	for (key in this.m_contact)
		msg += " contact: " + key + ": " + this.m_contact[key] + "\n";

	// if (this.m_entry)
	// 	msg += xmlDocumentToString(this.m_entry);
	// else
	// 	msg += "m_entry: null";

	return msg;
}

GdContact.prototype.updateFromEntry = function(node)
{
	var context = this;

	this.m_entry    = node; // .cloneNode(true);
	this.m_meta     = new Object();
	this.m_contact  = new Object();

	var functor = {
		run: function(node, key)
		{
			switch(key)
			{
				case "id":
				case "updated":
					context.setProperty(node, null, context.m_meta, key);
					break;
				case "edit":
					context.setProperty(node, "href", context.m_meta, "edit");
					break;
				case "title":
				case "content":
				case "organization#orgName":
				case "organization#orgTitle":
				case "phoneNumber#work":
				case "phoneNumber#home":
				case "phoneNumber#work_fax":
				case "phoneNumber#pager":
				case "phoneNumber#mobile":
					context.setProperty(node, null,  context.m_contact, key);
					break;
				case "PrimaryEmail":
				case "SecondEmail":
				case "im#AIM":
					context.setProperty(node, "address", context.m_contact, key);
					break;
					break;
				case "deleted":
					context.m_meta["deleted"] = "true";
					break;
			}
		}
	};

	this.runFunctorOnEntry(functor);
}

GdContact.prototype.set_visited = function(a_visited, key)
{
	if (!isPropertyPresent(a_visited, key))
		a_visited[key] = true;
	else
		gLogger.error("GdContact: visited this node twice - this shouldn't happen: key: " + key +
		                                                                   " a_visited: " + aToString(a_visited)); 
}

GdContact.prototype.runFunctorOnEntry = function(functor)
{
	var i, key, child;

	zinAssert(this.m_entry);

	var a_visited = new Object();

	this.m_entry_children = new Object();

	zinAssert(this.m_entry.nodeType == Node.ELEMENT_NODE);

	if (this.m_entry.hasChildNodes())
	{
		var children = this.m_entry.childNodes;

		for (i = 0; i < children.length; i++)
			if (children[i].nodeType == Node.ELEMENT_NODE)
			{
				child = children[i];
				key = child.localName;
				is_run_functor = false;

				// this.m_logger.debug("GdContact: runFunctorOnEntry: i: " + i + ": " + this.nodeAsString(child));

				if (child.namespaceURI == ZinXpath.nsResolver("atom"))
					switch(child.localName)
					{
						case "id":
						case "updated":
						case "title":
						case "content":
							this.set_visited(a_visited, key);
							functor.run(child, key);
							break;
						case "link":
							if (child.getAttribute("rel") == "edit")
							{
								key = "edit";
								this.set_visited(a_visited, key);
								functor.run(child, key);
							}
							break;
					}
				
				if (child.namespaceURI == ZinXpath.nsResolver("gd"))
					switch(child.localName)
					{
						case "organization":
							if (!isPropertyPresent(a_visited, key) && child.getAttribute("rel") == this.ns_gd("work")
							                                                       && child.hasChildNodes() )
							{
								this.m_entry_children[child.localName] = child;

								var grandchildren = child.childNodes;
								for (var j = 0; j < grandchildren.length; j++)
									if (grandchildren[j].nodeType == Node.ELEMENT_NODE &&
									    grandchildren[j].namespaceURI == ZinXpath.nsResolver("gd"))
										switch(grandchildren[j].localName)
										{
											case "orgName":
											case "orgTitle":
												key = "organization#" + grandchildren[j].localName;

												if (!isPropertyPresent(a_visited, key))
												{
													this.set_visited(a_visited, key);
													functor.run(grandchildren[j], key);
												}
												break;
										}
							}
							break;

						case "email":
							// PrimaryEmail == the <email> element with primary="true"
							// SecondEmail  == the first <element> element without the primary=true attribute

							if (child.getAttribute("primary") == "true")
								key = "PrimaryEmail";
							else 
								key = "SecondEmail";

							if (!isPropertyPresent(a_visited, key))
							{
								this.set_visited(a_visited, key);
								functor.run(child, key);
							}
							break;

						case "phoneNumber":
							key = String(child.getAttribute("rel")).substr(this.m_ns_gd_length);

							if (isPropertyPresent(this.m_phone_keys, key))
							{
								key = "phoneNumber#" + key;

								if (!isPropertyPresent(a_visited, key))
								{
									this.set_visited(a_visited, key);
									functor.run(child, key);
								}
							}
							break;

						case "im":
							key = String(child.getAttribute("protocol")).substr(this.m_ns_gd_length);

							if (key == "AIM")
							{
								key = "im#" + key;

								if (!isPropertyPresent(a_visited, key))
								{
									this.set_visited(a_visited, key);
									functor.run(child, key);
								}
							}
							break;

						case "deleted":
							this.set_visited(a_visited, key);
							functor.run(child, key);
							break;
					}
			}
	}
}

GdContact.prototype.fieldModDel = function(node, attribute, a_field, key, a_field_used, a_to_be_deleted)
{
	if (!isPropertyPresent(a_field, key) || a_field[key].length == 0)
	{
		var tmp = this.leftOfHash(key);
		if (isPropertyPresent(this.m_entry_children, tmp))
			parent = this.m_entry_children[tmp];
		else
			parent = this.m_entry;
		a_to_be_deleted[key] = newObject("parent", parent, "child", node);
		a_field_used[key] = true;
	}
	else
		this.setNode(node, attribute, a_field, key, a_field_used);
}

GdContact.prototype.updateFromContact = function(contact)
{
	var a_field         = zinCloneObject(contact);
	var a_field_used    = new Object();
	var a_to_be_deleted = new Object();
	var context = this;
	var key;

	this.m_logger.debug("updateFromContact: contact: " + aToString(contact));

	var functor = {
		run: function(node, key)
		{
			// this.m_logger.debug("GdContact: updateFromContact: node: " + context.nodeAsString(node));

			switch(key)
			{
				case "title":
					if (!isPropertyPresent(a_field, key))
						a_field[key] = "";
					context.setNode(node, null, a_field, key, a_field_used)
					break;
				case "content":
				case "organization#orgName":
				case "organization#orgTitle":
				case "phoneNumber#work":
				case "phoneNumber#home":
				case "phoneNumber#work_fax":
				case "phoneNumber#pager":
				case "phoneNumber#mobile":
					context.fieldModDel(node, null, a_field, key, a_field_used, a_to_be_deleted);
					break;
				case "PrimaryEmail":
				case "SecondEmail":
				case "im#AIM":
					context.fieldModDel(node, "address", a_field, key, a_field_used, a_to_be_deleted);
					break;

			}
		}
	};

	if (!this.m_entry)
	{
		this.m_entry = this.m_document.createElementNS(ZinXpath.NS_ATOM, "entry");
		this.ensureEntryHasXmlnsGd();

		var category = this.m_document.createElementNS(ZinXpath.NS_ATOM, "category");
		category.setAttribute("scheme", "http://schemas.google.com/g/2005#kind");
		category.setAttribute("term", "http://schemas.google.com/contact/2008#contact");

		var title = this.m_document.createElementNS(ZinXpath.NS_ATOM, "title");
		title.setAttribute("type", "text");
		title.textContent = "";

		this.m_entry.appendChild(category);
		this.m_entry.appendChild(title);
	}
	else
		this.ensureEntryHasXmlnsGd(); // <entry> elements that are children of <feed> need a xmlns:gd namespace declaration

	this.runFunctorOnEntry(functor);

	// now do DELs (don't do inside loop because deleting elements of an array while iterating over it produces unexpected results)
	for (key in a_to_be_deleted)
		try {
			this.m_logger.debug("updateFromContact: removeChild: key: " + key);
			a_to_be_deleted[key].parent.removeChild(a_to_be_deleted[key].child);
		} catch (ex) {
			zinAssertAndLog(false, "key: " + key + "ex: " + ex + "ex.stack: " + ex.stack);
		}

	// now do ADDs...
	for (key in a_field)
		if (!isPropertyPresent(a_field_used, key) && a_field[key].length > 0)
			this.fieldAdd(key, a_field);

	if (isPropertyPresent(this.m_entry_children, "organization") && this.m_entry_children["organization"].childNodes.length == 0)
	{
		// this.m_logger.debug("GdContact: fieldModDel: removeChild: node: " + this.nodeAsString(this.m_entry_children["organization"]));
		this.m_entry.removeChild(this.m_entry_children["organization"]);
		delete this.m_entry_children["organization"];
	}

	this.updateFromEntry(this.m_entry);
}

// This method adds an xmlns:gd namespace declaration to the <entry> element.  Otherwise, each child has a separate declaration,
// which works fine, but increases the size of the payload for no good reason.
//
GdContact.prototype.ensureEntryHasXmlnsGd = function()
{
	var is_xmlns_gd_present = false;

	zinAssert(this.m_entry);

	if (this.m_entry.hasAttributes())
	{
		for (var i = 0; i < this.m_entry.attributes.length; i++)
			if (this.m_entry.attributes.item(i).nodeName == "xmlns:gd")
			{
				is_xmlns_gd_present = true;
				break;
			}
	}

	if (!is_xmlns_gd_present)
		this.m_entry.setAttributeNS(ZinXpath.NS_XMLNS, "xmlns:gd", ZinXpath.NS_GD);
}

GdContact.prototype.fieldAdd = function(key, a_field)
{
	var element = null;
	var parent = this.m_entry;

	// this.m_logger.debug("GdContact: fieldAdd: key: " + key);

	switch(key)
	{
		case "title":
			gLogger.error("fieldAdd: shouldn't be here: key: " + key);
			break;
		case "content":
			element = this.m_document.createElementNS(ZinXpath.NS_ATOM, "content");
			element.setAttribute("type", "text");
			element.textContent = a_field[key];
			break;
		case "organization":
			element = this.m_document.createElementNS(ZinXpath.NS_GD, "organization");
			element.setAttribute("rel", this.ns_gd("work"));
			this.m_entry_children["organization"] = element;
			break;
		case "organization#orgName":
		case "organization#orgTitle":
			if (!isPropertyPresent(this.m_entry_children, "organization"))
				this.fieldAdd("organization");

			element = this.m_document.createElementNS(ZinXpath.NS_GD, this.rightOfHash(key));
			element.textContent = a_field[key];

			parent = this.m_entry_children["organization"];
			break;
		case "PrimaryEmail":
		case "SecondEmail":
			element = this.m_document.createElementNS(ZinXpath.NS_GD, "email");
			element.setAttribute("rel", this.ns_gd("home")); // this is pretty much a random choice
			element.setAttribute("address", a_field[key]);

			if (key == "PrimaryEmail")
				element.setAttribute("primary", "true");
				
			break;
		case "im#AIM":
			element = this.m_document.createElementNS(ZinXpath.NS_GD, "im");
			element.setAttribute("protocol", this.ns_gd("AIM"));
			element.setAttribute("rel", this.ns_gd("other")); // this is pretty much a random choice
			element.setAttribute("address", a_field[key]);
			break;
		case "phoneNumber#work":
		case "phoneNumber#home":
		case "phoneNumber#work_fax":
		case "phoneNumber#pager":
		case "phoneNumber#mobile":
			var fragment = this.rightOfHash(key);
			element = this.m_document.createElementNS(ZinXpath.NS_GD, "phoneNumber");
			element.setAttribute("rel", this.ns_gd(fragment))
			element.textContent = a_field[key];
			break;
	}

	if (element)
		parent.appendChild(element);
}

GdContact.prototype.ns_gd = function(str)
{
	return ZinXpath.NS_GD + "#" + str;
}

GdContact.prototype.setProperty = function(node, attribute, collection, key)
{
	var value = "";

	if (attribute)
		value = node.getAttribute(attribute);
	else if (node.hasChildNodes())
		value = node.firstChild.nodeValue;

	if (value.length > 0)
		collection[key] = value;
	else if (isPropertyPresent(collection, key))
		delete collection[key];
}

// GdContact.prototype.setProperty = function(node, attribute, collection, key)
// {
// 	if (attribute)
// 		collection[key] = node.getAttribute(attribute);
// 	else if (node.hasChildNodes())
// 		collection[key] = node.firstChild.nodeValue;
// 	else
// 		collection[key] = "";
// }

// GdContact.prototype.setNode = function(node, attribute, collection, key, a_key_used)
// {
// 	if (attribute)
// 	{
// 		node.setAttribute(attribute, collection[key]);
// 		a_key_used[key] = true;
// 	}
// 	else if (node.hasChildNodes())
// 	{
// 		node.firstChild.textContent = collection[key];
// 		a_key_used[key] = true;
// 	}
// 	else
// 		zinAssertAndLog(false, "attribute: " + attribute + " collection: " + aToString(collection) + " key: " + key);
// }

GdContact.prototype.setNode = function(node, attribute, collection, key, a_key_used)
{
	if (attribute)
	{
		node.setAttribute(attribute, collection[key]);
		a_key_used[key] = true;
	}
	else
	{
		node.textContent = collection[key];
		a_key_used[key] = true;
	}
}

GdContact.prototype.leftOfHash = function(str)
{
	return str.substr(0, str.indexOf("#"));
}

// rfc3986 refers to the part to the right of the hash as "fragment"
//
GdContact.prototype.rightOfHash = function(str)
{
	return str.substr(str.indexOf("#") + 1);
}

GdContact.prototype.nodeAsString = function(node)
{
	return " nodeType: " + node.nodeType +
	       " children: " + node.hasChildNodes() +
		   " localName: " + node.localName +
		   " namespaceURI: " + node.namespaceURI +
		   " rel: " + node.getAttribute("rel");
}

function GdContactFunctorToMakeHashFromNodes()
{
	this.m_collection = new Object();
}

GdContactFunctorToMakeHashFromNodes.prototype.run = function(doc, node)
{
	var contact = new GdContact(doc);
	
	contact.updateFromEntry(node);

	this.m_collection[contact.m_meta.id] = contact;
}

GdContact.arrayFromXpath = function(doc, xpath_query)
{
	var functor = new GdContactFunctorToMakeHashFromNodes();

	ZinXpath.runFunctor(functor, xpath_query, doc);

	return functor.m_collection;
}
