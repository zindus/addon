#!/bin/bash
# $Id: deploy-dev-version.sh,v 1.2 2008-11-23 05:46:57 cvsuser Exp $

. deploy-common.sh

export APP_VERSION_RELTYPE="dev"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	APPVERSION=`get_appversion`
	PLATFORM_ID=`get_platform_id`

	echo PLATFORM_ID is $PLATFORM_ID

	generate_and_copy_rdfs $APPVERSION $PLATFORM_ID 'dev'

else
	echo Aborted
fi
