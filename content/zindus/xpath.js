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

function ZinXpath()
{
}

ZinXpath.NS_SOAP_ENVELOPE  = "http://schemas.xmlsoap.org/soap/envelope/";
ZinXpath.NS_ZIMBRA         = "urn:zimbra";
ZinXpath.NS_ZACCOUNT       = "urn:zimbraAccount";
ZinXpath.NS_ZMAIL          = "urn:zimbraMail";

ZinXpath.NS_ATOM           = "http://www.w3.org/2005/Atom";
ZinXpath.NS_OPENSEARCH     = "http://a9.com/-/spec/opensearchrss/1.0/";
ZinXpath.NS_GCONTACT       = "http://schemas.google.com/contact/2008";
ZinXpath.NS_GD             = "http://schemas.google.com/g/2005";

ZinXpath.NS_XHTML          = "http://www.w3.org/1999/xhtml";
ZinXpath.NS_XMLNS          = "http://www.w3.org/2000/xmlns/"; // See the uri and http://www.w3.org/TR/DOM-Level-2-Core/core.html

ZinXpath.NS_ZINDUS_ADDRESS = "http://schemas.zindus.com/sync/2008";

ZinXpath.nsResolver = function(prefix)
{
	var map = {
			soap:       ZinXpath.NS_SOAP_ENVELOPE,
			z:          ZinXpath.NS_ZIMBRA,
			za:         ZinXpath.NS_ZACCOUNT,
			zm:         ZinXpath.NS_ZMAIL,
			atom:       ZinXpath.NS_ATOM,
			openSearch: ZinXpath.NS_OPENSEARCH,
			gcontact:   ZinXpath.NS_GCONTACT,
			gd:         ZinXpath.NS_GD,
			zindusaddr: ZinXpath.NS_ZINDUS_ADDRESS
	};

	ZinUtil.assertAndLog(ZinUtil.isPropertyPresent(map, prefix), "prefix: " + prefix);

	return map[prefix];
};

ZinXpath.logger = ZinLoggerFactory.instance().newZinLogger("ZinXpath");

ZinXpath.setConditional = function(object, property, xpath_query, doc, warning_msg)
{
	ZinUtil.assert(xpath_query.indexOf("attribute::") > 0); // this function is only intended for xpath queries that return a single attribute

	var node = ZinXpath.getOneNode(xpath_query, doc, doc);

	if (node && node.nodeValue)
		object[property] = node.nodeValue;
	else if (warning_msg != null)
		ZinXpath.logger.warn(warning_msg);
}

ZinXpath.getOneNode = function(xpath_query, doc, contextNode)
{
	return ZinXpath.getSingleNode(xpath_query, doc, contextNode, XPathResult.ANY_UNORDERED_NODE_TYPE);
}

ZinXpath.getFirstNode = function(xpath_query, doc, contextNode)
{
	return ZinXpath.getSingleNode(xpath_query, doc, contextNode, XPathResult.FIRST_ORDERED_NODE_TYPE);
}

ZinXpath.getSingleNode = function(xpath_query, doc, contextNode, xpathResultType)
{
	var ret         = null;
	var xpathResult = doc.evaluate(xpath_query, contextNode, ZinXpath.nsResolver, xpathResultType, null);

	try {
		if (xpathResult.resultType == xpathResultType && xpathResult.singleNodeValue != null)
		{
			ret = xpathResult.singleNodeValue;
		}
	}
	catch(ex) {
		ZinXpath.reportException(ex);
	}

	return ret;
}

ZinXpath.setConditionalFromSingleElement = function(object, property, xpath_query, doc, warning_msg)
{
	var functor = new FunctorArrayOfTextNodeValue();

	ZinXpath.runFunctor(functor, xpath_query, doc);

	if (functor.a.length == 1)
		object[property] = String(functor.a[0]);
	else if (warning_msg != null)
		ZinXpath.logger.warn(warning_msg);
}

ZinXpath.runFunctor = function(functor, xpath_query, doc, xpathResultType)
{
	ZinUtil.assert(arguments.length == 3 || arguments.length == 4); // catch programming errors
	ZinUtil.assert(typeof(doc.evaluate) == 'function');

	if (arguments.length == 3)
		xpathResultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE; // this used to be ANY_UNORDERED_NODE_ITERATOR_TYPE - why did that work?

	var xpathResult = doc.evaluate(xpath_query, doc, ZinXpath.nsResolver, xpathResultType, null);

	try {
		var node = xpathResult.iterateNext();

		while (node)
		{
			functor.run(doc, node);
			node = xpathResult.iterateNext();
		}
	}
	catch(ex) {
		ZinXpath.reportException(ex);
	}

}

ZinXpath.reportException = function(ex)
{
	ZinXpath.logger.error("Exception: " + ex);
	ZinXpath.logger.error("Stack: " + ex.stack);
}

ZinXpath.queryFromMethod = function(method)
{
	return "/soap:Envelope/soap:Body/" + ZmSoapDocument.nsFromMethod(method) + ":" + method + "Response";
}

function FunctorArrayOfTextNodeValue()
{
	this.a = new Array();
}

FunctorArrayOfTextNodeValue.prototype.run = function(doc, node)
{
	if (node.childNodes.length == 1 && node.childNodes.item(0).nodeType == Node.TEXT_NODE)
		this.a.push(new String(node.childNodes.item(0).nodeValue));
}

