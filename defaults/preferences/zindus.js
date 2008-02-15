// The interval and timer values below are in seconds. Common values are: week:604800 day:86400 hour:3600 min:60
//
// .general preferences can be edited via the zindus preferences UI
// .system  preferences aren't editable via the zindus UI - if you want to play with them, see Tools/Options/Advanced/General/Config Editor
//
pref("extensions.zindus.system.SyncGalMdInterval",      30);   // how often the entire GAL is requested
pref("extensions.zindus.system.SyncGalEnabledRecheck",  2);        // how many SyncGalMdInterval's before IfFewer is retested
pref("extensions.zindus.system.SyncGalEnabledIfFewer",  5);      // 500 sync gal if it contains less than this many contacts
pref("extensions.zindus.system.timerDelayOnStart",      3600);     // how long before the sync timer fires after startup
pref("extensions.zindus.system.timerDelayOnRepeat",     43200);    // how long before the second and subsequent sync timers fire
pref("extensions.zindus.system.preferSchemeForSoapUrl", "https");  // which scheme to prefer if multiple <soapURL>'s are recieved
pref("extensions.zindus.system.logfileSizeMax",         10000000); // logfile is truncated when it gets bigger than this

pref("extensions.zindus.general.verboselogging",        "true");   // default to verbose logging for while - at the cost of performance
pref("extensions.zindus.general.SyncGalEnabled",        "if-fewer"); // values: yes, no, if-fewer
