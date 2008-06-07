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

// gcs == Global Converged State
//

Gcs.WIN      = 0; // item didn't change, or item changed in one source
Gcs.CONFLICT = 1; // item changed in more than one source

Gcs.bimap_state = new BiMap(
	[Gcs.WIN, Gcs.CONFLICT],
	['win',   'conflict', ]);


function Gcs(sourceid, state)
{
	// ZinLoggerFactory.instance().logger().debug("Gcs: sourceid: " + sourceid); // blah
	// ZinLoggerFactory.instance().logger().debug("Gcs: state:    " + state);
	// ZinLoggerFactory.instance().logger().debug("Gcs: Gcs.bimap_state.isPresent(state): " + Gcs.bimap_state.isPresent(state));

	zinAssert(isValidSourceId(sourceid) && Gcs.bimap_state.isPresent(state));

	this.sourceid = sourceid;
	this.state    = state;
}

Gcs.prototype.toString = function()
{
	return  "winner: " + this.sourceid +
			" state: " + Gcs.bimap_state.lookup(this.state);
}
