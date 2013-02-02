# Makefile for Chatmore.
# https://github.com/spoulson/Chatmore
# Shawn Poulson <spoulson@explodingcoder.com>

OBJ_DIR = obj
BUILD_DIR = ../build
MINIFY = java -jar ../tools/yuicompressor-2.4.7.jar
MINIFY_OPTS = --type js --charset UTF-8 -v

all: build

#
# Minify javascript rules
#
$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

$(OBJ_DIR)/chatmore.min.js: chatmore.js
	$(MINIFY) $(MINIFY_OPTS) -o $@ $<
#	cp $< $@

$(OBJ_DIR)/chatmoreState.min.js: chatmoreState.js
	$(MINIFY) $(MINIFY_OPTS) -o $@ $<
#	cp $< $@

$(OBJ_DIR)/chatmoreCLI.min.js: chatmoreCLI.js
	$(MINIFY) $(MINIFY_OPTS) -o $@ $<
#	cp $< $@

$(OBJ_DIR)/chatmorePresentation.fullpage.min.js: chatmorePresentation.fullpage.js
	$(MINIFY) $(MINIFY_OPTS) -o $@ $<
#	cp $< $@

# Combine all Chatmore javascript into one file.
$(OBJ_DIR)/chatmoreAll.min.js: $(OBJ_DIR)/chatmoreState.min.js $(OBJ_DIR)/chatmore.min.js $(OBJ_DIR)/chatmoreCLI.min.js $(OBJ_DIR)/chatmorePresentation.fullpage.min.js
	cat $^ > $@

#
# Build
#
build: $(STATIC_SRC) $(OBJ_DIR) $(OBJ_DIR)/chatmoreAll.min.js
	rm -rf $(BUILD_DIR)
	rsync -av . $(BUILD_DIR) --exclude Makefile --exclude $(OBJ_DIR) --exclude chatmoreState.js --exclude chatmore.js --exclude chatmoreCLI.js --exclude chatmorePresentation.fullpage.js
	rsync -av $(OBJ_DIR)/chatmoreAll.min.js $(BUILD_DIR)

#
# Clean
#
clean:
	rm -rf $(OBJ_DIR) $(BUILD_DIR)
