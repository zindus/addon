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

// This class helps to pass data to/from parent + child windows as a parameter to window.openDialog()
//
function Payload(opcode)
{
	if (arguments.length > 0)
		this.m_opcode = opcode;
	this.m_args   = null;
	this.m_result = null;
}

// Payload.SYNC        = 0;
// Payload.AUTHONLY    = 1;

Payload.prototype.opcode = function()
{
	return this.m_opcode;
}

Payload.prototype.toString = function()
{
	var msg = "";

	msg += "opcode: " + this.m_opcode;
	msg += " m_args: "   + ((this.m_args   != null) ? this.m_args.toString()   : "null");
	msg += " m_result: " + ((this.m_result != null) ? this.m_result.toString() : "null");

	return msg;
}
