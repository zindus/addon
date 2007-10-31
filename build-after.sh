#!/bin/bash
# $Id: build-after.sh,v 1.3 2007-10-31 03:43:58 cvsuser Exp $

copy_to_host=tanner.moniker.net

if [ "$APP_VERSION_RELTYPE" = "testing" -o "$APP_VERSION_RELTYPE" = "prod-zindus" ]; then
  scp -q $XPI_FILE_NAME $copy_to_host:/home/httpd/zindus.com/htdocs/download/xpi
  # rm $XPI_FILE_NAME
  echo $XPI_FILE_NAME copied to $copy_to_host
fi
