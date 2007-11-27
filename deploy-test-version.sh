#!/bin/bash
# $Id: deploy-test-version.sh,v 1.4 2007-11-27 07:05:00 cvsuser Exp $

./build.sh

FILE_NAME_FROM=asd
FILE_NAME_TO=xpiversion.test.inc.php
APPVERSION=`sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`

sed -r "s#($GLOBALS\['zindus'\]\['reltype'\]\['testing'\]\['version'\] *= \")(.*)\";#\1$APPVERSION\";#" < deploy-test-version.sh.inc.php > asd

copy_to_host=tanner.moniker.net

scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
rm $FILE_NAME_FROM
echo External-facing testing version changed to $APPVERSION

