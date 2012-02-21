$.fn.chatmore = function (p1, p2) {
    // If no arguments provided, default to empty options array.
    if (p1 === undefined) p1 = {};

    // Private static functions.
    var isEmpty = function (text) {
        return text === undefined || text === null || text === '';
    };

    // charemoreUI constructor(options)
    if (typeof(p1) === 'object') {
        // Construct UI widget.
        var userOptions = p1;
        
        // Parse options.
        var options = {
            port: 6667,
            title: document.title,
            quitMessage: 'Chatmore IRC client',
            reactivateAttempts: 6,
            reactivateDelay: 10,
            mustMatchServer: false,
            channels: [ ]
        };
        $.extend(options, userOptions);
        if (isEmpty(userOptions.nick)) options.nick = 'user' + Math.floor(Math.random() * 10000);
        if (isEmpty(userOptions.realname)) options.realname = userOptions.nick;
        if (typeof(options.channel) === 'object') options.channels = options.channel;
        else options.channels.push(options.channel);

        if (window.console) console.log('userOptions:');
        if (window.console) console.log(userOptions);
        if (window.console) console.log('options:');
        if (window.console) console.log(options);
        
        var self = {
            //
            // Private members.
            //
            ircElement: $(this),                // Chatmore parent jQuery element.
            irc: undefined,                     // Chatmore client object.

            options: options,
            isWindowFocused: true,
            messageCount: 0,                    // Console message counter.
            notificationMessageCount: 0,        // Number of messages received while not focused on browser.
            blurMessageCount: undefined,        // Message count at time of blur event.
            prevState: undefined,
            msgSenders: [ ],                    // History of private message senders for autocomplete.
            autoCompleteReplyIndex: undefined,  // Autocomplete index against msgSenders array when replying to message senders.
            autoCompletePrefix: undefined,      // Autocomplete filter, word typed at first Tab completion.
            autoCompleteSuggest: undefined,     // Suggestion given from last Tab completion
            enableAutoReactivate: true,
            reactivateAttempts: 0,
            isPendingActivation: false,
            userEntryHistory: [''],             // User entry history log.  First entry is scratch buffer from last unsent entry.
            userEntryHistoryIndex: undefined,
            freezeSideBar: false,               // True to disregard UI updates when calling refreshSideBar.

            // IRC client message templates.
            tmpls: {
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
                serverMsgNumber: '{{tmpl "timestamp"}}<span class="serverMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">${msg.info.number} ${msg.info.message}</span>' +
                    '</span>',
                clientMsg: '{{tmpl "timestamp"}}<span class="clientMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</span>',
                outgoingChannelMsg: '{{tmpl "timestamp"}}<span class="channelMsg">' +
                    '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
                    '<span class="message">${msg.info.text}</span>' +
                    '</span>',
                outgoingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg action">' +
                    '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
                    '<span class="message">${msg.info.text}</span>' +
                    '</span>',
                outgoingChannelNotice: '{{tmpl "timestamp"}}<span class="channelNotice">' +
                    '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
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
                    '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>:<span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>&gt;</span> ' +
                    '<span class="message">${msg.info.text}</span>' +
                    '</span>',
                incomingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg action">' +
                    '<span class="prefix">&lt;<span class="channel">${msg.info.target}</span>&gt; &bull; <span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span> ' +
                    '<span class="message">${msg.info.text}</span>' +
                    '</span>',
                incomingChannelNotice: '{{tmpl "timestamp"}}<span class="channelNotice">' +
                    '<span class="prefix">-<span class="channel">${msg.info.target}</span>:<span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span>-</span> ' +
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
                    '<span class="message"><span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> (${msg.prefixUser}@${msg.prefixHost}) has joined the channel</span>' +
                    '</span>',
                leave: '{{tmpl "timestamp"}}<span class="PART">' +
                    '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
                    '<span class="message"><span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> has left the channel{{if !!msg.info.comment}}: ${msg.info.comment}{{/if}}</span>' +
                    '</span>',
                kick: '{{tmpl "timestamp"}}<span class="KICK">' +
                    '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message"><span class="nick ${self.getColorizeCSSClass(op, channel)}">${op}</span> has kicked <span class="nick ${self.getColorizeCSSClass(nick, channel)}">${nick}</span> from the channel{{if comment !== undefined}}: ${comment}{{/if}}</span>' +
                    '</span>',
                nick: '{{tmpl "timestamp"}}<span class="NICK">' +
                    '{{tmpl "notePrefix"}} <span class="message">' +
                    '{{if self.stricmp(self.irc.state.nick, msg.prefixNick) == 0}}' +
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
                    '<span class="message"><span class="no-decorate"><span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.channel)}">${msg.prefixNick}</span> ' +
                    '{{if msg.info.topic == ""}}' +
                        'has cleared the topic</span>' +
                    '{{else}}' +
                        'has changed the topic to: </span><span class="topicMessage">${msg.info.topic}</span>' +
                    '{{/if}}' +
                    '</span></span>',
                topicSetBy: '{{tmpl "timestamp"}}<span class="TOPIC">' +
                    '<span class="prefix">{{tmpl "bullet"}} &lt;<span class="channel">${msg.info.channel}</span>&gt;</span> ' +
                    '<span class="message no-decorate">Topic set by <span class="nick ${self.getColorizeCSSClass(msg.info.nick, msg.info.channel)}">${msg.info.nick}</span> on <span class="time">${self.formatTime(msg.info.time)}</span></span>' +
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
                        'by <span class="nick ${self.getColorizeCSSClass(msg.prefixNick, msg.info.target)}">${msg.prefixNick}</span></span>' +
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
            },
            
            // Client /command definitions.
            cmdDefs: {
                clear: {
                    helpUsage: 'Usage: /clear',
                    helpText: 'Clear the chat console.',
                    parseParam: function () { },
                    exec: function (meta) {
                        self.ircElement.find('.ircConsole .content').html('');
                    }
                },
                cleartopic: {
                    helpUsage: 'Usage: /cleartopic',
                    helpText: 'Clear the selected channel\'s topic',
                    parseParam: function (param, meta) {
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to clear the topic.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.irc.sendMsg('TOPIC ' + self.irc.target() + ' :');
                    }
                },
                help: {
                    helpUsage: 'Usage: /help &lt;command&gt;',
                    helpText: [
                        'Show help for client commands.',
                        'Commands:',
                        ' clear - Clear the chat console',
                        ' cleartopic - Clear the channel\'s topic',
                        //' connect - Connect to IRC server',
                        ' join - Join a channel',
                        ' kick - Kick user from channel',
                        ' leave - Leave a channel',
                        ' list - Get channel listing',
                        ' me - Send an action message',
                        ' motd - Get the server message of the day',
                        ' msg - Send a private message',
                        ' nick - Change your nick',
                        ' notice - Send a notice to a nick or channel',
                        ' query - Select a target for messaging',
                        ' quit - Quit IRC session',
                        ' quote - Send raw IRC message',
                        ' time - Get the server time',
                        ' topic - Get or set the channel\'s topic',
                        ' who - Get info on a nick'
                    ],
                    parseParam: function (param, meta) {
                        if (param === undefined) param = 'help';
                        
                        if (self.cmdDefs[param] === undefined) {
                            meta.error = 'Error: Cannot get help on unknown command "' + param + '".';
                            return false;
                        }

                        meta.cmd = param;
                    },
                    exec: function (meta) {
                        var cmdDef = self.cmdDefs[meta.cmd];
                        self.writeTmpl('help', { message: cmdDef.helpUsage });
                        
                        if (typeof(cmdDef.helpText) === 'object')
                            $.each(cmdDef.helpText, function (i, text) {
                                self.writeTmpl('help', { message: text });
                            });
                        else
                            self.writeTmpl('help', { message: cmdDef.helpText });
                    }
                },
                join: {
                    helpUsage: 'Usage: /join &lt;#channel&gt; [key]',
                    helpText: 'Join a channel.  Include a key if the channel requires it to join.',
                    parseParam: function (param, meta) {
                        if (param === undefined) {
                            meta.error = self.cmdDefs['join'].helpUsage;
                            return false;
                        }
                        
                        var params = param.split(/\s+/, 2);
                        // Normalize channel name if it's missing a prefix.
                        meta.channel = params[0].replace(/^([^#&+!])/, '#$1');
                        if (params[1] !== undefined) meta.key = params[1];
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to join a channel.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.joinChannel(meta.channel, meta.key);
                    }
                },
                kick: {
                    helpUsage: 'Usage: /kick &gt;nick&lt; [comment]',
                    helpText: 'Kick user from channel',
                    parseParam: function (param, meta) {
                        var usage = self.cmdDefs['kick'].helpUsage;
                        var m = /^(\S+)(\s+(.+))?/.exec(param);
                        if (m === null) {
                            meta.error = usage;
                            return false;
                        }
                        
                        meta.channel = self.irc.target();
                        meta.nick = m[1];
                        meta.comment = m[3];
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to kick a user.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.comment !== undefined)
                            self.irc.sendMsg('KICK ' + meta.channel + ' ' + meta.nick + ' :' + meta.comment);
                        else
                            self.irc.sendMsg('KICK ' + meta.channel + ' ' + meta.nick);
                    }
                },
                leave: {
                    helpUsage: 'Usage: /leave [#channel] [comment]',
                    helpText: [
                        'Leave a channel.',
                        'If channel omitted, leaves channel currently selected by /query.'
                    ],
                    parseParam: function (param, meta) {
                        if (param === undefined) {
                            if (self.irc.target() === undefined) {
                                meta.error = self.cmdDefs['leave'].helpUsage;
                                return false;
                            }
                            else {
                                meta.channel = self.irc.target();
                            }
                        }
                        else {
                            var m = /^(\S+)(\s+(.+))?\s*$/.exec(param);
                            // Normalize channel name if it's missing a prefix.
                            meta.channel = m[1].replace(/^([^#&+!])/, '#$1');
                            if (m[3] !== undefined) meta.comment = m[3];
                        }
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to leave a channel.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.comment !== undefined)
                            self.irc.sendMsg('PART ' + meta.channel + ' :' + meta.comment);
                        else
                            self.irc.sendMsg('PART ' + meta.channel);
                    }
                },
                list: {
                    helpUsage: 'Usage: /list [#channel [, #channel ...] ] [server]',
                    helpText: 'Get channel listing.',
                    parseParam: function (param, meta) {
                        if (param === undefined) {
                            // No parameters.
                        }
                        else {
                            // Parse form: channels and server.
                            var m = /^([#&+!][^\s,:\cg]+(\s*,\s*[#&+!][^\s,:\cg]+)*)(\s+(\S+))?\s*$/.exec(param);
                            if (m !== null) {
                                meta.channels = m[1].split(/\s*,\s*/);
                                
                                if (m[4] !== undefined) {
                                    meta.server = m[4];
                                }
                            }
                            else {
                                // Parse form: server only
                                m = /^(\S+)\s*$/.exec(param);
                                if (m !== null) {
                                    meta.server = m[1];
                                }
                                else {
                                    // Unable to parse parameters.
                                    meta.error = self.cmdDefs['list'].helpUsage;
                                    return false;
                                }
                            }
                        }
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to get the channel listing.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.channels !== undefined) {
                            if (meta.server !== undefined) {
                                self.irc.sendMsg('LIST ' + meta.channels.join(',') + ' ' + meta.server);
                            }
                            else {
                                self.irc.sendMsg('LIST ' + meta.channels.join(','));
                            }
                        }
                        else if (meta.server !== undefined) {
                            self.irc.sendMsg('LIST ' + meta.server);
                        }
                        else {
                            self.irc.sendMsg('LIST');
                        }
                    }
                },
                me: {
                    helpUsage: 'Usage: /me &lt;message&gt;',
                    helpText: 'Send an action message to currently selected channel or nick.',
                    parseParam: function (param, meta) {
                        var usage = self.cmdDefs['msg'].helpUsage;
                        
                        if (param === undefined) {
                            meta.error = usage;
                            return false;
                        }
                        
                        meta.target = self.irc.target();
                        meta.message = param;
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to send an action message.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelAction(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelAction', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                        else {
                            self.irc.sendPrivateAction(meta.target, meta.message);
                            self.writeTmpl('outgoingPrivateAction', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                    }
                },
                mode: {
                    helpUsage: 'Usage: /mode &lt;nick | #channel&gt; [ &lt;+mode | -mode&gt; [parameters] ]',
                    helpText: [
                        'Get or change user or channel mode.',
                        'Available user modes: http://tools.ietf.org/html/rfc2812#section-3.1.5',
                        'Available channel modes: http://tools.ietf.org/html/rfc2811#section-4'
                    ],
                    parseParam: function (param, meta) {
                        var usage = self.cmdDefs['mode'].helpUsage;
                        var m = /^(\S+)(\s+(\S+(\s+\S+)*))?\s*$/.exec(param);
                        if (m == null) {
                            meta.error = usage;
                            return false;
                        }
                        
                        meta.target = m[1];
                        
                        if (m[3] !== undefined)
                            meta.modes = m[3].split(/\s+/);
                    
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to change mode.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.modes !== undefined)
                            self.irc.sendMsg('MODE ' + meta.target + ' ' + meta.modes.join(' '));
                        else
                            self.irc.sendMsg('MODE ' + meta.target);
                    }
                },
                motd: {
                    helpUsage: 'Usage: /motd [server]',
                    helpText: [
                        'Get the server message of the day.',
                        'If server parameter is omitted, query current server.'
                    ],
                    parseParam: function (param, meta) {
                        meta.server = param;
                    
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to get server motd.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.server !== undefined && meta.server.length > 0)
                            self.irc.sendMsg('MOTD ' + meta.server);
                        else
                            self.irc.sendMsg('MOTD');
                    }
                },
                msg: {
                    helpUsage: 'Usage: /msg &lt;nick|#channel&gt; &lt;message&gt;',
                    helpText: 'Send a private message to a nick.',
                    parseParam: function (param, meta) {
                        var usage = self.cmdDefs['msg'].helpUsage;
                        
                        if (param === undefined) {
                            meta.error = usage;
                            return false;
                        }
                        
                        var m = /^(\S+)\s+(.+)$/.exec(param);
                        if (m === null || m.length != 3) {
                            meta.error = usage;
                            return false;
                        }
                        meta.target = m[1];
                        meta.message = m[2];
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to send a message.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelMsg(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelMsg', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                        else {
                            self.irc.sendPrivateMsg(meta.target, meta.message);
                            self.addToMsgSenders(meta.target);
                            self.writeTmpl('outgoingPrivateMsg', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                    }
                },
                nick: {
                    helpUsage: 'Usage: /nick &lt;nickname&gt;',
                    helpText: 'Change your nick.',
                    parseParam: function (param, meta) {
                        if (param === undefined) {
                            meta.error = self.cmdDefs['nick'].helpUsage;
                            return false;
                        }
                        
                        var params = param.split(/\s+/, 1);
                        meta.nick = params[0];

                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to change your nickname.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.irc.sendMsg('NICK ' + meta.nick);
                    }
                },
                notice: {
                    helpUsage: 'Usage: /notice &lt;nick|#channel&gt; &lt;message&gt;',
                    helpText: 'Send a notice to a nick or channel.',
                    parseParam: function (param, meta) {
                        var usage = self.cmdDefs['msg'].helpUsage;
                        
                        if (param === undefined) {
                            meta.error = usage;
                            return false;
                        }
                        
                        var m = /^(\S+)\s+(.+)$/.exec(param);
                        if (m === null || m.length != 3) {
                            meta.error = usage;
                            return false;
                        }
                        meta.target = m[1];
                        meta.message = m[2];
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to send a notice.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelNotice(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelNotice', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                        else {
                            self.irc.sendPrivateNotice(meta.target, meta.message);
                            self.writeTmpl('outgoingPrivateNotice', {
                                msg: {
                                    prefixNick: self.irc.state.nick,
                                    prefixUser: self.irc.state.ident,
                                    info: {
                                        target: meta.target,
                                        text: meta.message
                                    }
                                }
                            });
                        }
                    }
                },
                query: {
                    helpUsage: 'Usage: /query &lt;nick|#channel&gt;',
                    helpText: 'Select a nick or channel to send messages.',
                    parseParam: function (param, meta) {
                        if (param === undefined) {
                            meta.error = self.cmdDefs['query'].helpUsage;
                            return false;
                        }
                        
                        var params = param.split(/\s+/, 1);
                        meta.target = params[0];
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to query a target.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.queryTarget(meta.target);
                    }
                },
                quit: {
                    helpUsage: 'Usage: /quit [comment]',
                    helpText: 'Quit IRC session.',
                    parseParam: function (param, meta) {
                        meta.comment = param;
                    
                        if (!self.irc.state.isActivated && !self.isPendingActivation) {
                            meta.error = 'Error: Must be connected to quit.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.irc.target() !== undefined) self.queryTarget(undefined);
                        
                        var comment = meta.comment !== undefined ? meta.comment : self.options.quitMessage;
                        self.enableAutoReactivate = false;
                        if (self.isPendingActivation) {
                            self.isPendingActivation = false;
                            self.writeTmpl('error', { message: 'Server connection aborted.' });
                        }
                        else {
                            self.irc.sendMsg('QUIT :' + comment);
                        }
                    }
                },
                quote: {
                    helpUsage: 'Usage: /quote &gt;IRC request message&lt;',
                    helpText: 'Send a raw IRC request based on RFC2812.',
                    parseParam: function (param, meta) {
                        meta.param = param;
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to send a raw IRC request.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.irc.sendMsg(meta.param);
                    }
                },
                time: {
                    helpUsage: 'Usage: /time [server]',
                    helpText: [
                        'Get the server time.',
                        'If server parameter is omitted, query current server.'
                    ],
                    parseParam: function (param, meta) {
                        meta.server = param;
                    
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to get server time.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (meta.server !== undefined && meta.server.length > 0)
                            self.irc.sendMsg('TIME ' + meta.server);
                        else
                            self.irc.sendMsg('TIME');
                    }
                },
                topic: {
                    helpUsage: 'Usage: /topic [message]',
                    helpText: 'Get or set the selected channel\'s topic',
                    parseParam: function (param, meta) {
                        if (self.irc.target() === undefined) {
                            meta.error = 'Error: No target selected.  Doubleclick a channel or nick on the side bar or enter: /query &lt;nick|#channel&gt;.';
                            return false;
                        }
                        
                        if (!self.irc.state.isActivated) {
                            meta.error = 'Error: Must be connected to get or set the topic.';
                            return false;
                        }
                        
                        meta.topic = param;
                    },
                    exec: function (meta) {
                        if (meta.topic === undefined) {
                            self.irc.sendMsg('TOPIC ' + self.irc.target());
                        }
                        else {
                            self.irc.sendMsg('TOPIC ' + self.irc.target() + ' :' + meta.topic);
                        }
                    }
                },
                who: {
                    helpUsage: 'Usage: /who',
                    helpText: 'Get info on a nick.',
                    exec: function () {
                        self.irc.sendMsg('WHO');
                    }
                }
            },

            // Send line from user entry.
            // Parse out client commands and execute action.
            // If not a command, send as message to current target.
            sendLine: function (text) {
                // Parse out command and parameters.
                var m;
                if (m = /^\/(\S+)(\s+(.+))?/.exec(text)) {
                    var cmd = m[1].toLowerCase();
                    var param = m[3];
                    
                    if (self.cmdDefs[cmd] === undefined) {
                        self.writeTmpl('error', { message: 'Error: Unknown client command "' + cmd + '".' });
                    }
                    else {
                        var meta = {};
                        var cmdDef = self.cmdDefs[cmd];
                        if (cmdDef.parseParam && cmdDef.parseParam(param, meta) === false) {
                            if (meta.error) self.writeTmpl('error', { message: meta.error });
                        }
                        else {
                            cmdDef.exec(meta);
                        }
                    }
                }
                // Send text to selected target.
                else if (self.irc.state.isActivated) {
                    // Sanitize input.
                    if (self.irc.target() !== undefined) {
                        text = text.replace(/([\n\r])/gm, '');
                        if (text.length > 0) {
                            self.sendLine('/msg ' + self.irc.target() + ' ' + text);
                        }
                    }
                    else {
                        self.writeTmpl('error', { message: 'Error: No target selected.  Use: /query <nick|#channel> or /join <#channel>.' });
                    }
                }
                else {
                    self.writeTmpl('error', { message: 'Error: Cannot send message, client not activated.' });
                }
            },

            getShortTimestamp: function () {
                var d = new Date();
                return d.getHours() + ':' + self.padZero(d.getMinutes(), 2);
            },

            getLongTimestamp: function () {
                return new Date().toLocaleString();
            },
            
            padZero: function (n, digits) {
                var z = new Array(digits + 1).join('0');
                var pn = '' + z + n;
                return pn.substring(pn.length - digits);
            },

            formatTime: function(time) {
                var d = new Date();
                d.setTime(time * 1000);
                return d.toLocaleString();
            },
            
            isChannel: function (target) {
                return target.match(/^[#&+!][^\s,:\cg]+/);
            },

            // Determine if IRC console is scrolled to the bottom.
            isAtBottom: function () {
                var ircContent = self.ircElement.find('.ircConsole .content');
                return (ircContent[0].scrollTop + 4) >= (ircContent[0].scrollHeight - ircContent[0].clientHeight);
            },
            
            scrollToBottom: function () {
                var ircContent = self.ircElement.find('.ircConsole .content');
                ircContent[0].scrollTop = ircContent[0].scrollHeight;
            },
            
            stricmp: function (a, b) {
                return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
            },
            
            addToMsgSenders: function (nick) {
                if (self.stricmp(nick, self.irc.state.nick) != 0) {
                    self.msgSenders = $.grep(self.msgSenders, function (val) {
                        // Remove from array, if exists.
                        return self.stricmp(val, nick) != 0;
                    });
                    self.msgSenders.unshift(nick);
                    
                    // Preserve placement of auto complete reply index so that additions to the list don't interfere.
                    if (self.autoCompleteReplyIndex !== undefined) self.autoCompleteReplyIndex++;
                }
            },

            startsWith: function (subject, prefix, comparer) {
                return subject.length >= prefix.length &&
                    comparer(subject.substr(0, prefix.length), prefix) == 0;
            },

            // Find next match from a list, where the item is greater than seed.
            // comparer is function(a, b) returning -1, 0, or 1.
            getNextMatch: function (list, seed, comparer) {
                if (list.length > 0) {
                    if (seed === undefined || seed === null)
                        return list[0];
                        
                    // Find next match.
                    for (var i in list) {
                        var val = list[i];
                        if (comparer(val, seed) > 0) {
                            return val;
                        }
                    }
                    
                    // Wrap around to beginning of list.
                    return list[0];
                }
                else {
                    return undefined;
                }
            },
            
            // Equivalent of find("*"), but only returns text nodes.
            findTextNodes: function (node, predicate) {
                var next;
                var nodes = [];
 
                if (node.nodeType === 1) {
                    // Element node.
                    if (node = node.firstChild) {
                        do {
                            next = node.nextSibling;
                            nodes = nodes.concat(self.findTextNodes(node, predicate));
                        } while (node = next);
                    }
                }
                else if (node.nodeType === 3) {
                    // Text node.
                    if (predicate === undefined || predicate(node)) {
                        nodes.push(node);
                    }
                }
                
                return nodes;
            },

            findTextNodesForDecoration: function (el) {
                return self.findTextNodes(el, function (node) {
                    // Exclude already decorated elements.
                    // Exclude elements tagged with no-decorate class.
                    if ($(node).parent('a,.channel,.nick').length != 0 ||
                        $(node).parents('.no-decorate').length != 0)
                        return false;
                    else
                        return true;
                });
            },
            
            // Convert URL patterns into HTML links.
            linkifyURLs: function (el) {
                var nodes = self.findTextNodesForDecoration(el);
                
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var modified = false;
                    var html = $(node).text().replace(self.linkifyRegex, function (m, url) {
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
                };
            },

            //             [-scheme---------][-hostname------------][-port][-path----------][-querystring-----------------------------------------------------][anchor]
            linkifyRegex: /\b([a-z]{2,8}:\/\/([\w\-_]+(\.[\w\-_]+)*)(:\d+)?(\/[^\s\?\/<>]*)*(\?\&*([^\s=&#<>]+(=[^\s=&#<>]*)?(&[^\s=&#<>]+(=[^\s=&#<>]*)?)*)?)?(#\S+)?)/gi,

            // Decorate nicks found in text with span.
            decorateNicks: function (el, channel) {
                var nicks = undefined;
                if (self.irc.state !== undefined) {
                    nicks = $.map(self.irc.state.users, function (val, key) { return key; });
                }

                if (nicks === undefined || nicks.length == 0) return;
                
                // Convert array of nicks to regex expression.
                var nickExpr = $.map(nicks, function (nick) {
                    // Escape regex symbols.
                    return nick.replace(/([?*|.^$()\[\]{}\\/])/, "\\$1");
                }).join('|');
                var re = new RegExp("\\b(" + nickExpr + ")\\b", 'ig');
                
                var nodes = self.findTextNodesForDecoration(el);
                
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var modified = false;
                    var html = $(node).text().replace(re, function (m, nick) {
                        var colorizeNumber = undefined;
                        if (channel !== undefined && self.isChannel(channel)) {
                            // Lookup nick's colorize number for given channel.
                            if (self.irc.state.channels[channel] !== undefined &&
                                self.irc.state.channels[channel].members[nick] !== undefined) {
                                colorizeNumber = self.irc.state.channels[channel].members[nick].colorizeNumber;
                            }
                        }
                        
                        modified = true;

                        if (colorizeNumber !== undefined) {
                            return '<span class="nick color' + colorizeNumber + '">' + nick + '</span>'
                        }
                        else {
                            return '<span class="nick">' + nick + '</span>'
                        }
                    });
                    
                    if (modified) {
                        var newNode = $('<span/>').append(html);
                        $(node).replaceWith(newNode);
                    }
                };
            },

            // Decorate channel-like text with span.
            decorateChannels: function (el) {
                var nodes = self.findTextNodesForDecoration(el);
                
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
            },
            
            clearSelection: function () {
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                }
                else if (document.selection) {
                    document.selection.empty();
                }
            },

            writeLine: function (html) {
                self.messageCount++;
                self.incrementNotificationMessageCount();

                var ircContent = self.ircElement.find('.ircConsole .content');
                var lineElement;

                var write = function (element) {
                    // Is the console's scroll within 4 pixels from the bottom?
                    var atBottom = self.isAtBottom();
                    
                    // Auto decorate nicks and channels in message.
                    var channel = element.find('.prefix .channel').text();
                    element.closest('.channelMsg,.privateMsg,.TOPIC,.LIST,.serverMsg,.clientMsg').find('.message')
                        .each(function () {
                            self.linkifyURLs(this);
                            self.decorateChannels(this);
                            self.decorateNicks(this, channel);
                        });
                    
                    // Add doubleclick handler on nick and channel to auto-query.
                    element.find('.nick,.channel')
                        .hover(self.hoverClickableHandler, self.leaveClickableHandler)
                        .dblclick(self.dblclickChannelNickHandler);
                        
                    // Detect if my nick was mentioned in a channel message.
                    element.closest('.channelMsg').find('.message .nick')
                        .filter(function () {
                            return self.irc.state !== undefined && self.stricmp($(this).text(), self.irc.state.nick) == 0;
                        })
                        .first()
                        .filter(function () {
                            // Check if this message is written by me.  If I wrote it, skip highlighting.
                            var prefixNick = element.find('.prefix .nick').text();
                            return self.irc.state !== undefined && self.stricmp(prefixNick, self.irc.state.nick) != 0;
                        })
                        .each(function () {
                            element.closest('.channelMsg').addClass('nickHighlight');
                        });

                    // Add line to console.
                    var lineElement = $('<div class="line"/>')
                        .attr('mc', self.messageCount)
                        .append(element)
                        .appendTo(ircContent);
                        
                    if (!self.isWindowFocused) {
                        if (self.blurMessageCount === (self.messageCount - 1)) {
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
                    if (atBottom) self.scrollToBottom();
                    
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
            },
            
            writeTmpl: function (templateName, data) {
                data['self'] = self;
                var el = $('<div/>')
                    .append($.tmpl(templateName, data));
                return self.writeLine(el.html());
            },

            // Resize elements to proper alignment based on ircConsole's dimensions.
            alignUI: function () {
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
            },
            
            // Get total padding/margin of left and right sides of an element.
            getSpacingX: function (el) {
                return $(el).parent().outerWidth() + $(el).parent().width();
            },
            
            getSpacingY: function (el) {
                return $(el).parent().outerHeight() + $(el).parent().height();
            },

            hoverClickableHandler: function () {
                $(this).addClass('ui-state-hover');
            },
            
            leaveClickableHandler: function () {
                $(this).removeClass('ui-state-hover');
            },
            
            dblclickChannelNickHandler: function () {
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

                    if (self.irc.state !== undefined && self.stricmp(target, self.irc.state.nick) != 0) {
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
            },

            joinChannel: function (channel, key) {
                if (self.irc.state.channels[channel] !== undefined) {
                    // If already joined to this channel, just query it.
                    self.queryTarget(channel);
                }
                else {
                    if (key !== undefined)
                        self.irc.sendMsg('JOIN ' + channel + ' ' + key);
                    else
                        self.irc.sendMsg('JOIN ' + channel);
                }
            },

            queryTarget: function (target) {
                if (window.console) console.log('queryTarget(' + target + ')');
                var prevTarget = self.irc.target();
                
                if (target !== prevTarget) {
                    self.irc.target(target);

                    self.writeTmpl(target === undefined ? 'queryOff' : 'query', {
                        target: target,
                        prevTarget: prevTarget
                    });

                    // Update user mode line.
                    self.ircElement.find('.targetFragment').fadeOut(null, function () {
                        self.ircElement.find('.targetLabel').text(target);
                        if (target !== undefined && target !== null) {
                            var isChannel = self.isChannel(target);
                            self.ircElement.find('.targetLabel')
                                .removeClass(isChannel ? 'nick' : 'channel')
                                .addClass(isChannel ? 'channel' : 'nick');
    
                            self.ircElement.find('.targetFragment').fadeIn();
                        }
                    });
                }
            },
            
            // Handle renaming of a nick of any user.
            getJoinedChannels: function () {
                var channels = [ ];
                
                if (self.irc.state !== undefined) {
                    for (var channel in self.irc.state.channels) {
                        channels.push(channel);
                    }
                }

                return channels.sort(self.stricmp);
            },
            
            getChannelMembers: function (channel) {
                var members = [ ];
                
                if (self.irc.state !== undefined) {
                    var channelDesc = self.irc.state.channels[channel];
                    
                    if (channelDesc !== undefined) {
                        for (var member in channelDesc.members) {
                            members.push(member);
                        }
                    }
                }
                
                return members.sort(self.stricmp);
            },

            getColorizeCSSClass: function (nick, channel) {
                var number = self.getColorizeNumber(nick, channel);
                return number !== undefined ? 'color' + number : '';
            },
            
            getColorizeNumber: function (nick, channel) {
                var channelDesc = self.irc.state.channels[channel];
                if (channelDesc === undefined) return;
                
                return channelDesc.members[nick] !== undefined ?
                    channelDesc.members[nick].colorizeNumber : undefined;
            },
            
            // Get length of an object array.
            // Based on: http://stackoverflow.com/questions/5223/length-of-javascript-associative-array
            getLength: function (obj) {
                if (obj.length) {
                    // Non-object array.
                    return obj.length;
                }
                else if (Object.keys) {
                    // Object
                    return Object.keys(obj).length;
                }
                else {
                    // Object.  Manually counting elements.
                    var size = 0;
                    
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) size++;
                    }
                    
                    return size;
                }
            },
            
            // Clone an object or array structure.  Does not preserve prototype.
            // Based on: http://my.opera.com/GreyWyvern/blog/show.dml/1725165
            clone: function(obj) {
                var newObj = (obj instanceof Array) ? [] : {};
                for (key in obj) {
                    newObj[key] = (obj[key] && typeof obj[key] === "object") ? self.clone(obj[key]) : obj[key];
                }
                return newObj;
            },
            
            // Update browser title from template.
            refreshTitle: function () {
                var newTitle = $.tmpl('title', {
                    self: self,
                    defaultTitle: options.title,
                    messageCount: self.notificationMessageCount
                }).text();

                if (newTitle != document.title) document.title = newTitle;
            },

            // Update title when notifications occur and user isn't focused on the browser.
            incrementNotificationMessageCount: function () {
                if (!self.isWindowFocused) {
                    self.notificationMessageCount++;
                    self.refreshTitle();
                }
            },
            
            acceptAutoComplete: function () {
                //if (window.console) console.log('acceptAutoComplete()');
                if (self.autoCompleteReplyIndex !== undefined || self.autoCompletePrefix !== undefined) {
                    self.ircElement.find('.userEntry').each(function () {
                        // Move caret to end of selection.
                        this.selectionStart = this.selectionEnd;
        
                        // Clear autocomplete state.
                        self.autoCompleteReplyIndex = undefined;
                        self.autoCompletePrefix = undefined;
                    });
                }
            },
            
            rejectAutoComplete: function () {
                //if (window.console) console.log('rejectAutoComplete()');
                if (self.autoCompleteReplyIndex !== undefined || self.autoCompletePrefix !== undefined) {
                    self.ircElement.find('.userEntry').each(function () {
                        // Remove autocomplete suggestion.
                        var s = $(this).val();
                        var s1 = this.selectionStart > 1 ? s.substr(0, this.selectionStart) : '';
                        var s2 = this.selectionEnd < s.length ? s.substr(this.selectionEnd) : '';
                        //console.log('s1: "' + s1 + '", s2: "' + s2 + '"');
                        var caretPos = this.selectionStart;
                        
                        $(this).val(s1 + s2);
                        this.selectionStart = caretPos;
                        this.selectionEnd = caretPos;
                    });
                    
                    self.autoCompleteReplyIndex = undefined;
                    self.autoCompletePrefix = undefined;
                }
            },
            
            incrementAutoComplete: function () {
                //if (window.console) console.log('incrementAutoComplete()');
                var userEntry = self.ircElement.find('.userEntry');
                var s = userEntry.val();
                    
                if (s == '' || self.autoCompleteReplyIndex !== undefined) {
                    // When user entry is blank, autocomplete as reply to recent private message senders.
                    if (self.msgSenders.length) {
                        if (self.autoCompleteReplyIndex === undefined) self.autoCompleteReplyIndex = 0;
                        
                        // Quick send message to next recent sender.
                        var s = '/msg ' + self.msgSenders[self.autoCompleteReplyIndex] + ' ';
                        userEntry.val(s);
                        userEntry[0].selectionStart = 0;
                        userEntry[0].selectionEnd = s.length;
                        
                        self.autoCompleteReplyIndex++;
                        if (self.autoCompleteReplyIndex >= self.msgSenders.length) self.autoCompleteReplyIndex = 0;
                    }
                }
                else {
                    // Autocomplete.
                    var caretPos = userEntry[0].selectionEnd;
                    if (self.autoCompletePrefix === undefined) {
                        // Advance caret to end of word.
                        var m1 = s.substr(caretPos).match(/^\S+/);
                        if (m1 != null) caretPos += m1[0].length;
                        
                        // Get last word of user entry, up to the caret position.
                        var m2 = /\S+$/.exec(s.substr(0, caretPos));
                        if (m2 !== null) {
                            self.autoCompletePrefix = m2[0];
                            self.autoCompleteSuggest = undefined;
                        }
                    }
                    else {
                        // Delete selected text from last suggestion.
                        var s1 = '';
                        if (userEntry[0].selectionStart > 0) s1 += s.substr(0, userEntry[0].selectionStart);
                        if (userEntry[0].selectionEnd < s.length) s1 += s.substr(userEntry[0].selectionEnd);
                        s = s1;
                        userEntry[0].selectionEnd = userEntry[0].selectionStart;
                        caretPos = userEntry[0].selectionStart;
                    }
                    
                    if (self.autoCompletePrefix !== undefined) {
                        var myNick = self.irc.state.nick;
                        
                        if (self.isChannel(self.autoCompletePrefix)) {
                            // When string looks like a channel, autocomplete from joined channel list.
                            var channels = $.grep(self.getJoinedChannels(), function (val) {
                                return self.startsWith(val, self.autoCompletePrefix, self.stricmp) && self.stricmp(val, myNick) != 0;
                            });
                            
                            self.autoCompleteSuggest = self.getNextMatch(channels, self.autoCompleteSuggest, self.stricmp);
                                
                            // Replace last word with autoCompleteSuggest.
                            if (self.autoCompleteSuggest !== undefined) {
                                var s1 = s.substr(0, caretPos).replace(/(\S+)$/, self.autoCompleteSuggest);
                                s = s1 + s.substr(caretPos);
                                userEntry.val(s);
    
                                // Select suggested portion of autocomplete.
                                userEntry[0].selectionStart = s1.length - self.autoCompleteSuggest.length + self.autoCompletePrefix.length;
                                userEntry[0].selectionEnd = s1.length;
                            }
                        }
                        else if (self.irc.target() !== undefined && self.isChannel(self.irc.target())) {
                            // When a channel is selected, autocomplete that channel's users.
                            var nicks = $.grep(self.getChannelMembers(self.irc.target()), function (val) {
                                return self.startsWith(val, self.autoCompletePrefix, self.stricmp) && self.stricmp(val, myNick) != 0;
                            });
                            
                            self.autoCompleteSuggest = self.getNextMatch(nicks, self.autoCompleteSuggest, self.stricmp);
                                
                            // Replace last word with autoCompleteSuggest.
                            if (self.autoCompleteSuggest !== undefined) {
                                var s1 = s.substr(0, caretPos).replace(/(\S+)$/, self.autoCompleteSuggest);
                                var wordpos = s1.length - self.autoCompleteSuggest.length;
                                // If this is the only word on the line, assume it's to address the suggested user.
                                if (wordpos == 0) s1 += ': ';
                                s = s1 + s.substr(caretPos);
                                userEntry.val(s);
    
                                // Select suggested portion of autocomplete.
                                userEntry[0].selectionStart = wordpos + self.autoCompletePrefix.length;
                                userEntry[0].selectionEnd = s1.length;
                            }
                        }
                    }
                }
            },

            refreshSideBar: function () {
                if (!self.freezeSideBar) {
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
                        .hover(self.hoverClickableHandler, self.leaveClickableHandler)
                        .dblclick(self.dblclickChannelNickHandler);
                }
            },
            
            methods: {
                // Resize chatmoreUI element.
                // Args: width, height.
                resize: function (args) {
                    var ircConsole = self.ircElement.find('.ircConsole');
                    var sideBar = self.ircElement.find('.sideBar');
                    var userEntrySection = self.ircElement.find('.userEntrySection');
                    
                    ircConsole
                        .outerWidth(args.width - sideBar.outerWidth())
                        .outerHeight(args.height - userEntrySection.outerHeight());
                    
                    self.alignUI();
                    
                    return self;
                },
                // Determine if console is scrolled to the bottom.
                isAtBottom: function () {
                    return self.isAtBottom();
                },
                // Scroll console to bottom.
                scrollToBottom: function () {
                    self.scrollToBottom();
                    return self;
                },
                // Bind event 'stateChanged'.  Signature: callback(state)
                stateChanged: function (callback) {
                    self.ircElement.bind('stateChanged', function () {
                        callback.call(self.ircElement, self.irc.state);
                    });
                    return self;
                },
                // Bind event 'processedMessage'.  Signature: callback(array_of_msgs)
                processedMessage: function (callback) {
                    self.ircElement.bind('processedMessage', function () {
                        callback.call(self.ircElement);
                    });
                    return self;
                }
            }
        };

        //
        // Initialization.
        //
        // Save object in element.
        self.ircElement.data('chatmore', self);

        // Client command aliases.
        self.cmdDefs['j'] = self.cmdDefs['join'];
        self.cmdDefs['k'] = self.cmdDefs['kick'];
        self.cmdDefs['l'] = self.cmdDefs['leave'];
        self.cmdDefs['m'] = self.cmdDefs['msg'];
        self.cmdDefs['n'] = self.cmdDefs['notice'];
        self.cmdDefs['q'] = self.cmdDefs['query'];

        // Compile templates.
        $.each(self.tmpls, function (name, tmpl) {
            $.template(name, tmpl);
        });

        // Track browser window focus.
        $(window)
            .focus(function () {
                // Restore title when user comes back to the window.
                setTimeout(function () {
                    self.notificationMessageCount = 0;
                    self.refreshTitle();
                }, 200);
                
                if (!self.isWindowFocused) {
                    self.isWindowFocused = true;
                    self.ircElement.find('.userEntry').focus();
                    
                    // Indicate new messages since blur.
                    if (self.blurMessageCount) {
                        var msgElements = self.ircElement.find('.ircConsole .content > .line.new');
                        msgElements.fadeTo(2000, 1, 'easeOutExpo');
                    }
                    
                    self.blurMessageCount = undefined;
                }
            })
            .blur(function () {
                self.isWindowFocused = false;
                self.blurMessageCount = self.messageCount;
            });
        
        // Setup chatmore event handlers.
        self.ircElement
            .bind('localMessage', function (e, message, type, data) {
                if (window.console) console.log('UI event: localMessage');
                switch (data.code) {
                case 'R1':
                    // Retrying registration with new nick.
                    self.writeTmpl('retryRegistration', {});
                    break;
                    
                case 'RE1':
                    // Registration failed.  Abort activation.
                    var message = data.maxRegistrationAttempts > 1 ?
                        'Registration failed.  Unable to register with a unique nickname after ' + data.maxRegistrationAttempts + ' attempts.  Please reconnect with a unique nickname.' :
                        'Registration failed.  Please reconnect with a unique nickname.';
                    self.writeTmpl(type, { message: message });
                        
                    self.enableAutoReactivate = false;
                    self.deactivateClient();
                    break;
                
                default:
                    self.writeTmpl(type, { message: message });
                }
            })
            .bind('processingMessage', function (e, msg) {
                switch (msg.type) {
                case 'recv':
                    // Ensure user is in user state.
                    self.irc.state.addUser(msg.prefixNick);

                    switch (msg.command) {
                    case '433': // ERR_NICKNAMEINUSE
                        self.writeTmpl('nickInUse', { msg: msg });
                        break;
                    }
                }
            })
            .bind('processedMessage', function (e, msg) {
                switch (msg.type) {
                case 'recv':
                    switch (msg.command) {
                    case 'PRIVMSG':
                        if (self.stricmp(msg.info.target, self.irc.state.nick) == 0) {
                            self.writeTmpl(msg.info.isAction ? 'incomingPrivateAction' : 'incomingPrivateMsg', { msg: msg });
                            if (!msg.info.isAction) {
                                // Add this sender to the history of senders.
                                self.addToMsgSenders(msg.prefixNick);
                            }
                        }
                        else
                            self.writeTmpl(msg.info.isAction ? 'incomingChannelAction' : 'incomingChannelMsg', { msg: msg });
                        break;
                    
                    case 'NOTICE':
                        if (self.stricmp(msg.info.target, self.irc.state.nick) == 0) {
                            self.writeTmpl('incomingPrivateNotice', { msg: msg });

                            // Add this sender to the history of senders.
                            self.addToMsgSenders(msg.prefixNick);
                        }
                        else
                            self.writeTmpl('incomingChannelNotice', { msg: msg });
                        break;
                        
                    case 'JOIN':
                        self.writeTmpl('join', { msg: msg });

                        // Auto-query newly joined channel.
                        if (self.stricmp(msg.prefixNick, self.irc.state.nick) == 0) {
                            self.queryTarget(msg.info.channel);
                        }

                        break;
                        
                    case 'PART':
                        self.writeTmpl('leave', { msg: msg });                        
                        break;
                        
                    case 'KICK':
                        $.each(msg.info.kicks, function (i, kick) {
                            self.writeTmpl('kick', {
                                channel: kick.channel,
                                nick: kick.nick,
                                op: msg.prefixNick,
                                comment: msg.info.comment
                            });
                        });
                        break;
                        
                    case 'MODE':
                        self.writeTmpl('mode', { msg: msg });
                        break;
                    
                    case 'NICK':
                        self.writeTmpl('nick', { msg: msg });
                                                
                        // If selected target's nick changes, update target.
                        if (self.irc.target() !== undefined && self.stricmp(msg.prefixNick, self.irc.target()) == 0) {
                            self.queryTarget(msg.info.nick);
                        }
                        break;
                        
                    case 'TOPIC':
                        self.writeTmpl('changeTopic', { msg: msg });
                        break;
                        
                    case 'QUIT':
                        self.writeTmpl('quit', { msg: msg });
                        break;
                        
                    case 'ERROR':
                        self.writeTmpl('error', {
                            message: msg.info.message
                        });
                        break;

                    case '001': // Welcome
                        // Auto-join channels.
                        if (window.console) console.log('options.channels:');
                        if (window.console) console.log(self.options.channels);
                        if (self.options.channels !== undefined && self.options.channels.length > 0) {
                            $.each(self.options.channels.sort(self.stricmp).reverse(), function (idx, channel) {
                                if (window.console) console.log('Joining channel: ' + channel);
                                self.irc.sendMsg('JOIN ' + channel);
                            });
                        };
                        break;
                        
                    case '252': // RPL_LUSEROP
                    case '253': // RPL_LUSERUNKNOWN
                    case '254': // RPL_LUSERCHANNELS
                        self.writeTmpl('serverMsgNumber', { msg: msg });
                        break;
                        
                    case '322': // RPL_LIST
                        self.writeTmpl('list', { msg: msg });
                        break;
                        
                    case '331': // RPL_NOTOPIC
                        self.writeTmpl('notopic', { msg: msg });
                        break;
                        
                    case '332': // RPL_TOPIC
                        self.writeTmpl('topic', { msg: msg });
                        break;
                        
                    case '333': // Topic set by
                        self.writeTmpl('topicSetBy', { msg: msg });
                        break;
                        
                    case '391': // RPL_TIME
                        self.writeTmpl('serverTime', { msg: msg });
                        break;
                        
                    case '403': // ERR_NOSUCHCHANNEL
                        self.writeTmpl('serverMsg', { message: msg.info.message });
                        break;

                    // Disregard these messages.
                    case '004': // RPL_MYINFO
                    case '005': // RPL_BOUNCE
                    case '323': // RPL_LISTEND
                    case '324': // RPL_CHANNELMODEIS
                    case '353': // RPL_NAMREPLY
                    case '366': // RPL_ENDOFNAMES
                    case '433': // ERR_NICKNAMEINUSE (handled in processingMessage)
                        break;
                        
                    default:
                        // Any other server message.
                        if (msg.info.message !== undefined) {
                            self.writeTmpl('serverMsg', { message: msg.info.message });
                        }
                        break;
                    }
                }
            })
            .bind('stateChanged', function (e) {
                if (window.console) console.log('UI event: stateChanged');
                if (window.console) console.log(self.irc.state);
                
                var state = self.irc.state;
                
                if (self.prevState === undefined || self.stricmp(state.nick, self.prevState.nick) !== 0) {
                    // Nick changed.
                    if (window.console) console.log('Nick changed.');
                    var nickLabel = self.ircElement.find('.nickLabel');
                    nickLabel.fadeOut(null, function () {
                        nickLabel.text(state.nick);
                        nickLabel.fadeIn();
                    });
                }

                // Auto-query first channel if selected channel is no longer joined.
                var channels = self.getJoinedChannels();
                if (self.irc.target() !== undefined && state.channels[self.irc.target()] === undefined) {
                    var channel = channels[0];
                    if (window.console) console.log('Selected channel is no longer joined.  Selecting first channel: ' + channel);
                    self.queryTarget(channel);
                }
                
                // Save channel list for possible reconnection event to rejoin currently joined channels.
                //self.options.channels = channels;
                
                self.refreshSideBar();
                
                self.prevState = self.clone(self.irc.state);
            })
            .bind('sendMsg', function (e, rawMsg) {
                if (window.console) console.log('Sent: ' + rawMsg);
            })
            .bind('activatingClient', function (e, stage, message, params) {
                switch (stage) {
                case 'start':
                    if (window.console) console.log('UI event: activatingClient start');
                    self.isPendingActivation = true;
                    self.ircElement.find('.userEntry').focus();
                    break;
                    
                case 'connecting':
                    if (window.console) console.log('UI event: activatingClient connecting');
                    var server = params.server + (params.port != 6667 ? (':' + params.port) : '');
                    self.writeTmpl('clientMsg', { message: 'Connecting to IRC server ' + server });
                    break;
                    
                case 'resuming':
                    if (window.console) console.log('UI event: activatingClient resuming');
                    var server = params.server + (params.port != 6667 ? (':' + params.port) : '');
                    self.writeTmpl('clientMsg', { message: 'Resuming existing IRC connection to ' + server });
                    self.freezeSideBar = false;

                    // Auto-join channels.
                    var channels = self.options.channels.sort(self.stricmp);
                    if (channels.length > 0) {
                        $.each(channels, function (idx, channel) {
                            if (window.console) console.log('Rejoining channel: ' + channel);
                            self.irc.sendMsg('JOIN ' + channel);
                            self.irc.sendMsg('NAMES ' + channel);
                        });

                        // Auto-query first channel.
                        self.queryTarget(channels[0]);
                    }
                    break;
                    
                case 'activated':
                    if (window.console) console.log('UI event: activatingClient activated');
                    self.ircElement
                        .removeClass('deactivated')
                        .addClass('activated');
                    self.reactivateAttempts = 0;
                    self.enableAutoReactivate = true;
                    self.isPendingActivation = false;
                    self.freezeSideBar = false;
                    break;

                case 'error':
                    if (window.console) console.log('UI event: activatingClient error');
                    self.isPendingActivation = false;
                    self.writeTmpl('error', { message: message });
                    break;
                }
            })
            .bind('deactivatingClient', function () {
                if (window.console) console.log('UI event: deactivatingClient');
                self.ircElement
                    .removeClass('activated')
                    .addClass('deactivated');
                
                if (self.enableAutoReactivate) {
                    // Attempt reactivation.
                    if (self.reactivateAttempts < self.options.reactivateAttempts) {
                        self.freezeSideBar = true;
                        self.isPendingActivation = true;
                        self.writeTmpl('error', { message: 'Server connection lost.  Retrying connection in ' + self.options.reactivateDelay + ' seconds...  Enter /quit to abort.' });

                        setTimeout(function () {
                            if (self.enableAutoReactivate) {
                                self.reactivateAttempts++;
                                self.irc.activateClient();
                            }
                        }, self.options.reactivateDelay * 1000);
                    }
                    else {
                        self.isPendingActivation = false;
                        self.writeTmpl('error', { message: 'Server connection lost and will not reconnect.  Sorry about that.' });
                        self.freezeSideBar = false;
                    }
                }
                else {
                    self.isPendingActivation = false;
                    self.writeTmpl('error', { message: 'Server connection closed.' });
                    self.freezeSideBar = false;
                }
            });
            
        // Setup user entry event handlers.
        self.ircElement.find('.userEntry')
            .click(function (e) {
                // Clicking on user entry assumes changing selection; accept autocomplete.
                self.acceptAutoComplete();
            })
            .keydown(function (e) {
                if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
                    if (e.keyCode === 13 /* Enter */) {
                        if (self.autoCompleteReplyIndex !== undefined || self.autoCompletePrefix !== undefined) {
                            // If presenting an autocomplete, accept it.
                            self.acceptAutoComplete();
                        }
                        else {
                            // Send message.
                            // Add new scratch line to user entry history.
                            self.userEntryHistory.unshift('');
                        
                            self.sendLine($(this).val());
                            $(this).val('');
                            
                            // Reset user entry history index.
                            self.userEntryHistoryIndex = undefined;
                        }
                        return false;
                    }
                    else if (e.keyCode === 27 /* Escape */) {
                        self.rejectAutoComplete();
                        return false;
                    }
                    else if (e.keyCode === 9 /* Tab */) {
                        // TODO: Support Shift+Tab to decrement autocomplete.
                        self.incrementAutoComplete();
                        return false;
                    }
                    else if (e.keyCode === 38 /* Arrow up */ || e.keyCode === 40 /* Arrow down */) {
                        if (self.userEntryHistoryIndex === undefined && self.userEntryHistory.length > 1) {
                            // Start browsing history, if any exists.
                            self.userEntryHistoryIndex = 0;
                        }
                        
                        if (self.userEntryHistoryIndex !== undefined) {
                            if (e.keyCode == '38') {
                                // Go to next oldest history entry.
                                self.userEntryHistoryIndex++;
                                if (self.userEntryHistoryIndex >= self.userEntryHistory.length)
                                    self.userEntryHistoryIndex = 0;
                            }
                            else {
                                // Go to next newest history entry.
                                self.userEntryHistoryIndex--;
                                if (self.userEntryHistoryIndex < 0)
                                    self.userEntryHistoryIndex = self.userEntryHistory.length - 1;
                            }
                        
                            // Display history in user entry.
                            var entry = self.userEntryHistory[self.userEntryHistoryIndex];
                            $(this).val(entry);
    
                            // Place caret at end of line.
                            this.selectionStart = entry.length;
                            this.selectionEnd = this.selectionStart;
                        }
                        
                        return false;
                    }
                }
            })
            .keypress(function (e) {
                // Ignore key codes handled from keyDown event.
                if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
                    if (e.keyCode === 13 || e.keyCode === 27 || e.keyCode === 9 ||
                        e.keyCode === 38 || e.keyCode === 40) {
                       return false;
                    }
                }
                
                // Typing text will accept a presented autocomplete.
                self.acceptAutoComplete();

                // Store current entry in first history element as scratch buffer.
                self.userEntryHistory[0] = $(this).val() + String.fromCharCode(e.which);
            })
            .focus();
        
        self.alignUI();
    
        if (options.server !== undefined) {
            self.irc = new chatmore(self.ircElement[0], options.server, options.port, options.nick, options.realname, {
                mustMatchServer: options.mustMatchServer
            });
            self.irc.activateClient();
        }
        
        return self.ircElement;
    }
    else {
        // Invoke method against chatmoreUI object.
        var method = p1;
        var args = p2;
        var self = $(this).data('chatmore');
        return self.methods[method].call(self, args);
    }
};
