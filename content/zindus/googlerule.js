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

function GoogleRuleTrash(addressbook)
{
	if (!addressbook)
	{
		contact_converter  = new ContactConverter();
		this.m_addressbook = AddressBook.new();

		contact_converter.setup();
		this.m_addressbook.contact_converter(contact_converter);
	}
	else
		this.m_addressbook = addressbook;

	this.a_gd_uris_to_delete = new Object();
	this.m_uri_trash         = null;
	this.m_logger            = newLogger("GoogleRuleTrash");
}

GoogleRuleTrash.FAIL_CODES = [ 'failon.gd.conflict.1', 'failon.gd.conflict.2', 'failon.gd.conflict.3', 'failon.gd.conflict.4' ];

GoogleRuleTrash.prototype.moveToTrashDontAsk = function(failcode, grd)
{
	zinAssertAndLog(isInArray(failcode, GoogleRuleTrash.FAIL_CODES), failcode);

	if (failcode == 'failon.gd.conflict.1' || failcode == 'failon.gd.conflict.2' || failcode == 'failon.gd.conflict.3' )
	{
		var a_email = new Array(); // index the email addresses via an array so that we can iterate through them in a guaranteed order

		for (var email in grd.m_unique)
			a_email.push(email);

		this.moveToTrashRuleUnique(failcode, grd, a_email, 0, {});
		this.moveToTrashRuleUniqueFinalise();
	}
	else if (failcode == 'failon.gd.conflict.4')
		this.moveToTrashCardsTb(grd.m_empty);
}

GoogleRuleTrash.prototype.moveToTrashRuleUnique = function(failcode, grd, a_email, start, a_luids_deleted)
{
	var a_gcch, a_gcch_to_move, index, luid, luid_keep, ret;

	for (index = start; index < a_email.length; )
	{
		email          = a_email[index];
		a_gcch         = grd.m_unique[email];
		a_gcch_to_move = new Object();
		luid_leep      = this.selectContactHandle(a_gcch);

		this.m_logger.debug("moveToTrashRuleUnique: luid_leep: " + luid_leep);

		for (luid in a_gcch)
			if (luid != luid_leep)
			{
				a_gcch_to_move[luid] = a_gcch[luid];
				a_luids_deleted[luid] = true;
			}

		this.moveToTrashCards(a_gcch_to_move);

		index = this.advanceToNextUnique(grd, a_email, index, a_luids_deleted);
	}
}

// Conflicts are organised by email address, and since a contact can have multiple email addresses it can be associated
// with multiple conflicts.
// The first thing done after advancing to the next conflict is to remove any contacts deleted upstream.
// Downstream conflicts may get entirely resolved by upstream contact deletions.
//
GoogleRuleTrash.prototype.advanceToNextUnique = function(grd, a_email, index, a_luids_deleted)
{
	var i, email, a_gcch, luid;

	do
	{
		index++;

		email  = a_email[index];
		a_gcch = grd.m_unique[email];

		var a_delete_from_gcch = new Array();

		for (luid in a_gcch)
			if (isPropertyPresent(a_luids_deleted, luid))
				a_delete_from_gcch.push(luid)

		for (i = 0; i < a_delete_from_gcch.length; i++)
		{
			this.m_logger.debug("advanceToNextUnique: removing luid from next gcch: " + a_delete_from_gcch[i]);

			delete a_gcch[a_delete_from_gcch[i]];
		}
	}
	while (index < a_email.length && aToLength(a_gcch) < 2);

	this.m_logger.debug("advanceToNextUnique: returns: " + index);

	return index;
}

GoogleRuleTrash.prototype.selectContactHandle = function(a_gcch)
{
	var luid, criteria;
	var a_criteria = {
		most_data:     { luid: -1, highwater: 0, count: 0 },
		tb_popularity: { luid: -1, highwater: 0, count: 0 } };
	                
	var ret = -1;
	var msg = " ";
	var criteria      = 'most_data';
	var is_any_google = false;

	for (luid in a_gcch)
		if (a_gcch[luid].m_format == FORMAT_GD)
		{
			is_any_google = true;
			break;
		}

	this.selectContactHandleUsingCriteria(a_gcch, a_criteria, 'most_data');

	if (a_criteria[criteria].count == 1)
	{
		ret = a_criteria[criteria].luid;
		msg += "selected by " + criteria;
	}

	if (ret == -1 && !is_any_google)
	{
		criteria = 'tb_popularity';
		this.selectContactHandleUsingCriteria(a_gcch, a_criteria, criteria);

		if (a_criteria[criteria].count == 1)
		{
			ret = a_criteria[criteria].luid;
			msg += "selected by " + criteria;
		}
	}

	if (ret == -1)
	{
		ret = a_gcch[firstKeyInObject(a_gcch)].m_luid;
		msg += "selected at random"; // not really random, it's the first key in the object - it's "unspecified"
	}

	this.m_logger.debug("selectContactHandle: returns: " + ret + msg);

	return ret;
}

GoogleRuleTrash.prototype.selectContactHandleUsingCriteria = function(a_gcch, a_criteria, criteria)
{
	var measure, abCard;

	for (luid in a_gcch)
	{
		if (criteria == 'most_data')
			measure = aToLength(a_gcch[luid].m_properties);
		else if (criteria == 'tb_popularity' && a_gcch[luid].m_format == FORMAT_TB)
		{
			abCard = this.m_addressbook.lookupCard(a_gcch[luid].m_uri, TBCARD_ATTRIBUTE_LUID, luid);

			if (!abCard)
			{
				this.m_logger.error("abCard in null: a_gcch[" + luid + "]: " + a_gcch[luid].toString());
				zinAssert(false);
			}

			measure = abCard.popularityIndex;
		}

		if (measure > a_criteria[criteria].highwater)
		{
			a_criteria[criteria].highwater = measure;
			a_criteria[criteria].luid      = luid;
			a_criteria[criteria].count     = 1;
		}
		else if (measure == a_criteria[criteria].highwater)
			a_criteria[criteria].count++;
	}

	this.m_logger.debug("selectContactHandleUsingCriteria: sets a_criteria[" + criteria + "]: " + aToString(a_criteria[criteria]));
}

GoogleRuleTrash.prototype.moveToTrashCards = function(a_gcch)
{
	var a_tb = new Object();
	var a_gd = new Object();
	var msg  = "";
	var key;

	for (key in a_gcch)
		if (a_gcch[key].m_format == FORMAT_TB)
			a_tb[key] = a_gcch[key];
		else if (a_gcch[key].m_format == FORMAT_GD)
			a_gd[key] = a_gcch[key];

	if (!isObjectEmpty(a_tb))
		this.moveToTrashCardsTb(a_tb);

	if (!isObjectEmpty(a_gd))
		this.moveToTrashCardsGd(a_gd);
}

GoogleRuleTrash.prototype.getOrCreateTrashAddressbook = function()
{
	var ret = this.m_uri_trash;

	if (!ret)
	{
		var name_to = GoogleRuleTrash.getTrashName('localised');
		ret  = this.getUri(name_to);

		if (!ret)
		{
			var abip = this.m_addressbook.newAddressBook(name_to);
			ret = abip.m_uri;
		}

		if (!ret)
			this.m_logger.warn("Unable to create addressbook: " + name_to);

		this.m_uri_trash = ret;

		this.m_logger.debug("getOrCreateTrashAddressbook: uri_trash: " + this.m_uri_trash);
	}

	return ret;
}

GoogleRuleTrash.prototype.moveToTrashCardsTb = function(a_gcch)
{
	var abCardFrom, abCardTo, uri_from, luid, attributes, properties, is_deleted;

	zinAssert(arguments.length == 1 && a_gcch);

	this.getOrCreateTrashAddressbook();

	this.m_logger.debug("moveToTrashCardsTb: a_gcch: " + keysToString(a_gcch));

	if (this.m_uri_trash)
		for (key in a_gcch)
		{
			// m_properties in a_gcch are for the purposes of comparison and display
			// they're not necessarily the full set, so we look them up via getCardProperties...
			// properties = a_gcch[key].m_properties;
			// and don't preserve attributes: attributes = this.m_addressbook.getCardAttributes(abCardFrom);
			//
			attributes = newObject(TBCARD_ATTRIBUTE_EXPIRED_ON, parseInt(Date.now()/1000));

			this.m_logger.debug("moveToTrashCardsTb: properties: " + aToString(properties) + " attributes: " + aToString(attributes));

			is_deleted = false;

			luid       = a_gcch[key].m_luid;
			uri_from   = a_gcch[key].m_uri;
			abCardFrom = this.m_addressbook.lookupCard(uri_from, TBCARD_ATTRIBUTE_LUID, luid);

			if (!abCardFrom)
				this.m_logger.warn("Unable to find or move card with luid: " + luid);

			properties = this.m_addressbook.getCardProperties(abCardFrom);

			if (!isObjectEmpty(properties))
				abCardTo = this.m_addressbook.addCard(this.m_uri_trash, properties, attributes);
			else
			{
				this.m_logger.debug("card was completely empty - dont add it to zindus/ToBeDeleted: luid: " + luid);
				abCardTo = true;
			}

			if (abCardTo)
				is_deleted = this.m_addressbook.deleteCards(uri_from, [ abCardFrom ]);
			else
				this.m_logger.error("moveToTrashCardsTb: addCard failed: luid: " + luid);

			this.m_logger.debug("moveToTrashCardsTb: " + (is_deleted ? ("resolved luid: " + luid) : "failed"));
		}
}

GoogleRuleTrash.prototype.moveToTrashCardsGd = function(a_gcch)
{
	var abCardTo, uri_from, luid, attributes, properties, is_deleted, gcch;

	zinAssert(arguments.length == 1 && a_gcch);

	this.getOrCreateTrashAddressbook();

	this.m_logger.debug("moveToTrashCardsGd: a_gcch: " + keysToString(a_gcch));

	if (this.m_uri_trash)
		for (key in a_gcch)
		{
			properties = a_gcch[key].m_properties;
			attributes = newObject(TBCARD_ATTRIBUTE_EXPIRED_ON, parseInt(Date.now()/1000));

			this.m_logger.debug("moveToTrashCardsGd: properties: " + aToString(properties) + " attributes: " + aToString(attributes));

			luid       = a_gcch[key].m_luid;
			abCardTo   = this.m_addressbook.addCard(this.m_uri_trash, properties, attributes);

			if (abCardTo)
			{
				this.a_gd_uris_to_delete[a_gcch[key].m_gd_contact.m_meta[GdContact.edit]] = a_gcch[key].m_gd_username;
				is_deleted = true;
			}
			else
				this.m_logger.error("moveToTrashCardsGd: addCard failed: luid: " + luid);
		}
}

GoogleRuleTrash.prototype.moveToTrashRuleUniqueFinalise = function()
{
	if (!isObjectEmpty(this.a_gd_uris_to_delete))
	{
		var zfc   = new FeedCollection();
		var a_zfi = new Object();
		var uri, username;

		zfc.filename(Filesystem.FILENAME_GD_TO_BE_DELETED);

		for (uri in this.a_gd_uris_to_delete)
		{
			username = this.a_gd_uris_to_delete[uri];

			if (!isPropertyPresent(a_zfi, username))
				a_zfi[username] = new FeedItem(null, FeedItem.ATTR_KEY, username);

			a_zfi[username].set(uri, '1');
		}

		for (username in a_zfi)
			zfc.set(a_zfi[username]);

		zfc.save();

		this.m_logger.debug("moveToTrashRuleUniqueFinalise: google contacts to be deleted by next sync: zfc: " + zfc.toString());
	}
}

// this method doesn't use abCard.lastModifiedDate because during a slow sync, luid attributes are given to cards,
// which updates .lastModifiedDate.  That would cause cards only to expire when older than expire_seconds of unbroken fast syncs.
// That's too wierd to explain to users - the semantics of TBCARD_ATTRIBUTE_EXPIRED_ON are straightforward.
// The only minor irritant is that one day, tb will fix drag+drop so that attributes are preserved, which means that
// if the user drags and drops a card out of ToBeDeleted, the TBCARD_ATTRIBUTE_EXPIRED_ON attribute is associated
// with a card in a regular addressbook.  But I guess that's no big deal - we could always check for this and delete if it became an issue.
// 
// 
GoogleRuleTrash.prototype.expire = function(type)
{
	if (!type)
	{
		this.expire('hardcoded');
		this.expire('localised');
		return;
	}

	var context = this;
	var uri     = this.getUri(GoogleRuleTrash.getTrashName(type));

	if (uri)
	{
		var now                   = parseInt(Date.now()/1000);
		var expire_seconds        = preference(MozillaPreferences.GD_TRASH_EXPIRE_SECONDS, 'int');
		var a_cards_to_be_deleted = new Array();
		var count_cards           = 0;

		var functor_foreach_card = {
			run: function(uri, item)
			{
				var abCard  = item.QueryInterface(Ci.nsIAbCard);
				var mdbCard = item.QueryInterface(Ci.nsIAbMDBCard);
				var expired_on = mdbCard.getStringAttribute(TBCARD_ATTRIBUTE_EXPIRED_ON);

				if (expired_on > 0)
				{
					// context.m_logger.debug("GoogleRuleTrash.expire: now: " + now + " expire_seconds: " + expire_seconds + " expired_on: " + expired_on + " difference: " + (now - expired_on) + " card: " + context.m_addressbook.nsIAbCardToPrintableVerbose(abCard));

					if (now - expired_on > expire_seconds)
					{
						context.m_logger.debug("GoogleRuleTrash.expire: now: " + now + " expire_seconds: " + expire_seconds + " expired_on: " + expired_on + " difference: " + (now - expired_on) + " card: " + context.m_addressbook.nsIAbCardToPrintableVerbose(abCard));
						context.m_logger.debug("GoogleRuleTrash.expire: about to expire card: " + context.m_addressbook.nsIAbCardToPrintableVerbose(abCard));
						a_cards_to_be_deleted.push(abCard);
					}
				}
				else
					context.m_addressbook.setCardAttribute(mdbCard, uri, TBCARD_ATTRIBUTE_EXPIRED_ON, now);

				count_cards++;

				return true;
			}
		};

		this.m_addressbook.forEachCard(uri, functor_foreach_card);

		var msg = "";
		for (var i = 0; i < a_cards_to_be_deleted.length; i++)
			msg += "\n" + this.m_addressbook.nsIAbCardToPrintableVerbose(a_cards_to_be_deleted[i]);

		if (msg != "")
			this.m_logger.debug("GoogleRuleTrash.expire: cards to be deleted: " + msg);

		if (count_cards == 0 || count_cards == a_cards_to_be_deleted.length)
		{
			this.m_logger.debug("GoogleRuleTrash.expire: about to delete addressbook: " + uri);
			this.m_addressbook.deleteAddressBook(uri);
		}
		else if (a_cards_to_be_deleted.length > 0)
			this.m_addressbook.deleteCards(uri, a_cards_to_be_deleted);
	}
}

GoogleRuleTrash.prototype.getUri = function(name)
{
	var a_match = this.m_addressbook.getAddressBooksByPattern(new RegExp( "^" + name + "$" ));

	return (isPropertyPresent(a_match, name) && a_match[name].length == 1) ? a_match[name][0].uri() : null;
}

GoogleRuleTrash.getTrashName = function(type)
{
	var ret;

	switch (type)
	{
		case 'hardcoded': ret = FolderConverter.PREFIX_PRIMARY_ACCOUNT + TB_GOOGLE_CONFLICT_TRASH;             break;
		case 'localised': ret = FolderConverter.PREFIX_PRIMARY_ACCOUNT + stringBundleString("gr.tobedeleted"); break;
		default: zinAssertAndLog(false, type);
	}

	return ret;
}

GoogleRuleTrash.isDontAsk = function(failcode)
{
	var ret = false;

	if (isInArray(failcode, GoogleRuleTrash.FAIL_CODES))
	{
		var prefset = new PrefSet(PrefSet.GENERAL, [ PrefSet.GENERAL_GD_RULE_DONT_ASK ]);
		prefset.load();

		ret = (prefset.getProperty(PrefSet.GENERAL_GD_RULE_DONT_ASK) == "dont-ask");
	}

	logger().debug("GoogleRuleTrash.isDontAsk: failcode: " + failcode + " returns: " + ret);

	return ret;
}

GoogleRuleTrash.failCodeToHref = function(failcode)
{
	var ret;

	switch (failcode)
	{
		case 'failon.gd.conflict.1':
		case 'failon.gd.conflict.2':
		case 'failon.gd.conflict.3':
			ret = 'http://www.zindus.com/faq-thunderbird-google/#toc-google-requires-unique-email-addresses';
			break;
		case 'failon.gd.conflict.4':
			ret = 'http://www.zindus.com/faq-thunderbird-google/#toc-no-empty-contacts';
			break;
		default:
			zinAssertAndLog(false, failcode);
	}

	return ret;
}

// bag contains: FORMAT_TB: uri, FORMAT_GD: contact, username
//
function GoogleRuleContactHandle(format, luid, properties, bag)
{
	this.m_format     = format;
	this.m_luid       = luid;
	this.m_properties = properties;

	switch (format) {
		case FORMAT_TB:
			this.m_uri = bag.uri;
			break;
		case FORMAT_GD:
			this.m_gd_contact  = bag.contact;
			this.m_gd_username = bag.username;
			break;
		default:
			zinAssertAndLog(false,format);
	}
}

GoogleRuleContactHandle.prototype.toString = function()
{
	return "gcch: format: "  + this.m_format +
	              " luid: "  + this.m_luid +
	        " properties: "  + aToString(this.m_properties) +
	               " uri: "  + this.m_uri +
	        " gd_username: " + this.m_gd_username +
	        " gd_contact: "  + (this.m_gd_contact ? this.m_gd_contact.toString() : "null");
}

function GoogleRuleDetail(username)
{
	this.m_username = username;
	this.m_empty    = null; // an associative array where key is a tb luid and value is a GoogleRuleContactHandle
	this.m_unique   = null; // an associative array where key is a email address and value is an array of GoogleRuleContactHandle
}

GoogleRuleDetail.prototype.toString = function(arg)
{
	var msg = "";
	var key;

	arg = arg ? arg : 'full';

	msg += "username: " + this.m_username;

	if (arg == 'summary')
	{
		if (this.m_empty)
			msg += " " + keysToString(this.m_empty)

		if (this.m_unique)
			msg += " " + keysToString(this.m_unique)
	}
	else
	{
		if (this.m_empty)
		{
			msg += " empty: ";

			for (key in this.m_empty)
				msg += key + ": " + aToString(this.m_empty[key]);

			msg += "\n";
		}

		if (this.m_unique)
		{
			var luid;
			msg += " unique: ";

			for (key in this.m_unique)
			{
				msg += "\n" + key + ": ";
				for (luid in this.m_unique[key])
					msg += "\n  luid: " + luid + ": " + this.m_unique[key][luid].toString();
			}

			msg += "\n";
		}
	}

	return msg;
}

function GoogleRuleDialog()
{
	this.m_es     = null;
	this.m_grd    = null;
}

GoogleRuleDialog.prototype.onLoad = function()
{
	var payload = window.arguments[0];
	this.m_es   = payload.m_args.m_es;
	this.m_grd  = payload.m_args.m_es.m_fail_grd;

	this.m_logger.debug("m_grd: " + this.m_grd.toString());
}

GoogleRuleDialog.prototype.onCancel = function()
{
	this.m_logger.debug("onCancel:");

	return true;
}

function GoogleRuleEmpty()
{
	GoogleRuleDialog.call(this);

	this.m_logger = newLogger("GoogleRuleEmpty");
}

GoogleRuleEmpty.prototype = new GoogleRuleDialog();

GoogleRuleEmpty.prototype.onLoad = function()
{
	GoogleRuleDialog.prototype.onLoad.call(this);

	dId("gr-top-caption").label  = stringBundleString("gr.caption.empty.label");
	dId("gr-dont-ask").label = stringBundleString("gr.dont.ask.empty.label");

	xulSetHtml('gr-description',
		stringBundleString("gr.description.empty.value",
			[ stringBundleString("gr.more.information", [ GoogleRuleTrash.failCodeToHref(this.m_es.failcode()) ]) ]));

	this.refreshRows();

	this.updateView();
}

GoogleRuleDialog.prototype.confirmDontAsk = function()
{
	var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	var value   = {};
	var title   = stringBundleString("gr.confirmation.required");
	var text    = stringBundleString("gr.confirmation.text");
	var flags   = Components.interfaces.nsIPromptService.BUTTON_POS_1_DEFAULT |
	              Components.interfaces.nsIPromptService.STD_YES_NO_BUTTONS;
	var button  = prompts.confirmEx(null, title, text, flags , "", "", "", null, value);

	this.m_logger.debug("confirmDontAsk: button: " + button + " as boolean: " + (button == 0));

	return (button == 0);
}

GoogleRuleDialog.prototype.setDontAsk = function()
{
	var prefset = new PrefSet(PrefSet.GENERAL, PrefSet.GENERAL_GD_PROPERTIES);
	prefset.load();
	prefset.setProperty(PrefSet.GENERAL_GD_RULE_DONT_ASK, "dont-ask");
	prefset.save();

	this.m_logger.debug("setDontAsk: set to dont-ask");
}

GoogleRuleEmpty.prototype.onAccept = function()
{
	var a_gcch         = this.m_grd.m_empty;
	var a_gcch_to_move = new Object();
	var ret;
	var checkbox;

	this.m_logger.debug("onAccept: enters");

	var is_dont_ask = false;
	var is_dont_ask_confirmed = false;

	if (dId("gr-dont-ask").checked)
	{
		is_dont_ask = true;

		is_dont_ask_confirmed = this.confirmDontAsk();
	}

	if (is_dont_ask && !is_dont_ask_confirmed)
	{
		ret = false; // do nothing, stay where we are...
	}
	else
	{
		if (is_dont_ask && is_dont_ask_confirmed)
			this.setDontAsk();

		for (luid in a_gcch)
		{
			checkbox = dId(luid);

			if (checkbox && checkbox.checked)
				a_gcch_to_move[luid] = a_gcch[luid];
		}

		gct = new GoogleRuleTrash();

		gct.moveToTrashCardsTb(a_gcch_to_move);

		ret = true;
	}

	this.m_logger.debug("onAccept: returns: " + ret);

	return ret;
}


GoogleRuleEmpty.prototype.onCommand = function(id_target)
{
	this.m_logger.debug("onCommand: target: " + id_target);

	this.updateView();
}

GoogleRuleEmpty.prototype.updateView = function()
{
	// if there were concerns about performance we could cache the checkbox checked flag after each command event - don't bother
	//
	var is_any_checked = false;

	for (luid in this.m_grd.m_empty)
	{
		checkbox = dId(luid);

		if (checkbox && checkbox.checked)
		{
			is_any_checked = true;
			break;
		}
	}

	dId("gr-dialog").setAttribute('buttondisabledaccept', !is_any_checked);
}

GoogleRuleEmpty.prototype.refreshRows = function()
{
	var rows           = dId('gr-empty-rows');
	var a_gcch         = this.m_grd.m_empty;
	var max_attributes = 3;
	var count, is_first, key, value, luid, row;

	for (luid in a_gcch)
	{
		this.m_logger.debug("refreshRows: luid: " + luid);

		is_first = true;
		value    = "";
		count    = 0;

		for (key in a_gcch[luid].m_properties)
		{
			count++;

			if (!is_first)
				value += ", ";
			else
				is_first = false;

			value += stringBundleString("cc." + key) + ": " + a_gcch[luid].m_properties[key];

			this.m_logger.debug("refreshRows: key: " + key + " value: " + value)

			if (count >= max_attributes)
				break;
		}

		if (count == 0)
			value = stringBundleString("gr.contact.completely.empty");

		row = document.createElement("row");

		checkbox = document.createElement("checkbox");
		checkbox.setAttribute("label", value);
		checkbox.id = luid;

		row.appendChild(checkbox);

		rows.appendChild(row);
	}
}

function GoogleRuleUnique()
{
	GoogleRuleDialog.call(this);

	this.m_logger           = newLogger("GoogleRuleUnique");
	this.m_a_email          = new Array();          // index the email addresses via an array so that we can iterate through them
	                                                // in a guaranteed order and so that we know the total number of them and show progress
	this.m_a_luids_deleted  = new Object();         // collect the luids that have been deleted along the way
	this.m_index            = 0;
	this.m_gct              = new GoogleRuleTrash();
	this.m_treeitem_to_luid = null;
}

GoogleRuleUnique.prototype  = new GoogleRuleDialog();

GoogleRuleUnique.prototype.onLoad = function()
{
	GoogleRuleDialog.prototype.onLoad.call(this);

	for (var email in this.m_grd.m_unique)
		this.m_a_email.push(email);

	this.updateView();
}

GoogleRuleUnique.prototype.onExtra1 = function()
{
	this.m_logger.debug("onExtra1: enters");

	this.m_index = this.m_gct.advanceToNextUnique(this.m_grd, this.m_a_email, this.m_index, this.m_a_luids_deleted);

	var is_finished = (this.m_index >= this.m_a_email.length);

	if (is_finished)
	{
		this.m_gct.moveToTrashRuleUniqueFinalise();
		dId('gr-dialog').cancelDialog()
	}
	else
		this.updateView();

	this.m_logger.debug("onExtra1: exits");
}

GoogleRuleUnique.prototype.updateView = function()
{
	zinAssert(this.m_index < this.m_a_email.length);

	dId("gr-top-caption").label = stringBundleString("gr.caption.syncing.with.label", [ this.m_grd.m_username ]);
	dId("gr-tree-caption").label = stringBundleString("gr.caption.unique.label", [ (this.m_index + 1), this.m_a_email.length ]);
	dId("gr-dont-ask").label = stringBundleString("gr.dont.ask.unique.label");

	this.m_logger.debug("updateView: progress: " + (this.m_index + 1) + " of " + this.m_a_email.length);

	var value = stringBundleString("gr.description.unique.value",
			      [ this.m_a_email[this.m_index],                    // email
			        stringBundleString("gr.more.information", [ GoogleRuleTrash.failCodeToHref(this.m_es.failcode()) ]) ]);

	xulSetHtml('gr-description', value);

	this.refreshRows();

	dId("gr-tree").focus();
}

// In each row, display:
//  DisplayName PrimaryEmail (SecondEmail if no Primary) (a limited number of distinguishing property name:values)
// - use tb property names
// - only choosing from amongst those properties that map to google - the filtering happened when the error was raised
//
GoogleRuleUnique.prototype.refreshRows = function()
{
	var treechildren   = dId("gr-treechildren");
	var email          = this.m_a_email[this.m_index];
	var a_gcch         = this.m_grd.m_unique[email];
	var max_attributes = 2;
	var a_columns      = ['Location', 'DisplayName', 'Email', 'Summary', ];
	var a_email_keys   = { PrimaryEmail: 0, SecondEmail: 0 };
	var a_cell         = new Object();
	var luid_to_select = this.m_gct.selectContactHandle(a_gcch);
	var i, count, properties, key, value, luid, row, label, treeitem, treerow, treeitem_index_to_select;

	this.m_treeitem_to_luid = new Array();

	this.populateDifferingProperties(a_gcch, { DisplayName: 0 });

	if (treechildren.hasChildNodes())
	{
		var children = treechildren.childNodes;

		for (i = children.length - 1; i >= 0; i--)
			if (children[i].nodeType == Node.ELEMENT_NODE)
				treechildren.removeChild(children[i])
	}

	for (luid in a_gcch)
	{
		treeitem = document.createElement("treeitem");
		treerow  = document.createElement("treerow");

		this.m_treeitem_to_luid.push(luid);

		if (luid == luid_to_select)
			treeitem_index_to_select = this.m_treeitem_to_luid.length - 1;

		for (i = 0; i < a_columns.length; i++)
			a_cell[a_columns[i]] = document.createElement("treecell");

		properties = a_gcch[luid].m_properties;

		// Location
		//
		value = (a_gcch[luid].m_format == FORMAT_TB) ? this.m_gct.m_addressbook.getAddressBookNameByUri(a_gcch[luid].m_uri) :
		                                               stringBundleString("brand.google");
		a_cell['Location'].setAttribute('label', value);

		// DisplayName
		//
		if (isPropertyPresent(properties, 'DisplayName'))
			a_cell['DisplayName'].setAttribute('label', properties['DisplayName']);

		// Email
		//
		a_cell['Email'].setAttribute('label', email);

		for (key in a_email_keys)
			if (a_gcch[luid].m_properties_different[key] == email)
				delete a_gcch[luid].m_properties_different[key];
		
		// Summary
		//
		count = 0;
		value = "";

		for (key in a_gcch[luid].m_properties_different)
		{
			value += " " + stringBundleString("cc." + key) + ": " + a_gcch[luid].m_properties_different[key];

			if (++count >= max_attributes)
				break;
		}

		a_cell['Summary'].setAttribute('label', value);

		this.m_logger.debug("refreshRows: luid: " + luid + " value: " + value);

		for (i = 0; i < a_columns.length; i++)
			treerow.appendChild(a_cell[a_columns[i]]);

		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}

	dId("gr-tree").view.selection.select(treeitem_index_to_select);
}

GoogleRuleUnique.prototype.populateDifferingProperties = function(a_gcch, a_exclude)
{
	var a_map = new Object(); // key is property-key:property-value, value is index into a_gcch
	var i, key, key_map, luid;

	this.m_logger.debug("populateDifferingProperties: a_gcch: " + keysToString(a_gcch));

	for (luid in a_gcch)
	{
		a_gcch[luid].m_properties_different = new Object();

		for (key in a_gcch[luid].m_properties)
		{
			if (!isPropertyPresent(a_exclude, key))
			{
				a_gcch[luid].m_properties_different[key] = a_gcch[luid].m_properties[key];
				key_map = key + ":" + a_gcch[luid].m_properties[key];

				if (!isPropertyPresent(a_map, key_map))
					a_map[key_map] = new Array();

				a_map[key_map].push(luid);
			}
		}
	}

	this.m_logger.debug("populateDifferingProperties: a_map: " + aToString(a_map));

	for (key_map in a_map)
		if (a_map[key_map].length > 1)
		{
			key = key_map.split(":")[0];

			this.m_logger.debug("populateDifferingProperties: deleting key: " + key + " from: " + a_map[key_map].toString());

			for (i = 0; i < a_map[key_map].length; i++)
				delete a_gcch[a_map[key_map][i]].m_properties_different[key];
		}

	var msg = "";
	for (luid in a_gcch)
		msg += "luid: " + luid + " properties_different: " + aToString(a_gcch[luid].m_properties_different) + "\n";

	this.m_logger.debug("populateDifferingProperties: properties_different: " + msg);
}

GoogleRuleUnique.prototype.onAccept = function()
{
	var email          = this.m_a_email[this.m_index];
	var a_gcch         = this.m_grd.m_unique[email];
	var a_gcch_to_move = new Object();
	var luid_leep      = this.m_treeitem_to_luid[dId("gr-tree").currentIndex];
	var i, luid, ret;

	this.m_logger.debug("onAccept: luid_leep: " + luid_leep);

	var is_dont_ask           = false;
	var is_dont_ask_confirmed = false;

	if (dId("gr-dont-ask").checked)
	{
		is_dont_ask = true;

		is_dont_ask_confirmed = this.confirmDontAsk();
	}

	if (is_dont_ask && !is_dont_ask_confirmed)
	{
		ret = false; // do nothing, stay where we are...
	}
	else
	{
		for (luid in a_gcch)
			if (luid != luid_leep)
			{
				a_gcch_to_move[luid] = a_gcch[luid];
				
				this.m_a_luids_deleted[luid] = true;
			}

		this.m_gct.moveToTrashCards(a_gcch_to_move);

		if (is_dont_ask && is_dont_ask_confirmed)
		{
			this.setDontAsk();
			this.m_gct.moveToTrashRuleUnique(this.m_es.failcode(), this.m_grd, this.m_a_email, this.m_index + 1, this.m_a_luids_deleted);
			this.m_index = this.m_a_email.length;
			ret = true; // we're leaving...
		}
		else
		{
			this.m_index = this.m_gct.advanceToNextUnique(this.m_grd, this.m_a_email, this.m_index, this.m_a_luids_deleted);
			ret = (this.m_index >= this.m_a_email.length);

			if (!ret)
				this.updateView();  // we're going around again...
		}
	}

	if (ret)
		this.m_gct.moveToTrashRuleUniqueFinalise();

	this.m_logger.debug("onAccept: m_index: " + this.m_index + " of: " + this.m_a_email.length + " returns: " + ret);

	return ret;
}

function GoogleRuleRepeater()
{
	this.m_gct = null;
}

GoogleRuleRepeater.prototype.resolve_if_appropriate = function(logger, es, sfcd)
{
	var is_repeat = false;

	if (es.m_exit_status != 0)
	{
		var failcode         = es.failcode();
		var a_failcodes_seen = sfcd.sourceid(Account.indexToSourceId(sfcd.m_account_index), 'a_failcodes_seen');
		var is_dont_ask      = GoogleRuleTrash.isDontAsk(failcode);
		var is_failcode_seen = isPropertyPresent(a_failcodes_seen, failcode);
		is_repeat            = isInArray(failcode, GoogleRuleTrash.FAIL_CODES) && is_dont_ask && !is_failcode_seen;

		logger.debug("resolve_if_appropriate: isFinal: es: " + es.toString() + " failcode" + failcode +
	                      	" is_repeat: " + is_repeat + " a_failcodes_seen: " + aToString(a_failcodes_seen) );

		if (is_failcode_seen && a_failcodes_seen[failcode] == is_dont_ask)
			logger.warn("The last time a sync finished, is_dont_ask was true!  So why wasn't the conflict resolved?");
	}

	if (is_repeat)
	{
		a_failcodes_seen[failcode] = is_dont_ask;

		logger.debug("resolve_if_appropriate: fsm failed with a conflict. auto-resolve it and try again.");

		if (!this.m_gct)
			this.m_gct = new GoogleRuleTrash();

		this.m_gct.moveToTrashDontAsk(failcode, es.m_fail_grd);
	}

	return is_repeat;
}
