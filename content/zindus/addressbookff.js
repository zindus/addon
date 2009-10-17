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
// $Id: addressbookff.js,v 1.4 2009-10-17 07:04:36 cvsuser Exp $
includejs("json.js");

function AddressBookFf()
{
	AddressBook.call(this);

	this.m_conn = null;
}

AddressBookFf.prototype = new AddressBook();

// start AddressBookFf.prototype
//
AddressBookFf.prototype.conn = function()
{
	if (!this.m_conn)
		this.m_conn = AddressBookFfStatic.db_new_conn();
	return this.m_conn;
}

AddressBookFf.prototype.directoryProperty = function(elem, property)
{
	zinAssert(property in elem);

	return elem[property];
}

AddressBookFf.prototype.forEachAddressBook = function(functor)
{
	let query       = "SELECT * from groupt";
	let is_continue = true;
	let stmt, uri;

	stmt = this.conn().createStatement(query);

	while (stmt.executeStep() && is_continue) {
		let elem    = new AddressBookFfDirectoryElem(stmt.row);
		is_continue = functor.run(elem);

		zinAssert(typeof(is_continue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean
	}
}

AddressBookFf.prototype.forEachCardGenerator = function(uri, functor, yield_count)
{
	let is_continue = true;
	let count     = 0;
	let stmt, query;

	query = "SELECT contact.* from contact,member where contact.id = member.id_contact and member.id_group =:uri";
	stmt  = this.conn().createStatement(query);
	stmt.params.uri = uri;

	while (stmt.executeStep() && is_continue) {
		let item = new AddressBookFfCard(JSON.fromString(stmt.row.properties), newObject(TBCARD_ATTRIBUTE_LUID, stmt.row.id));

		is_continue = functor.run(uri, item);

		zinAssert(typeof(is_continue) == "boolean"); // catch programming errors where the functor hasn't returned a boolean

		if (++count % yield_count == 0)
			yield true;
	}

	stmt.reset();

	yield false;
}

AddressBookFf.prototype.newAddressBook = function(name)
{
	let stmt, query, rc;

	query = "INSERT INTO groupt (name) VALUES (:name)";
	stmt  = this.conn().createStatement(query);
	stmt.params.name = name;

	AddressBookFfStatic.executeStep(this.conn(), stmt, "failed to create addressbook: " + name);

	stmt.reset();
	stmt.finalize();

	let id = this.conn().lastInsertRowID;

	AddressBookFfStatic.debug("newAddressBook: id: " + id + " name: " + name);

	AddressBook.prototype.newAddressBook.call(this);

	return new AddressBookImportantProperties(id, id);
}

AddressBookFf.prototype.deleteAddressBook = function(uri)
{
	let stmt, query, rc;

	try {
		this.conn().beginTransaction();

		query = "DELETE FROM contact where contact.id IN (select id_contact from member where member.id_group = :uri)";
		stmt  = this.conn().createStatement(query);
		stmt.params.uri = uri;
		stmt.executeStep();
		stmt.reset();
		stmt.finalize();

		query = "DELETE FROM member where member.id_group = :uri";
		stmt  = this.conn().createStatement(query);
		stmt.params.uri = uri;
		stmt.executeStep();
		stmt.reset();
		stmt.finalize();

		query = "DELETE FROM groupt where id = :uri";
		stmt  = this.conn().createStatement(query);
		stmt.params.uri = uri;
		stmt.executeStep();
		stmt.reset();
		stmt.finalize();

		this.conn().commitTransaction();
	}
	catch (ex) {
		this.logger().error("lastError: " + this.conn().lastError + " lastErrorString: " + this.conn().lastErrorString);

		this.conn().rollbackTransaction();

		zinAssertAndLog(false, "failed to delete addressbook: uri: " + uri);
	}

	AddressBook.prototype.deleteAddressBook.call(this);

	AddressBookFfStatic.debug("deleteAddressBook: uri: " + uri);
}

AddressBookFf.prototype.renameAddressBook = function(uri, name)
{
	let stmt, query, rc;

	query = "UPDATE groupt set name = :name where id = :uri";
	stmt  = this.conn().createStatement(query);
	stmt.params.uri = uri;
	stmt.params.name = name;

	AddressBookFfStatic.executeStep(this.conn(), stmt, "failed to rename addressbook: uri: " + uri + " name: " + name);

	stmt.reset();
	stmt.finalize();

	AddressBookFfStatic.debug("renameAddressBook: uri: " + uri + " to: " + name);

	AddressBook.prototype.renameAddressBook.call(this);
}

AddressBookFf.prototype.addCard = function(uri, properties, attributes)
{
	zinAssert(uri != null);
	zinAssert(properties != null);
	zinAssert(attributes != null);

	if (false)
		this.logger().debug("addCard: uri: " + uri + " properties: " + aToString(properties) + " attributes: " + aToString(attributes));

	let abCard = new AddressBookFfCard(properties, attributes);
	let i, stmt, query, id_contact;

	try {
		this.conn().beginTransaction();

		query = "INSERT INTO contact (properties) VALUES (:properties)";
		stmt  = this.conn().createStatement(query);
		stmt.params.properties = abCard.toJson();
		stmt.executeStep();
		stmt.reset();

		id_contact = this.conn().lastInsertRowID;

		query = "INSERT INTO member (id_contact,id_group) VALUES (:id_contact,:id_group)";
		stmt  = this.conn().createStatement(query);
		stmt.params.id_contact = id_contact;
		stmt.params.id_group   = uri;
		stmt.executeStep();

		this.conn().commitTransaction();
	}
	catch (ex) {
		this.logger().error("lastError: " + this.conn().lastError + " lastErrorString: " + this.conn().lastErrorString);

		this.conn().rollbackTransaction();

		zinAssertAndLog(false, "failed to add card: uri: " + uri + " properties: " + aToString(properties));
	}
	finally {
		stmt.finalize();
	}

	AddressBookFfStatic.debug("addCard: id_contact: " + id_contact);

	abCard.id(id_contact);

	return new AddressBookFacadeCard(abCard, id_contact);
}

AddressBookFf.prototype.setCardProperties = function(abCard, uri, properties)
{
	let stmt, query, rc;

	AddressBookFfStatic.debug("setCardProperties: uri: " + uri + " properties: " + aToString(properties));

	abCard.properties(properties);

	query = "UPDATE contact set properties = :properties where id = :id";
	stmt  = this.conn().createStatement(query);
	stmt.params.properties = abCard.toJson();
	stmt.params.id = abCard.id();

	AddressBookFfStatic.executeStep(this.conn(), stmt, "failed to update contact: uri: " + uri + " abCard: " + abCard.id());

	stmt.reset();
	stmt.finalize();

	AddressBookFfStatic.debug("setCardProperties: uri: " + uri + " abCard: " + abCard.toString());

	return abCard;
}

AddressBookFf.prototype.setCardAttributes = function(abCard, uri, properties)
{
	this.setCardProperties(abCard, uri, properties);
}

AddressBookFf.prototype.deleteCards = function(uri, aCards)
{
	zinAssert(aCards.length > 0);

	let query1 = "DELETE FROM member  where member.id_contact = :id";
	let query2 = "DELETE FROM contact where contact.id = :id";
	let a_ids = new Array();
	let stmt1, stmt2;

	try {
		stmt1  = this.conn().createStatement(query1);
		stmt2  = this.conn().createStatement(query2);

		this.conn().beginTransaction();

		for (var i = 0; i < aCards.length; i++) {
			let card = aCards[i];
			a_ids.push(card.id());

			stmt1.params.id = card.id();
			stmt2.params.id = card.id();
			stmt1.executeStep();
			stmt2.executeStep();
			stmt1.reset();
			stmt2.reset();
		}

		this.conn().commitTransaction();
	}
	catch (ex) {
		this.logger().error("lastError: " + this.conn().lastError + " lastErrorString: " + this.conn().lastErrorString);

		this.conn().rollbackTransaction();

		zinAssertAndLog(false, "failed to delete addressbook: uri: " + uri);
	}
	finally {
		stmt1.finalize();
		stmt2.finalize();
	}

	AddressBookFfStatic.debug("deleteCards: ids: " + a_ids.toString());

	return true;
}

AddressBookFf.prototype.lookupCard = function(uri, key, value)
{
	zinAssert(uri);
	zinAssert(key == TBCARD_ATTRIBUTE_LUID);
	zinAssert(value);

	let query, stmt;

	query = "SELECT * from contact where id=:id";
	stmt  = this.conn().createStatement(query);
	stmt.params.id = value;

	let rc     = AddressBookFfStatic.executeStep(this.conn(), stmt, "failed to lookup card id: " + value);
	let abCard = null;

	if (rc)
		abCard = new AddressBookFfCard(JSON.fromString(stmt.row.properties), newObject(TBCARD_ATTRIBUTE_LUID, stmt.row.id));

	stmt.finalize();

	return abCard;
}

// TODO: note how this differs from the base class getCardProperties which references the contact converter
// just to be defensive, we probably want to filter out the properties that aren't in the contactconverter's map.

AddressBookFf.prototype.getCardProperties = function(abCard) { return this.getCardElements(abCard, 'properties'); }
AddressBookFf.prototype.getCardAttributes = function(abCard) { return this.getCardElements(abCard, 'attributes'); }

AddressBookFf.prototype.getCardElements = function(abCard, type)
{
	let properties = abCard.properties();
	let ret        = new Object();
	zinAssert(type == 'properties' || type == 'attributes');

	for (var key in properties) {
		let is_zindus_prefix = /^zindus/.test(key);

		if ((type == 'properties' && !is_zindus_prefix) || (type == 'attributes' && is_zindus_prefix))
			ret[key] = properties[key];
	}

	return ret;
}

AddressBookFf.prototype.getCardProperty = function(abCard, key)
{
	let properties = abCard.properties();
	// tb2 and tb3 return "" if the property isn't present, but I reckon that's crap, so this is more conservative...
	//
	zinAssertAndLog(key in properties, function() { return "properties: " + aToString(properties) + " key: " + key; } );
	return properties[key];
}

AddressBookFf.prototype.nsIAbMDBCardToKey = function(abCard)
{
	zinAssert(abCard instanceof AddressBookFfCard);

	return abCard.id();
}

AddressBookFf.prototype.qiCard = function(item)
{
	return item;
}

AddressBookFf.prototype.has_uuids = function(item)
{
	return true;
}

function AddressBookFfDirectoryElem(row)
{
	zinAssert(typeof(row) != 'undefined');

	this.m_id           = row.id
	this.m_name         = row.name
	this.m_last_updated = row.last_updated;

	for (key in AddressBookFfStatic.elem_properties)
		this.__defineGetter__(key, this.getter(key));
}

AddressBookFfDirectoryElem.prototype = {
	getter : function(key) {
		let ret;
		switch(key) {
			case "URI":
			case "dirPrefId": ret = function() { return this.m_id;   }; break;
			case "dirName":   ret = function() { return this.m_name; }; break;
			default:          ret = function() { return "n/a";       }; break;
		}
		return ret;
	},
	toString : function() {
		return "id: "            + this.m_id +
		       " name: "         + this.m_name +
			   " last_updated: " + this.m_last_updated;
	}
};

function AddressBookFfCard(properties, attributes)
{
	var key;

	this.m_properties = properties ? cloneObject(properties) : new Object();

	if (attributes)
		for (key in attributes)
			this.m_properties[key] = attributes[key];

	for (key in AddressBookFfStatic.elem_properties)
		this.__defineGetter__(key, this.getter(key));
}

AddressBookFfCard.prototype = {
	getter : function(key) {
		let ret;
		switch(key) {
			case "isMailList": ret = function() { return false;       }; break;
			default:           ret = function() { return "n/a";       }; break;
		}
		return ret;
	},
	properties : function(p) {
		if (p) {
			let key;
			for (key in p) {
				if (key == TBCARD_ATTRIBUTE_LUID)
					; // do nothing
				else if (p[key] && p[key].length > 0) {
					// logger().debug("FfCard setting property: key: " + key + " value: " + p[key]);
					this.m_properties[key] = p[key];
				}
				else if (key in this.m_properties) {
					// logger().debug("FfCard deleting property: key: " + key);
					delete this.m_properties[key];
				}
			}
		}
			
		return this.m_properties;
	},
	id : function(new_id) {
		if (new_id)
			this.m_properties[TBCARD_ATTRIBUTE_LUID] = new_id;
			
		zinAssert(TBCARD_ATTRIBUTE_LUID in this.m_properties);

		return this.m_properties[TBCARD_ATTRIBUTE_LUID];
	},
	toString : function() {
		return "properties: " + aToString(this.m_properties);
	},
	toJson : function() {
		let a = cloneObject(this.m_properties);
		if (TBCARD_ATTRIBUTE_LUID in a)
			delete a[TBCARD_ATTRIBUTE_LUID];
		return JSON.toString(a);
	},
	fromRow : function(row) {
		return new AddressBookFfCard(JSON.fromString(row.properties), newObject(TBCARD_ATTRIBUTE_LUID, row.id));
	}
};
var AddressBookFfStatic = {
	elem_properties : newObjectWithKeys("URI", "dirName", "dirType", "dirPrefId", "fileName", "position"),
	card_properties : newObjectWithKeys("isMailList", "mailListURI", "lastModifiedDate" ),
	db_table_name   : newObjectWithKeys("contact", "groupt", "member", "master" ),
	db_index_name   : newObjectWithKeys("index_group", "index_member" ),
	db_new_conn : function() {

		let nsifile = Filesystem.nsIFileForDirectory(Filesystem.eDirectory.DATA);
		nsifile.append("contacts.sqlite");

		this.debug("db_new_conn: path: " + nsifile.path);

		let storageService = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
		return storageService.openDatabase(nsifile);
	},
	db_is_healthy : function() {
		let conn = AddressBookFfStatic.db_new_conn();
		let ret = true;
		let a_reason = new Object();
		let i;

		function set_a_reason(key, value) {
			if (!isAnyValue(a_reason, false))
				a_reason[key] = value;
		}

		for (i in this.db_table_name)
			set_a_reason(i, conn.tableExists(i));

		for (i in this.db_index_name)
			set_a_reason(i, conn.indexExists(i));

		ret = !isAnyValue(a_reason, false);

		this.debug("db_is_healthy: returns: " + ret + " a_reason: " + aToString(a_reason));

		if (ret) {
			let query, stmt;

			// PAB must be present in groupt
			//
			query = "SELECT * from groupt where name = :name";
			stmt  = conn.createStatement(query);
			stmt.params.name = TB_PAB_FULLNAME;
			zinAssert(stmt.executeStep());
			stmt.finalize();

			// schema_version must be present in master
			//
			query = "SELECT * from master where key = :key";
			stmt  = conn.createStatement(query);
			stmt.params.key = 'schema_version';
			zinAssert(stmt.executeStep());
			stmt.finalize();

			// referential integrity
			// - every row in member must refer to a row in contact and groupt
			//
			function do_ref_check(key, query) {
				stmt  = conn.createStatement(query);
				let msg = "";
				while (stmt.executeStep())
					msg += stmt.row[key] + " ";
				stmt.finalize();
				zinAssertAndLog(msg.length == 0, query + ": " + msg);
			}
			do_ref_check("id_contact", "SELECT id_contact from member where id_contact NOT IN (SELECT distinct id FROM contact)");
			do_ref_check("id_group",   "SELECT id_group   from member where id_group   NOT IN (SELECT distinct id FROM groupt)");

			// test for dangling references - ie that contacts must be a member of a group
			//
			do_ref_check("id", "SELECT id from contact where id NOT IN (SELECT distinct id_contact FROM member)");
		}

		conn.close();

		return ret;
	},
	db_drop_and_create : function() {
		let conn = AddressBookFfStatic.db_new_conn();
		let query = "";
		let stmt, rc;

		function do_sql(query) {
			try {
				conn.executeSimpleSQL(query);
			}
			catch (ex) {
				logger().error("query failed: lastError: " + conn.lastError + " lastErrorString: " + conn.lastErrorString +
				               " stack: " + executionStackAsString());
				zinAssert(false);
			}
		}

		for (i in this.db_table_name)
			query += "DROP TABLE IF EXISTS " + i + ";";

		for (i in this.db_index_name)
			query += "DROP INDEX IF EXISTS " + i + ";";

		do_sql(query);
	
		query = "                                                         \
CREATE TABLE contact (                                                    \
  id           INTEGER PRIMARY KEY AUTOINCREMENT,                         \
  properties   BLOB NOT NULL,                                             \
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL );            \
CREATE TABLE groupt (                                                     \
  id           INTEGER PRIMARY KEY AUTOINCREMENT,                         \
  name         TINYTEXT UNIQUE NOT NULL,                                  \
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL );            \
CREATE TABLE member (                                                     \
  id_contact   INTEGER,                                                   \
  id_group     INTEGER );                                                 \
CREATE TABLE master (                                                     \
  key          TINYTEXT UNIQUE NOT NULL,                                  \
  value        BLOB NOT NULL );                                           \
CREATE INDEX index_group ON groupt (name);                                \
CREATE INDEX index_member ON member (id_contact, id_group);";

// CREATE INDEX IF NOT EXISTS property_index ON property (id_contact);   \
// CREATE TABLE IF NOT EXISTS property (                                 \
//  id_contact   INTEGER,                                                \
//  key          TINYTEXT NOT NULL,                                      \
//  value        BLOB );                                                 \

		do_sql(query);

		query = "INSERT INTO groupt (name) VALUES (:name)";
		stmt  = conn.createStatement(query);
		stmt.params.name = TB_PAB_FULLNAME;

		AddressBookFfStatic.executeStep(conn, stmt, "unable to create groupt with name: " + TB_PAB_FULLNAME);

		stmt.finalize();

		query = "INSERT INTO master (key, value) VALUES (:key, :value)";
		stmt  = conn.createStatement(query);
		stmt.params.key = 'schema_version';
		stmt.params.value = '1';

		AddressBookFfStatic.executeStep(conn, stmt, "unable to insert schema_version into master");

		stmt.finalize();

		if (false) {
		query = "";

		for (var i = 0; i < AUTO_INCREMENT_STARTS_AT; i++)
			query += "INSERT INTO contact (properties) VALUES ('');";

		query += "DELETE FROM contact;";
		do_sql(query);

		stmt.finalize();
		}

		this.debug("db_drop_and_create: file: " + conn.databaseFile.path);

		conn.close();
	},
	executeStep : function(conn, stmt, msg_on_fail) {
		let ret;

		try {
			ret = stmt.executeStep();
		}
		catch (ex) {
			logger().error("executeStep: lastError: " + conn.lastError + " lastErrorString: " + conn.lastErrorString);
			zinAssertAndLog(false, msg_on_fail);
		}

		return ret;
	},
	debug : function(msg) {
		if (!this.m_logger) // delay construction
			this.m_logger = newLogger("AddressBookFf"); 

		if (true)
			this.m_logger.debug(msg);
	}
};
