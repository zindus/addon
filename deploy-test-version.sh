#!/bin/bash
# $Id: deploy-test-version.sh,v 1.10 2008-11-23 05:46:57 cvsuser Exp $

. deploy-common.sh

export APP_VERSION_RELTYPE="testing"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	APPVERSION=`get_appversion`
	PLATFORM_ID=`get_platform_id`

	generate_and_copy_rdfs $APPVERSION $PLATFORM_ID 'testing'

	cvs commit -m ""

else
	echo Aborted
fi
