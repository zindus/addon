#!/bin/bash
# $Id: build-after.sh,v 1.1 2007-10-08 22:30:25 cvsuser Exp $


if [ "$APP_VERSION_RELTYPE" = "testing" -o "$APP_VERSION_RELTYPE" = "prod-zindus" ]; then
  scp -q $XPI_FILE_NAME spring.moniker.net:/home/httpd/zindus.com/htdocs/download/xpi
  rm $XPI_FILE_NAME
  echo $XPI_FILE_NAME copied to spring.moniker.net
fi
