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
// $Id: contactgoogle.js,v 1.19 2009-06-20 23:23:04 cvsuser Exp $

function ContactGoogle(xml, mode) {
	this.m_entry      = xml  ? xml  : ContactGoogleStatic.newEntry();
	this.m_mode       = mode ? mode : ContactGoogle.ePostal.kDisabled;
	this.m_properties = null;             // associative array populated by the getter
	this.m_groups     = null;             //             array populated by the getter

	this.meta  = new Object();
	this.meta_initialise_getters();
}

ContactGoogle.eMeta      = new ZinEnum( 'id', 'updated', 'edit', 'self', 'deleted' );
ContactGoogle.ePostal    = new ZinEnum( { 'kEnabled' : 0x01, 'kDisabled'   : 0x02 } );
ContactGoogle.eTransform = new ZinEnum( { 'kEmail'   : 0x01, 'kWhitespace' : 0x02, 'kAll' : 0x03 } );

ContactGoogle.prototype = {
meta_initialise_getters : function () {
	let fn, key, value;

	this.m_cache_meta  = new ContactPropertyCache();

	for each ([key, value] in ContactGoogle.eMeta) {
		with (ContactGoogle.eMeta) { with (ContactGoogleStatic) {
			switch(value) {
				case id:      fn = function(entry) { return to_string(entry.nsAtom::id); };                            break;
				case updated: fn = function(entry) { return to_string(entry.nsAtom::updated); };                       break;
				case edit:    fn = function(entry) { return to_string(entry.nsAtom::link.(@rel=="edit").@href); };     break;
				case self:    fn = function(entry) { return to_string(entry.nsAtom::link.(@rel=="self").@href); };     break;
				case deleted: fn = function(entry) { return to_bool(entry.nsGd::deleted); };                           break;
				default: zinAssertAndLog(false, key);
			};
		} }

		this.meta.__defineGetter__(key, this.meta_make_getter(key, fn));
	}
},
meta_make_getter: function(key, fn) {
	var context = this;
	return function() {
		let ret = context.m_cache_meta.get(key);
		
		return ret !== null ? ret : fn(context.m_entry);
	};
},
groups_initialise_getter_and_setter: function() {
	var fn_getter
},
mode : function (value) {
	if (value) {
		zinAssertAndLog(ContactGoogle.ePostal.isPresent(value), value);
		this.m_mode = value;
		this.m_properties = null;
	}

	return this.m_mode;
},
make_mask_of_elements_in_entry: function () {
	var children = this.m_entry.*;
	var ret = 0;
	var i;

	var reAtom     = /content/;
	var reGd       = /email|phoneNumber|postalAddress|name|organization|im/;
	var reGContact = /website|birthday/;

	with (ContactGoogleStatic)
		for (i = 0; i < children.length(); i++) {
			let name = children[i].name().localName;
			let uri  = children[i].name().uri;

			if ((uri == Xpath.NS_ATOM     && reAtom.test(name)) ||
			    (uri == Xpath.NS_GD       && reGd.test(name))   ||
			    (uri == Xpath.NS_GCONTACT && reGContact.test(name)))
				ret |= mask[name];
		}

	return ret;
},
warn_if_entry_isnt_valid : function() {
	// Google sometimes sends clients payloads that it won't accept back
	// this method it to notice and warn about such things
},
groups_from_xml: function () {
	var ret = new Array();

	with (ContactGoogleStatic)
		var groups = this.m_entry.nsGContact::groupMembershipInfo;

	for (var i = 0; i < groups.length(); i++)
		if (groups[i].@deleted != 'true') {
			let href = groups[i].@href.toString();

			if (href.length > 0)
				ret.push(href);
		}

	return ret;
},
properties_from_xml: function () {
	var entry      = this.m_entry;
	var imask      = this.make_mask_of_elements_in_entry();
	let properties = new Object();
	let i, j, list;

	this.warn_if_entry_isnt_valid();

	with (ContactGoogleStatic) {
		if (imask & mask.content) set_if(properties, 'content',  entry.nsAtom::content);

		if (imask & mask.email) {
			let key, xml;
			for ( [ key, xml ] in cgei.iterator(entry))
				set_if(properties, key, xml.@address);
		}

		if (imask & mask.phoneNumber)
			set_for(properties, nsGd, entry, 'phoneNumber');

		if (imask & mask.postalAddress && (this.m_mode & ContactGoogle.ePostal.kEnabled) )
			set_for(properties, nsGd, entry, 'postalAddress');

		if (imask & mask.name) {
			set_if(properties, 'name_givenName',   entry.nsGd::name.nsGd::givenName);
			set_if(properties, 'name_familyName',  entry.nsGd::name.nsGd::familyName);
			set_if(properties, 'name_fullName',    entry.nsGd::name.nsGd::fullName);
		}

		if (imask & mask.organization) {
			list = get_elements_matching_attribute(entry.nsGd::organization, 'rel', a_fragment.organization, kMatchFirst, 'organization');

			if (list.length() > 0) {
				set_if(properties, 'organization_orgTitle',  list[0].nsGd::orgTitle);
				set_if(properties, 'organization_orgName',   list[0].nsGd::orgName);
			}
		}

		if (imask & mask.im) {
			list = get_elements_matching_attribute(entry.nsGd::im, 'protocol', ['AIM'], kMatchFirst, 'im');
	
			if (list.length() > 0)
				properties['im_AIM'] = list[0].@address.toString();
		}

		if (imask & mask.website) {
			list = get_elements_matching_attribute(entry.nsGContact::website, 'rel', a_fragment.website, kMatchFirst, 'website');
	
			for (i = 0; i < list.length(); i++)
				set_if(properties, get_hyphenation('website', shorten_rel(list[i].@rel, 'website')), list[i].@href);
		}

		if (imask & mask.birthday) {
			set_if(properties, 'birthday', entry.nsGContact::birthday.@when);
		}

	}

	if (false)
		for (i in properties)
			zinAssertAndLog(typeof(properties[i]) == 'string', i);

	return properties;
},
get groups () {
	if (!this.m_groups)
		this.m_groups = this.groups_from_xml();
	return this.m_groups;
},
set groups (groups) {
	zinAssert(groups instanceof Array);
	var entry = this.m_entry;

	with (ContactGoogleStatic) {
		delete entry.nsGContact::groupMembershipInfo;

		for (var i = 0; i < groups.length; i++)
			entry.* += <gContact:groupMembershipInfo xmlns:gContact={Xpath.NS_GCONTACT} deleted='false' href={groups[i]}/>;
	}

	this.m_groups = null;
},
get properties () {
	if (!this.m_properties)
		this.m_properties = this.properties_from_xml();
	return this.m_properties;
},
set properties (properties_in) {
	// Here's how the contact is updated:
	// - iterate through the children of <entry>
	//   - for each child of <entry> that we're interested in:
	//     - if there's a corresponding member of property, modify the child, otherwise delete it.
	// - add the property members that weren't involved in modify or delete

	var properties   = new Object();
	var entry        = this.m_entry;
	var imask        = this.make_mask_of_elements_in_entry();
	var a_is_used    = new Object();
	var organization = null;
	var name         = null;
	var i, key;

	// ignore keys where the value is 100% whitespace
	//
	for (key in properties_in) {
		let value = ContactGoogle.transformTbProperty(ContactGoogle.eTransform.kWhitespace, key, properties_in[key]);

		if (value.length > 0)
			properties[key] = value;
	}

	// logger().debug("ContactGoogle: 1: properties: " + aToString(properties));

	with (ContactGoogleStatic) {
		if (imask & mask.content)
			modify_or_delete_child(entry.nsAtom::content, properties, 'content', a_is_used);

		if (imask & mask.email) {
			let key, xml;
			for ( [ key, xml ] in cgei.iterator(entry))
				modify_or_delete_child(xml, properties, key, a_is_used, 'address');
		}

		if (imask & mask.phoneNumber)
			modify_or_delete_child_for(properties, nsGd, entry, 'phoneNumber', a_is_used);

		if (!(this.m_mode & ContactGoogle.ePostal.kEnabled)) // ensure that postalAddress elements aren't touched
			for (i = 0; i < a_fragment.postalAddress.length; i++)
				a_is_used[get_hyphenation('postalAddress', a_fragment.postalAddress[i])] = true;
		else if (imask & mask.postalAddress)
			this.postalAddressModifyFields(properties, a_is_used);

		if (imask & mask.name) {
			name = entry.nsGd::name;

			modify_or_delete_child_if(name.nsGd::givenName,  properties, 'name_givenName',  a_is_used);
			modify_or_delete_child_if(name.nsGd::familyName, properties, 'name_familyName', a_is_used);
			modify_or_delete_child_if(name.nsGd::fullName,   properties, 'name_fullName',   a_is_used);

			if (name.*.length() == 0) {
				// logger().debug("ContactGoogle: deleting");
				delete entry.*[name.childIndex()];
				name = null;
			}
		}

		if (imask & mask.organization) {
			let is_found = false;

			organization = get_elements_matching_attribute(entry.nsGd::organization, 'rel', a_fragment.organization, kMatchFirst, 'organization');

			if (organization.length() > 0) {
				modify_or_delete_child_if(organization[0].nsGd::orgTitle, properties, 'organization_orgTitle', a_is_used);
				modify_or_delete_child_if(organization[0].nsGd::orgName,  properties, 'organization_orgName',  a_is_used);
				is_found = true;
			}

			if (!is_found)
				organization = null;
			else if (organization.*.length() == 0) {
				// logger().debug("ContactGoogle: deleting");
				delete entry.*[organization.childIndex()];
				organization = null;
			}
		}

		if (imask & mask.im) {
			let tmp = get_elements_matching_attribute(entry.nsGd::im, 'protocol', ['AIM'], kMatchFirst, 'im');
	
			if (tmp.length() > 0)
				modify_or_delete_child(tmp[0], properties, 'im_AIM', a_is_used, 'address');
		}

		if (imask & mask.website)
			modify_or_delete_child_for(properties, nsGContact, entry, 'website', a_is_used, 'href');

		if (imask & mask.birthday) {
			let tmp = entry.nsGContact::birthday;

			if (tmp.length() > 0)
				modify_or_delete_child(tmp, properties, 'birthday', a_is_used, 'when');
		}

		// ADD properties...
		// the choice of rel='other' for AIM and rel='home' for email* is arbitrary
		// logger().debug("ContactGoogle: 2: properties: " + aToString(properties) + " a_is_used: " + aToString(a_is_used));
		//
		let l, r, value;
		let is_added_organization = false;
		let is_added_name = false;

		for (key in cgopi.iterator(properties))
			if (!(key in a_is_used)) {
				// logger().debug("properties setter: adding key: " + key);

				switch(key) {
				case "content":
					entry.content = <atom:content xmlns:atom={Xpath.NS_ATOM} type='text'>{properties[key]}</atom:content>;
					break;
				case "name_givenName":
				case "name_familyName":
				case "name_fullName":
					if (!name) {
						name = <gd:name xmlns:gd={Xpath.NS_GD} />;
						is_added_name = true;
					}
					r = rightOfChar(key, '_');
					name.* += <gd:{r} xmlns:gd={Xpath.NS_GD} >{properties[key]}</gd:{r}>;
					break;
				case "organization_orgName":
				case "organization_orgTitle":
					if (!organization) {
						organization = <gd:organization xmlns:gd={Xpath.NS_GD} rel={get_rel("work")} />;
						is_added_organization = true;
					}
					r = rightOfChar(key, '_');
					organization.* += <gd:{r} xmlns:gd={Xpath.NS_GD} >{properties[key]}</gd:{r}>;
					break;
				case "email1":
				case "email2":
					let email = <gd:email xmlns:gd={Xpath.NS_GD} rel={get_rel('home')} address={properties[key]} />;
					if (key == 'email1')
						email.@primary = 'true';
					entry.* += email;
					break;
				case "im_AIM":
					entry.* += <gd:im xmlns:gd={Xpath.NS_GD} rel={get_rel('other')} protocol={get_rel('AIM')} address={properties[key]} />;
					break;
				case "phoneNumber_home":
				case "phoneNumber_mobile":
				case "phoneNumber_pager":
				case "phoneNumber_work":
				case "phoneNumber_work_fax":
				case "postalAddress_home":
				case "postalAddress_work":
					[l, r] = get_element_and_suffix(key);
					value = properties[key];
					if (l == 'postalAddress') {
						zinAssert(this.mode() & ContactGoogle.ePostal.kEnabled);
						value = ContactGoogleStatic.add_whitespace_to_postal_properties(properties, key);
					}
					entry.* += <gd:{l} xmlns:gd={Xpath.NS_GD} rel={get_rel(r)}>{value}</gd:{l}>;
					break;
				case "website_home":
				case "website_work":
					[l, r] = get_element_and_suffix(key);
					let value = properties[key];
					entry.* += <gContact:{l} xmlns:gContact={Xpath.NS_GCONTACT} rel={get_rel(r, l)} href={value}/>;
					break;
				case "birthday":
					entry.* += <gContact:birthday xmlns:gd={Xpath.NS_GCONTACT} when={properties[key]} />;
					break;
				default:
					zinAssertAndLog(false, key);
				}
			}

		if (is_added_name)
			entry.* += name;

		if (is_added_organization)
			entry.* += organization;
	}

	this.m_properties = null;
},
postalAddressModifyFields : function(properties, a_is_used) {
	with (ContactGoogleStatic) {
		let list = get_elements_matching_attribute(this.m_entry.nsGd::postalAddress, 'rel', a_fragment.postalAddress, kMatchFirst, 'postalAddress');

		for (var i = 0; i < list.length(); i++)
			this.postalAddressModifyField(list[i], properties, rightOfChar(list[i].@rel, '#'), a_is_used);
	}
},
postalAddressModifyField : function(xml, properties, suffix, a_is_used) {
	// if the contact's field contains xml,  preserve the <otheraddr> element
	// if the contact's field contacts text, move the text into an <otheraddr> element in the xml and save that
	//
	zinAssert((this.m_mode & ContactGoogle.ePostal.kEnabled));

	with (ContactGoogleStatic) {
		var key                = get_hyphenation('postalAddress', suffix);
		var is_property_postal = false;
		var otheraddr          = this.postalAddressOtherAddr(key);
		var a_gac_properties   = { };
		var new_properties;

		if (key in properties)
			is_property_postal = gac.convert(properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_PROPERTIES);

		// if (a) the new property is a parsable postal address OR (b) the existing property isn't parsable
		//
		if (is_property_postal || otheraddr == null) {
			new_properties = { key : null };

			if (otheraddr && otheraddr.length > 0) // the postalAddress of the contact is xml
				a_gac_properties["otheraddr"] = otheraddr;
			else if (otheraddr == null)            // the postalAddress of the contact is text
				a_gac_properties["otheraddr"] = xml.toString();
			else
				;                                  // the postalAddress of the contact is xml with an empty <otheraddr> element

			for (var i in a_gac_properties)
				a_gac_properties[i] = ContactGoogleStatic.add_whitespace_to_postal_line(a_gac_properties[i]);

			gac.convert(new_properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_XML | GdAddressConverter.PRETTY_XML );
		}
		else
			new_properties = properties;

		// logger().debug("ContactGoogle: key: " + key + " new_properties: " + aToString(new_properties));

		modify_or_delete_child(xml, new_properties, key, a_is_used);
	}
},
postalAddressOtherAddr : function(key) {
	zinAssert(this.m_mode & ContactGoogle.ePostal.kEnabled);

	var is_parsed = key in this.properties;

	if (is_parsed) {
		var str = this.properties[key];
		var ret = "";
		var a_in  = newObject('x', str);
		var a_out = new Object();
	
		is_parsed = is_parsed && ContactGoogleStatic.gac.convert(a_in, 'x', a_out, GdAddressConverter.ADDR_TO_PROPERTIES);
	}

	if (!is_parsed)                                 // it wasn't xml
		ret = null;
	else if (isPropertyPresent(a_out, "otheraddr")) // it was xml and there was an <otheraddr> element
		ret = a_out["otheraddr"];
	else                                            // it was xml but didn't have an <otheraddr> element
		ret = "";

	return ret;
},
isAnyPostalAddressInXml : function() {
	var ret = false;

	zinAssert(this.mode() & ContactGoogle.ePostal.kEnabled); // it only makes sense to call this method in this mode

	with (ContactGoogleStatic)
		for (var i = 0; i < a_fragment.postalAddress.length && !ret; i++) {
			let key = get_hyphenation('postalAddress', a_fragment.postalAddress[i]);

			if (key in this.properties)
				ret = (this.postalAddressOtherAddr(key) != null);
		}

	return ret;
},
postalAddressRemoveEmptyElements : function () {
	// workaround for a Google bug whereby you may get an empty <postalAddress> element but if you preserve it and send it back
	// the update fails.  See issue #160
	var children = this.m_entry.*;

	for (var i = children.length() - 1; i >= 0; i--)
		if (children[i].name().uri == Xpath.NS_GD && children[i].name().localName == 'postalAddress' && children[i].*.length() == 0)
			delete children[i];
},
is_empty : function() {
	return isObjectEmpty(this.properties);
},
toString : function() {
	var ret = "\n";
	var key, value;

	ret += " meta:       ";
	for ([key, value] in ContactGoogle.eMeta)
		ret += " " + key + ": " + this.meta[key];
	ret += "\n"

	ret += " groups:     " + this.groups.toString() + "\n";

	ret += " properties: ";
	for (key in this.properties)
		ret += " " + key + ": " + this.properties[key];

	return ret;
},
toStringXml : function() {
	return this.m_entry.toXMLString();
}
};

// factory methods
//
ContactGoogle.newContact = function(arg, mode) {
	var xml = ContactGoogleStatic.newXml(arg);
	return new ContactGoogle(xml, mode);
}
ContactGoogle.newContacts = function(arg, a_contact, mode) {
	var feed    = ContactGoogleStatic.newXml(arg);
	var nsAtom  = ContactGoogleStatic.nsAtom;
	var entries = feed.nsAtom::entry;
	var ret     = a_contact ? a_contact : new Object();

	for (var i = 0; i < entries.length(); i++) {
		let contact = new ContactGoogle(entries[i], mode);
		ret[contact.meta.id] = contact;
	}

	return ret;
}

ContactGoogle.transformTbProperties = function(transform, properties)
{
	for (var key in properties)
		properties[key] = ContactGoogle.transformTbProperty(transform, key, properties[key]);
}

ContactGoogle.transformTbProperty = function(transform, key, value)
{
	var ret = value;

	if (transform & ContactGoogle.eTransform.kWhitespace)
		ret = ContactGoogle.transformTbPropertyTo(ContactGoogle.eTransform.kWhitespace, ret);

	if (transform & ContactGoogle.eTransform.kEmail && (key == "PrimaryEmail" || key == "SecondEmail"))
		ret = ContactGoogle.transformTbPropertyTo(ContactGoogle.eTransform.kEmail, ret);

	return ret;
}

ContactGoogle.transformTbPropertyTo = function(transform, value)
{
	var ret;

	switch(transform) {
		case ContactGoogle.eTransform.kEmail:      ret = value.toLowerCase(); break;
		case ContactGoogle.eTransform.kWhitespace: ret = zinTrim(value);      break;
		default: zinAssertAndLog(false, transform);
	}

	return ret;
}

function ContactPropertyCache()
{
	this.reset();
	this.m_is_active = true;
}

ContactPropertyCache.prototype = {
get : function (key) {
	return (this.m_is_active && (key in this.m_properties)) ? this.m_properties[key] : null;
},
is_active : function (arg) {
	if (arg)
		this.m_is_active = arg;

	return this.m_is_active;
},
reset : function () {
	this.m_properties = new Object();
}
};

// Here's how the <email> elements map to email1, email2 properties:
// - email1 is the first <email> element that has a primary attribute, 
//   or if no <email> has a primary attribute, then email1 is the first <email> element
// - email2 is the first <email> that isn't email1
// Note that there's no guarantee that the <email> element with the primary attribute will be the first.
// eg: <email address='fred'/> <email address='joe' primary='true'/> gives email1 == joe and email2 == fred
//
function ContactGoogleEmailIterator(entry) {
	if (entry)
		this.iterator(entry)
}

ContactGoogleEmailIterator.prototype = {
iterator: function(entry) {
	with (ContactGoogleStatic) {
		this.m_emails  = entry.nsGd::email;
		this.m_a_index = new Array();

		if (this.m_emails.length() > 0) {
			let primary = -1;
			let i;
	
			for (i = 0; i < this.m_emails.length() && (primary == -1); i++)
				if (this.m_emails[i].@primary == "true")
					primary = i;

			if (primary == -1)
				primary = 0;

			this.m_a_index[0] = this.m_emails[primary];

			let count = 1;

			for (i = 0; i < this.m_emails.length(); i++)
				if (i != primary)     // don't bump count if we're at the primary element
					this.m_a_index[count++] = this.m_emails[i];
		}
	}

	return this;
},
__iterator__: function(is_keys_only) {
	const max = 1; // don't interate over email3 

	for (var i = 0; i <= ZinMin(max, this.m_a_index.length - 1); i++)
		yield is_keys_only ? value : [ 'email' + (i + 1), this.m_a_index[i]];
}
};

// If an <entry> is created at Google with two <email> elements and the second having  aprimary="true" attribute then that's the way
// it's returned by Google.  So Google preserves ordering.  While we're only handling two <email> elements it doesn't matter whether
// we preserve ordering because of the primary attribute.  But when we handle n <email> elements ordering will matter
// which is why we use this properties iterator to guarantee the order of iteration over the email1 and email2 properties.
//
function ContactGoogleOrderedPropertyIterator(properties) {
	this.m_properties = null;

	if (properties)
		this.iterator(properties);
}

ContactGoogleOrderedPropertyIterator.prototype = {
iterator: function(properties) {
	this.m_properties = properties;
	return this;
},
__iterator__: function() {
	zinAssert(this.m_properties);

	if ('email1' in this.m_properties)
		yield 'email1';
	if ('email2' in this.m_properties)
		yield 'email2';

	for (var key in this.m_properties)
		if (key != 'email1' && key != 'email2')
			yield key;
}
};


// ContactGoogleStatic
// static objects and methods are in this separate object for with() convenience
//
var ContactGoogleStatic = {
	nsAtom     : Namespace(Xpath.NS_ATOM),
	nsGd       : Namespace(Xpath.NS_GD),
	nsGContact : Namespace(Xpath.NS_GCONTACT),
	mask       : {
		name          : 0x0001,
		content       : 0x0002,
		email         : 0x0004,
		phoneNumber   : 0x0008,
		postalAddress : 0x0010,
		organization  : 0x0020,
		im            : 0x0040,
		website       : 0x0080,
		birthday      : 0x0100
	},
	a_fragment : {
		organization  : [ 'work', 'other' ],
		phoneNumber   : [ 'work', 'home', 'work_fax', 'pager', 'mobile' ],
		postalAddress : [ 'work', 'home' ],
		website       : [ 'work', 'home' ]
	},
	ns_rel : {
		organization  : Xpath.NS_GD,
		phoneNumber   : Xpath.NS_GD,
		postalAddress : Xpath.NS_GD,
		website       : Xpath.NS_GCONTACT
	},
	m_a_rel                : new Object(),
	m_a_element_and_suffix : new Object(),
	m_a_hyphenation        : new Object(),
	gac                    : new GdAddressConverter(),
	cgopi                  : new ContactGoogleOrderedPropertyIterator(),
	cgei                   : new ContactGoogleEmailIterator(),
	kMatchFirst            : 1, // tell get_elements_matching_attribute() to return only the first element of each match

	to_bool : function (xml) {
		return (xml.length() > 0);
	},
	to_string : function (xml) {
		var length = xml.length();
		zinAssertAndLog(length == 0 || length == 1, function () { return "length: " + length + " string: " + xml.toString(); });

		return (length == 0) ? "" : xml.toString();
	},
	shorten_rel : function(value, element_name) {
		return (element_name == 'website') ? value : rightOfChar(value);
	},
	set_if : function(properties, key, xml_value) {
		try {
			var value = xml_value.hasComplexContent() ? xml_value.child(0).toString() : xml_value.toString();
		} catch(ex) {
			zinAssertAndLog(false);
		}
		// logger().debug("ContactGoogle: set_if: key: " + key + " value: " + value + " length: " + value.length);
		// logger().debug("ContactGoogle: set_if: xml_value: " + xml_value + " length: " + xml_value.length());
		if (value.length > 0)
			properties[key] = value;
	},
	set_for : function (properties, ns, entry, element_name) {
		let list = this.get_elements_matching_attribute(entry.ns::[element_name], 'rel', this.a_fragment[element_name],
		                   this.kMatchFirst, element_name);

		for (var i = 0; i < list.length(); i++)
			this.set_if(properties, this.get_hyphenation(element_name, this.shorten_rel(list[i].@rel, element_name)), list[i]);
	},
	modify_or_delete_child : function(xml, properties, key, a_is_used, attribute_to_set) {
		// logger().debug("ContactGoogle: modify_or_delete_child: key: " + key);

		if (key in properties && properties[key].length > 0) {
			// logger().debug("ContactGoogle: modify key: " + key);

			if (attribute_to_set)
				xml.@[attribute_to_set] = properties[key];
			else
				xml.* = properties[key];
		}
		else {
			// logger().debug("ContactGoogle: deleting key: " + key);
			try {
				delete xml.parent().*[xml.childIndex()];
			} catch(ex) {
				zinAssertAndLog(false, "xml: " + xml.toXMLString() + " key: " + key);
			}
		}

		a_is_used[key] = true;
	},
	modify_or_delete_child_for : function (properties, ns, entry, element_name, a_is_used, attribute_to_set) {
		let list = this.get_elements_matching_attribute(entry.ns::[element_name], 'rel', this.a_fragment[element_name], this.kMatchFirst, element_name);

		for (var i = 0; i < list.length(); i++)
			this.modify_or_delete_child(list[i], properties,
				this.get_hyphenation(element_name, this.shorten_rel(list[i].@rel, element_name)), a_is_used, attribute_to_set);
	},
	modify_or_delete_child_if : function(e, properties, key, a_is_used) {
		if (e.length() > 0)
			this.modify_or_delete_child(e, properties, key, a_is_used);
	},
	get_rel : function (suffix, element_name) {
		// website is in gContact namespace, which don't use urls in rel values
		let left_of = (element_name == "website") ? "" : (Xpath.NS_GD + '#');
		let key     = element_name + '_' + suffix;
			
		if (!(key in this.m_a_rel))
			this.m_a_rel[key] = left_of + suffix;

		return this.m_a_rel[key];
	},
	get_element_and_suffix : function (key) {
		if (!(key in this.m_a_element_and_suffix)) {
			let l = leftOfChar(key, '_');
			let r = rightOfChar(key, '_');
			this.m_a_element_and_suffix[key] = newObject('l', l, 'r', r)
		}

		return [this.m_a_element_and_suffix[key].l, this.m_a_element_and_suffix[key].r];
	},
	get_elements_matching_attribute : function (list, attribute, a_rel, style, element_name) {
		// the e4x formulation for matching attributes throws an exception if the element doesn't have a rel attribute:
		// entry.nsGd::organization.(@rel==blah);
		// We could catch the exception, but a) that seems clumsy and b) we may (in future) compose the list differently based on style
		// ie when tb supports multiple 'work' email addresses

		zinAssert(style == this.kMatchFirst); // this.kMatchAll not implemented.

		let a_matched = {};
		let ret       = <></>;

		for (var i = 0; i < list.length(); i++)
		{
			let tmp = list[i].@[attribute];

			if (!(tmp in a_matched))
				for (var j = 0; j < a_rel.length; j++)
					if (tmp == this.get_rel(a_rel[j], element_name)) {
						a_matched[tmp] = true;
						ret += list[i];
					}
		}

		zinAssertAndLog(a_rel.length >= ret.length(), function () { return ret.toXMLString(); });

		return ret;
	},
	get_hyphenation : function (left, right) {
		if (!(left in this.m_a_hyphenation))
			this.m_a_hyphenation[left] = new Object();

		if (!(right in this.m_a_hyphenation[left]))
			this.m_a_hyphenation[left][right] = left + '_' + right;

		return this.m_a_hyphenation[left][right];
	},
	newEntry : function() {
		return <atom:entry xmlns:atom={Xpath.NS_ATOM}
		                   xmlns:gd={Xpath.NS_GD}
		                   xmlns:openSearch={Xpath.NS_OPENSEARCH}
		                   xmlns:gContact={Xpath.NS_GCONTACT}>
		              <atom:category scheme={Xpath.NS_GD + "#kind"} term={Xpath.NS_GCONTACT + "#group"}/>
		          </atom:entry>;
	},
	newXml : function(arg) {
		zinAssert((arg instanceof String) || (typeof(arg) == 'string') || (arg instanceof XMLHttpRequest));
		var is_text_parsed = false;

		var text = (arg instanceof XMLHttpRequest) ? arg.responseText : arg;

		try {
			var xml = new XML(stripCharsToWorkaroundBug478905(text).replace(reXmlDeclaration,""));
			is_text_parsed = true;
		}
		catch (ex) {
			// The e4x parser can fail on certain UTF-8 byte sequences (see Issue #180)
			// and http://groups.google.com/group/mozilla.dev.tech.xml/browse_thread/thread/60ff2a453c96af06#
			// here we try to recover using the DOM XML parser.
			//
			logger().warn("ContactGoogleStatic: newXml: failed to parse XML using e4x: " + ex.message + " xml text: " + text);
		}

		zinAssert(is_text_parsed);

		return xml;
	},
	add_whitespace_to_postal_line : function(x) {
		return " " + x + " ";
	},
	add_whitespace_to_postal_properties : function(properties, key) {
		with (ContactGoogleStatic) {
			var properties_out   = { };
			let a_gac_properties = new Object();
			let is_sane          = gac.convert(properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_PROPERTIES);

			zinAssertAndLog(is_sane, function() { return "key: " + key + " properties: " + aToString(properties); } );

			for (i in a_gac_properties)
				a_gac_properties[i] = add_whitespace_to_postal_line(a_gac_properties[i]);

			gac.convert(properties_out, key, a_gac_properties, GdAddressConverter.ADDR_TO_XML | GdAddressConverter.PRETTY_XML );
		}

		return properties_out[key];
	}
};
