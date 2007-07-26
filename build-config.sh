#!/bin/bash
# $Id: build-config.sh,v 1.5 2007-07-26 21:47:53 cvsuser Exp $

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=`perl -e 'while (<>) { if (/^\s*\<em:version\>(.*)\<\/em:version\>/) { print $1 . "\n"; } }' < install.rdf`
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=./build-sanity-check.sh
BEFORE_JAR=
AFTER_BUILD=
