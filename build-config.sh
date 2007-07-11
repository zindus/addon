#!/bin/bash

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="components defaults"
BEFORE_BUILD=
AFTER_BUILD=
VERSION_NUMBER=`perl -e 'while (<>) { if (/^\s*\<em:version\>(.*)\<\/em:version\>/) { print $1 . "\n"; } }' < install.rdf`
