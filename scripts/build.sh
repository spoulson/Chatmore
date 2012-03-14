#!/bin/sh

pushd `dirname $0`

BUILD_DIR=../build
SRC_DIR=../src
OBJ_DIR=$SRC_DIR/obj

# Clean build dir.
if [ ! -d $BUILD_DIR ]; then mkdir $BUILD_DIR; fi
rm -rf $BUILD_DIR/*

# Minify javascript.
./minify.sh

# Copy src files.
rsync -av $SRC_DIR/* $BUILD_DIR --exclude=chatmore*.js --exclude=obj

# Copy minified output.
cp -a $OBJ_DIR/chatmoreAll.min.js $BUILD_DIR

popd
