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
 * The Initial Developer of the Original Code is Moniker Pty Ltd.
 *
 * Portions created by Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s): Leni Mayo
 * 
 * ***** END LICENSE BLOCK *****/

function include(url)
{
	// dump("include: " + url + "\n");

	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
	var ret;

	if (loader)
	{
		var is_exception = false;

		if (true)
			ret = loader.loadSubScript(url);  // note - this is here for debugging only - otherwise the url is included twice!
		else
			try {
				ret = loader.loadSubScript(url);
			}
			catch (ex)
			{
				is_exception = true;
	
				if (typeof alert == 'function')
					alert(ex.message + " stack: \n" + ex.stack);
				else
					print(ex.message + " stack: \n" + ex.stack);
			}

		if (false)
		if (is_exception) // this is the code from Assert()
			try
			{
				throw new Error("Internal error in extension: assert failed");
			}
			catch(ex)
			{
				if (typeof alert == 'function')
					alert(ex.message + " stack: \n" + ex.stack);
				else
					print(ex.message + " stack: \n" + ex.stack);

				throw new Error(ex.message + "\n\n stack:\n" + ex.stack);
			}
	}
}
