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
// $Id: userprompt.js,v 1.1 2009-11-04 02:38:42 cvsuser Exp $

function UserPrompt()
{
	this.m_logger = newLogger("UserPrompt");

	this.m_payload   = null; // we keep it around so that we can pass the results back
}

UserPrompt.prototype = {
	onLoad : function() {
		this.m_payload = window.arguments[0];

		xulSetHtml("zindus-userprompt-description", this.m_payload.m_args.msg);

		if (!/accept/.test(this.m_payload.m_args.args['buttons']))
			dId("zindus-userprompt-dialog").getButton('accept').hidden = true;
		else if (!/cancel/.test(this.m_payload.m_args.args['buttons']))
			dId("zindus-userprompt-dialog").getButton('cancel').hidden = true;

		dId("zindus-userprompt-show-again").hidden = !this.m_payload.m_args.args['show_again'];
	},
	onAccept : function() {
		let result = newObject('button', 'accept');

		if (this.m_payload.m_args.args['show_again'])
			result['show_again'] = dId("zindus-userprompt-show-again").checked;

		this.m_payload.m_result = result;

		return true;
	},
	onCancel : function() {
		let result = newObject('button', 'cancel');
		this.m_payload.m_result = result;

		return true;
	}
};

UserPrompt.show = function(msg, args)
{
	logger().debug("UserPrompt.show: msg: " + msg + " args: " + aToString(args));

	let buttons     = false;
	let show_again  = false;
	let actual_args = { 'buttons' : 'accept', 'show_again' : false };
	let i;

	if (args)
		for (i in actual_args)
			if (i in args)
				actual_args[i] = args[i];
		
	zinAssert(/accept/.test(actual_args['buttons']) || /cancel/.test(actual_args['show_again']));
	zinAssert(typeof(actual_args['show_again']) == 'boolean');

	let payload = new Payload();
	payload.m_args = newObject('msg', msg, 'args', actual_args);

	window.openDialog("chrome://zindus/content/userprompt.xul", "_blank", WINDOW_FEATURES, payload);

	logger().debug("UserPrompt.show: result: " + aToString(payload.m_result));

	return payload.m_result;
}
