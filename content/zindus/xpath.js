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

function Xpath()
{
}

Xpath.NS_SOAP_ENVELOPE  = "http://schemas.xmlsoap.org/soap/envelope/";
Xpath.NS_ZIMBRA         = "urn:zimbra";
Xpath.NS_ZACCOUNT       = "urn:zimbraAccount";
Xpath.NS_ZMAIL          = "urn:zimbraMail";

Xpath.NS_ATOM           = "http://www.w3.org/2005/Atom";
Xpath.NS_OPENSEARCH     = "http://a9.com/-/spec/opensearchrss/1.0/";
Xpath.NS_GCONTACT       = "http://schemas.google.com/contact/2008";
Xpath.NS_GD             = "http://schemas.google.com/g/2005";

Xpath.NS_XHTML          = "http://www.w3.org/1999/xhtml";
Xpath.NS_XMLNS          = "http://www.w3.org/2000/xmlns/"; // See the uri and http://www.w3.org/TR/DOM-Level-2-Core/core.html

Xpath.NS_ZINDUS_ADDRESS = "http://schemas.zindus.com/sync/2008";

Xpath.nsResolver = function(prefix)
{
	var map = {
			soap:       Xpath.NS_SOAP_ENVELOPE,
			z:          Xpath.NS_ZIMBRA,
			za:         Xpath.NS_ZACCOUNT,
			zm:         Xpath.NS_ZMAIL,
			atom:       Xpath.NS_ATOM,
			openSearch: Xpath.NS_OPENSEARCH,
			gcontact:   Xpath.NS_GCONTACT,
			gd:         Xpath.NS_GD,
			zindusaddr: Xpath.NS_ZINDUS_ADDRESS
	};

	zinAssertAndLog(isPropertyPresent(map, prefix), "prefix: " + prefix);

	return map[prefix];
};

Xpath.setConditional = function(object, property, xpath_query, doc, warning_msg)
{
	zinAssert(xpath_query.indexOf("attribute::") > 0); // this function is only intended for xpath queries that return a single attribute

	var node = Xpath.getOneNode(xpath_query, doc, doc);

	if (node && node.nodeValue)
		object[property] = node.nodeValue;
	else if (warning_msg != null)
		logger().warn("Xpath: " + warning_msg);
}

Xpath.getOneNode = function(xpath_query, doc, contextNode)
{
	return Xpath.getSingleNode(xpath_query, doc, contextNode, XPathResult.ANY_UNORDERED_NODE_TYPE);
}

Xpath.getFirstNode = function(xpath_query, doc, contextNode)
{
	return Xpath.getSingleNode(xpath_query, doc, contextNode, XPathResult.FIRST_ORDERED_NODE_TYPE);
}

Xpath.getSingleNode = function(xpath_query, doc, contextNode, xpathResultType)
{
	var ret         = null;
	var xpathResult = doc.evaluate(xpath_query, contextNode, Xpath.nsResolver, xpathResultType, null);

	try {
		if (xpathResult.resultType == xpathResultType && xpathResult.singleNodeValue != null)
		{
			ret = xpathResult.singleNodeValue;
		}
	}
	catch(ex) {
		Xpath.reportException(ex);
	}

	return ret;
}

Xpath.setConditionalFromSingleElement = function(object, property, xpath_query, doc, warning_msg)
{
	var functor = new FunctorArrayOfTextNodeValue();

	Xpath.runFunctor(functor, xpath_query, doc);

	if (functor.a.length == 1)
		object[property] = String(functor.a[0]);
	else if (warning_msg != null)
		logger().warn("Xpath: " + warning_msg);
}

Xpath.runFunctor = function(functor, xpath_query, doc, xpathResultType)
{
	zinAssert(arguments.length == 3 || arguments.length == 4); // catch programming errors
	zinAssert(typeof(doc.evaluate) == 'function');

	if (arguments.length == 3)
		xpathResultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE; // this used to be ANY_UNORDERED_NODE_ITERATOR_TYPE - why did that work?

	var xpathResult = doc.evaluate(xpath_query, doc, Xpath.nsResolver, xpathResultType, null);

	try {
		var node = xpathResult.iterateNext();

		while (node)
		{
			functor.run(doc, node);
			node = xpathResult.iterateNext();
		}
	}
	catch(ex) {
		Xpath.reportException(ex);
	}

}

Xpath.runFunctorGenerator = function(functor, xpath_query, doc, yield_count, xpathResultType)
{
	zinAssert(arguments.length == 4 || arguments.length == 5); // catch programming errors
	zinAssert(typeof(doc.evaluate) == 'function');

	if (arguments.length == 4)
		xpathResultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE; // this used to be ANY_UNORDERED_NODE_ITERATOR_TYPE - why did that work?

	var xpathResult = doc.evaluate(xpath_query, doc, Xpath.nsResolver, xpathResultType, null);
	var count = 0;

	try {
		var node = xpathResult.iterateNext();

		while (node)
		{
			functor.run(doc, node);
			node = xpathResult.iterateNext();

			logger().debug("AMHERE6: count: " + count + " yield_count: " + yield_count);

			if (yield_count > 0)
			{
				if (++count % yield_count == 0)
				{
					logger().debug("AMHERE6: yield: count: " + count);
					yield true;
				}
			}
		}
	}
	catch(ex) {
		Xpath.reportException(ex);
	}

	yield false;
}

Xpath.reportException = function(ex)
{
	logger().error("Xpath: " + "Exception: " + ex);
	logger().error("Xpath: " + "Stack: " + ex.stack);
}

Xpath.queryFromMethod = function(method)
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

