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

function ZinXpath()
{
}

ZinXpath.logger = newZinLogger("ZinXpath");

ZinXpath.setConditional = function(object, property, xpath_query, doc, warning_msg)
{
	zinAssert(xpath_query.indexOf("attribute::") > 0); // this function is only intended for xpath queries that return a single attribute

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
	var xpathResult     = doc.evaluate(xpath_query, contextNode, ZimbraSoapDocument.nsResolver, xpathResultType, null);

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
	var xpathResult     = doc.evaluate(xpath_query, doc, ZimbraSoapDocument.nsResolver, xpathResultType, null);

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
	return "/soap:Envelope/soap:Body/" + ZimbraSoapDocument.nsFromMethod(method) + ":" + method + "Response";
}

