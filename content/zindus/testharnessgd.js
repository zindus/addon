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
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/


ZinTestHarness.prototype.testGoogleContacts = function()
{
	var xmlString = "<?xml version='1.0' encoding='UTF-8'?><feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/' xmlns:gContact='http://schemas.google.com/contact/2008' xmlns:gd='http://schemas.google.com/g/2005'><id>a2ghbe@gmail.com</id><updated>2008-03-30T00:33:50.384Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>cvek a2ghbe's Contacts</title><link rel='alternate' type='text/html' href='http://www.google.com/'/><link rel='http://schemas.google.com/g/2005#feed' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base'/><link rel='http://schemas.google.com/g/2005#post' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base'/><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base?max-results=25&amp;showdeleted=true'/><author><name>cvek a2ghbe</name><email>a2ghbe@gmail.com</email></author><generator version='1.0' uri='http://www.google.com/m8/feeds'>Contacts</generator><openSearch:totalResults>6</openSearch:totalResults><openSearch:startIndex>1</openSearch:startIndex><openSearch:itemsPerPage>25</openSearch:itemsPerPage><entry><id>http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0</id><updated>2008-03-29T20:36:25.343Z</updated><category scheme='http://schemas.google.com/g/2005#kind' term='http://schemas.google.com/contact/2008#contact'/><title type='text'>John Smith</title><content type='text'>notes-line-1 notes-line-2</content><link rel='self' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0'/><link rel='edit' type='application/atom+xml' href='http://www.google.com/m8/feeds/contacts/a2ghbe%40gmail.com/base/0/1206822985343000'/><gd:organization rel='http://schemas.google.com/g/2005#work'><gd:orgName>company-acme</gd:orgName><gd:orgTitle>title-directory</gd:orgTitle></gd:organization><gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.primary@example.com' primary='true'/><gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.1@example.com'/><gd:email rel='http://schemas.google.com/g/2005#home' address='john.smith.home.2@example.com'/><gd:email rel='http://schemas.google.com/g/2005#other' address='john.smith.other@example.com'/><gd:email rel='http://schemas.google.com/g/2005#work' address='john.smith.work@example.com'/><gd:im address='aim-im-1' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/><gd:im address='aim-im-2' protocol='http://schemas.google.com/g/2005#AIM' rel='http://schemas.google.com/g/2005#other'/><gd:phoneNumber rel='http://schemas.google.com/g/2005#home_fax'>4-home-fax</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#pager'>6-pager</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>2-home</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#home'>3-home</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#mobile'>1-mobile</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#work_fax'>5-work-fax</gd:phoneNumber><gd:phoneNumber rel='http://schemas.google.com/g/2005#work'>3-work</gd:phoneNumber><gd:postalAddress rel='http://schemas.google.com/g/2005#home'>home-address-line-1 home address line 2</gd:postalAddress></entry></feed>";

	var domparser = new DOMParser();
	var response = domparser.parseFromString(xmlString, "text/xml");

	var xpath_query = "/atom:feed/atom:entry";
	var a_gd_contact = GdContact.arrayFromXpath(response, xpath_query);

	var iterator = Iterator(a_gd_contact);
	var pair = iterator.next();
	var id = pair[0];
	var contact = pair[1];

	this.m_logger.debug("testGoogleContacts: 1. id: " + id + " contact: " + a_gd_contact[id].toString());

	// var x = { };
	// contact.fieldModDel(contact.m_entry_children["content"], null, x, "content", x);
	// this.m_logger.debug("testGoogleContacts: 2. id: " + id + " contact: " + a_gd_contact[id].toString());
	// return;

	var properties = new Object();

	// this.m_logger.debug("testGoogleContacts: properties: " + aToString(properties));
	// this works ok
	// contact.updateFromContact(properties);
	// contact.updateFromEntry(response, contact.m_entry);
	// this.m_logger.debug("testGoogleContacts: 3. id: " + id + " contact: " + a_gd_contact[id].toString());

	delete properties["content"];
	delete properties["organization#orgName"];
	delete properties["organization#orgTitle"];
	delete properties["phoneNumber#work"];
	delete properties["phoneNumber#home"];
	delete properties["phoneNumber#work_fax"];
	delete properties["phoneNumber#pager"];
	delete properties["phoneNumber#mobile"];
	properties["PrimaryEmail"] = "";
	delete properties["SecondEmail"];
	delete properties["im#AIM"];

	contact.updateFromContact(properties);
	contact.updateFromEntry(response, contact.m_entry);
	this.m_logger.debug("testGoogleContacts: properties: " + aToString(properties));
	this.m_logger.debug("testGoogleContacts: 4. id: " + id + " contact: " + a_gd_contact[id].toString());

	// test adding properties
	//
	var properties = this.sampleGoogleContactProperties();

	contact.updateFromContact(properties);
	contact.updateFromEntry(response, contact.m_entry);

	this.m_logger.debug("testGoogleContacts: properties: " + aToString(properties));
	this.m_logger.debug("testGoogleContacts: 5. id: " + id + " contact: " + a_gd_contact[id].toString());

	return true;
}

ZinTestHarness.prototype.sampleGoogleContactProperties = function()
{
	var properties = new Object();

	properties["title"] = "1";
	properties["content"] = "2";
	properties["organization#orgName"] = "3";
	properties["organization#orgTitle"] = "4";
	properties["phoneNumber#work"] = "5";
	properties["phoneNumber#home"] = "6";
	properties["phoneNumber#work_fax"] = "7";
	properties["phoneNumber#pager"] = "8";
	properties["phoneNumber#mobile"] = "9";
	properties["PrimaryEmail"] = "10";
	properties["SecondEmail"] = "11";
	properties["im#AIM"] = "12";

	return properties;
}

