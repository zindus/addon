#!/bin/bash
# $Id: build-config.sh,v 1.9 2007-10-15 00:14:20 cvsuser Exp $

# Build config for the build script, build.sh. Look there for more info.

APP_NAME=zindus
APP_VERSION_NUMBER=0.6.1
APP_VERSION_RELTYPE="prod-zindus" # must be one of "testing", "prod-zindus" or "prod-amo"
CHROME_PROVIDERS="content locale"
CLEAN_UP=1
ROOT_FILES="README"
ROOT_DIRS="defaults"
BEFORE_BUILD=./build-update-version-in-source.sh
BEFORE_JAR=
AFTER_BUILD=./build-after.sh
