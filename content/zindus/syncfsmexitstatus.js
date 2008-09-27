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

function SyncFsmExitStatus()
{
	this.m_exit_status      = null;
	this.m_fail_code        = null; // one of the Fail* codes
	this.m_fail_detail      = null;
	this.m_fail_gcd         = null;
	this.m_fail_soapmethod  = null;
	this.m_fail_fsmoldstate = null;
	this.m_count_conflicts  = 0;
	this.m_logger           = newLogger("SyncFsmExitStatus");

	this.m_a_valid_code = {
		'failon.service'                       : { 'hasdetail' : 0 }, // 1.  some sort of service failure
		'failon.fault'                         : { 'hasdetail' : 0 }, //     recieved a soap fault
		'failon.mismatched.response'           : { 'hasdetail' : 0 }, //     sent ARequest and received BResponse (expected AResponse)
		'failon.cancel'                        : { 'hasdetail' : 0 }, //     user cancelled
		'failon.integrity.zm.bad.credentials'  : { 'hasdetail' : 0 }, //     something dodgy about url, username or password - dont proceed
		'failon.integrity.gd.bad.credentials'  : { 'hasdetail' : 0 }, //     something dodgy about email address or password - dont proceed
		'failon.integrity.data.store.in'       : { 'hasdetail' : 0 }, //     something dodgy about the data store that just got loaded
		'failon.integrity.data.store.out'      : { 'hasdetail' : 1 }, //     internal error - we've created a data store that's dodgy
		'failon.integrity.data.store.map'      : { 'hasdetail' : 1 }, //     internal error - somehow a card acquired the luid of a folder!
		'failon.integrity.accounts.identical'  : { 'hasdetail' : 1 }, // 10. user has created accounts that are identical
		'failon.integrity.accounts.one.zimbra' : { 'hasdetail' : 0 }, //     user has created more than one zimbra account
		'failon.unknown'                       : { 'hasdetail' : 0 }, //     this should never be!
		'failon.folder.name.empty'             : { 'hasdetail' : 1 }, //    
		'failon.folder.name.duplicate'         : { 'hasdetail' : 1 }, //    
		'failon.folder.name.reserved'          : { 'hasdetail' : 1 }, //    
		'failon.folder.name.invalid'           : { 'hasdetail' : 1 }, //    
		'failon.folder.must.be.present'        : { 'hasdetail' : 1 }, //    
		'failon.folder.reserved.changed'       : { 'hasdetail' : 1 }, //    
		'failon.folder.name.clash'             : { 'hasdetail' : 1 }, //     a folder name entered the namespace from both tb and zm sides
		'failon.folder.source.update'          : { 'hasdetail' : 1 }, // 20. the source update operations can't be applied with confidence
		'failon.folder.cant.create.shared'     : { 'hasdetail' : 1 }, //    
		'failon.unable.to.update.server'       : { 'hasdetail' : 1 }, //     couldn't make sense of the http/soap response
		'failon.unable.to.update.thunderbird'  : { 'hasdetail' : 1 }, //     
		'failon.no.xpath'                      : { 'hasdetail' : 0 }, //    
		'failon.no.tbpre'                      : { 'hasdetail' : 0 }, //    
		'failon.no.pab'                        : { 'hasdetail' : 1 }, //     
		'failon.multiple.ln'                   : { 'hasdetail' : 1 }, //      
		'failon.gd.conflict.1'                 : { 'hasdetail' : 0 }, //     
		'failon.gd.conflict.2'                 : { 'hasdetail' : 0 }, //     
		'failon.gd.conflict.3'                 : { 'hasdetail' : 0 }, // 30.
		'failon.gd.conflict.4'                 : { 'hasdetail' : 0 }, //    
		'failon.gd.forbidden'                  : { 'hasdetail' : 0 }, //    
		'failon.gd.syncwith'                   : { 'hasdetail' : 1 }, //     
		'failon.gd.get'                        : { 'hasdetail' : 0 }, //     
		'failon.zm.empty.contact'              : { 'hasdetail' : 1 }, //    
		'failon.unauthorized'                  : { 'hasdetail' : 0 }, //     server 401 - did a proxy remove the 'Authorized' header?
		'failon.auth'                          : { 'hasdetail' : 1 }  //     Failed to login to Google or Zimbra via preauth
	};
}

SyncFsmExitStatus.prototype.toString = function()
{
	var ret = "";
	
	ret += "exit_status: " + this.m_exit_status;

	if (this.m_exit_status)
	{
		ret += " fail_code: "        + this.failcode();
		ret += " fail_detail: "      + this.m_fail_detail;
		ret += " fail_fsmoldstate: " + this.m_fail_fsmoldstate;
		if (this.m_fail_gcd)
			ret += " fail_gcd: " + this.m_fail_gcd.toString();
	}

	ret += " count_conflicts: " + this.m_count_conflicts;

	return ret;
}

SyncFsmExitStatus.prototype.failCodeStringId = function()
{
	var stringid = 'status.' + this.failcode();

	return stringid;
}

SyncFsmExitStatus.prototype.failcode = function()
{
	if (arguments.length == 1)
	{
		this.m_fail_code = arguments[0];
		zinAssertAndLog(isPropertyPresent(this.m_a_valid_code, this.m_fail_code), "unmatched code: " + this.m_fail_code);
	}

	return this.m_fail_code;
}

SyncFsmExitStatus.prototype.hasDetail = function()
{
	return this.m_a_valid_code[this.failcode()]['hasdetail'] == 1;
}

SyncFsmExitStatus.prototype.asMessage = function(sbsSuccess, sbsFailure)
{
	var msg = "";

	// if the dialog was cancelled while we were syncing, string bundles wont be available, so we try/catch...
	//
	try {
		if (this.m_exit_status == 0)
			msg += stringBundleString(sbsSuccess);
		else
		{
			msg += stringBundleString(sbsFailure);
			msg += "\n" + stringBundleString(this.failCodeStringId());

			if (this.failcode() == 'failon.fault')
			{
				msg += "\n" + this.m_fail_detail;
				msg += "\n" + stringBundleString("status.failmsg.zm.soap.method") + " " + this.m_fail_soapmethod;
			}
			else if (this.failcode() == 'failon.cancel')
				msg += "\n" + stringBundleString("status.failon.cancel.detail");
			else if (this.failcode() == 'failon.service')
				msg += "\n" + stringBundleString("status.failon.service.detail");
			else if (this.hasDetail())
				msg += this.m_fail_detail;
		}
	} catch (ex) {
		dump("asMessage: exception: " + ex.message + "\n");
		this.m_logger.debug("asMessage: exception: " + ex.message);
	}

	return msg;
}
