#!/bin/bash
# $Id: build-update-version-in-source.sh,v 1.1 2007-09-20 12:00:26 cvsuser Exp $

filename=content/const.js
cp $filename /tmp
sed "s#const APP_VERSION_NUMBER=.*#const APP_VERSION_NUMBER=\"$APP_VERSION_NUMBER\";        // this line generated by build.sh#" < $filename > asd
mv asd $filename
