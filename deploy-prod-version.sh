#!/bin/bash
# $Id: deploy-prod-version.sh,v 1.3 2007-11-27 07:05:00 cvsuser Exp $

echo -n "have you edited build-config.sh to set APP_VERSION_NUMBER and set APP_VERSION_RELTYPE='prod-zindus' ? "
read is_version_updated
if [ "$is_version_updated" == "y" ]; then

	./build.sh

	FILE_NAME_FROM=asd
	FILE_NAME_TO=xpiversion.prod.inc.php
	APPVERSION=`sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`

	RELEASE_TAG=`echo $APPVERSION | sed 's/\./_/g'`
	RELEASE_TAG="release-"$RELEASE_TAG
	echo release tag is $RELEASE_TAG

	cvs commit -m ""
	cvs tag $RELEASE_TAG

	sed -r "s#($GLOBALS\['zindus'\]\['reltype'\]\['prod'\]\['version'\] *= \")(.*)\";#\1$APPVERSION\";#" < deploy-prod-version.sh.inc.php > asd

	copy_to_host=tanner.moniker.net

	scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
	echo External-facing prod-zindus version changed to $APPVERSION

else
	echo aborted.
fi

exit
