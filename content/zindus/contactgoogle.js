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
// $Id: contactgoogle.js,v 1.42 2011-05-01 02:21:51 cvsuser Exp $

function GoogleData()
{
	this.m_properties = null;             // associative array populated by the getter

	this.meta         = new Object();
	this.m_meta_cache = new Object();

	this.meta_initialise_getters();

	this.__defineGetter__("properties", function()  { return this.get_properties();  });
	this.__defineSetter__("properties", function(p) { return this.set_properties(p); });
}

GoogleData.eMeta    = new ZinEnum( 'id', 'id_as_url', 'updated', 'edit', 'self', 'deleted' );
GoogleData.eElement = new ZinEnum( 'contact', 'group' );

GoogleData.prototype = {
meta_initialise_getters : function () {
	let fn, key, value;

	for each ([key, value] in GoogleData.eMeta) {
		with (GoogleData.eMeta) { with (ContactGoogleStatic) {
			switch(value) {
				case id_as_url: fn = function(entry)  { return to_id_as_url(entry.nsAtom::id); };                         break;
				case id:         fn = function(entry) { return to_id(entry.nsAtom::id); };                                break;
				case updated:    fn = function(entry) { return to_string(entry.nsAtom::updated); };                       break;
				case edit:       fn = function(entry) { return to_string(entry.nsAtom::link.(@rel=="edit").@href); };     break;
				case self:       fn = function(entry) { return to_string(entry.nsAtom::link.(@rel=="self").@href); };     break;
				case deleted:    fn = function(entry) { return to_bool(entry.nsGd::deleted); };                           break;
				default: zinAssertAndLog(false, key);
			};
		} }

		this.meta.__defineGetter__(key, this.meta_make_getter(key, fn));
	}
},
meta_make_getter: function(key, fn) {
	var self = this;
	return function() {
		zinAssert(self.m_entry);
		if (!(key in self.m_meta_cache))
			self.m_meta_cache[key] = fn(self.m_entry);

		return self.m_meta_cache[key];
	};
},
get_properties : function() {
	if (!this.m_properties)
		this.m_properties = this.properties_from_xml();
	return this.m_properties;
},
set_properties : function(p) {
	zinAssert(false);
},
toString : function() {
	var ret = "\n";
	var key, value;

	ret += " meta:       ";
	for ([key, value] in GoogleData.eMeta)
		ret += " " + key + ": " + this.meta[key];
	ret += "\n"

	ret += " properties: ";
	for (key in this.properties)
		ret += " " + key + ": " + this.properties[key];

	return ret;
},
toStringXml : function() {
	return this.m_entry.toXMLString();
}
};

GoogleData.element_type_from_instance = function(x) {
	let ret;
	if (x instanceof ContactGoogle)
		ret = GoogleData.eElement.contact;
	else if (x instanceof GroupGoogle)
		ret = GoogleData.eElement.group;
	else zinAssertAndLog(false, x);
	return ret;
}

GoogleData.new = function(arg, mode) {
	let entry    = (typeof(arg) == "xml") ? arg : ContactGoogleStatic.newXml(arg);
	let nsAtom   = ContactGoogleStatic.nsAtom;
	let id       = entry.nsAtom::id;
	let a        = id.toString().match(/\/(contacts|groups)\//);
	let key      = a[1];
	let ret;

	zinAssert(id.length() == 1);

	switch(key) {
		case 'contacts': ret = new ContactGoogle(entry, mode); break;
		case 'groups':   ret = new GroupGoogle(entry);         break;
		default:        zinAssertAndLog(false, arg);
	}

	return ret;
}

GoogleData.new_from_feed = function(arg, a_gd, mode) {
	var feed    = ContactGoogleStatic.newXml(arg);
	var nsAtom  = ContactGoogleStatic.nsAtom;
	var entries = feed.nsAtom::entry;
	var ret     = a_gd ? a_gd : new Object();

	for (var i = 0; i < entries.length(); i++) {
		let gd = GoogleData.new(entries[i], mode);
		ret[gd.meta.id] = gd;
	}

	return ret;
}

function ContactGoogle(xml, mode) {
	GoogleData.call(this);

	this.m_entry      = xml  ? xml  : ContactGoogleStatic.newEntry(GoogleData.eElement.contact);
	this.m_mode       = mode ? mode : ContactGoogle.ePostal.kDisabled;
	this.m_groups     = null;             //             array populated by the getter
	this.m_photo      = null;             //             array populated by the getter

	this.__defineGetter__("groups", function()  { return this.get_groups(); });
	this.__defineSetter__("groups", function(g) { return this.set_groups(g); });
	this.__defineGetter__("photo",  function()  { return this.get_photo(); }); // don't need a setter
}

ContactGoogle.ePostal      = new ZinEnum( { 'kEnabled' : 0x01, 'kDisabled'   : 0x02 } );
ContactGoogle.eTransform   = new ZinEnum( { 'kEmail'   : 0x01, 'kWhitespace' : 0x02, 'kAll' : 0x03 } );
ContactGoogle.eModify      = new ZinEnum( { 'kRemoveDeletedGroupMembershipInfo' : 0x01 } );
ContactGoogle.eSystemGroup = new ZinEnum( newObjectWithKeysMatchingValues('Contacts', 'Coworkers', 'Family', 'Friends', 'Suggested') );
ContactGoogle.eSystemGroupForApps = new ZinEnum( newObjectWithKeysMatchingValues('Contacts', 'Suggested') );

function ContactGoogleProto() {}

ContactGoogleProto.prototype = {
copy : function () {
	return new ContactGoogle(ContactGoogleStatic.newXml(this.m_entry.toXMLString()), this.m_mode);
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
	zinAssert(this.m_entry);

	var children = this.m_entry.*;
	var ret = 0;
	var i, reAtom, reGd, reGContact;

	if (GD_API_VERSION == 2) {
		reAtom     = /title|content/;
		reGd       = /email|phoneNumber|postalAddress|organization|im/;
		reGContact = /blablahblahblah/;
	}
	else {
		zinAssert(String(GD_API_VERSION).substr(0,1) == 3);

		reAtom     = /content/;
		reGd       = /email|phoneNumber|structuredPostalAddress|name|organization|im/;
		reGContact = /website|birthday/;
	}

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
	let ret = new Array();

	zinAssert(this.m_entry);

	with (ContactGoogleStatic) {
		let groups = this.m_entry.nsGContact::groupMembershipInfo;

		for (var i = 0; i < groups.length(); i++)
			if (groups[i].@deleted != 'true') {
				let href = groups[i].@href.toString();

				if (href.length > 0)
					ret.push(to_id(href));
			}
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

		if (imask & mask.structuredPostalAddress && (this.m_mode & ContactGoogle.ePostal.kEnabled) ) {
			list = get_elements_matching_attribute(entry.nsGd::structuredPostalAddress, 'rel', a_fragment.structuredPostalAddress, kMatchFirst, 'structuredPostalAddress');

			for (i = 0; i < list.length(); i++)
				set_if(properties, get_hyphenation('structuredPostalAddress', shorten_rel(list[i].@rel, 'structuredPostalAddress')), list[i].nsGd::formattedAddress);
		}

		if (imask & mask.name) {
			// set_if(properties, 'name_givenName',   entry.nsGd::name.nsGd::givenName);
			// set_if(properties, 'name_familyName',  entry.nsGd::name.nsGd::familyName);
			set_if(properties,    'name_fullName',    entry.nsGd::name.nsGd::fullName);
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
get_photo : function() {
	if (!this.m_photo) {
		let link = this.get_photo_link();

		with (ContactGoogleStatic) {
			this.m_photo = newObject('uri', link.@href.toString());

			if (link.@nsGd::etag.length() > 0)
				this.m_photo['etag'] = link.@nsGd::etag.toString();
		}
	}
	return this.m_photo;
},
get_photo_link : function() {
	let ret = null;
	with (ContactGoogleStatic) {
	 	let list = this.m_entry.nsAtom::link;
		let i;

		for (i = 0; i < list.length(); i++) {
			if (list[i].@rel == get_rel("photo")) {
				ret = list[i];
				break;
			}
		}

		zinAssertAndLog(ret != null, "<entry>'s must contain a <limk> element with a photo rel");
	}
	return ret;
},
get_groups : function() {
	if (!this.m_groups)
		this.m_groups = this.groups_from_xml();
	return this.m_groups;
},
set_groups : function(groups) {
	zinAssert(groups instanceof Array);
	var entry = this.m_entry;

	with (ContactGoogleStatic) {
		delete entry.nsGContact::groupMembershipInfo;

		for (var i = 0; i < groups.length; i++)
			entry.* += <gContact:groupMembershipInfo xmlns:gContact={Xpath.NS_GCONTACT} deleted='false' href={groups[i]}/>;
	}

	this.m_groups = null;
},
set_properties : function(properties_in) {
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

	// logger().debug("ContactGoogle: set_properties: 1: properties: " + aToString(properties));

	try {
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
				modify_or_delete_child(xml, properties, key, a_is_used, 'address');
		}

		if (imask & mask.phoneNumber)
			modify_or_delete_child_for(properties, nsGd, entry, 'phoneNumber', a_is_used);

		if (!(this.m_mode & ContactGoogle.ePostal.kEnabled)) // ensure that postalAddress elements aren't touched
			for (i = 0; i < a_fragment.postalAddress.length; i++)
				a_is_used[get_hyphenation(postalWord(), a_fragment[postalWord()][i])] = true;
		else if ((imask & mask.postalAddress) || (imask & mask.structuredPostalAddress))
			this.postalAddressModifyFields(properties, a_is_used);

		if (imask & mask.name) {
			name = entry.nsGd::name;

			// explicity clear the flavour that we don't use - triggering google mutation
			// as per: http://groups.google.com/group/google-contacts-api/browse_thread/thread/ea623b18efb16963?hl=en
			//
			modify_or_delete_child_if(name.nsGd::givenName,  {name_givenName: ""},  'name_givenName',  {});
			modify_or_delete_child_if(name.nsGd::familyName, {name_familyName: ""}, 'name_familyName', {});
			modify_or_delete_child_if(name.nsGd::fullName,   properties,            'name_fullName',   a_is_used);

			if (name.*.length() == 0) {
				// logger().debug("ContactGoogle: deleting");
				delete entry.*[name.childIndex()];
				name = null;
			}
		}

		if (imask & mask.organization) {
			let is_found = false;

			list = get_elements_matching_attribute(entry.nsGd::organization, 'rel', a_fragment.organization, kMatchFirst, 'organization');

			// logger().debug("ContactGoogle: organization list length: " + list.length());

			if (list.length() > 0) {
				organization = list[0];

				// logger().debug("ContactGoogle: organization before change: " + organization.toString());

				modify_or_delete_child_if(organization.nsGd::orgTitle, properties, 'organization_orgTitle', a_is_used);
				modify_or_delete_child_if(organization.nsGd::orgName,  properties, 'organization_orgName',  a_is_used);
				is_found = true;

				// logger().debug("ContactGoogle: organization after change: " + organization.toString());
				// logger().debug("ContactGoogle: organization.*.length(): " + organization.*.length());
			}

			if (!is_found)
				organization = null;
			else if (organization.*.length() == 0) {
				// logger().debug("ContactGoogle: deleting empty organization element");
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
				case "title":
					logger().error("ContactGoogle: shouldn't be adding a property with key: " + key);
					break;
				case "content":
					entry.content = <atom:content xmlns:atom={Xpath.NS_ATOM} type='text'>{properties[key]}</atom:content>;
					break;
				// case "name_givenName":
				// case "name_familyName":
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
					try {
					organization.* += <gd:{r} xmlns:gd={Xpath.NS_GD} >{properties[key]}</gd:{r}>;
					} catch (ex) {
						// better debugging for issue #266
						logger().fatal("exception encountered in organisation setter:\n" +
						   " is_added_organization: " + is_added_organization + " " +
						   " organization: " + organization.toString() + " " +
						   " properties[key]: " + properties[key]);
						zinAssertCatch(ex);
					}

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
					[l, r] = get_element_and_suffix(key);
					value = properties[key];
					entry.* += <gd:{l} xmlns:gd={Xpath.NS_GD} rel={get_rel(r)}>{value}</gd:{l}>;
					break;
				case "structuredPostalAddress_home":
				case "structuredPostalAddress_work":
				case "postalAddress_home":
				case "postalAddress_work":
					[l, r] = get_element_and_suffix(key);
					value = properties[key];

					zinAssert(this.mode() & ContactGoogle.ePostal.kEnabled);
					value = ContactGoogleStatic.add_whitespace_to_postal_properties(properties, key);

					if (GD_API_VERSION == 2) {
						entry.* += <gd:{l} xmlns:gd={Xpath.NS_GD} rel={get_rel(r)}>{value}</gd:{l}>;
					}
					else { // v3
						entry.* += <gd:structuredPostalAddress xmlns:gd={Xpath.NS_GD} rel={get_rel(r)}>
						               <gd:formattedAddress>{value}</gd:formattedAddress></gd:structuredPostalAddress>
					}
					break;
				case "website_home":
				case "website_work":
					[l, r] = get_element_and_suffix(key);
					let value = properties[key];
					entry.* += <gContact:{l} xmlns:gContact={Xpath.NS_GCONTACT} rel={get_rel(r, l)} href={value}/>;
					break;
				case "birthday":
					entry.* += <gContact:birthday xmlns:gContact={Xpath.NS_GCONTACT} when={properties[key]} />;
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
	}
	catch (ex) {
		// better debugging for issue #266
		logger().fatal("exception encountered in contact setter:\n properties_in: " + aToString(properties_in) + "\n xml: " + this.toString());
		zinAssertCatch(ex);
	}

	this.m_properties = null;
},
postalEntry : function() {
	let nsGd = ContactGoogleStatic.nsGd;
	return (GD_API_VERSION == 2) ? this.m_entry.nsGd::postalAddress : this.m_entry.nsGd::structuredPostalAddress;
},
postalAddressModifyFields : function(properties, a_is_used) {
	with (ContactGoogleStatic) {
		let list = get_elements_matching_attribute(this.postalEntry(), 'rel', a_fragment[postalWord()], kMatchFirst, postalWord());

		for (var i = 0; i < list.length(); i++)
			this.postalAddressModifyField(list[i], properties, rightOfChar(list[i].@rel, '#'), a_is_used);
	}
},
postalAddressModifyField : function(xml, properties, suffix, a_is_used) {
	// if the contact's field contains xml,  preserve the <otheraddr> element
	// if the contact's field contacts text, move the text into an <otheraddr> element in the xml and save that
	//
	zinAssert((this.m_mode & ContactGoogle.ePostal.kEnabled));

	// logger().debug("postalAddressModifyField: enters: xml: " + xml.toXMLString() + " properties: " + aToString(properties) + " suffix: " + suffix);

	with (ContactGoogleStatic) {
		var key                = get_hyphenation(postalWord(), suffix);
		var is_property_postal = false;
		var otheraddr          = this.postalAddressOtherAddr(key);
		var a_gac_properties   = { };
		var new_properties;

		// logger().debug("postalAddressModifyField: otheraddr: " + otheraddr);

		if (key in properties)
			is_property_postal = gac.convert(properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_PROPERTIES);

		// if (a) the new property is a parsable postal address OR (b) the existing property isn't parsable
		//
		if (is_property_postal || otheraddr == null) {
			new_properties = { key : null };

			if (otheraddr && otheraddr.length > 0) // the postalAddress of the contact is xml
				a_gac_properties["otheraddr"] = otheraddr;
			else if (otheraddr == null)            // the postalAddress of the contact is text
				a_gac_properties["otheraddr"] = (GD_API_VERSION == 2) ? xml.toString() : xml.nsGd::formattedAddress.toString();
			else
				;                                  // the postalAddress of the contact is xml with an empty <otheraddr> element

			// logger().debug("postalAddressModifyField: a_gac_properties before: " + aToString(a_gac_properties));

			for (var i in a_gac_properties)
				a_gac_properties[i] = ContactGoogleStatic.add_whitespace_to_postal_line(a_gac_properties[i]);

			// logger().debug("postalAddressModifyField: a_gac_properties after: " + aToString(a_gac_properties));

			gac.convert(new_properties, key, a_gac_properties, GdAddressConverter.ADDR_TO_XML | GdAddressConverter.PRETTY_XML );
		}
		else
			new_properties = properties;

		// logger().debug("postalAddressModifyField: key: " + key + " new_properties: " + aToString(new_properties));

		if (GD_API_VERSION == 2)
			modify_or_delete_child(xml, new_properties, key, a_is_used);
		else {
			// note - strictly speaking when we modify formattedAddress we'd want to remove the structured fields
			// to trigger google's destructuring parsing
			// but - their parsing isn't going to support zindus xml, so no point.  If the user has both
			// zindus xml and the structured fields, they probably want exactly that (for thunderbird and phone).
			//
			modify_or_delete_child(xml.nsGd::formattedAddress, new_properties, key, a_is_used);

			if (xml.nsGd::formattedAddress.length() == 0)
				delete xml.parent().*[xml.childIndex()];
		}
	}

	// logger().debug("postalAddressModifyField: exits: xml: " + xml.toXMLString());
},
postalAddressOtherAddr : function(key) {
	zinAssert(this.m_mode & ContactGoogle.ePostal.kEnabled);

	var is_parsed = key in this.properties;

	// logger().debug("postalAddressOtherAddr: key: " + key + " is_parsed: " + is_parsed + " contact: " + this.toString());

	if (is_parsed) {
		var str = this.properties[key];
		var ret = "";
		var a_in  = newObject('x', str);
		var a_out = new Object();
	
		is_parsed = is_parsed && ContactGoogleStatic.gac.convert(a_in, 'x', a_out, GdAddressConverter.ADDR_TO_PROPERTIES);

		// logger().debug("postalAddressOtherAddr: gac.convert returns is_parsed: " + is_parsed + " str: " + str + " a_out: " + aToString(a_out));
	}

	if (!is_parsed)                  // it wasn't xml
		ret = null;
	else if ("otheraddr" in a_out)   // it was xml and there was an <otheraddr> element
		ret = a_out["otheraddr"];
	else                             // it was xml but didn't have an <otheraddr> element
		ret = "";

	return ret;
},
isAnyPostalAddressInXml : function() {
	var ret = false;

	zinAssert(this.mode() & ContactGoogle.ePostal.kEnabled); // it only makes sense to call this method in this mode

	with (ContactGoogleStatic)
		for (var i = 0; i < a_fragment[postalWord()].length && !ret; i++) {
			let key = get_hyphenation(postalWord(), a_fragment[postalWord()][i]);

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
modify : function( mods ) {
	with (ContactGoogleStatic) {
		if (mods | ContactGoogle.eModify.kRemoveDeletedGroupMembershipInfo) {
			// issue #202 POSTed contacts should not contain deleted groupMembershipInfo elements.
			//
			let groups = this.m_entry.nsGContact::groupMembershipInfo;

			for (var i = groups.length() - 1; i >= 0; i--)
				if (groups[i].@deleted == 'true')
					delete groups[i];
		}
	}
},
toString : function() {
	function photo_to_string(photo) {
		return ('etag' in photo) ?
	       "\n photo:       etag: " + photo.etag + " uri: " + photo.uri + "\n" :
	       "\n photo:\n";
	}
	return GoogleData.prototype.toString.call(this) +
	       "\n groups:      " + this.groups.toString() +
	       photo_to_string(this.photo);
}
};

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
		title                   : 0x0001,
		name                    : 0x0002,
		content                 : 0x0004,
		email                   : 0x0008,
		phoneNumber             : 0x0010,
		postalAddress           : 0x0020,
		structuredPostalAddress : 0x0040,
		organization            : 0x0080,
		im                      : 0x0100,
		website                 : 0x0200,
		birthday                : 0x0400
	},
	a_fragment : {
		organization            : [ 'work', 'other' ],
		phoneNumber             : [ 'work', 'home', 'work_fax', 'pager', 'mobile' ],
		postalAddress           : [ 'work', 'home' ],
		structuredPostalAddress : [ 'work', 'home' ],
		website                 : [ 'work', 'home' ],
		photo                   : [ 'photo' ]
	},
	ns_rel : {
		organization            : Xpath.NS_GD,
		phoneNumber             : Xpath.NS_GD,
		postalAddress           : Xpath.NS_GD,
		structuredPostalAddress : Xpath.NS_GD,
		website                 : Xpath.NS_GCONTACT
	},
	m_a_rel                : new Object(),
	m_a_element_and_suffix : new Object(),
	m_a_hyphenation        : new Object(),
	m_a_system_groups      : new Object(),
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
	to_id : function(str) {
		let ret     = str;
		let a_match = str.match(/\/(contacts|groups)\/.*base\/(.*)$/);

		if (a_match && a_match.length > 0)
			ret = ((a_match[1] == 'contacts') ? "c:" : "g:") + a_match[2];

		return ret;
	},
	to_id_as_url : function(str) {
		return this.to_string(str); // .replace(/https?:\/\//gi, "");
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
		let left_of;

		if (element_name == "website")
			left_of = ""; // website is in gContact namespace, and doesn't use urls in rel values
		else if (suffix == "photo")
			left_of = 'http://schemas.google.com/contacts/2008/rel#'; // 'contacts' here vs 'contact' in NS_GCONTACT (surely google made a mistake)
		else
			left_of = Xpath.NS_GD + '#';

		let key = element_name + '_' + suffix;

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
		// For kMatchFirst the return is: an XMLList containing an element for the first matching a_rel eg. for organization the return is:
		// 0 ==> no match
		// 1 ==> either 'other' or  'work'
		// 2 ==> both   'other' and 'work'

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
	newEntry : function(type) {
		zinAssert(GoogleData.eElement.isPresent(type));

		let term_fragment = (type == GoogleData.eElement.contact) ? "#contact" : "#group";
			
		let ret = <atom:entry xmlns:atom={Xpath.NS_ATOM}
		                      xmlns:gd={Xpath.NS_GD}
		                      xmlns:openSearch={Xpath.NS_OPENSEARCH}
		                      xmlns:gContact={Xpath.NS_GCONTACT}>
					<atom:category xmlns:atom={Xpath.NS_ATOM} scheme={Xpath.NS_GD + "#kind"} term={Xpath.NS_GCONTACT + term_fragment}/>
		          </atom:entry>;

		if (type == GoogleData.eElement.group || GD_API_VERSION == 2)
			ret.* += <atom:title xmlns:atom={Xpath.NS_ATOM} type="text"/>

		return ret;
	},
	newXml : function(arg) {
		zinAssert((arg instanceof String) || (typeof(arg) == 'string') || (arg instanceof XMLHttpRequest));
		var is_text_parsed = false;

		var text = (arg instanceof XMLHttpRequest) ? arg.responseText : arg;

		try {
			var xml = new XML(stripCharsToWorkaroundBug478905(text).replace(re_xml_declaration,""));
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
	},
	postalWord : function() {
		return (GD_API_VERSION == 2) ? 'postalAddress' : 'structuredPostalAddress';
	},
	is_google_apps : function (account) {
		return !(account.username.match(/@(gmail\.com|googlemail\.com)$/i));
	},
	systemGroups : function(account) {
		zinAssert(account.format_xx() == FORMAT_GD);

		if (!(account.username in this.m_a_system_groups)) {
			this.m_a_system_groups[account.username] = this.is_google_apps(account) ? ContactGoogle.eSystemGroupForApps :
			                                                                          ContactGoogle.eSystemGroup;
			logger().debug("systemGroups: account: " + account.username +
			               " returns: " + this.m_a_system_groups[account.username].toString());
		}
		
		return this.m_a_system_groups[account.username];
	}
};

function GroupGoogle(xml) {
	GoogleData.call(this);

	this.m_entry = xml ? xml : ContactGoogleStatic.newEntry(GoogleData.eElement.group);
}

function GroupGoogleProto() {}

GroupGoogleProto.prototype = {
copy : function () {
	return new GroupGoogle(ContactGoogleStatic.newXml(this.m_entry.toXMLString()));
},
systemGroup : function() {
	let nsGContact = ContactGoogleStatic.nsGContact;
	let el = this.m_entry.nsGContact::systemGroup;
	return el.length() > 0 ? el.@id.toString() : false;
},
properties_from_xml: function () {
	let nsAtom = ContactGoogleStatic.nsAtom;
	return newObject('title', this.m_entry.nsAtom::title.toString());
},
set_properties : function(properties_in) {
	zinAssert('title' in properties_in && properties_in['title'].length > 0);
	let nsAtom                 = ContactGoogleStatic.nsAtom;
	this.m_entry.nsAtom::title = properties_in['title'];
	this.m_properties          = null;
},
toString : function() {
	return GoogleData.prototype.toString.call(this) + "\n systemGroup: " + this.systemGroup() + "\n";
}
};

ContactGoogle.prototype = new GoogleData(); AddToPrototype(ContactGoogle, ContactGoogleProto);
GroupGoogle.prototype   = new GoogleData(); AddToPrototype(GroupGoogle,   GroupGoogleProto);
