#!/bin/bash
# $Id: build-config.sh,v 1.64 2010-07-06 05:43:05 cvsuser Exp $

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=0.8.21
CHROME_PROVIDERS="content locale skin"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=./build-update-version-in-source.sh
BEFORE_JAR=
AFTER_BUILD=./build-after.sh

if [ -z "$APP_VERSION_RELTYPE" ]; then
	APP_VERSION_RELTYPE="dev" # must be one of "dev", "testing", "prod-zindus" or "prod-amo"

	echo build-config.sh: APP_VERSION_RELTYPE was undefined, setting to $APP_VERSION_RELTYPE
else
	echo build-config.sh: APP_VERSION_RELTYPE came from the environment: $APP_VERSION_RELTYPE
fi
