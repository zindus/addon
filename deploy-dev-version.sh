#!/bin/bash
# $Id: deploy-dev-version.sh,v 1.1 2007-12-31 04:24:42 cvsuser Exp $

. deploy-common.sh

export APP_VERSION_RELTYPE="dev"

./build.sh

# echo -n "have you signed update.rdf with mccoy ? "
# read is_signed
is_signed="y"
if [ "$is_signed" == "y" ]; then

	APPVERSION=`get_appversion`

	generate_and_copy_rdfs $APPVERSION 'dev'

else
	echo Aborted
fi
