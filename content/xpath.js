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

function ZinXpath()
{
}

ZinXpath.logger = newZinLogger("ZinXpath");

ZinXpath.nsResolverBimap = new BiMap(
	[ "soap",                              "z",                          "za",                          "zm"                       ],
	[ ZimbraSoapDocument.NS_SOAP_ENVELOPE, ZimbraSoapDocument.NS_ZIMBRA, ZimbraSoapDocument.NS_ACCOUNT, ZimbraSoapDocument.NS_MAIL ]);

ZinXpath.nsOfMethod = {
		Auth:           "za",
		CheckLicense:   "za",
		GetAccountInfo: "za",
		SyncGal:        "za",
		GetContacts:    "zm",
		Sync:           "zm",
		CreateContact:  "zm", 
		CreateFolder:   "zm", 
		ContactAction:  "zm", 
		FolderAction:   "zm", 
		ModifyContact:  "zm",
		last_notused:   null
};

ZinXpath.nsResolver = function(prefix)
{
	return ZinXpath.nsResolverBimap.lookup(prefix, null);
};

ZinXpath.setConditional = function(object, property, xpath_query, doc, warning_msg)
{
	zinAssert(xpath_query.indexOf("attribute::")); // this function is only intended for xpath queries that return a single attribute

	var node = ZinXpath.getSingleValue(xpath_query, doc, doc);

	if (node && node.nodeValue)
		object[property] = node.nodeValue;
	else if (warning_msg != null)
		ZinXpath.logger.warn(warning_msg);
}

ZinXpath.getSingleValue = function(xpath_query, doc, contextNode)
{
	var ret = null;

	// ZinXpath.logger.debug("44990: xpath query is " + xpath_query + " and doc is " + xmlDocumentToString(doc));

	var xpathResultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
	var xpathResult     = doc.evaluate(xpath_query, contextNode, ZinXpath.nsResolver, xpathResultType, null);

	try {
		if (xpathResult.resultType == XPathResult.ANY_UNORDERED_NODE_TYPE && xpathResult.singleNodeValue != null)
		{
			ret = xpathResult.singleNodeValue;

			// ZinXpath.logger.debug("44991: ret.nodeName == " + ret.nodeName);
			// ZinXpath.logger.debug("44991: ret.nodeValue == " + ret.nodeValue);
		}
	}
	catch(e) {
		ZinXpath.logger.error("============================= ERROR - exception ==========================");
		ZinXpath.logger.error("ZinXpath.getSingleValue() reports document tree modified during iteration " + e);
	}

	return ret;
}

ZinXpath.runFunctor = function(functor, xpath_query, doc)
{
	// ZinXpath.logger.debug("44990: xpath query is " + xpath_query + " and doc is " + xmlDocumentToString(doc));

	var xpathResultType = XPathResult.ANY_UNORDERED_NODE_ITERATOR_TYPE;
	var xpathResult     = doc.evaluate(xpath_query, doc, ZinXpath.nsResolver, xpathResultType, null);

	try {
		var node = xpathResult.iterateNext();

		while (node)
		{
			// ZinXpath.logger.debug("44991: arrayOfContactsFromXpath - node.nodeType == " + node.nodeType);
			functor.run(doc, node);
			node = xpathResult.iterateNext();
		}
	}
	catch(e) {
		ZinXpath.logger.error("============================= ERROR - exception ==========================");
		ZinXpath.logger.error("ZinXpath.runFunctor() reports document tree modified during iteration " + e);
	}

}

ZinXpath.queryFromMethod = function(method)
{
	zinAssert(isPropertyPresent(ZinXpath.nsOfMethod, method));

	return "/soap:Envelope/soap:Body/" + ZinXpath.nsOfMethod[method] + ":" + method + "Response";
}

