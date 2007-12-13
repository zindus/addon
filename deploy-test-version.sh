#!/bin/bash
# $Id: deploy-test-version.sh,v 1.7 2007-12-13 03:25:59 cvsuser Exp $

export APP_VERSION_RELTYPE="testing"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	FILE_NAME_FROM=asd
	FILE_NAME_TO=xpiversion.$APP_VERSION_RELTYPE.inc.php
	# em:version="0.6.15"
	# APPVERSION=`sed -r "s#em:version=\"(.*)\"#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`
	APPVERSION=`sed -r "s#<em:version>(.*)</em:version>#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`

	echo '<?php'                                                                    >  $FILE_NAME_FROM
	echo '$GLOBALS["zindus"]["reltype"]["testing"]["version"]  = "'"$APPVERSION"'";'>> $FILE_NAME_FROM
	echo '?>'                                                                       >> $FILE_NAME_FROM

	copy_to_host=tanner.moniker.net

	scp -q $FILE_NAME_FROM $copy_to_host:/home/httpd/zindus.com/php-include/$FILE_NAME_TO
	scp -q update.rdf $copy_to_host:/home/httpd/zindus.com/htdocs/download/update-$APP_VERSION_RELTYPE.rdf

	rm $FILE_NAME_FROM

	echo External-facing $APP_VERSION_RELTYPE version changed to $APPVERSION

else
	echo Aborted
fi
