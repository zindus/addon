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

// if you want to do 10,000 string concatenations in a row, the performance is better if they are chunked up
// 
function BigString()
{
	this.m_chunk_size = chunk_size('bigstring');

	this.reset();
}

BigString.prototype.concat = function(str)
{
	zinAssert(arguments.length == 1);

	this.m_intermediate += str;

	if (++this.m_count > this.m_chunk_size)
		this.concatIntermediate(str);
}

BigString.prototype.concatIntermediate = function(str)
{
	this.m_string += this.m_intermediate;
	this.m_intermediate = "";
	this.m_count = 0;
}

BigString.prototype.toString = function()
{
	if (this.m_intermediate.length > 0)
		this.concatIntermediate("");
	
	return this.m_string;
}

BigString.prototype.reset = function()
{
	this.m_string = "";
	this.m_count = 0;
	this.m_intermediate = "";
}
