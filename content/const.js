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

const EXTENSION_NAME = "zindus";

const PREFERENCES_STARTAT = 1000;            // leaves plenty of room for default preferences 0-999

const LOGFILENAME = "logfile.txt"; // appended to DIRECTORY_LOG

const SOAP_REQUEST_FAILED = -12344;

const FORMAT_TB = 0;
const FORMAT_ZM = 1;

const TBCARD_ATTRIBUTE_LUID     = "zid"; // user-defined attributes associated with thunderbird cards
const TBCARD_ATTRIBUTE_CHECKSUM = "zcs"; //

const ABSPECIAL_GAL   = "GAL";
const ABSPECIAL_TRASH = "Trash";

const ZIMBRA_ID_TRASH = 3;

const SOURCEID_TB = 1;
const SOURCEID_ZM = 2;
