// The interval and timer values below are in seconds. Common values are: week:604800 day:86400 hour:3600 min:60
//
// .general preferences can be edited via the zindus preferences UI
// .system  preferences aren't editable via the zindus UI - if you want to play with them, see Tools/Options/Advanced/General/Config Editor
//
pref("extensions.zindus.system.as_logfile_max_size",      10000000);   // logfile is truncated when it gets bigger than this
pref("extensions.zindus.system.as_timer_delay_on_start",  3600);       // how long before the sync timer fires after startup
pref("extensions.zindus.system.as_timer_delay_on_repeat", 43200);      // how long before the second and subsequent sync timers fire
pref("extensions.zindus.system.zm_sync_gal_md_interval",  604800);     // how often the entire GAL is requested
pref("extensions.zindus.system.zm_sync_gal_recheck",      2);          // how many SyncGalMdInterval's before IfFewer is retested
pref("extensions.zindus.system.zm_sync_gal_if_fewer",     500);        // sync gal if it contains less than this many contacts
pref("extensions.zindus.system.zm_prefer_soapurl_scheme", "https");    // which scheme to prefer if multiple <soapURL>'s are recieved

pref("extensions.zindus.general.as_verbose_logging",      "true");     // 
pref("extensions.zindus.general.as_auto_sync",            "true");     // 
pref("extensions.zindus.general.zm_sync_gal_enabled",     "if-fewer"); // values: yes, no, if-fewer
