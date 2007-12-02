#!/bin/bash
# $Id: deploy-prod-version.sh,v 1.4 2007-12-02 07:07:57 cvsuser Exp $

export APP_VERSION_RELTYPE="prod-zindus"

echo -n "have you edited build-config.sh to set APP_VERSION_NUMBER ? "
read is_version_updated
if [ "$is_version_updated" == "y" ]; then

	./build.sh

	echo -n "have you signed update.rdf with mccoy ? "
	read is_signed
	if [ "$is_signed" == "y" ]; then

		FILE_NAME_FROM=asd
		FILE_NAME_TO=xpiversion.prod.inc.php
		APPVERSION=`sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`

		echo '<?php'                                                                 >  $FILE_NAME_FROM
		echo '$GLOBALS["zindus"]["reltype"]["prod"]["version"]  = "'"$APPVERSION"'";'>> $FILE_NAME_FROM
		echo '?>'                                                                    >> $FILE_NAME_FROM

		RELEASE_TAG=`echo $APPVERSION | sed 's/\./_/g'`
		RELEASE_TAG="release-"$RELEASE_TAG
		echo release tag is $RELEASE_TAG

		cvs commit -m ""
		cvs tag $RELEASE_TAG

		copy_to_host=tanner.moniker.net

		scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
		scp -q update.rdf $copy_to_host:/home/httpd/zindus.com/htdocs/download/update-prod.rdf

		rm $FILE_NAME_FROM
		echo External-facing prod-zindus version changed to $APPVERSION
	else
		echo aborted.
	fi
else
	echo aborted.
fi

exit
