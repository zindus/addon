#!/bin/bash

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=`perl -e 'while (<>) { if (/^\s*\<em:version\>(.*)\<\/em:version\>/) { print $1 . "\n"; } }' < install.rdf`
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=./sed-script.sh
AFTER_BUILD=
