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
// $Id: gcs.js,v 1.12 2009-05-31 22:56:37 cvsuser Exp $

// Gcs == Global Converged State
//

var eGcs = new ZinEnum( 'win', 'conflict' );

function Gcs(sourceid, state)
{
	zinAssert(isValidSourceId(sourceid) && eGcs.isPresent(state));

	this.sourceid = sourceid;
	this.state    = state;
}

Gcs.prototype = {
	toString : function() {
		return  "winner: " + this.sourceid + " state: " + eGcs.keyFromValue(this.state);
	}
};
