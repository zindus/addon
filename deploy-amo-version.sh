#!/bin/bash
# $Id: deploy-amo-version.sh,v 1.1 2007-12-02 07:07:57 cvsuser Exp $

export APP_VERSION_RELTYPE="prod-amo"

echo -n "have you already deployed the prod version (which implies that you updated APP_VERSION_NUMBER and tagged the source in cvs) ? "
read is_version_updated
if [ "$is_version_updated" == "y" ]; then

	./build.sh

else
	echo aborted.
fi

exit
