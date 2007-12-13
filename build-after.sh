#!/bin/bash
# $Id: build-after.sh,v 1.6 2007-12-13 20:55:08 cvsuser Exp $

if [ "$APP_VERSION_RELTYPE" = "dev" -o "$APP_VERSION_RELTYPE" = "testing" -o "$APP_VERSION_RELTYPE" = "prod-zindus" ]; then
	copy_to_host=tanner.moniker.net
	scp -q $XPI_FILE_NAME $copy_to_host:/home/httpd/zindus.com/htdocs/download/xpi
elif [ "$APP_VERSION_RELTYPE" = "prod-amo" ]; then
	copy_to_host=/cygdrive/s/tmp
	cp $XPI_FILE_NAME /cygdrive/s/tmp
else
	echo ERROR - failed to match APP_VERSION_RELTYPE == $APP_VERSION_RELTYPE
	exit 1
fi

echo $APP_VERSION_RELTYPE version $XPI_FILE_NAME copied to $copy_to_host

# rm $XPI_FILE_NAME
