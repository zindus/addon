#!/bin/bash
# $Id: deploy-common.sh,v 1.5 2010-06-28 02:48:11 cvsuser Exp $

get_appversion()
{
	echo `sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`
}

get_platform_id()
{
	appv=`get_appversion`

	if [ -z "$appv" ]; then
		echo ERROR: unable to parse version out of install.rdf
		exit 1;
	fi

	ls *$appv-* | sed -r "s#$appv(.*)\.xpi#fredfred \1#" | awk '/fredfred/ { print $2; }'
}

generate_and_copy_rdfs()
{
	n_appversion=$1
	n_platform_id=$2
	n_remotereltype=$3 # one of: dev, testing, prod

	if [ -z "$n_appversion" -o -z "$n_platform_id" -o -z "$n_remotereltype" ]; then
		echo bad number of params
		echo n_appversion: $n_appversion
		echo n_platform_id: $n_platform_id
		echo n_remotereltype: $n_remotereltype
		return 'bad!'  # force an error
	fi

	echo generate_and_copy_rdfs: n_appversion: $n_appversion and n_platform_id: $n_platform_id and n_remotereltype: $n_remotereltype

	FILE_NAME_FROM=asd
	FILE_NAME_TO=xpiversion.$n_remotereltype.inc.php

	echo '<?php'                                                                                 >  $FILE_NAME_FROM
	echo '$GLOBALS["zindus"]["reltype"]["'$n_remotereltype'"]["version"]  = "'"$n_appversion"'";'>> $FILE_NAME_FROM
	echo '$GLOBALS["zindus"]["platform_id"] = "'"$n_platform_id"'";'                             >> $FILE_NAME_FROM
	echo '?>'                                                                                    >> $FILE_NAME_FROM

	copy_to_host=tanner.moniker.net

	scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
	scp -q update.rdf $copy_to_host:/home/httpd/zindus.com/htdocs/download/update-$n_remotereltype.rdf

	rm $FILE_NAME_FROM

	echo External-facing $APP_VERSION_RELTYPE version changed to $APPVERSION
}
