function CookieObserver(host)
{
	this.m_host   = host;
	this.m_cookie = null;
	this.m_topic  = "cookie-changed";
}

CookieObserver.prototype.observe = function(subject, topic, data)
{
    if (topic == this.m_topic && (data == "added" || data == "changed"))
	{
		var nsICookie2 = subject.QueryInterface(Components.interfaces.nsICookie2);

		if (nsICookie2.host == this.m_host && nsICookie2.name == "ZM_AUTH_TOKEN")
			this.m_cookie = nsICookie2.value;
	}
}
