#!/bin/sh
# $Id: build-sed-script.sh,v 1.2 2007-07-26 21:15:30 cvsuser Exp $

variables_to_replace="APP_NAME APP_VERSION_NUMBER"

cd content

files_to_search_replace=
for x in $variables_to_replace; do
  files_to_search_replace="${files_to_search_replace} `grep -l @${x}@ *`"
done

for x in $variables_to_replace; do
	for y in $files_to_search_replace; do
		sed "s/@${x}@/${!x}/g" $y > /tmp/asd
		mv /tmp/asd $y
	done
done
