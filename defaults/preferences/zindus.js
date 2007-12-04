pref("extensions.zindus.system.SyncGalMdInterval",      86400);    // 60   how frequently the entire GAL is requested (seconds)
pref("extensions.zindus.system.timerDelayOnStart",      3600);     // 3600 how long before the sync timer fires after startup (seconds)
pref("extensions.zindus.system.timerDelayOnRepeat",     43200);    // 300 86400 how long before the second and subsequent sync timers fire
pref("extensions.zindus.system.preferSchemeForSoapUrl", "https");  // which scheme to prefer if multiple <soapURL>'s are recieved
pref("extensions.zindus.system.logfileSizeMax",         10000000); // logfile is truncated when it gets bigger than this
pref("extensions.zindus.general.verboselogging",        "true");   // default to verbose logging for while - at the cost of performance
