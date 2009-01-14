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

function ContactGoogle(xml, mode) {
	this.m_entry      = xml  ? xml  : ContactGoogleStatic.newEntry();
	this.m_mode       = mode ? mode : ContactGoogle.ePostal.kDisabled;
	this.m_properties = null;             // associative array populated by the getter
	this.m_groups     = null;             //             array populated by the getter

	this.meta  = new Object();
	this.meta_initialise_getters();
}

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

	var reAtom = /title|content/;
	var reGd   = /email|phoneNumber|postalAddress|organization|im/;

	with (ContactGoogleStatic)
		for (i = 0; i < children.length(); i++) {
			let name = children[i].name().localName;
			let uri  = children[i].name().uri;

			if ((uri == Xpath.NS_ATOM && reAtom.test(name)) || (uri == Xpath.NS_GD && reGd.test(name))) 
				ret |= mask[name];
		}

	return ret;
},
warn_if_entry_isnt_valid : function() {
	var entry = this.m_entry;

	with (ContactGoogleStatic) {
		// Curious to know whether <title> has a type attribute set to something other than 'text'. ATOM rfc says that 'html' is legal
		//
		let title = entry.nsAtom::title;
	
		if (title.@type.length() > 0 && title.@type != 'text')
			logger().warn("ContactGoogle: unexpected: title: " + title.toXMLString());
	}
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
	let i;

	this.warn_if_entry_isnt_valid();

	with (ContactGoogleStatic) {
		if (imask & mask.title)   set_if(properties, 'title',    entry.nsAtom::title);
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

		if (imask & mask.organization)
			for (i = 0; i < a_fragment.organization.length; i++) {
				let list = entry.nsGd::organization.(@rel==get_rel(a_fragment.organization[i]));

				if (list.length() > 0)
				{
					set_if(properties, 'organization_orgTitle',  list[0].nsGd::orgTitle);
					set_if(properties, 'organization_orgName',   list[0].nsGd::orgName);
					break;
				}
			}

		if (imask & mask.im) {
			let list = entry.nsGd::im.(@protocol==get_rel('AIM'));
	
			if (list.length() > 0)
				properties['im_AIM'] = list[0].@address.toString();
		}
	}

	// TODO this is just while debugging - remove for release
	if (true)
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
set properties (properties) {
	// Here's how the contact is updated:
	// - iterate through the children of <entry>
	//   - for each child of <entry> that we're interested in:
	//     - if there's a corresponding member of property, modify the child, otherwise delete it.
	// - add the property members that weren't involved in modify or delete

	var entry        = this.m_entry;
	var imask        = this.make_mask_of_elements_in_entry();
	var a_is_used    = new Object();
	var organization = null;
	var i, key;

	// logger().debug("AMHERE: 1: properties: " + aToString(properties));

	with (ContactGoogleStatic) {
		if (imask & mask.title) {
			// only ever modify - never add or delete <title> here
			entry.nsAtom::title = ('title' in properties) ? properties['title'] : "";
			a_is_used['title'] = true;
		}

		if (imask & mask.content)
			modify_or_delete_child(entry.nsAtom::content, properties, 'content', a_is_used);

		if (imask & mask.email) {
			let key, xml;
			for ( [ key, xml ] in cgei.iterator(entry))
				modify_or_delete_child(xml, properties, key, a_is_used, true);
		}

		if (imask & mask.phoneNumber)
			modify_or_delete_child_for(properties, nsGd, entry, 'phoneNumber', a_is_used);

		if (!(this.m_mode & ContactGoogle.ePostal.kEnabled)) // ensure that postalAddress elements aren't touched
			for (i = 0; i < a_fragment.postalAddress.length; i++)
				a_is_used[get_hyphenation('postalAddress', a_fragment.postalAddress[i])] = true;
		else if (imask & mask.postalAddress)
			this.postalAddressModifyFields(properties, a_is_used);

		if (imask & mask.organization) {
			let is_found = false;

			for (i = 0; i < a_fragment.organization.length && !is_found; i++) {
				organization = entry.nsGd::organization.(@rel==get_rel(a_fragment.organization[i]));

				if (organization.length() > 0) {
					let e;
					e = organization[0].nsGd::orgTitle;
					if (e.length() > 0)
						modify_or_delete_child(e, properties, 'organization_orgTitle', a_is_used);
					e = organization[0].nsGd::orgName;
					if (e.length() > 0)
						modify_or_delete_child(e, properties, 'organization_orgName', a_is_used);
					is_found = true;
				}
			}

			if (!is_found)
				organization = null;
			else if (organization.*.length() == 0) {
				// logger().debug("AMHERE: deleting");
				delete entry.*[organization.childIndex()];
				organization = null;
			}
		}

		if (imask & mask.im) {
			let tmp = entry.nsGd::im.(@protocol==get_rel('AIM'));
	
			if (tmp.length() > 0)
				modify_or_delete_child(tmp[0], properties, 'im_AIM', a_is_used, true);
		}

		// ADD properties...
		// the choice of rel='other' for AIM and rel='home' for email* is arbitrary
		// logger().debug("AMHERE: 2: properties: " + aToString(properties) + " a_is_used: " + aToString(a_is_used));
		//
		let l, r;
		let is_added_organization = false;

		for (key in cgopi.iterator(properties))
			if (!(key in a_is_used)) {
				// logger().debug("properties setter: adding key: " + key);

				switch(key) {
				case "title":
					logger().error("ContactGoogle: shouldn't be adding a property with key: " + key);
					break;
				case "content":
					entry.content = <atom:content xmlns:atom={Xpath.NS_ATOM} type='text'>{properties[key]}</atom:content>;
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
					entry.* += <gd:{l} xmlns:gd={Xpath.NS_GD} rel={get_rel(r)}>{properties[key]}</gd:{l}>;
					break;
				default:
					zinAssertAndLog(false, key);
				}
			}

		if (is_added_organization)
			entry.* += organization;
	}

	this.m_properties = null;
},
postalAddressModifyFields : function(properties, a_is_used) {
	with (ContactGoogleStatic) {
		let a_suffix = a_fragment['postalAddress'];

		for (var i = 0; i < a_suffix.length; i++) {
			let tmp = this.m_entry.nsGd::['postalAddress'].(@rel==get_rel(a_suffix[i]));

			if (tmp.length() > 0)
				this.postalAddressModifyField(tmp[0], properties, a_suffix[i], a_is_used);
		}
	}
},
postalAddressModifyField : function(xml, properties, suffix, a_is_used) {
	// if the contact's field contains xml,  preserve the <otheraddr> element
	// if the contact's field contacts text, move the text into an <otheraddr> element in the xml and save that
	//
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

			gac.convert(new_properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_XML | GdAddressConverter.PRETTY_XML );
		}
		else
			new_properties = properties;

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
is_empty: function() {
	return isObjectEmpty(this.properties);
},
toString: function() {
	var ret = "\n";
	var key, value;

	for ([key, value] in ContactGoogle.eMeta)
		ret += " meta:     " + key + ": " + this.meta[key] + "\n";

	ret += " groups:   " + this.groups.toString() + "\n";

	for (key in this.properties)
		ret += " property: " + key + ": " + this.properties[key] + "\n";

	return ret;
},
toStringXml: function() {
	return this.m_entry.toXMLString();
}
};

ContactGoogle.eMeta      = new ZinEnum( 'id', 'updated', 'edit', 'self', 'deleted' ); // 'etag' 
ContactGoogle.ePostal    = new ZinEnum( { 'kEnabled' : 0x01, 'kDisabled'   : 0x02 } );
ContactGoogle.eTransform = new ZinEnum( { 'kEmail'   : 0x01, 'kWhitespace' : 0x02, 'kAll' : 0x03 } );

// factory methods
//
ContactGoogle.textToContact = function(text, mode) {
	var xml = ContactGoogleStatic.newXml(text);
	return new ContactGoogle(xml, mode);
}
ContactGoogle.textToContacts = function(text, a_contact, mode) {
	var feed    = ContactGoogleStatic.newXml(text);
	var nsAtom  = ContactGoogleStatic.nsAtom;
	var entries = feed.nsAtom::entry;
	var ret     = a_contact ? a_contact : new Object();
	var contact;

	for (var i = 0; i < entries.length(); i++) {
		contact = new ContactGoogle(entries[i], mode);
		ret[contact.meta.id] = contact;
	}

	return ret;
}

ContactGoogle.addWhitespaceToPostalProperties = function(properties) {
	var properties_out = cloneObject(properties);

	with (ContactGoogleStatic) {
		var a_suffix = a_fragment['postalAddress'];

		for (var i = 0; i < a_suffix.length; i++) {
			let key = get_hyphenation('postalAddress', a_suffix[i])

			if (key in properties) {
				let a_gac_properties = new Object();
				let is_sane          = gac.convert(properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_PROPERTIES);

				zinAssertAndLog(is_sane, function() { return "key: " + key + " properties: " + aToString(properties); } );

				for (i in a_gac_properties)
					a_gac_properties[i] = " " + a_gac_properties[i] + " ";

				gac.convert(properties_out, key, a_gac_properties, GdAddressConverter.ADDR_TO_XML | GdAddressConverter.PRETTY_XML );
			}
		}
	}

	return properties_out;
}

ContactGoogle.transformTbProperties = function(transform, properties)
{
	for (key in properties)
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
		default: zinAssert(false, transform);
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
		title         : 0x01,
		content       : 0x02,
		email         : 0x04,
		phoneNumber   : 0x08,
		postalAddress : 0x10,
		organization  : 0x20,
		im            : 0x40
	},
	a_fragment : {
		organization  : [ 'work', 'other' ],
		phoneNumber   : [ 'work', 'home', 'work_fax', 'pager', 'mobile' ],
		postalAddress : [ 'work', 'home' ]
	},
	m_a_rel                : new Object(),
	m_a_element_and_suffix : new Object(),
	m_a_hyphenation        : new Object(),
	gac                    : new GdAddressConverter(),
	cgopi                  : new ContactGoogleOrderedPropertyIterator(),
	cgei                   : new ContactGoogleEmailIterator(),

	to_bool : function (xml) {
		return (xml.length() > 0);
	},
	to_string : function (xml) {
		var length = xml.length();
		zinAssertAndLog(length == 0 || length == 1, function () { return "length: " + length + " string: " + xml.toString(); });

		return (length == 0) ? "" : xml.toString();
	},
	set_if : function(properties, key, xml_value) {
		var value = xml_value.toString();
		// logger().debug("AMHERE: set_if: key: " + key + " value: " + value + " length: " + value.length);
		// logger().debug("AMHERE: set_if: xml_value: " + xml_value + " length: " + xml_value.length());
		if (value.length > 0)
			properties[key] = value;
	},
	set_for : function (properties, ns, entry, prefix) {
		var a_suffix = this.a_fragment[prefix];

		for (var i = 0; i < a_suffix.length; i++) {
			let tmp = entry.ns::[prefix].(@rel==this.get_rel(a_suffix[i]));

			if (tmp.length() > 0)
				this.set_if(properties, this.get_hyphenation(prefix, a_suffix[i]), tmp[0]);
		}
	},
	modify_or_delete_child : function(xml, properties, key, a_is_used, is_address_attribute) {
		// logger().debug("AMHERE: modify_or_delete_child: key: " + key);

		if (key in properties && properties[key].length > 0) {
			// logger().debug("AMHERE: modify key: " + key);

			if (is_address_attribute)
				xml.@address = properties[key];
			else
				xml.* = properties[key];
		}
		else {
			// logger().debug("AMHERE: deleting key: " + key);
			delete xml.parent().*[xml.childIndex()];
		}

		a_is_used[key] = true;
	},
	modify_or_delete_child_for : function (properties, ns, entry, prefix, a_is_used) {
		var a_suffix = this.a_fragment[prefix];

		for (var i = 0; i < a_suffix.length; i++) {
			let tmp = entry.ns::[prefix].(@rel==this.get_rel(a_suffix[i]));

			if (tmp.length() > 0)
				this.modify_or_delete_child(tmp[0], properties, this.get_hyphenation(prefix, a_suffix[i]), a_is_used);
		}
	},
	get_rel : function (suffix) {
		if (!(suffix in this.m_a_rel))
			this.m_a_rel[suffix] = Xpath.NS_GD + '#' + suffix;

		return this.m_a_rel[suffix];
	},
	get_element_and_suffix : function (key) {
		if (!(key in this.m_a_element_and_suffix)) {
			let l = leftOfChar(key, '_');
			let r = rightOfChar(key, '_');
			this.m_a_element_and_suffix[key] = newObject('l', l, 'r', r)
		}

		return [this.m_a_element_and_suffix[key].l, this.m_a_element_and_suffix[key].r];
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
		              <atom:title type="text"/>
		          </atom:entry>;
	},
	newXml : function(text) {
		try {
			var xml = new XML(text.replace(reXmlDeclaration,""));
		}
		catch (ex) {
			zinAssertAndLog(false, ex.message + "\nbad xml text: " + text);
		}

		return xml;
	}
};
