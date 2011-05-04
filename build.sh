#!/bin/bash
# build.sh -- builds JAR and XPI files for mozilla extensions
#   by Nickolay Ponomarev <asqueella@gmail.com>
#   (original version based on Nathan Yergler's build script)
# Most recent version is at <http://kb.mozillazine.org/Bash_build_script>
# set -x
set -e

# This script assumes the following directory structure:
# ./
#   chrome.manifest (optional - for newer extensions)
#   install.rdf
#   (other files listed in $ROOT_FILES)
#
#   content/    |
#   locale/     |} these can be named arbitrary and listed in $CHROME_PROVIDERS
#   skin/       |
#
#   defaults/   |
#   components/ |} these must be listed in $ROOT_DIRS in order to be packaged
#   ...         |
#
# It uses a temporary directory ./build when building; don't use that!
# Script's output is:
# ./$APP_NAME-$PLATFORM_ID-$VERSION.xpi
# ./$APP_NAME.jar  (only if $KEEP_JAR=1)
# ./files -- the list of packaged files
#
# Note: It modifies chrome.manifest when packaging so that it points to 
#       chrome/$APP_NAME.jar!/*
#
# $Id: build.sh,v 1.24 2011-05-04 22:06:13 cvsuser Exp $

#
# default configuration file is ./build-config.sh, unless another file is 
# specified in command-line. Available config variables:
APP_NAME=           # short-name, jar and xpi files name. Must be lowercase with no spaces
APP_VERSION_NUMBER= # eg: 0.1
APP_VERSION_TESTING= # either empty or a date string depending on whether we're cutting a production or testing release
CHROME_PROVIDERS=   # which chrome providers we have (space-separated list)
CLEAN_UP=           # delete the jar / "files" when done?       (1/0)
ROOT_FILES=         # put these files in root of xpi (space separated list of leaf filenames)
ROOT_DIRS=          # ...and these directories       (space separated list)
BEFORE_BUILD=       # run this before building       (bash command)
BEFORE_JAR=         # run this before making the jar (bash command)
AFTER_BUILD=        # ...and this after the build    (bash command)
PLATFORM_ID=tb+sm+pb+sb # eg: linux-i686 or win.  Don't set it to the empty string here as we want it to be passed in via the environment.

if [ -z $1 ]; then
  . ./build-config.sh
else
  . $1
fi

. deploy-common.sh

if [ "$APP_VERSION_RELTYPE" = "testing" -o "$APP_VERSION_RELTYPE" = "dev" ]; then
	APP_VERSION_NUMBER=$APP_VERSION_NUMBER.`date +%Y%m%d.%H%M%S`
fi

XPI_FILE_NAME=$APP_NAME-$APP_VERSION_NUMBER-$PLATFORM_ID.xpi

export APP_NAME APP_VERSION_NUMBER XPI_FILE_NAME APP_VERSION_RELTYPE PLATFORM_ID # BEFORE_BUILD or AFTER_BUILD might use these...

if [ -z $APP_NAME ]; then
  echo "You need to create build config file first!"
  echo "Read comments at the beginning of this script for more info."
  exit;
fi

ROOT_DIR=`pwd`
TMP_DIR=$ROOT_DIR/build

if [ -z "$APP_VERSION_RELTYPE" ]; then
	APP_VERSION_RELTYPE="dev" # must be one of "dev", "testing", "prod-zindus" or "prod-amo"

	echo build-config.sh: APP_VERSION_RELTYPE was undefined, setting to $APP_VERSION_RELTYPE
else
	echo build-config.sh: APP_VERSION_RELTYPE came from the environment: $APP_VERSION_RELTYPE
fi


# remove any left-over files from previous build
rm -f $APP_NAME.jar $XPI_FILE_NAME files
rm -rf $TMP_DIR

$BEFORE_BUILD

[ $? -ne "0" ] && exit 1

mkdir -p -v $TMP_DIR/chrome

$BEFORE_JAR

# generate the JAR file, excluding CVS, SVN, and temporary files
JAR_FILE=$TMP_DIR/chrome/$APP_NAME.jar
echo "Generating $JAR_FILE..."
for CHROME_SUBDIR in $CHROME_PROVIDERS; do
  find $CHROME_SUBDIR \( -path '*CVS*' -o -path '*.git*' -o -path '*.svn*' -o -path '*.swp' \) -prune -o -type f -print | grep -v \~ >> files
done

zip -0 -r $JAR_FILE -@ < files

# prepare components and defaults
echo "Copying various files to $TMP_DIR folder..."
for DIR in $ROOT_DIRS; do
  mkdir $TMP_DIR/$DIR
  FILES="`find $DIR \( -path '*CVS*' -o -path '*.svn*' -o -path '*.swp' \) -prune -o -type f -print | grep -v \~`"
  echo $FILES >> files
  tar cf - $FILES | (cd $TMP_DIR; tar xvf -)
done

# update.rdf
#
#set -x
#set +x
DOWNLOAD_DIR=http://www.zindus.com/download/xpi
app[0]='tb';
app[1]='sm';
app[2]='pb';
app[3]='pe';
app[4]='sb';
# app[4]='ff';

app_id[0]='.3550f703-e582-4d05-9a08-453d09bdfdc6.';
app_id[1]='.92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a.';
app_id[2]='postbox@postbox-inc.com';
app_id[3]='express@postbox-inc.com';
app_id[4]='.ee53ece0-255c-4cc6-8a7e-81a8b6e5ba2c.';
# app_id[4]='.ec8030f7-c20a-464f-9b0e-13a3a9e97384.';
# when you get around to adding firefox: (1) uncomment above (2) change app_indexes (3) add a stanza to update.rdf (4) add to install.rdf

app_indexes="0 1 2 3 4"

for i in $app_indexes; do
  minversion[$i]=`$SED "s#<em:minVersion>(.*)</em:minVersion>.*${app[$i]}#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`
  maxversion[$i]=`$SED "s#<em:maxVersion>(.*)</em:maxVersion>.*${app[$i]}#fredfred \1#" < install.rdf | awk '/fredfred/ { print $2; }'`
done

for i in $app_indexes; do
  $SED_IN_PLACE "s#(em:id=\"${app_id[$i]}\")#\1 em:maxVersion=\"${maxversion[$i]}\" em:minVersion=\"${minversion[$i]}\"#" update.rdf
done

$SED_IN_PLACE "/  em:maxVersion/d" update.rdf
$SED_IN_PLACE "/  em:minVersion/d" update.rdf

$SED_IN_PLACE "s#em:version=\"(.*)\"#em:version=\"$APP_VERSION_NUMBER\"#" update.rdf
$SED_IN_PLACE "s#em:updateLink=\"(.*)\"#em:updateLink=\"$DOWNLOAD_DIR/$XPI_FILE_NAME\"#" update.rdf

# install.rdf
#
$SED_IN_PLACE "s#<em:version>(.*)</em:version>#<em:version>$APP_VERSION_NUMBER</em:version>#" install.rdf

updateURL="    <em:updateURL>http://www.zindus.com/download/xpi-update-rdf.php?item_id=%ITEM_ID%\&amp;item_version=%ITEM_VERSION%\&amp;item_status=%ITEM_STATUS%\&amp;app_id=%APP_ID%\&amp;app_os=%APP_OS%\&amp;app_abi=%APP_ABI%"
updateKey="    <em:updateKey>MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCyC+XK8GT8SJpfhxXZu7MM+ALv/OmcRfP3m2m6DzWrB121ToA3zEfUOfD568gDuKExpptuomgNyYRUB32yCQfmHryMS4fXXuG49JGlQq7kMNXW+aSp7IE5Q6DExVhLZ0jOSXk+alWbTWLFpXNLuI0n72T291Otmq0YEyrlqx3UbwIDAQAB</em:updateKey>"

if [ "$APP_VERSION_RELTYPE" = "prod-zindus" -o "$APP_VERSION_RELTYPE" = "testing" -o "$APP_VERSION_RELTYPE" = "dev" ]; then
	$SED_IN_PLACE "s#.*<em:updateURL>.*</em:updateURL>.*#$updateURL\&amp;reltype=$APP_VERSION_RELTYPE</em:updateURL>#" install.rdf
	$SED_IN_PLACE "s#.*<em:updateKey>.*</em:updateKey>.*#$updateKey#" install.rdf
elif [ "$APP_VERSION_RELTYPE" = "prod-amo" ]; then
	$SED_IN_PLACE "s#.*<em:updateURL>.*</em:updateURL>.*#    <!-- <em:updateURL></em:updateURL> -->#" install.rdf
	$SED_IN_PLACE "s#.*<em:updateKey>.*</em:updateKey>.*#    <!-- <em:updateKey></em:updateKey> -->#" install.rdf
else
	echo Undefined APP_VERSION_RELTYPE - aborting
	exit 1
fi

# Copy other files to the root of future XPI.
for ROOT_FILE in $ROOT_FILES install.rdf chrome.manifest; do
  cp -v $ROOT_FILE $TMP_DIR
  if [ -f $ROOT_FILE ]; then
    echo $ROOT_FILE >> files
  fi
done

cd $TMP_DIR

if [ -f "chrome.manifest" ]; then
  echo "Preprocessing chrome.manifest..."
  # You think this is scary?
  #s/^(content\s+\S*\s+)(\S*\/)$/\1jar:chrome\/$APP_NAME\.jar!\/\2/
  #s/^(skin|locale)(\s+\S*\s+\S*\s+)(.*\/)$/\1\2jar:chrome\/$APP_NAME\.jar!\/\3/
  #
  # Then try this! (Same, but with characters escaped for bash :)
  # sed -i "" -E s/^\(content\\s+\\S*\\s+\)\(\\S*\\/\)$/\\1jar:chrome\\/$APP_NAME\\.jar!\\/\\2/ chrome.manifest
  # sed -i "" -E s/^\(skin\|locale\)\(\\s+\\S*\\s+\\S*\\s+\)\(.*\\/\)$/\\1\\2jar:chrome\\/$APP_NAME\\.jar!\\/\\3/ chrome.manifest
if [ "$OS" = "Darwin" ]; then
  $SED_IN_PLACE s/^\(content\[\ \\t\]+\[^\ \\t\]*\[\ \\t\]+\)\(content.*$\)/\\1jar:chrome\\/$APP_NAME\\.jar!\\/\\2/ chrome.manifest
  $SED_IN_PLACE s/^\(skin.*\)\(skin.*$\)/\\1jar:chrome\\/$APP_NAME\\.jar!\\/\\2/ chrome.manifest
  $SED_IN_PLACE s/^\(locale.*\)\(locale.*$\)/\\1jar:chrome\\/$APP_NAME\\.jar!\\/\\2/ chrome.manifest
elif [ "$OS" = "CYGWIN_NT-5.0" ]; then
  $SED_IN_PLACE s/^\(content\\s+\\S*\\s+\)\(\\S*\\/\)$/\\1jar:chrome\\/$APP_NAME\\.jar!\\/\\2/ chrome.manifest
  $SED_IN_PLACE s/^\(skin\|locale\)\(\\s+\\S*\\s+\\S*\\s+\)\(.*\\/\)$/\\1\\2jar:chrome\\/$APP_NAME\\.jar!\\/\\3/ chrome.manifest
fi

  # (it simply adds jar:chrome/whatever.jar!/ at appropriate positions of chrome.manifest)
fi

# generate the XPI file
echo "Generating $XPI_FILE_NAME..."
zip -r ../$XPI_FILE_NAME *

if [ "$OS" = "Darwin" ]; then
	# mccoy on osx throws an exception on window.close
	# so I've commented that out and instead start it in the background and kill it here
	# 
	/Applications/McCoy.app/Contents/MacOS/mccoy -console \
	                                             -sign file:///Users/leni/wrk/consile/xpi/thunderbird/update.rdf \
												 -key zindus-xpi-updatekey \
												 -addOnFileName file:///Users/leni/wrk/consile/xpi/thunderbird/$XPI_FILE_NAME &
	pid=$!
	sleep 3
	kill $pid
elif [ "$OS" = "CYGWIN_NT-5.0" ]; then
	/cygdrive/c/leni/bin/mccoy/mccoy/mccoy.exe -sign file:///c:/cygwin/home/L/wrk/consile/xpi/thunderbird/update.rdf \
		                                       -key zindus-xpi-updatekey \
	                                           -addOnFileName file:///c:/cygwin/home/L/wrk/consile/xpi/thunderbird/$XPI_FILE_NAME
fi
cd "$ROOT_DIR"

echo "Cleanup..."
if [ $CLEAN_UP = 0 ]; then
  # save the jar file
  mv $TMP_DIR/chrome/$APP_NAME.jar .
else
  rm ./files
fi

# remove the working files
rm -rf $TMP_DIR
echo "Done!"

$AFTER_BUILD
