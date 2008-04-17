#!/bin/bash
# $Id: deploy-amo-version.sh,v 1.2 2008-04-17 20:53:09 cvsuser Exp $

export APP_VERSION_RELTYPE="prod-amo"

echo -n "have you already deployed the prod version (ie you have already updated APP_VERSION_NUMBER and the source got tagged in cvs) ? "
read is_version_updated
if [ "$is_version_updated" == "y" ]; then

	./build.sh

else
	echo -n "ok, have you edited build-config.sh to update APP_VERSION_NUMBER ? "

	read is_version_updated

	if [ "$is_version_updated" == "y" ]; then

		./build.sh

		APPVERSION=`get_appversion`

		RELEASE_TAG=`echo $APPVERSION | sed 's/\./_/g'`
		RELEASE_TAG="release-"$RELEASE_TAG
		echo release tag is $RELEASE_TAG

		cvs commit -m ""
		cvs tag $RELEASE_TAG
	else
		echo aborted.
	fi
fi

exit

fi

exit
