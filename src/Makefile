# Makefile for Chatmore.
# https://github.com/spoulson/Chatmore
# Shawn Poulson <spoulson@explodingcoder.com>

OBJ_DIR := obj
BUILD_DIR := ../build
MINIFY := java -jar ../tools/yuicompressor-2.4.7.jar
MINIFY_OPTS := --type js --charset UTF-8 -v

all: build

#
# Minify javascript rules
#
$(OBJ_DIR)/chatmore.min.js: chatmore.js
	$(MINIFY) $(MINIFY_OPTS) $< > $@

$(OBJ_DIR)/chatmoreState.min.js: chatmoreState.js
	mkdir -p $(OBJ_DIR)
	$(MINIFY) $(MINIFY_OPTS) $< > $@

$(OBJ_DIR)/chatmoreUI.min.js: chatmoreUI.js
	$(MINIFY) $(MINIFY_OPTS) $< > $@

$(OBJ_DIR)/chatmoreUI.fullpage.min.js: chatmoreUI.fullpage.js
	$(MINIFY) $(MINIFY_OPTS) $< > $@

# Combine all Chatmore javascript into one minified file.
$(OBJ_DIR)/chatmoreAll.min.js: $(OBJ_DIR)/chatmoreState.min.js $(OBJ_DIR)/chatmore.min.js $(OBJ_DIR)/chatmoreUI.min.js $(OBJ_DIR)/chatmoreUI.fullpage.min.js
	cat $^ > $@

#
# Build
#
build: $(STATIC_SRC) $(OBJ_DIR)/chatmoreAll.min.js
	rm -rf $(BUILD_DIR)
	mkdir -p $(BUILD_DIR)
	rsync -av . $(BUILD_DIR) --exclude Makefile --exclude $(OBJ_DIR) --exclude chatmoreState.js --exclude chatmore.js --exclude chatmoreUI.js --exclude chatmoreUI.fullpage.js
	cp $(OBJ_DIR)/chatmoreAll.min.js $(BUILD_DIR)

#
# Clean
#
clean:
	rm -rf chatmoreState.min.js chatmore.min.js chatmoreUI.min.js chatmoreUI.fullpage.min.js $(OBJ_DIR) $(BUILD_DIR)
