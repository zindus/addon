<?php
	$GLOBALS['zindus']['reltype']['prod']['version']     = "0.6.5";
	$GLOBALS['zindus']['reltype']['testing']['version']  = "0.6.5.20071107.113115";

	$GLOBALS['zindus']['reltype']['prod']['filename']    = "zindus-" . $GLOBALS['zindus']['reltype']['prod']['version']    . "-tb.xpi";
	$GLOBALS['zindus']['reltype']['testing']['filename'] = "zindus-" . $GLOBALS['zindus']['reltype']['testing']['version'] . "-tb.xpi";

	function get_url($mode)
	{
		return "http://www.zindus.com/download/xpi/" . $GLOBALS['zindus']['reltype'][$mode]['filename'];
	}

	function get_version($mode)
	{
		return $GLOBALS['zindus']['reltype'][$mode]['version'];
	}
?>
