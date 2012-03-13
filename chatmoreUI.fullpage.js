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
        error: '{{tmpl "timestamp"}}<span class="error">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        usage: '{{tmpl "timestamp"}}<span class="usage">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        help: '{{tmpl "timestamp"}}<span class="help">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        serverMsg: '{{tmpl "timestamp"}}<span class="serverMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        serverChannelMsg: '{{tmpl "timestamp"}}<span class="serverMsg">' +
            '{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; ' +
            '<span class="message">${message}</span>' +
            '</span>',
        serverMsgNumber: '{{tmpl "timestamp"}}<span class="serverMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">${msg.info.number} ${msg.info.message}</span>' +
            '</span>',
        clientMsg: '{{tmpl "timestamp"}}<span class="clientMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        outgoingChannelMsg: '{{tmpl "timestamp"}}<span class="channelMsg">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        outgoingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg action">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        outgoingChannelNotice: '{{tmpl "timestamp"}}<span class="channelNotice">' +
            '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        outgoingPrivateMsg: '{{tmpl "timestamp"}}<span class="privateMsg">' +
            '<span class="prefix">&#x21E8; &bull;<span class="nick">${msg.info.target}</span>&bull;</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        outgoingPrivateAction: '{{tmpl "timestamp"}}<span class="privateMsg action">' +
            '<span class="prefix">&#x21E8; &bull;<span class="nick">${msg.info.target}</span>&bull; <span class="nick">${msg.prefixNick}</span></span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        outgoingPrivateNotice: '{{tmpl "timestamp"}}<span class="privateNotice">' +
            '<span class="prefix">-<span class="nick">${msg.info.target}</span>-</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingChannelMsg: '{{tmpl "timestamp"}}<span class="channelMsg">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg action">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingChannelNotice: '{{tmpl "timestamp"}}<span class="channelNotice">' +
            '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingPrivateMsg: '{{tmpl "timestamp"}}<span class="privateMsg">' +
            '<span class="prefix">&bull;<span class="nick">${msg.prefixNick}</span>&bull;</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingPrivateAction: '{{tmpl "timestamp"}}<span class="privateMsg action">' +
            '<span class="prefix">&bull; <span class="nick">${msg.prefixNick}</span></span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        incomingPrivateNotice: '{{tmpl "timestamp"}}<span class="privateNotice">' +
            '<span class="prefix">-<span class="nick">${msg.prefixNick}</span>-</span> ' +
            '<span class="message">${msg.info.text}</span>' +
            '</span>',
        queryOff: '{{tmpl "timestamp"}}<span class="queryMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.isChannel(prevTarget)}}' +
                'You are no longer talking on channel <span class="channel">${prevTarget}</span>' +
            '{{else}}' +
                'Ending conversation with <span class="nick">${prevTarget}</span>' +
            '{{/if}}' +
            '</span></span>',
        query: '{{tmpl "timestamp"}}<span class="queryMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.isChannel(target)}}' +
                'You are now talking on channel <span class="channel">${target}</span>' +
            '{{else}}' +
                'Starting conversation with <span class="nick">${target}</span>' +
            '{{/if}}' +
            '</span></span>',
        join: '{{tmpl "timestamp"}}<span class="JOIN">' +
            '<span class="prefix">&lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> (${msg.prefixUser}@${msg.prefixHost}) has joined the channel</span>' +
            '</span>',
        leave: '{{tmpl "timestamp"}}<span class="PART">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> has left the channel{{if !!msg.info.comment}}: ${msg.info.comment}{{/if}}</span>' +
            '</span>',
        kick: '{{tmpl "timestamp"}}<span class="KICK">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.kick.channel}</span>&gt;</span> ' +
            '<span class="message">' +
            '{{if self.stricmp(self.irc.state.nick, msg.info.kick.nick) === 0}}' +
                'You have been kicked from the channel by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.kick.channel)}">${msg.prefixNick}</span>' +
            '{{else}}' +
                '<span class="nick ${layout.getColorizeCSSClass(self, msg.info.kick.nick, msg.info.kick.channel)}">${msg.info.kick.nick}</span> has been kicked from the channel by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.kick.channel)}">${msg.prefixNick}</span>' +
            '{{/if}}' +
            '{{if msg.info.comment !== undefined && msg.info.comment !== msg.prefixNick}}: ${msg.info.comment}{{/if}}</span>' +
            '</span>',
        nick: '{{tmpl "timestamp"}}<span class="NICK">' +
            '{{tmpl "notePrefix"}} <span class="message">' +
            '{{if self.stricmp(self.irc.state.nick, msg.prefixNick) === 0}}' +
                'Nick changed to <span class="nick">${msg.info.nick}</span>' +
            '{{else}}' +
                '<span class="nick">${msg.prefixNick}</span> is now known as <span class="nick">${msg.info.nick}</span>' +
            '{{/if}}' +
            '</span></span>',
        nickInUse: '{{tmpl "timestamp"}}<span class="serverMsg">' +
            '{{tmpl "notePrefix"}} <span class="message">Nickname <span class="nick">${msg.info.nick}</span> is already in use.</span>' +
            '</span>',
        notopic: '{{tmpl "timestamp"}}<span class="TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message no-decorate">No topic is set</span>' +
            '</span>',
        topic: '{{tmpl "timestamp"}}<span class="TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message">' +
            '{{if msg.info.topic !== undefined}}' +
                '<span class="no-decorate">The current topic is:</span> <span class="topicMessage">${msg.info.topic}</span>' +
            '{{else}}' +
                '<span class="message no-decorate">No topic is set</span>' +
            '{{/if}}' +
            '</span>' +
            '</span>',
        changeTopic: '{{tmpl "timestamp"}}<span class="TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message"><span class="no-decorate"><span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> ' +
            '{{if msg.info.topic == ""}}' +
                'has cleared the topic</span>' +
            '{{else}}' +
                'has changed the topic to: </span><span class="topicMessage">${msg.info.topic}</span>' +
            '{{/if}}' +
            '</span></span>',
        topicSetBy: '{{tmpl "timestamp"}}<span class="TOPIC">' +
            '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
            '<span class="message no-decorate">Topic set by <span class="nick ${layout.getColorizeCSSClass(self, msg.info.nick, msg.info.channel)}">${msg.info.nick}</span> on <span class="time">${self.formatTime(msg.info.time)}</span></span>' +
            '</span>',
        serverTime: '{{tmpl "timestamp"}}<span class="TIME">' +
            '{{tmpl "notePrefix"}} <span class="message">Server time for <span class="server">${msg.info.server}</span>: <span class="time">${msg.info.timeString}</span></span>' +
            '</span>',
        quit: '{{tmpl "timestamp"}}<span class="QUIT">' +
            '{{tmpl "notePrefix"}} <span class="message">Signoff: <span class="nick">${msg.prefixNick}</span> (${msg.info.message})</span>' +
            '</span>',
        error: '{{tmpl "timestamp"}}<span class="ERROR">' +
            '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
            '</span>',
        mode: '{{tmpl "timestamp"}}<span class="MODE">' +
            '{{tmpl "notePrefix"}} <span class="message">Mode change "<span class="modeString">${msg.info.mode}</span>" for ' +
            '{{if self.isChannel(msg.info.target)}}' +
                'channel <span class="channel">${msg.info.target}</span> ' +
                'by <span class="nick ${layout.getColorizeCSSClass(self, msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span>' +
            '{{else}}'  +
                'user <span class="nick">${msg.info.target}</span> ' +
                'by <span class="nick">${msg.prefixNick}</span></span>' +
            '{{/if}}' +
            '</span>',
        list: '{{tmpl "timestamp"}}<span class="LIST">' +
            '{{tmpl "notePrefix"}} <span class="message"><span class="no-decorate"><span class="channel">${msg.info.channel}</span> (${msg.info.memberCount}): </span>${msg.info.topic}</span>' +
            '</span>',
        retryRegistration: '{{tmpl "timestamp"}}<span class="clientMsg">' +
            '{{tmpl "notePrefix"}} <span class="message no-decorate">Retrying registration with nickname <span class="nick">${self.irc.state.nick}</span></span>' +
            '</span>'
    };

    //                  [-scheme---------][-hostname------------][-port][-path----------][-querystring-----------------------------------------------------][anchor]
    var linkifyRegex = /\b([a-z]{2,8}:\/\/([\w\-_]+(\.[\w\-_]+)*)(:\d+)?(\/[^\s\?\/<>]*)*(\?\&*([^\s=&#<>]+(=[^\s=&#<>]*)?(&[^\s=&#<>]+(=[^\s=&#<>]*)?)*)?)?(#\S+)?)/gi;

    //
    // Private methods.
    //
    // Write HTML line to ircConsole.
    var writeLine = function (self, html) {
        layout.messageCount++;
        incrementNotificationMessageCount(self);

        var ircContent = self.ircElement.find('.ircConsole .content');
        var lineElement;

        var write = function (element) {
            // Is the console's scroll within 4 pixels from the bottom?
            var atBottom = layout.isAtBottom(self);
            
            // Auto decorate nicks and channels in message.
            var channel = element.find('.prefix .channel').text();
            element.closest('.channelMsg,.privateMsg,.TOPIC,.LIST,.serverMsg,.clientMsg').find('.message')
                .each(function () {
                    linkifyURLs(self, this);
                    decorateChannels(self, this);
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
                    content.find('.line.new').removeClass('new');
                    content.find('.line.separator').remove();
                    lineElement.before('<div class="line separator"/>');
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
    var findTextNodes = function (node, predicate) {
        var next;
        var nodes = [];

        if (node.nodeType === 1) {
            // Element node.
            if (node.firstChild) {
                node = node.firstChild;
                do {
                    next = node.nextSibling;
                    nodes = nodes.concat(findTextNodes(node, predicate));
                    node = next;
                } while (node);
            }
        }
        else if (node.nodeType === 3) {
            // Text node.
            if (predicate === undefined || predicate(node)) {
                nodes.push(node);
            }
        }
        
        return nodes;
    };

    var findTextNodesForDecoration = function (el) {
        return findTextNodes(el, function (node) {
            // Exclude already decorated elements.
            // Exclude elements tagged with no-decorate class.
            if ($(node).parent('a,.channel,.nick').length !== 0 ||
                $(node).parents('.no-decorate').length !== 0)
                return false;
            else
                return true;
        });
    };
            
    // Convert URL patterns into HTML links.
    var linkifyURLs = function (self, el) {
        var nodes = findTextNodesForDecoration(el);
        
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var modified = false;
            var html = $(node).text().replace(linkifyRegex, function (m, url) {
                modified = true;
                
                // Strip trailing symbols that are probably not part of the URL.
                trailingText = url.match(/[)>,\.;:'"]$/);
                if (trailingText !== null)
                    url = url.substring(url, url.length - trailingText[0].length);
                
                var n = $('<div/>')
                    .append($('<a/>')
                        .attr('href', url)
                        .attr('target', '_blank')
                        .text(url));
                        
                if (trailingText !== null)
                    n.append(document.createTextNode(trailingText[0]));
                
                return n.html();
            });
            
            if (modified) {
                var newNode = $('<span/>').append(html);
                $(node).replaceWith(newNode);
            }
        }
    };

    // Decorate nicks found in text with span.
    var decorateNicks = function (self, el, channel) {
        var nicks;
        if (self.irc.state !== undefined) {
            nicks = $.map(self.irc.state.users, function (val, key) { return key; });
        }

        if (nicks === undefined || nicks.length === 0) return;
        
        // Convert array of nicks to regex expression.
        var nickExpr = $.map(nicks, function (nick) {
            // Escape regex symbols.
            return nick.replace(/([?*|.^$()\[\]{}\\/])/, "\\$1");
        }).join('|');
        var re = new RegExp("\\b(" + nickExpr + ")\\b", 'ig');
        
        var nodes = findTextNodesForDecoration(el);
        
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var modified = false;
            var html = $(node).text().replace(re, function (m, nick) {
                var colorizeNumber;
                if (channel !== undefined && self.isChannel(channel)) {
                    // Lookup nick's colorize number for given channel.
                    if (self.irc.state.channels[channel] !== undefined &&
                        self.irc.state.channels[channel].members[nick] !== undefined) {
                        colorizeNumber = self.irc.state.channels[channel].members[nick].colorizeNumber;
                    }
                }
                
                modified = true;

                if (colorizeNumber !== undefined) {
                    return '<span class="nick color' + colorizeNumber + '">' + nick + '</span>';
                }
                else {
                    return '<span class="nick">' + nick + '</span>';
                }
            });
            
            if (modified) {
                var newNode = $('<span/>').append(html);
                $(node).replaceWith(newNode);
            }
        }
    };

    // Decorate channel-like text with span.
    var decorateChannels = function (self, el) {
        var nodes = findTextNodesForDecoration(el);
        
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var modified = false;
            
            var html = $(node).text().replace(/(^|[\s,:\cg])(#[^\s,:\cg]+)\b/g, function (m, text, channel) {
                modified = true;
                
                return text + '<span class="channel">' + channel + '</span>';
            });
            
            if (modified) {
                var newNode = $('<span/>').append(html);
                $(node).replaceWith(newNode);
            }
        }
    };

    var getColorizeNumber = function (self, nick, channel) {
        var channelDesc = self.irc.state.channels[channel];
        if (channelDesc === undefined) return;
        
        return channelDesc.members[nick] !== undefined ?
            channelDesc.members[nick].colorizeNumber : undefined;
    };

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
        if (channels[0] == '') return [ ];
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
            $(self.ircElement)
                .addClass('chatmore')
                .addClass('-fullpage-layout')
                .addClass('ui-widget')
                .append($(
                    '<div style="float:left;overflow:hidden">' +
                        '<div class="ircConsole ui-widget-content ui-corner-tl"><div class="content ui-corner-all"/></div>' +
                        '<div class="userEntrySection ui-widget-content ui-corner-bl">' +
                            '<div class="userEntryModeLine">' +
                                '<div class="activationIndicator"/>' +
                                '<div class="nickLabel nick"/>' +
                                '<div class="targetFragment" style="display:none"><div class="targetLabel"/></div>' +
                            '</div>' +
                            '<div class="userEntryLine"><input type="text" class="userEntry" /></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="sideBar ui-widget ui-widget-content ui-corner-right"><ul class="channelList"/></div>'
                ));
            
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
                            msgElements.fadeTo(2000, 1, 'easeOutExpo');
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
                
            layout.resize(self);
        },
        destroy: function () {
            // Clean up.
            $(window).off('.chatmore_default');
        },
        writeTemplate: function (self, templateName, data) {
            data.self = self;
            data.layout = layout;
            var el = $('<div/>')
                .append($.tmpl(templateName, data));
            return writeLine(self, el.html());
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
        onStateChanged: function (self) {
            //if (window.console) console.log('Plugin event: stateChanged');
            refreshSideBar(self);
            setHashWithChannels(self.irc.state.getChannels());
        },
        onLocalMessage: function (self, message, type, data) { },
        onProcessingMessage: function (self, msg) { },
        onProcessedMessage: function (self, msg) {
            //if (window.console) console.log('Plugin event: processedMessage');
            if (msg.type === 'servermsg' && msg.code === 402) {
                if (window.console) console.warn('Got session deleted error.  Generating new viewKey and reactivating...');
                
                // Session deleted error during activation.  Generate new viewKey and reactivate.
                var query = parseQueryString(getQueryString());
                query['viewKey'] = newViewKey();

                if (window.history.replaceState) {
                    // HTML5: Restart client with new viewKey without reloading; update URL to reflect viewKey.
                    var updatedUrl = document.location.pathname + '?' + toQueryString(query) + document.location.hash;
                    window.history.replaceState(null, document.title, updatedUrl);

                    var options = $.extend({ }, self.options);
                    options.viewKey = query['viewKey'];
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
    $.chatmore('layouts').default = layout;
})();
