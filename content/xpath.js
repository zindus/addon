function ZinXpath()
{
}

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
	cnsAssert(xpath_query.indexOf("attribute::")); // this function is only intended for xpath queries that return a single attribute

	var node = ZinXpath.getSingleValue(xpath_query, doc, doc);

	if (node && node.nodeValue)
		object[property] = node.nodeValue;
	else if (warning_msg != null)
		gLogger.warn(warning_msg);
}

ZinXpath.getSingleValue = function(xpath_query, doc, contextNode)
{
	var ret = null;

	// gLogger.debug("44990: xpath query is " + xpath_query + " and doc is " + xmlDocumentToString(doc));

	var xpathResultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
	var xpathResult     = doc.evaluate(xpath_query, contextNode, ZinXpath.nsResolver, xpathResultType, null);

	try {
		if (xpathResult.resultType == XPathResult.ANY_UNORDERED_NODE_TYPE && xpathResult.singleNodeValue != null)
		{
			ret = xpathResult.singleNodeValue;

			// gLogger.debug("44991: ret.nodeName == " + ret.nodeName);
			// gLogger.debug("44991: ret.nodeValue == " + ret.nodeValue);
		}
	}
	catch(e) {
		gLogger.error("============================= ERROR - exception ==========================");
		gLogger.error("ZinXpath.getSingleValue() reports document tree modified during iteration " + e);
	}

	return ret;
}

ZinXpath.runFunctor = function(functor, xpath_query, doc)
{
	// gLogger.debug("44990: xpath query is " + xpath_query + " and doc is " + xmlDocumentToString(doc));

	var xpathResultType = XPathResult.ANY_UNORDERED_NODE_ITERATOR_TYPE;
	var xpathResult     = doc.evaluate(xpath_query, doc, ZinXpath.nsResolver, xpathResultType, null);

	try {
		var node = xpathResult.iterateNext();

		while (node)
		{
			// gLogger.debug("44991: arrayOfContactsFromXpath - node.nodeType == " + node.nodeType);
			functor.run(doc, node);
			node = xpathResult.iterateNext();
		}
	}
	catch(e) {
		gLogger.error("============================= ERROR - exception ==========================");
		gLogger.error("ZinXpath.runFunctor() reports document tree modified during iteration " + e);
	}

}

ZinXpath.queryFromMethod = function(method)
{
	cnsAssert(isPropertyPresent(ZinXpath.nsOfMethod, method));

	return "/soap:Envelope/soap:Body/" + ZinXpath.nsOfMethod[method] + ":" + method + "Response";
}
