// Default layout plugin for Chatmore.
(function () {
    //
    // Private static variables.
    //
    var layout;
    
    // IRC client message templates.
    var templates = {
        title: '<span>{{if messageCount == 1}}A new message has arrived! -- ' +
            '{{else messageCount > 1}}${messageCount} new messages have arrived! -- ' +
            '{{/if}}' +
            '${self.options.title} - ${self.irc.state.server}:${self.irc.state.port}</span>',
        timestamp: '<span class="timestamp" title="${self.getLongTimestamp()}">[${self.getShortTimestamp()}]&nbsp;</span>',
        bullet: '&bull;&bull;&bull;',
        notePrefix: '<span class="prefix">{{tmpl "bullet"}}</span>',
        error: '{{tmpl "timestamp"}}<span class="msg ERROR">' +
            '{{tmpl "notePrefix"}} <span class="message">${layout.htmlEncode(message)}</span>' +
            '</span>',
        usage: '{{tmpl "timestamp"}}<span class="msg usage">' +
            '{{tmpl "notePrefix"}} <span class="message">${layout.htmlEncode(message)}</span>' +
            '</span>',
        help: '{{tmpl "timestamp"}}<span class="msg help">' +
            '{{tmpl "notePrefix"}} <span class="message">${layout.htmlEncode(message)}</span>' +
            '</span>',
        serverMsg: '{{tmpl "timestamp"}}<span class="msg serverMsg">' +
            '{{tmpl "notePrefix"}} ' +
            '{{if channel}}&lt;<span class="channel">${channel}</span>&gt; {{/if}}' +
            '<span class="message">' +
            '{{if number}}${number} {{/if}}' +
            '${layout.htmlEncode(message)}</span>' +
            '</span>',
        clientMsg: '{{tmpl "timestamp"}}<span class="msg clientMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">${layout.htmlEncode(message)}</span>' +
            '</span>',
        outgoingChannelMsg: '{{tmpl "timestamp"}}<span class="msg channelMsg">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        outgoingChannelAction: '{{tmpl "timestamp"}}<span class="msg channelMsg action">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        outgoingChannelNotice: '{{tmpl "timestamp"}}<span class="msg channelNotice outgoing">' +
            '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        outgoingPrivateMsg: '{{tmpl "timestamp"}}<span class="msg privateMsg outgoing">' +
            '<span class="prefix">&bull;<span class="nick">${msg.info.target}</span>&bull;</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        outgoingPrivateAction: '{{tmpl "timestamp"}}<span class="msg privateMsg outgoing action">' +
            '<span class="prefix">&bull;<span class="nick">${msg.info.target}</span>&bull; <span class="nick">${msg.prefixNick}</span></span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        outgoingPrivateNotice: '{{tmpl "timestamp"}}<span class="msg privateNotice outgoing">' +
            '<span class="prefix">-<span class="nick">${msg.info.target}</span>-</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingChannelMsg: '{{tmpl "timestamp"}}<span class="msg channelMsg">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingChannelAction: '{{tmpl "timestamp"}}<span class="msg channelMsg action">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingChannelNotice: '{{tmpl "timestamp"}}<span class="msg channelNotice incoming">' +
            '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingPrivateMsg: '{{tmpl "timestamp"}}<span class="msg privateMsg incoming">' +
            '<span class="prefix">&bull;<span class="nick">${msg.prefixNick}</span>&bull;</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingPrivateAction: '{{tmpl "timestamp"}}<span class="msg privateMsg incoming action">' +
            '<span class="prefix">&bull; <span class="nick">${msg.prefixNick}</span></span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        incomingPrivateNotice: '{{tmpl "timestamp"}}<span class="msg privateNotice incoming">' +
            '<span class="prefix">-<span class="nick">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${layout.htmlEncode(msg.info.text)}</span>' +
            '</span>',
        queryOff: '{{tmpl "timestamp"}}<span class="msg queryMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.isChannel(prevTarget)}}' +
                'You are no longer talking on channel <span class="channel">${prevTarget}</span>' +
            '{{else}}' +
                'Ending conversation with <span class="nick">${prevTarget}</span>' +
            '{{/if}}' +
            '</span></span>',
        query: '{{tmpl "timestamp"}}<span class="msg queryMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.isChannel(target)}}' +
                'You are now talking on channel <span class="channel">${target}</span>' +
            '{{else}}' +
                'Starting conversation with <span class="nick">${target}</span>' +
            '{{/if}}' +
            '</span></span>',
        join: '{{tmpl "timestamp"}}<span class="msg JOIN">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> (${msg.prefixUser}@${msg.prefixHost}) has joined the channel</span>' +
            '</span>',
        leave: '{{tmpl "timestamp"}}<span class="msg PART">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> has left the channel{{if !!msg.info.comment}}: ${msg.info.comment}{{/if}}</span>' +
            '</span>',
        kick: '{{tmpl "timestamp"}}<span class="msg KICK">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.kick.channel}</span>&gt;</span> ' +
            '<span class="message">' +
            '{{if self.stricmp(self.irc.state.nick, msg.info.kick.nick) === 0}}' +
                'You have been kicked from the channel by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.kick.channel)}">${msg.prefixNick}</span>' +
            '{{else}}' +
                '<span class="nick ${layout.getColorizeCSSClass(self, msg.info.kick.nick, msg.info.kick.channel)}">${msg.info.kick.nick}</span> has been kicked from the channel by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.kick.channel)}">${msg.prefixNick}</span>' +
            '{{/if}}' +
            '{{if msg.info.comment !== undefined && msg.info.comment !== msg.prefixNick}}: ${layout.htmlEncode(msg.info.comment)}{{/if}}</span>' +
            '</span>',
        nick: '{{tmpl "timestamp"}}<span class="msg NICK">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.stricmp(self.irc.state.nick, msg.prefixNick) === 0}}' +
                'Nick changed to <span class="nick">${msg.info.nick}</span>' +
            '{{else}}' +
                '<span class="nick">${msg.prefixNick}</span> is now known as <span class="nick">${msg.info.nick}</span>' +
            '{{/if}}' +
            '</span></span>',
        nickInUse: '{{tmpl "timestamp"}}<span class="msg serverMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">Nickname <span class="nick">${msg.info.nick}</span> is already in use.</span>' +
            '</span>',
        notopic: '{{tmpl "timestamp"}}<span class="msg TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message no-decorate">No topic is set</span>' +
            '</span>',
        topic: '{{tmpl "timestamp"}}<span class="msg TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message">' +
            '{{if msg.info.topic !== undefined}}' +
                '<span class="no-decorate">The current topic is:</span> <span class="topicMessage">${layout.htmlEncode(msg.info.topic)}</span>' +
            '{{else}}' +
                '<span class="message no-decorate">No topic is set</span>' +
            '{{/if}}' +
            '</span>' +
            '</span>',
        changeTopic: '{{tmpl "timestamp"}}<span class="msg TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="no-decorate"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> ' +
            '{{if msg.info.topic == ""}}' +
                'has cleared the topic</span>' +
            '{{else}}' +
                'has changed the topic to: </span><span class="topicMessage">${layout.htmlEncode(msg.info.topic)}</span>' +
            '{{/if}}' +
            '</span></span>',
        topicSetBy: '{{tmpl "timestamp"}}<span class="msg TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message no-decorate">Topic set by <span class="nick ${layout.getColorizeCSSClass(self, msg.info.nick, msg.info.channel)}">${msg.info.nick}</span> on <span class="time">${self.formatTime(msg.info.time)}</span></span>' +
            '</span>',
        who: '{{tmpl "timestamp"}}<span class="msg WHO">' +
            '{{tmpl "notePrefix"}} <span class="message">WHO for <span class="nick ${layout.getColorizeCSSClass(self, msg.info.nick, msg.info.channel)}">${msg.info.nick}</span>: "${msg.info.realname}" ${msg.info.user}@${msg.info.host} on server ${msg.info.server}' +
            '</span>',
        serverTime: '{{tmpl "timestamp"}}<span class="msg TIME">' +
            '{{tmpl "notePrefix"}} <span class="message">Server time for <span class="server">${msg.info.server}</span>: <span class="time">${msg.info.timeString}</span></span>' +
            '</span>',
        quit: '{{tmpl "timestamp"}}<span class="msg QUIT">' +
            '{{tmpl "notePrefix"}} <span class="message">Signoff: <span class="nick">${msg.prefixNick}</span> (${msg.info.message})</span>' +
            '</span>',
        mode: '{{tmpl "timestamp"}}<span class="msg MODE">' +
            '{{tmpl "notePrefix"}} <span class="message">Mode change "<span class="modeString">${msg.info.mode}</span>" for ' +
            '{{if self.isChannel(msg.info.target)}}' +
                'channel <span class="channel">${msg.info.target}</span> ' +
                'by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span>' +
            '{{else}}'  +
                'user <span class="nick">${msg.info.target}</span> ' +
                'by <span class="nick">${msg.prefixNick}</span></span>' +
            '{{/if}}' +
            '</span>',
        list: '{{tmpl "timestamp"}}<span class="msg LIST">' +
            '{{tmpl "notePrefix"}} <span class="message"><span class="no-decorate"><span class="channel">${msg.info.channel}</span> (${msg.info.memberCount}): </span>${layout.htmlEncode(msg.info.topic)}</span>' +
            '</span>',
        retryRegistration: '{{tmpl "timestamp"}}<span class="msg clientMsg">' +
            '{{tmpl "notePrefix"}} <span class="message no-decorate">Retrying registration with nickname <span class="nick">${self.irc.state.nick}</span></span>' +
            '</span>'
    };

    //                  [-scheme---------][-hostname------------][-port][-path----------][-querystring-------------------------------------------------------][anchor]
    var linkifyRegex = /\b([a-z]{2,8}:\/\/([\w\-_]+(\.[\w\-_]+)*)(:\d+)?(\/[^\s\?\/<>]*)*(\?(\&)*([^\s=&#<>]+(=[^\s=&#<>]*)?(&[^\s=&#<>]+(=[^\s=&#<>]*)?)*)?)?(#\S+)?)/i;

    // Channel recognition regex.
    var channelRegex = /(^|[\s,:\cg])(#[^\s,:\cg]+)\b/;
    
    // History of users for autoreply suggestions.
    var autoReplyList = [ ];

    // Autoreply index against autoReplyList array.
    var autoReplyIndex;
    
    // Auto complete setTimeout handle.
    var autoCompleteTimeoutHandle;
    
    // Auto complete list of term objects in the form:
    // { type: 'nick'|'channel', value: string }
    var autoCompleteList;
    
    // Auto complete suggest index against list of terms.
    var autoCompleteIndex;
    
    // Auto complete suggest index of value placed in userEntry.
    var autoCompleteTermIndex;

    // Current term string in userEntry when autoComplete presents suggestions.
    var autoCompleteTerm;
    
    // User provided term used for scanning autocomplete suggestions.
    // This contains the initial search term the user entered when scanAutoComplete() was called.
    var autoCompleteSpec;
    
    // Starting position of autoCompleteTerm.
    var autoCompleteTermPosition;
    
    // Function generated at runtime when tooltip is displayed.
    // Usage: autoCompleteTooltipScrollToTerm(termIndex);
    var autoCompleteTooltipScrollToTerm;

    // User entry history log.  First entry is scratch buffer from last unsent entry.
    var userEntryHistory = [''];
    var userEntryHistoryIndex;
    
    // Console message counter.
    var consoleLineCount = 0;
    
    //
    // Private methods.
    //
    // Write HTML line to ircConsole.
    var writeLine = function (self, html) {
        layout.messageCount++;
        consoleLineCount++;
        incrementNotificationMessageCount(self);

        var ircContent = self.ircElement.find('.ircConsole .content');
        var lineElement;

        var write = function (element) {
            // Is the console's scroll within 4 pixels from the bottom?
            var atBottom = layout.isAtBottom(self);
            
            // Roll off oldest lines if at maximum lines.  Trigger roll off at threshold of overage.
            var rollOffCount = Math.max(consoleLineCount - self.options.maximumConsoleLines, 0);

            if (rollOffCount >= 20) {
                ircContent.find('.line').slice(0,rollOffCount).remove();
                consoleLineCount -= rollOffCount;
            }

            // Auto decorate nicks and channels in message.
            var channel = element.find('.prefix .channel').text();
            element.closest('.channelMsg,.privateMsg,.channelNotice,.privateNotice,.TOPIC,.LIST,.serverMsg,.clientMsg').find('.message')
                .each(function () {
                    linkifyURLs(this);
                    decorateChannels(this);
                    decorateNicks(self, this, channel);
                });
            
            // Add doubleclick handler on nick and channel to auto-query.
            element.find('.nick,.channel')
                .hover(hoverClickableHandler, leaveClickableHandler)
                .dblclick(function () { dblclickChannelNickHandler.call(this, self); });
                
            // Detect if my nick was mentioned in a channel message.
            element.closest('.channelMsg').find('.message .nick')
                .filter(function () {
                    return self.irc.state !== undefined && self.stricmp($(this).text(), self.irc.state.nick) === 0;
                })
                .first()
                .filter(function () {
                    // Check if this message is written by me.  If I wrote it, skip highlighting.
                    var prefixNick = element.find('.prefix .nick').text();
                    return self.irc.state !== undefined && self.stricmp(prefixNick, self.irc.state.nick) !== 0;
                })
                .each(function () {
                    element.closest('.channelMsg').addClass('nickHighlight');
                });

            // Add line to console.
            var lineElement = $('<div class="line"/>')
                .attr('mc', layout.messageCount)
                .append(element)
                .appendTo(ircContent);
                
            if (!layout.isWindowFocused) {
                if (layout.blurMessageCount === (layout.messageCount - 1)) {
                    var content = self.ircElement.find('.ircConsole .content');
                    content.find('.line.viewed').removeClass('viewed');
                }
                lineElement
                    .addClass('new')
                    .css('opacity', '0.5');
            }
                
            // Auto scroll to bottom if currently at bottom.
            if (atBottom) layout.scrollToBottom(self);
            
            return lineElement;
        };
        
        if (typeof(html) === 'object') {
            $.each(html, function (i, html) {
                var element = $('<div/>').append(html);
                lineElement = write(element.contents());
            });
        }
        else {
            var element = $('<div/>').append(html);
            lineElement = write(element.contents());
        }
        
        return lineElement;
    };

    // Equivalent of find("*"), but only returns text nodes.
    // Returns jQuery object.
    var findTextNodes = function (node) {
        var textNodes = $();
        
        $(node).contents().each(function () {
            if (this.nodeType === 3) {
                textNodes = textNodes.add(this);
            }
            else {
                // Recurse children.
                var childNodes = findTextNodes(this);
                if (childNodes.length > 0)
                    textNodes = textNodes.add(childNodes);
            }
        });
    
        return textNodes;
    };

    // Filter findTextNodes to only those text nodes that qualify for decoration.
    // Returns jQuery object.
    var findTextNodesForDecoration = function (el) {
        return findTextNodes(el).filter(function () {
            var $node = $(this);
            // Exclude elements tagged with no-decorate class.
            return $(this).parents('.no-decorate').length === 0;
        });
    };
    
    // Convert URL patterns into HTML links.
    var linkifyURLs = function (el) {
        findTextNodesForDecoration(el).each(function () {
            var $node = $(this);
            var $newNode = $();
            var modified = false;

            // Scan for URL substring.
            // Extract prefix text and linkified URL and add to $newNode array.
            // Repeat loop with remaining text.
            var text = $node.text();
            while (text.length > 0) {
                var linkMatch = text.match(linkifyRegex);
                if (linkMatch !== null) {
                    var prefix = text.substr(0, linkMatch.index);
                    $newNode = $newNode.add($('<span/>').text(prefix));
                
                    // Special case: strip trailing symbols that are probably not intended as part of the URL.
                    var url = linkMatch[0];
                    var trailingText = url.match(/[)>,\.;:'"]+$/);
                    if (trailingText !== null) url = url.substr(0, url.length - trailingText[0].length);
                    $newNode = $newNode.add($('<a/>')
                        .attr('href', url)
                        .attr('target', '_blank')
                        .attr('class', 'no-decorate')
                        .text(url)
                    );

                    text = text.substr(linkMatch.index + url.length);
                
                    modified = true;
                }
                else {
                    // No matches.
                    $newNode = $newNode.add($('<span/>').text(text));
                    text = '';
                }
            }

            if (modified) {
                var $prevSibling = $node.prev();
                var $parent = $node.parent();
  
                $node.remove();

                if ($prevSibling.length)
                    $prevSibling.after($newNode);
                else
                    $parent.prepend($newNode);
            }
        });
    };
    
    // Decorate nicks found in text with span.
    var decorateNicks = function (self, el, channel) {
        // Generate nick regex on demand if state has changed.
        // Store cached nick decoration parameters in function properties.
        // Update if state changes timestamp.
        if (decorateNicks.regex === undefined || decorateNicks.timestamp < self.irc.state.lastModificationTime) {
            decorateNicks.timestamp = self.irc.state.lastModificationTime;
            decorateNicks.nicks = [ ];
            
            if (self.irc.state !== undefined) {
                decorateNicks.nicks = $.map(self.irc.state.users, function (val, key) { return key; });
            }

            // If no nicks are known, do no work.
            if (decorateNicks.nicks === undefined || decorateNicks.nicks.length === 0) return;
        
            // Convert array of nicks to regex pattern.
            var nickExpr = $.map(decorateNicks.nicks, function (nick) {
                // Escape regex symbols.
                return nick.replace(/([?*|.\^$()\[\]{}\\\/])/g, "\\$1");
            }).join('|');
            decorateNicks.regex = new RegExp("\\b(" + nickExpr + ")\\b", 'i');
        }
        
        findTextNodesForDecoration(el).each(function () {
            var $node = $(this);
            var $newNode = $();
            var modified = false;
            
            // Scan for known nick substrings.
            // Extract prefix text and decorated nick element and add to $newNode array.
            // Repeat loop with remaining text.
            var text = $node.text();
            while (text.length > 0) {
                var linkMatch = text.match(decorateNicks.regex);
                if (linkMatch !== null) {
                    var prefix = text.substr(0, linkMatch.index);
                    var nick = linkMatch[0];
                    var $nickNode = $('<span/>')
                            .addClass('nick no-decorate')
                            .text(nick);

                    // Lookup nick's colorize number for given channel.
                    if (channel !== undefined &&
                        self.isChannel(channel) &&
                        self.irc.state.channels[channel] !== undefined &&
                        self.irc.state.channels[channel].members[nick] !== undefined) {
                        $nickNode.addClass('color' + self.irc.state.channels[channel].members[nick].colorizeNumber);
                    }
                    
                    $newNode = $newNode
                        .add($('<span/>').text(prefix))
                        .add($nickNode);

                    text = text.substr(linkMatch.index + nick.length);
                    modified = true;
                }
                else {
                    // No matches.
                    $newNode = $newNode.add($('<span/>').text(text));
                    text = '';
                }
            }

            if (modified) {
                var $prevSibling = $node.prev();
                var $parent = $node.parent();

                $node.remove();

                if ($prevSibling.length)
                    $prevSibling.after($newNode);
                else
                    $parent.prepend($newNode);
            }
        });
    };
    
    // Decorate channel-like text with span.
    var decorateChannels = function (el) {
        findTextNodesForDecoration(el).each(function () {
            var $node = $(this);
            var $newNode = $();
            var modified = false;
            
            // Scan for known channel substrings.
            // Extract prefix text and decorated channel element and add to $newNode array.
            // Repeat loop with remaining text.
            var text = $node.text();
            while (text.length > 0) {
                var linkMatch = text.match(channelRegex);
                if (linkMatch !== null) {
                    var prefix = text.substr(0, linkMatch.index);
                    var channel = linkMatch[0];
                    
                    $newNode = $newNode
                        .add($('<span/>').text(prefix))
                        .add($('<span/>')
                            .addClass('channel no-decorate')
                            .text(channel)
                        );
                        
                    text = text.substr(linkMatch.index + channel.length);
                    modified = true
                }
                else {
                    // No matches.
                    $newNode = $newNode.add($('<span/>').text(text));
                    text = '';
                }
            }
            
            /*
            var html = layout.htmlEncode($node.text()).replace(/(^|[\s,:\cg])(#[^\s,:\cg]+)\b/g, function (m, text, channel) {
                modified = true;
                
                return text + '<span class="channel no-decorate">' + channel + '</span>';
            });
            */
            if (modified) {
                var $prevSibling = $node.prev();
                var $parent = $node.parent();

                $node.remove();

                if ($prevSibling.length)
                    $prevSibling.after($newNode);
                else
                    $parent.prepend($newNode);
            }
        });
    };

    // Get colorize number associated with nick in channel from state object.
    var getColorizeNumber = function (self, nick, channel) {
        var channelDesc = self.irc.state.channels[channel];
        if (channelDesc === undefined) return;
        
        return channelDesc.members[nick] !== undefined ?
            channelDesc.members[nick].colorizeNumber : undefined;
    };

    // Add nick to recent message users list for use with autoreply suggestions.
    var addToAutoReplyList = function (self, nick) {
        if (self.stricmp(nick, self.irc.state.nick) !== 0) {
            autoReplyList = $.grep(autoReplyList, function (val) {
                // Remove from array, if exists.
                return self.stricmp(val, nick) !== 0;
            });
            autoReplyList.unshift(nick);
            
            // Preserve placement of auto complete reply index so that additions to the list don't interfere.
            if (autoReplyIndex !== undefined) autoReplyIndex++;
        }
    };

    // Accept presented autoreply.
    var acceptAutoReply = function (self) {
        if (autoReplyIndex !== undefined) {
            // Accept autoreply.
            // User entry value and caret are already set from incrementAutoReply.
            // Clear autoreply state.
            autoReplyIndex = undefined;

            self.ircElement.find('.userEntry')
                .tooltip('option', 'content', '')
                .tooltip('close');
        }
    };

    // Reject presented autoreply.
    var rejectAutoReply = function (self) {
        if (autoReplyIndex !== undefined) {
            // Clear user entry and autoreply state.
            autoReplyIndex = undefined;

            self.ircElement.find('.userEntry')
                .val('')
                .tooltip('option', 'content', '')
                .tooltip('close');
        }
    };
                
    // Iterate over autoreply possibilities.
    var incrementAutoReply = function (self) {
        var $userEntry = self.ircElement.find('.userEntry').first();
        var s = $userEntry.val();
            
        if (s === '' || autoReplyIndex !== undefined) {
            // When user entry is blank, suggest autoreply from recent users list.
            if (autoReplyList.length) {
                if (autoReplyIndex === undefined) autoReplyIndex = 0;
                
                // Suggest quick send message to next recent sender.
                var recipient = autoReplyList[autoReplyIndex];
                var s2 = '/msg ' + recipient + ' ';
                $userEntry.val(s2);
                $userEntry[0].selectionStart = $userEntry[0].selectionEnd = s2.length;
                autoReplyIndex++;
                if (autoReplyIndex >= autoReplyList.length) autoReplyIndex = 0;
                
                // Take this opportunity to store current entry in first history element as scratch buffer.
                userEntryHistory[0] = $userEntry.val();

                // Show autoreply suggestion as tooltip.
                $userEntry
                    .tooltip('close')
                    .tooltip('option', 'content', 'Reply to <span class="activeSuggestion term"><span class="nick">' + recipient + '</span></span>')
                    .tooltip('open');
            }
        }
    };

    var queueScanAutoComplete = function (self) {
        cancelQueuedScanAutoComplete();
        
        autoCompleteTimeoutHandle = setTimeout(function () {
            autoCompleteTimeoutHandle = undefined;
            scanAutoComplete(self);
        }, 200);
    };
    
    var cancelQueuedScanAutoComplete = function () {
        if (autoCompleteTimeoutHandle !== undefined) {
            clearTimeout(autoCompleteTimeoutHandle);
            autoCompleteTimeoutHandle = undefined;
        }
    };
    
    // Check for keyword at cursor for an autocomplete suggestion.
    var scanAutoComplete = function (self) {
        var $userEntry = self.ircElement.find('.userEntry').first();
        var value = $userEntry.val();
        var position = $userEntry[0].selectionStart;
        var matches = [];

        // Take this opportunity to store current entry in first history element as scratch buffer.
        userEntryHistory[0] = value;

        // If cursor is at beginning, cancel autocomplete.
        if (position > 0) {
            // Position must be on a word boundary.
            // If cursor is in the middle of a word or not on a word at all, cancel autosuggest.
            // Keyword may be bounded by white space or certain punctuation.
            var lvalue = value.substr(0, position);
            var termMatch = /([^\s,\.\/\\]+)$/.exec(lvalue);
            var rvalue = value.substr(position);
            
            if (termMatch !== null && /^([\s,\.\/\\]|$)/.test(rvalue)) {
                // term is valid.
                autoCompleteSpec = autoCompleteTerm = termMatch[1];
                autoCompleteTermPosition = position - autoCompleteSpec.length;
                var term = autoCompleteTerm.toLowerCase();
                
                // Scan nicks.
                var channel = self.irc.state.channels[self.irc.target()];
                if (channel !== undefined) {
                    $.each(channel.members, function (nick) {
                        if (term === nick.substr(0, term.length).toLowerCase() && nick !== self.irc.state.nick) {
                            matches.push({ type: 'nick', value: nick });
                        }
                    });
                }
                
                // Scan channels.
                $.each(self.irc.state.channels, function (channel) {
                    if (term === channel.substr(0, term.length).toLowerCase()) {
                        matches.push({ type: 'channel', value: channel });
                    }
                });
            }
        }

        if (matches.length === 0) {
            clearAutoComplete(self);
        }
        else {
            // Prep match list.
            matches.sort(function (a, b) { return a.value.localeCompare(b.value) });
            if (window.console) {
                console.log('autoComplete matches:');
                console.log(matches);
            }
            
            // Show tooltip with first match.
            autoCompleteList = matches;
            autoCompleteIndex = 0;
            autoCompleteTermIndex = undefined;
            updateAutoCompleteTooltip(self);
            
            // Hack to make incrementAutoComplete() pick up the first term on Tab.
            autoCompleteIndex = -1;
        }
    };
    
    var updateAutoCompleteTooltip = function (self) {
        var $userEntry = self.ircElement.find('.userEntry').first();

        if (autoCompleteList.length > 0) {
            // Show all suggestions in tooltip.
            // Decorate suggestion text based on type.
            var tooltipContentList = [];

            for (var matchIndex = 0; matchIndex < autoCompleteList.length; matchIndex++) {
                var match = autoCompleteList[matchIndex];
                var content = layout.htmlEncode(match.value);
                
                if (match.type === 'nick') {
                    var colorizeNumber = getColorizeNumber(self, match.value, self.irc.target());
                    content = '<span class="nick color' + colorizeNumber + '">' + content + '</span>';
                }
                else if (match.type === 'channel')
                    content = '<span class="channel">' + content + '</span>';
                
                // Identify the 'active' suggestion placed in userEntry.
                if (autoCompleteTermIndex !== undefined && match.value === autoCompleteList[autoCompleteTermIndex].value)
                    content = '<span class="activeSuggestion term">' + content + '</span>';
                else
                    content = '<span class="inactiveSuggestion term">' + content + '</span>';
                
                tooltipContentList.push(content);
            }
            
            var tooltipContent = tooltipContentList.join(',&nbsp;');

            $userEntry
                .tooltip('option', 'content', tooltipContent)
                .tooltip('open');

            autoCompleteTooltipScrollToTerm(autoCompleteTermIndex);
        }
        else {
            $userEntry
                .tooltip('option', 'content', '')
                .tooltip('close');
        }
    };
    
    var incrementAutoComplete = function (self, step) {
        if (autoCompleteList !== undefined) {
            if (step === undefined) step = 1;
            
            // Parse out old term from userEntry.
            var $userEntry = self.ircElement.find('.userEntry').first();
            var value = $userEntry.val();
            var lvalue = value.substr(0, autoCompleteTermPosition);
            var rvalue = value.substr(autoCompleteTermPosition + autoCompleteTerm.length);

            // Get next suggested term.
            autoCompleteIndex = autoCompleteTermIndex = (autoCompleteIndex + step) % autoCompleteList.length;
            autoCompleteTerm = autoCompleteList[autoCompleteIndex].value;
            if (lvalue.length === 0) autoCompleteTerm += ': ';

            // Place term into userEntry.
            var newValue = lvalue + autoCompleteTerm + rvalue;
            $userEntry.val(newValue);
            $userEntry[0].selectionStart = $userEntry[0].selectionEnd = autoCompleteTermPosition + autoCompleteTerm.length;

            // Take this opportunity to store current entry in first history element as scratch buffer.
            userEntryHistory[0] = $userEntry.val();

            // Update tooltip.
            updateAutoCompleteTooltip(self);
        }
    };

    var rejectAutoComplete = function (self) {
        var $userEntry = self.ircElement.find('.userEntry').first();

        if (autoCompleteTerm !== undefined) {
            // Parse out old term from userEntry.
            var value = $userEntry.val();
            var lvalue = value.substr(0, autoCompleteTermPosition);
            var rvalue = value.substr(autoCompleteTermPosition + autoCompleteTerm.length);
            
            // Place original spec into userEntry.
            var newValue = lvalue + autoCompleteSpec + rvalue;
            $userEntry.val(newValue);
            $userEntry[0].selectionStart = $userEntry[0].selectionEnd = autoCompleteTermPosition + autoCompleteSpec.length;
        }
        
        autoCompleteList = undefined;
        autoCompleteIndex = undefined;
        autoCompleteTermIndex = undefined;
        autoCompleteTermPosition = undefined;
        autoCompleteTerm = undefined;
        
        $userEntry
            .tooltip('option', 'content', '')
            .tooltip('close');
    };
    
    var clearAutoComplete = function (self) {
        var $userEntry = self.ircElement.find('.userEntry').first();

        clearAutoCompleteState();
        
        $userEntry
            .tooltip('option', 'content', '')
            .tooltip('close');
    }

    var clearAutoCompleteState = function () {
        autoCompleteList = undefined;
        autoCompleteIndex = undefined;
        autoCompleteTermIndex = undefined;
        autoCompleteTermPosition = undefined;
        autoCompleteTerm = undefined;
    }

    var hoverClickableHandler = function () {
        $(this).addClass('ui-state-hover');
    };
    
    var leaveClickableHandler = function () {
        $(this).removeClass('ui-state-hover');
    };
    
    var dblclickChannelNickHandler = function (self) {
        if (self.irc.state.isActivated) {
            // Get text of element, ignoring child elements.
            var target = $(this)
                .clone()
                .children()
                .remove()
                .end()
                .text();
                
            // Unselect doubleclicked text.
            self.clearSelection();

            if (self.irc.state !== undefined && self.stricmp(target, self.irc.state.nick) !== 0) {
                if (self.isChannel(target)) {
                    // Check if joined to this channel.
                    if (self.irc.state !== undefined && self.irc.state.channels[target] === undefined)
                        self.sendLine('/join ' + target);
                    else
                        self.queryTarget(target);
                }
                else {
                    self.queryTarget(target);
                }

                self.ircElement.find('.userEntry').focus();
            }
        }
    };

    var refreshSideBar = function (self) {
        if (!layout.freezeSideBar) {
            // TODO: Incrementally update channel/member lists to avoid rendering flaws of concurrent actions,
            // such as incoming messages and user actions both changing state.
            var channelList = self.ircElement.find('.sideBar ul.channelList');
            var originalScrollTop = channelList[0].scrollTop;
                
            channelList.empty();

            $.each(self.getJoinedChannels(), function (i, channel) {
                var channelDesc = self.irc.state.channels[channel];
                var memberCount = self.getLength(channelDesc.members);
                var channelElement = $('<li><span class="channel">' + channel + '</span><span class="memberCount">(' + memberCount + ')</span><span class="leaveButton" title="Leave channel"></span></li>')
                    // Set topic as tooltip.
                    .find('.channel')
                        .attr('title', (channelDesc.topic !== undefined) ? channelDesc.topic : 'No topic set')
                        .end()
                    // Setup leave channel icon.
                    .find('.leaveButton')
                        .click(function () {
                            if (self.irc.state.isActivated) {
                                $(this).parent('li').addClass('leaving');
                                self.sendLine('/leave ' + channel);
                            }
                        })
                        .end()
                    .appendTo(channelList);
                
                var memberList = $('<ul class="memberList"/>')
                    .appendTo(channelElement);
                    
                $.each(self.getChannelMembers(channel), function (i, member) {
                    var memberDesc = channelDesc.members[member];
                    var colorizeNumber = memberDesc.colorizeNumber;
                    $('<li><span class="mode">' + memberDesc.mode + '</span><span class="nick color' + colorizeNumber + '">' + member + '</span></li>')
                        .appendTo(memberList);
                });
            });
            
            // Scroll back to original spot.
            channelList[0].scrollTop = originalScrollTop;
            
            // Apply doubleclick handler to channels and nicks.
            channelList.find('.nick,.channel')
                .hover(hoverClickableHandler, leaveClickableHandler)
                .dblclick(function () { dblclickChannelNickHandler.call(this, self); });
        }
    };

    // Resize elements to proper alignment based on ircConsole's dimensions.
    var alignUI = function (self) {
        var ircConsole = self.ircElement.find('.ircConsole');
        var ircContent = self.ircElement.find('.ircConsole .content');
        var userEntrySection = self.ircElement.find('.userEntrySection');
        var userEntryLine = self.ircElement.find('.userEntryLine');
        var userEntry = self.ircElement.find('.userEntry');
        var sideBar = self.ircElement.find('.sideBar');
        var channelList = sideBar.find('.channelList');
        ircContent
            .width(ircConsole.width())
            .height(ircConsole.height());
        userEntrySection
            .outerWidth(ircConsole.outerWidth());
        userEntryLine
            .width(userEntrySection.width());
        userEntry.outerWidth(userEntryLine.width());
        sideBar.outerHeight(ircConsole.outerHeight() + userEntrySection.outerHeight());
        channelList.height(sideBar.height());
    };
    
    var compileTemplates = function () {
        $.each(templates, function (name, tmpl) {
            $.template(name, tmpl);
        });
    };

    // Update browser title from template.
    var refreshTitle = function (self) {
        var newTitle = $.tmpl('title', {
            self: self,
            layout: layout,
            messageCount: layout.notificationMessageCount
        }).text();

        if (newTitle !== document.title) document.title = newTitle;
    };

    // Update title when notifications occur and user isn't focused on the browser.
    var incrementNotificationMessageCount = function (self) {
        if (!layout.isWindowFocused) {
            layout.notificationMessageCount++;
            refreshTitle(self);
        }
    };

    var getChannelsFromHash = function () {
        var channels = document.location.hash.split(',');
        if (channels[0].length === 0) return [ ];
        else return channels;
    };
    
    var setHashWithChannels = function (channels) {
        var hash = channels.sort().join(',');
        if (document.location.hash !== hash) document.location.hash = hash;
    };

    var newViewKey = function () {
        return Math.random().toString(36).substr(2, 8);
    };
    
    var getQueryString = function () {
        return location.search.substring(1);
    };
    
    // http://stackoverflow.com/a/647272/3347
    var parseQueryString = function (queryString) {
        var result = { };
        var re = /([^&=]+)=([^&]*)/g;
        var m;
        
        while (m = re.exec(queryString)) {
            result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
        }

        return result;
    };
    
    toQueryString = function (arr) {
        var args = $.map(arr, function (val, key) {
            if (val === undefined || val === null)
                return encodeURIComponent(key);
            else
                return encodeURIComponent(key) + '=' + encodeURIComponent(val);
        });
        return args.join('&');
    };

    //
    // Public methods.
    //
    layout = {
        messageCount: 0,                    // Console message counter.
        notificationMessageCount: 0,        // Number of messages received while not focused on browser.
        blurMessageCount: undefined,        // Message count at time of blur event.
        isWindowFocused: true,
        freezeSideBar: false,               // True to disregard UI updates when calling refreshSideBar.
        warnOnUnload: true,                 // Warn user when attempting to navigate away from page.

        initialize: function (self, options) {
            self.ircElement
                .addClass('chatmore')
                .addClass('-fullpage-layout')
                .addClass('ui-widget')
                .append($(
                    '<div style="float:left;overflow:hidden">' +
                        '<div class="ircConsole ui-widget-content ui-corner-tl"><div class="content ui-corner-all"/></div>' +
                        '<div class="userEntrySection ui-widget-content ui-corner-bl">' +
                            '<div class="userEntryModeLine">' +
                                '<div class="activationIndicator"/>' +
                                '<div class="nickLabel"><span class="nick"/></div>' +
                                '<div class="targetLabel"><span class="nick"/><span class="channel"/></div>' +
                            '</div>' +
                            '<div class="userEntryLine"><input type="text" class="userEntry" /></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="sideBar ui-widget ui-widget-content ui-corner-right"><ul class="channelList"/></div>'
                ));
                
            self.ircElement.find('.nick,.channel')
                .hover(hoverClickableHandler, leaveClickableHandler);
            
            alignUI(self);
            compileTemplates(self);

            // Parse hash string for channels.
            var channels = getChannelsFromHash();
            if (channels.length > 0) self.autoJoinChannels = channels;

            // Track browser window focus.
            $(window)
                .on('focus.chatmore_default', function () {
                    // Restore title when user comes back to the window.
                    setTimeout(function () {
                        layout.notificationMessageCount = 0;
                        refreshTitle(self);
                    }, 200);
                    
                    if (!layout.isWindowFocused) {
                        layout.isWindowFocused = true;
                        self.ircElement.find('.userEntry').focus();
                        
                        // Indicate new messages since blur.
                        if (layout.blurMessageCount) {
                            var msgElements = self.ircElement.find('.ircConsole .content > .line.new');
                            msgElements.fadeTo(2000, 1, 'easeOutExpo', function () {
                                msgElements
                                    .removeClass('new')
                                    .addClass('viewed');
                            });
                        }
                        
                        layout.blurMessageCount = undefined;
                    }
                })
                .on('blur.chatmore_default', function () {
                    // Start tracking new messages when losing focus.
                    layout.isWindowFocused = false;
                    layout.blurMessageCount = layout.messageCount;
                })
                .on('resize.chatmore_default', function () {
                    // Resize client to match window.
                    layout.resize(self);
                })
                .on('beforeunload.chatmore_default', function () {
                    // Provide popup warning when navigating away from this page.
                    if (layout.warnOnUnload) return 'You are about to navigate away from the Chatmore IRC client, which may disconnect from your session.';
                });
            
            // Setup user entry event handlers.
            var keydownWasHandled = false;

            self.ircElement.find('.userEntry')
                .keydown(function (e) {
                    var $userEntry = $(this);
                    keydownWasHandled = false;

                    if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
                        // Cancel pending scanAutoComplete() to prevent typing conflicts.
                        cancelQueuedScanAutoComplete();
                        
                        if (e.keyCode === 13 /* Enter */) {
                            // Send message.

                            // Take this opportunity to store current entry in first history element as scratch buffer.
                            userEntryHistory[0] = $userEntry.val();

                            // Add new scratch line to user entry history.
                            userEntryHistory.unshift('');
                        
                            self.sendLine($userEntry.val());
                            $userEntry.val('');
                            
                            // Reset user entry history index.
                            userEntryHistoryIndex = undefined;

                            // Clear any autocomplete suggestions.
                            if (autoReplyIndex !== undefined)
                                rejectAutoReply(self);
                            else
                                clearAutoComplete(self);
                            
                            keydownWasHandled = true;
                            return false;
                        }
                        else if (e.keyCode === 27 /* Escape */) {
                            if (autoReplyIndex !== undefined)
                                rejectAutoReply(self);
                            else
                                rejectAutoComplete(self);
                            
                            keydownWasHandled = true;
                            return false;
                        }
                        else if (e.keyCode == 8 /* Backspace */ || e.keyCode == 46 /* Delete */) {
                            // Backspace/Delete rejects an autoreply.
                            if (autoReplyIndex !== undefined) {
                                rejectAutoReply(self);
                                
                                keydownWasHandled = true;
                                return false;
                            }
                                
                            // Cancel autocomplete suggestion, then rescan on backspace or delete.
                            queueScanAutoComplete(self);
                        }
                        else if (e.keyCode === 9 /* Tab */) {
                            // Tab through auto replies if line is empty.
                            if ($userEntry.val() === '' || autoReplyIndex !== undefined) {
                                incrementAutoReply(self);
                            }
                            // Scan for autocomplete if no suggestion is present.
                            else if (autoCompleteList === undefined) {
                                scanAutoComplete(self);
                                incrementAutoComplete(self);
                            }
                            // Increment next autocomplete suggestion.
                            else {
                                incrementAutoComplete(self);
                            }
                            
                            keydownWasHandled = true;
                            return false;
                        }
                        else if (e.keyCode === 38 /* Arrow up */ || e.keyCode === 40 /* Arrow down */) {
                            if (userEntryHistoryIndex === undefined && userEntryHistory.length > 1) {
                                // Start browsing history, if any exists.
                                userEntryHistoryIndex = 0;
                            }
                            
                            if (userEntryHistoryIndex !== undefined) {
                                // Ensure no auto complete is presented.
                                rejectAutoReply(self);
                                clearAutoComplete(self);

                                if (e.keyCode === 38) {
                                    // Go to next oldest history entry.
                                    userEntryHistoryIndex++;
                                    if (userEntryHistoryIndex >= userEntryHistory.length)
                                        userEntryHistoryIndex = 0;
                                }
                                else {
                                    // Go to next newest history entry.
                                    userEntryHistoryIndex--;
                                    if (userEntryHistoryIndex < 0)
                                        userEntryHistoryIndex = userEntryHistory.length - 1;
                                }
                            
                                // Display history in user entry.
                                var entry = userEntryHistory[userEntryHistoryIndex];
                                $userEntry.val(entry);
        
                                // Place caret at end of line.
                                this.selectionStart = entry.length;
                                this.selectionEnd = this.selectionStart;
                            }
                            
                            keydownWasHandled = true;
                            return false;
                        }                    
                    }
                })
                .keypress(function (e) {
                    if (keydownWasHandled) {
                        keydownWasHandled = false;
                        return false;
                    }
                    
                    clearAutoCompleteState();

                    if (autoReplyIndex !== undefined) {
                        // Typing text will accept a presented autoreply.
                        acceptAutoReply(self);
                    }

                    queueScanAutoComplete(self);
                })
                // Setup tooltip.
                .tooltip({
                    items: '.userEntry',
                    show: { effect: 'fade', duration: 250 },
                    position: { my: 'left top', at: 'left bottom' },
                    track: false,
                    open: function (e, ui) {
                        // Move tooltip div to inside ircElement so that CSS styles apply.
                        ui.tooltip.appendTo(self.ircElement);
                        
                        // Prepare delegate function for scrolling to term index.
                        autoCompleteTooltipScrollToTerm = function (termIndex) {
                            var $term = ui.tooltip.find('.term').eq(termIndex).each(function () {
                                var newScrollLeft = $(this).offset().left - parseInt($(this).css('margin-left')) - parseInt($(this).css('padding-left')) - ui.tooltip.offset().left - parseInt(ui.tooltip.css('padding-left')) + ui.tooltip.scrollLeft();
                                ui.tooltip
                                    .stop('chatmore.tooltip', true, true)
                                    .animate({ scrollLeft: newScrollLeft, queue: 'chatmore.tooltip' });
                            });
                        };
                    }
                })
                .focus();
            
            layout.resize(self);
        },
        destroy: function () {
            // Clean up.
            $(window).off('.chatmore_default');
        },
        writeTemplate: function (self, templateName, data) {
            if (templateName === 'outgoingPrivateMsg') {
                // For outgoing private messages to a user, record the target nick in autoreply list.
                if (!self.isChannel(data.msg.info.target)) {
                    addToAutoReplyList(self, data.msg.info.target);
                }
            }

            data.self = self;
            data.layout = layout;
            
            var el = $('<div/>')
                .append($.tmpl(templateName, data));
            return writeLine(self, el.html());
        },
        htmlEncode: function (value) {
            //return $('<div/>').text(value).html();
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },
        htmlDecode: function (value) {
            return String(value)
                .replace('&quot;', '"')
                .replace('&apos;', "'")
                .replace('&lt;', '<')
                .replace('&gt;', '>')
                .replace('&amp;', '&');
        },
        resize: function (self, width, height) {
            if (width && height) {
                var ircConsole = self.ircElement.find('.ircConsole');
                var sideBar = self.ircElement.find('.sideBar');
                var userEntrySection = self.ircElement.find('.userEntrySection');
                
                ircConsole
                    .outerWidth(width - sideBar.outerWidth())
                    .outerHeight(height - userEntrySection.outerHeight());
                
                alignUI(self);
            }
            else {
                // Resize to fit.
                var parent = self.ircElement.parent();
                var atBottom = layout.isAtBottom(self);
                
                layout.resize(self,
                    $(window).width() - parent.outerWidth() + parent.width(),
                    $(window).height() - parent.outerHeight() + parent.height());
                
                if (atBottom) layout.scrollToBottom(self);
            }
        },
        scrollToBottom: function (self) {
            var ircContent = self.ircElement.find('.ircConsole .content');
            ircContent[0].scrollTop = ircContent[0].scrollHeight;
        },

        //
        // Property getters.
        //
        // Determine if IRC console is scrolled to the bottom.
        isAtBottom: function (self) {
            var ircContent = self.ircElement.find('.ircConsole .content');
            return (ircContent[0].scrollTop + 4) >= (ircContent[0].scrollHeight - ircContent[0].clientHeight);
        },
        
        //
        // Event handlers.
        //
        onQueryTarget: function (self, target, prevTarget) {
            self.writeTmpl(target === undefined ? 'queryOff' : 'query', {
                target: target,
                prevTarget: prevTarget
            });

            // Update user mode line.
            self.ircElement.find('.targetLabel').fadeOut(null, function () {
                //self.ircElement.find('.targetLabel').text(target);
                if (target !== undefined && target !== null) {
                    var isChannel = self.isChannel(target);
                    if (self.isChannel(target)) {
                        self.ircElement.find('.targetLabel')
                            .find('.nick')
                                .hide()
                            .end()
                            .find('.channel')
                                .show()
                                .text(target);
                    }
                    else {
                        self.ircElement.find('.targetLabel')
                            .find('.channel')
                                .hide()
                            .end()
                            .find('.nick')
                                .show()
                                .text(target);
                    }
                    
                    self.ircElement.find('.targetLabel').fadeIn();
                }
            })
        },
        onStateChanged: function (self) {
            //if (window.console) console.log('Plugin event: stateChanged');
            var state = self.irc.state;
            
            if (self.prevState === undefined || self.stricmp(state.nick, self.prevState.nick) !== 0) {
                // Nick changed.
                if (window.console) console.log('Nick changed.');
                var nickLabel = self.ircElement.find('.userEntryModeLine .nickLabel .nick');
                nickLabel.fadeOut(null, function () {
                    nickLabel.text(state.nick);
                    nickLabel.fadeIn();
                });
            }

            refreshSideBar(self);
            setHashWithChannels(state.getChannels());
        },
        onLocalMessage: function (self, message, type, data) { },
        onProcessingMessage: function (self, msg) { },
        onProcessedMessage: function (self, msg) {
            //if (window.console) console.log('Plugin event: processedMessage');
            if (msg.type === 'servermsg' && msg.code === 402) {
                if (window.console) console.warn('Got session deleted error.  Generating new viewKey and reactivating...');
                
                // Session deleted error during activation.  Generate new viewKey and reactivate.
                var query = parseQueryString(getQueryString());
                query.viewKey = newViewKey();

                if (window.history.replaceState) {
                    // HTML5: Restart client with new viewKey without reloading; update URL to reflect viewKey.
                    var updatedUrl = document.location.pathname + '?' + toQueryString(query) + document.location.hash;
                    window.history.replaceState(null, document.title, updatedUrl);

                    var options = $.extend({ }, self.options);
                    options.viewKey = query.viewKey;
                    options.channels = getChannelsFromHash();
                    $('#chatmore')
                        .chatmore(options)
                        .chatmore('resize');
                }
                else {
                    // HTML4: Redirect back with new viewKey.
                    layout.warnOnUnload = false;
                    document.location.search = '?' + toQueryString(query);
                }
            }
            else {
                switch (msg.command) {
                case 'PRIVMSG':
                    if (self.stricmp(msg.info.target, self.irc.state.nick) === 0) {
                        if (!msg.info.isAction) {
                            // Add this sender to the history of users.
                            addToAutoReplyList(self, msg.prefixNick);
                        }
                    }
                    break;
                case 'NOTICE':
                    if (self.stricmp(msg.info.target, self.irc.state.nick) === 0) {
                        // Add this sender to the history of users.
                        addToAutoReplyList(self, msg.prefixNick);
                    }
                    break;
                }
            }
        },
        onSendingMessage: function (self, rawMsg) { },
        onErrorSendingMessage: function (self, xhr, rawMsg) { },
        onSentMessage: function (self, rawMsg) { },
        onActivatingClient: function (self, stage, message, params) {
            if (stage === 'resuming' || stage === 'activated') {
                // Once activated, the sidebar can be refreshed.
                layout.freezeSideBar = false;
            }
        },
        onDeactivatingClient: function (self) {
            // Disable updates to the sidebar while in auto-reconnection state.
            if (self.enableAutoReactivate && self.reactivateAttempts < self.options.reactivateAttempts)
                layout.freezeSideBar = true;
            else
                layout.freezeSideBar = false;
        },

        //
        // Internal methods.
        //
        getColorizeCSSClass: function (self, nick, channel) {
            var number = getColorizeNumber(self, nick, channel);
            return number !== undefined ? 'color' + number : '';
        }
    };

    // Register layout.
    $.chatmore('layouts')['default'] = layout;
})();
