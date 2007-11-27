#!/bin/bash
# $Id: build-config.sh,v 1.18 2007-11-27 21:51:04 cvsuser Exp $

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=0.6.8
# APP_VERSION_RELTYPE="testing" # must be one of "testing", "prod-zindus" or "prod-amo"
APP_VERSION_RELTYPE="prod-zindus"
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=./build-update-version-in-source.sh
BEFORE_JAR=
AFTER_BUILD=./build-after.sh
