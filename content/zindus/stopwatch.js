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

// suo == Source Update Operation
//

function StopWatch(prefix)
{
	this.m_prefix = prefix;
	this.m_start  = new Date(Date.now());
	this.m_logger = newLogger("stopwatch");
}

StopWatch.prototype.mark = function(marker)
{
	this.m_logger.debug(this.m_prefix + ": " + marker + ": " + this.elapsed());
}

StopWatch.prototype.elapsed = function()
{
	return (new Date(Date.now()) - this.m_start);
}

StopWatch.prototype.reset = function()
{
	this.m_start  = new Date(Date.now());
}
