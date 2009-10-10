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
// $Id: infodlg.js,v 1.2 2009-10-10 14:06:12 cvsuser Exp $

function InfoDlg()
{
	this.m_logger = newLogger("InfoDlg");

	this.m_logger.debug("constructor starts");

	this.m_payload   = null; // we keep it around so that we can pass the results back

	this.m_logger.debug("constructor ends");
}

InfoDlg.prototype = {
	onLoad : function() {
		this.m_logger.debug("onLoad: enters: ");

		this.m_payload = window.arguments[0];

		xulSetHtml("zindus-infodlg-description", this.m_payload.m_args.msg);

		if (!/accept/.test(this.m_payload.m_args.buttons))
			dId("zindus-infodlg").getButton('accept').hidden = true;
		else if (!/cancel/.test(this.m_payload.m_args.buttons))
			dId("zindus-infodlg").getButton('cancel').hidden = true;

		this.m_logger.debug("onLoad: exits");
	},
	onAccept : function() {
		this.m_logger.debug("onAccept: enters");

		this.m_payload.m_result = 'accept';

		this.m_logger.debug("onAccept: exits");

		return true;
	},
	onCancel : function() {
		this.m_logger.debug("onCancel: enters");

		this.m_payload.m_result = 'cancel';

		// don't reference logger here because logger.js is out of scope after the window is closed...
		// this.m_logger.debug("onCancel: exits");

		return true;
	}
};

InfoDlg.show = function(msg, buttons)
{
	logger().debug("InfoDlg.show: msg: " + msg);

	if (!buttons)
		buttons = 'accept';

	let payload = new Payload();
	payload.m_args = newObject('msg', msg, 'buttons', buttons);

	window.openDialog("chrome://zindus/content/infodlg.xul", "_blank", WINDOW_FEATURES, payload);

	logger().debug("InfoDlg.show: result: " + payload.m_result);

	return payload.m_result;
}
