#!/bin/bash
# $Id: deploy-test-version.sh,v 1.8 2007-12-13 20:55:08 cvsuser Exp $

. deploy-common.sh

export APP_VERSION_RELTYPE="testing"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	APPVERSION=`get_appversion`

	generate_and_copy_rdfs $APPVERSION 'testing'

else
	echo Aborted
fi
