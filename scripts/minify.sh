#!/bin/sh

pushd `dirname $0`

TOOLS_DIR=../tools
SRC_DIR=../src
OBJ_DIR=$SRC_DIR/obj

if [ ! -f $OBJ_DIR ]; then mkdir $OBJ_DIR; fi

# Minify each Chatmore component.
java -jar $TOOLS_DIR/yuicompressor-2.4.7.jar --type js --charset UTF-8 -v $SRC_DIR/chatmoreState.js > $OBJ_DIR/chatmoreState.min.js
java -jar $TOOLS_DIR/yuicompressor-2.4.7.jar --type js --charset UTF-8 -v $SRC_DIR/chatmore.js > $OBJ_DIR/chatmore.min.js
java -jar $TOOLS_DIR/yuicompressor-2.4.7.jar --type js --charset UTF-8 -v $SRC_DIR/chatmoreUI.js > $OBJ_DIR/chatmoreUI.min.js
java -jar $TOOLS_DIR/yuicompressor-2.4.7.jar --type js --charset UTF-8 -v $SRC_DIR/chatmoreUI.fullpage.js > $OBJ_DIR/chatmoreUI.fullpage.min.js

# Combine all Chatmore scripts into chatmoreAll.min.js.
cat $OBJ_DIR/chatmoreState.min.js $OBJ_DIR/chatmore.min.js $OBJ_DIR/chatmoreUI.min.js $OBJ_DIR/chatmoreUI.fullpage.min.js > $OBJ_DIR/chatmoreAll.min.js

popd
