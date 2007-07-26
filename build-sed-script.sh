#!/bin/sh
# echo sed-script entered...

# for debugging...
# env | grep APP_
# APP_NAME=zindus 
# APP_VERSION_NUMBER=0.44

variables_to_replace="APP_NAME APP_VERSION_NUMBER"

# look for the files that contain the strings that we're going to search and replace...
#

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

# echo sed-script exiting...
