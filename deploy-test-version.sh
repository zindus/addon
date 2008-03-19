#!/bin/bash
# $Id: deploy-test-version.sh,v 1.9 2008-03-19 22:05:10 cvsuser Exp $

. deploy-common.sh

export APP_VERSION_RELTYPE="testing"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	APPVERSION=`get_appversion`

	generate_and_copy_rdfs $APPVERSION 'testing'

	cvs commit -m ""

else
	echo Aborted
fi
