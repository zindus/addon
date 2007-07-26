#!/bin/bash
# $Id: build-config.sh,v 1.4 2007-07-26 21:16:14 cvsuser Exp $

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=`perl -e 'while (<>) { if (/^\s*\<em:version\>(.*)\<\/em:version\>/) { print $1 . "\n"; } }' < install.rdf`
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=
BEFORE_JAR=./build-sed-script.sh
AFTER_BUILD=
