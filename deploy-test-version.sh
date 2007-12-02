#!/bin/bash
# $Id: deploy-test-version.sh,v 1.5 2007-12-02 07:14:57 cvsuser Exp $

export APP_VERSION_RELTYPE="testing"

./build.sh

echo -n "have you signed update.rdf with mccoy ? "
read is_signed
if [ "$is_signed" == "y" ]; then

	FILE_NAME_FROM=asd
	FILE_NAME_TO=xpiversion.test.inc.php
	APPVERSION=`sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`

	echo '<?php'                                                                    >  $FILE_NAME_FROM
	echo '$GLOBALS["zindus"]["reltype"]["testing"]["version"]  = "'"$APPVERSION"'";'>> $FILE_NAME_FROM
	echo '?>'                                                                       >> $FILE_NAME_FROM

	copy_to_host=tanner.moniker.net

	scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
	scp -q update.rdf $copy_to_host:/home/httpd/zindus.com/htdocs/download/update-$APP_VERSION_RELTYPE.rdf

	rm $FILE_NAME_FROM

echo External-facing testing version changed to $APPVERSION

else
	echo Aborted
fi
