$.fn.chatmore = function (p1, p2) {
    if (p1 === undefined) p1 = {};
    
    if (typeof(p1) == 'object') {
        // Construct UI widget.
        var options = p1;
        
        // Default options.
        if (options.nick === undefined) options.nick = 'user' + Math.floor(Math.random() * 10000);
        if (options.realname === undefined) options.realname = options.nick;
        if (options.port === undefined) options.port = 6667;
        if (options.title === undefined) options.title = document.title;
        if (options.notificationTitle === undefined) options.notificationTitle = 'A new message has arrived! -- ' + options.title;
        if (options.quitMessage === undefined) options.quitMessage = 'Chatmore IRC client';
        if (options.reactivateAttempts === undefined) options.reactivateAttempts = 6;
        if (options.reactivateDelay === undefined) options.reactivateDelay = 10;
        
        var self;
        self = {
            //
            // Private members.
            //
            ircElement: $(this),
            nick: options.nick,
            realname: options.realname,
            irc: undefined,

            quitMessage: options.quitMessage,
            defaultTitle: options.title,
            notificationTitle: options.notificationTitle,
            isWindowFocused: true,
            prevState: undefined,
            msgSenders: [],                    // History of private message senders for autocomplete.
            autoCompleteReplyIndex: undefined, // Autocomplete index against msgSenders array when replying to message senders.
            autoCompletePrefix: undefined,     // Autocomplete filter, word typed at first Tab completion.
            autoCompleteSuggest: undefined,    // Suggestion given from last Tab completion
            enableAutoReactivate: true,
            reactivateAttempts: 0,
            maxReactivateAttempts: options.reactivateAttempts,
            reactivateDelay: options.reactivateDelay,   // in seconds.
            freezeSideBar: false,               // True to disregard UI updates when calling refreshSideBar.

            // IRC client message templates.
            tmpls: {
                timestamp: '<span class="timestamp">[${self.getTimestamp()}]&nbsp;</span>',
                notePrefix: '<span class="prefix">***</span>',
                error: '{{tmpl "timestamp"}}<div class="error">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                usage: '{{tmpl "timestamp"}}<div class="usage">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                help: '{{tmpl "timestamp"}}<div class="help">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                serverMsg: '{{tmpl "timestamp"}}<div class="serverMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                clientMsg: '{{tmpl "timestamp"}}<div class="clientMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                outgoingChannelMsg: '{{tmpl "timestamp"}}<div class="channelMsg">' +
                    '<span class="prefix">&lt;<span class="channel">${channel}</span>:<span class="nick">${clientNick}</span>&gt;</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                outgoingPrivateMsg: '{{tmpl "timestamp"}}<div class="privateMsg">' +
                    '<span class="prefix">-&gt; *<span class="nick">${nick}</span>*</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                outgoingChannelAction: '{{tmpl "timestamp"}}<div class="channelMsg action">' +
                    '<span class="prefix">&lt;<span class="channel">${channel}</span>&gt; * <span class="nick">${clientNick}</span></span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                outgoingPrivateAction: '{{tmpl "timestamp"}}<div class="privateMsg action">' +
                    '<span class="prefix">-&gt; *<span class="nick">${nick}</span>* <span class="nick">${clientNick}</span></span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                outgoingChannelNotice: '{{tmpl "timestamp"}}<div class="channelNotice">' +
                    '<span class="prefix">-<span class="channel">${channel}</span>-</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                outgoingPrivateNotice: '{{tmpl "timestamp"}}<div class="privateNotice">' +
                    '<span class="prefix">-<span class="nick">${nick}</span>-</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingChannelMsg: '{{tmpl "timestamp"}}<div class="channelMsg">' +
                    '<span class="prefix">&lt;<span class="channel">${channel}</span>:<span class="nick">${nick}</span>&gt;</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingPrivateMsg: '{{tmpl "timestamp"}}<div class="privateMsg">' +
                    '<span class="prefix">*<span class="nick">${nick}</span>*</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingChannelAction: '{{tmpl "timestamp"}}<div class="channelMsg action">' +
                    '<span class="prefix">&lt;<span class="channel">${channel}</span>&gt; * <span class="nick">${nick}</span></span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingPrivateAction: '{{tmpl "timestamp"}}<div class="privateMsg action">' +
                    '<span class="prefix">* <span class="nick">${nick}</span></span>' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingPrivateNotice: '{{tmpl "timestamp"}}<div class="privateNotice">' +
                    '<span class="prefix">-<span class="nick">${nick}</span>-</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                incomingChannelNotice: '{{tmpl "timestamp"}}<div class="channelNotice">' +
                    '<span class="prefix">-<span class="channel">${channel}</span>:<span class="nick">${nick}</span>-</span> ' +
                    '<span class="message">${message}</span>' +
                    '</div>',
                queryOff: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">' +
                    '{{if /^[#&+!]/.test(prevTarget)}}' +
                        'You are no longer talking on channel <span class="channel">${prevTarget}</span>' +
                    '{{else}}' +
                        'Ending conversation with <span class="nick">${prevTarget}</span>' +
                    '{{/if}}' +
                    '</div>',
                query: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">' +
                    '{{if /^[#&+!]/.test(target)}}' +
                        'You are now talking on channel <span class="channel">${target}</span>' +
                    '{{else}}' +
                        'Starting conversation with <span class="nick">${target}</span>' +
                    '{{/if}}' +
                    '</div>',
                queryOffChannel: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">You are no longer talking to channel <span class="channel">${channel}</span></span>' +
                    '</div>',
                queryOffNick: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">Ending conversation with <span class="nick">${nick}</span></span>' +
                    '</div>',
                queryChannel: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">You are now talking to channel <span class="channel">${channel}</span></span>' +
                    '</div>',
                queryNick: '{{tmpl "timestamp"}}<div class="queryMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">Starting conversation with <span class="nick">${nick}</span></span>' +
                    '</div>',
                join: '{{tmpl "timestamp"}}<div class="JOIN">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message"><span class="nick">${nick}</span> <span class="message">(${ident}@${host}) has joined the channel</span>' +
                    '</div>',
                leave: '{{tmpl "timestamp"}}<div class="PART">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message"><span class="nick">${nick}</span> has left the channel{{if !!comment}}: ${comment}{{/if}}</span>' +
                    '</div>',
                kick: '{{tmpl "timestamp"}}<div class="KICK">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message"><span class="nick">${op}</span> has kicked <span class="nick">${nick}</span> from the channel{{if comment !== undefined}}: ${comment}{{/if}}</span>' +
                    '</div>',
                nick: '{{tmpl "timestamp"}}<div class="NICK">{{tmpl "notePrefix"}} <span class="message">' +
                    '{{if clientNick.toLowerCase() == prevNick.toLowerCase()}}' +
                        'Nick changed to <span class="nick">${nick}</span>' +
                    '{{else}}' +
                        '<span class="nick">${prevNick}</span> is now known as <span class="nick">${nick}</span>' +
                    '{{/if}}' +
                    '</span></div>',
                nickInUse: '{{tmpl "timestamp"}}<div class="serverMsg">' +
                    '{{tmpl "notePrefix"}} <span class="message">Nickname <span class="nick">${nick}</span> is already in use.</span>' +
                    '</div>',
                notopic: '{{tmpl "timestamp"}}<div class="TOPIC">' +
                    '{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; <span class="message">No topic is set</span>' +
                    '</div>',
                topic: '{{tmpl "timestamp"}}<div class="TOPIC">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message">The current topic is: <span class="topicMessage">${topic}</span></span>' +
                    '</div>',
                changeTopic: '{{tmpl "timestamp"}}<div class="TOPIC">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> <span class="message"><span class="nick">${nick}</span> ' +
                    '{{if topic == ""}}' +
                        'has cleared the topic' +
                    '{{else}}' +
                        'has changed the topic to: <span class="topicMessage">${topic}</span>' +
                    '{{/if}}' +
                    '</span></div>',
                topicSetBy: '{{tmpl "timestamp"}}<div class="TOPIC">' +
                    '<span class="prefix">*** &lt;<span class="channel">${channel}</span>&gt;</span> ' +
                    '<span class="message">Topic set by <span class="nick">${nick}</span> on <span class="time">${self.formatTime(time)}</span></span>' +
                    '</div>',
                serverTime: '{{tmpl "timestamp"}}<div class="TIME">' +
                    '{{tmpl "notePrefix"}} <span class="message">Server time for <span class="server">${server}</span>: <span class="time">${timeString}</span></span>' +
                    '</div>',
                quit: '{{tmpl "timestamp"}}<div class="QUIT">' +
                    '{{tmpl "notePrefix"}} <span class="message">Signoff: <span class="nick">${nick}</span> (${message})</span>' +
                    '</div>',
                error: '{{tmpl "timestamp"}}<div class="ERROR">' +
                    '{{tmpl "notePrefix"}} <span class="message">${message}</span>' +
                    '</div>',
                userMode: '{{tmpl "timestamp"}}<div class="MODE">' +
                    '{{tmpl "notePrefix"}} <span class="message">Mode change "<span class="modeString">${mode}</span>" for user <span class="nick">${target}</span> by <span class="nick">${nick}</span></span>' +
                    '</div>'
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
                        if (!self.irc.isActivated()) {
                            meta.error = 'Error: Must be connected to clear the topic.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        self.irc.sendMsg('TOPIC ' + self.irc.target() + ' :');
                    }
                },
                connect: {
                    helpUsage: 'Usage: /connect &lt;server&gt; [port]',
                    helpText: 'Connect to IRC server',
                    parseParam: function (param, meta) {
                        var m = /^(\S+)(\s+(\d+))?\s*$/.exec(param);
                        if (m === null) {
                            meta.error = self.cmdDefs['connect'].helpUsage;
                            return false;
                        }
                        
                        meta.server = m[1];
                        meta.port = m[3] === undefined ? 6667 : m[3];
                    },
                    exec: function (meta) {
                        var connectFunc = function () {
                            self.irc.deactivateClient();
                            
                            // Connect to server.
                            self.irc = new chatmore(self.ircElement.get(0), meta.server, meta.port, self.nick, self.realname, { mustMatchServer: true });
                            self.irc.activateClient();
                        };
                        
                        if (self.irc.isActivated()) {
                            // /quit, wait a moment, then deactivate and reconnect.
                            self.sendLine('/quit');
                            setTimeout(connectFunc, 1000);
                        }
                        else {
                            connectFunc();
                        }
                    }
                },
                help: {
                    helpUsage: 'Usage: /help &lt;command&gt;',
                    helpText: [
                        'Show help for client commands.',
                        'Commands:',
                        ' clear - Clear the chat console',
                        ' cleartopic - Clear the channel\'s topic',
                        ' connect - Connect to IRC server',
                        ' join - Join a channel',
                        ' kick - Kick user from channel',
                        ' leave - Leave a channel',
                        ' me - Send an action message',
                        ' motd - Get the server message of the day',
                        ' msg - Send a private message',
                        ' nick - Change your nick',
                        ' notice - Send a notice to a nick or channel',
                        ' query - Select a target for messaging',
                        ' quit - Quit IRC session',
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
                        
                        if (!self.irc.isActivated()) {
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
                        
                        if (!self.irc.isActivated()) {
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
                        
                        if (!self.irc.isActivated()) {
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
                        
                        if (!self.irc.isActivated()) {
                            meta.error = 'Error: Must be connected to send an action message.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelAction(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelAction', {
                                clientNick: self.irc.state().nick,
                                channel: meta.target,
                                message: meta.message
                            });
                        }
                        else {
                            self.irc.sendPrivateAction(meta.target, meta.message);
                            self.writeTmpl('outgoingPrivateAction', {
                                clientNick: self.irc.state().nick,
                                nick: meta.target,
                                message: meta.message
                            });
                        }
                    }
                },
                mode: {
                    helpUsage: 'Usage: /mode &lt;nick | channel&gt; [ &lt;+mode | -mode&gt; [parameters] ]',
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
                    
                        if (!self.irc.isActivated()) {
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
                    
                        if (!self.irc.isActivated()) {
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
                        
                        if (!self.irc.isActivated()) {
                            meta.error = 'Error: Must be connected to send a message.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelMsg(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelMsg', {
                                clientNick: self.irc.state().nick,
                                channel: meta.target,
                                message: meta.message
                            });
                        }
                        else {
                            self.irc.sendPrivateMsg(meta.target, meta.message);
                            self.writeTmpl('outgoingPrivateMsg', {
                                clientNick: self.irc.state().nick,
                                nick: meta.target,
                                message: meta.message
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

                        if (!self.irc.isActivated()) {
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
                        
                        if (!self.irc.isActivated()) {
                            meta.error = 'Error: Must be connected to send a notice.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.isChannel(meta.target)) {
                            self.irc.sendChannelNotice(meta.target, meta.message);
                            self.writeTmpl('outgoingChannelNotice', {
                                clientNick: self.irc.state().nick,
                                channel: meta.target,
                                message: meta.message
                            });
                        }
                        else {
                            self.irc.sendPrivateNotice(meta.target, meta.message);
                            self.writeTmpl('outgoingPrivateNotice', {
                                clientNick: self.irc.state().nick,
                                nick: meta.target,
                                message: meta.message
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
                        
                        if (!self.irc.isActivated()) {
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
                    
                        if (!self.irc.isActivated()) {
                            meta.error = 'Error: Must be connected to quit.';
                            return false;
                        }
                    },
                    exec: function (meta) {
                        if (self.irc.target() !== undefined) self.queryTarget(undefined);
                        
                        var comment = meta.comment !== undefined ? meta.comment : self.quitMessage;
                        self.enableAutoReactivate = false;
                        self.irc.sendMsg('QUIT :' + comment);
                    }
                },
                raw: {
                    helpUsage: 'Usage: /raw &gt;IRC request message&lt;',
                    helpText: 'Send a raw IRC request based on RFC2812.',
                    parseParam: function (param, meta) {
                        meta.param = param;
                        
                        if (!self.irc.isActivated()) {
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
                    
                        if (!self.irc.isActivated()) {
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
                            meta.error = 'Error: No target selected.  Use: /query &lt;nick|#channel&gt;.';
                            return false;
                        }
                        
                        if (!self.irc.isActivated()) {
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
                else if (self.irc.isActivated()) {
                    // Sanitize input.
                    if (self.irc.target() !== undefined) {
                        text = text.replace(/([\n\r])/gm, '');
                        if (text.length > 0) {
                            self.sendLine('/msg ' + self.irc.target() + ' ' + text);
                        }
                    }
                    else {
                        self.writeTmpl('error', { message: 'Error: No target selected.  Use: /query <nick|#channel>.' });
                    }
                }
                else {
                    self.writeTmpl('error', { message: 'Error: Cannot send message, client not activated.' });
                }
                
                self.ircElement.find('.userEntry').val('');
            },

            getTimestamp: function () {
                var d = new Date();
                return d.getHours() + ':' + self.padZero(d.getMinutes(), 2);
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
                return target.match(/^[#&+!]/);
            },
            
            stricmp: function (a, b) {
                return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
            },
            
            addToMsgSenders: function (nick) {
                if (self.stricmp(nick, self.irc.state().nick) != 0) {
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
                                    
            // Convert URL patterns into HTML links.
            linkifyURLs: function (html) {
                return html.replace(self.linkifyRegex, '<a href="$1" target="_blank">$1</a>');
            },
            linkifyRegex: /(https?:\/\/([\w\-_]+(\.[\w\-_]+)*)(:\d+)?(\/[^\s\?\/<>()]*)*(\?([^\s=&<>()]+=[^\s=&<>()]*(&[^\s=&<>()]+=[^\s=&<>()]*)*)?)?(#[\w_\-]+)?)/g,

            // Decorate nicks found in text with span.
            decorateNicks: function (html, nicks) {
                var nickExpr = nicks.join('|');
                var re = new RegExp("\\b(" + nickExpr + ")\\b", 'ig');
                return html.replace(re, '<span class="nick">$1</span>');
            },

            // Decorate channel-like text with span.
            decorateChannels: function (html) {
                return html.replace(/(^|\W)(#\w+)\b/g, '$1<span class="channel">$2</span>');
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
                var ircChannel = self.ircElement.find('.ircConsole .content');
                var el = ircChannel.get(0);
                var lineElement;

                var write = function (element) {
                    // Is the console's scroll within 4 pixels from the bottom?
                    var atBottom = (el.scrollTop + 4) >= (el.scrollHeight - el.clientHeight);
                    
                    // Auto decorate nicks and channels in message.
                    element.closest('.channelMsg,.PRIVMSG').find('.message')
                        .html(function (i, html) {
                            html = self.linkifyURLs(html);
                            if (self.irc.state() !== undefined) {
                                var nicks = $.map(self.irc.state().users, function (val, key) { return key; });
                                html = self.decorateNicks(html, nicks);
                            }
                            html = self.decorateChannels(html);
                            return html;
                        });
                    
                    // Add doubleclick handler on nick and channel to auto-query.
                    element.find('.nick,.channel')
                        .dblclick(self.dblclickChannelNickHandler);
                        
                    // Detect if my nick was mentioned in a channel message.
                    element.closest('.channelMsg').find('.message .nick')
                        .filter(function () {
                            return self.irc.state() !== undefined && self.stricmp($(this).text(), self.irc.state().nick) == 0;
                        })
                        .first()
                        .filter(function () {
                            // Check if this message is written by me.  If I wrote it, skip highlighting.
                            var prefixNick = element.find('.prefix .nick').text();
                            return self.irc.state() !== undefined && self.stricmp(prefixNick, self.irc.state().nick) != 0;
                        })
                        .each(function () {
                            element.closest('.channelMsg').addClass('nickHighlight');
                        });

                    // Add line to console.
                    var lineElement = $('<div class="line"/>')
                        .append(element)
                        .appendTo(ircChannel);
                        
                    // Auto scroll to bottom if currently at bottom.
                    if (atBottom) el.scrollTop = el.scrollHeight;
                    
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
                return self.writeLine(
                    $('<div/>')
                        .append($.tmpl(templateName, data))
                        .html()
                );
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
                userEntrySection.outerWidth(ircConsole.outerWidth());
                userEntryLine
                    .width(userEntrySection.width())
                    .innerHeight(userEntry.outerHeight() + 4 /* margin not included in outerHeight? */);
                userEntry.width(userEntryLine.width());
                sideBar.outerHeight(ircConsole.outerHeight() + userEntrySection.outerHeight());
                channelList.height(sideBar.height());
            },

            dblclickChannelNickHandler: function () {
                if (self.irc.isActivated()) {
                    // Get text of element, ignoring child elements.
                    var target = $(this)
                        .clone()
                        .children()
                        .remove()
                        .end()
                        .text();
                        
                    if (self.irc.state() !== undefined && target != self.irc.state().nick) {
                        if (self.isChannel(target)) {
                            // Check if joined to this channel.
                            if (self.irc.state() !== undefined && self.irc.state().channels[target] === undefined)
                                self.sendLine('/join ' + target);
                            else
                                self.queryTarget(target);
                        }
                        else {
                            self.queryTarget(target);
                        }
                                    
                        self.ircElement.find('.userEntry').focus();
                    }

                    // Unselect doubleclicked text.
                    self.clearSelection();
                }
            },

            joinChannel: function (channel, key) {
                if (self.irc.state().channels[channel] !== undefined) {
                    // If already joined to this channel, just query it.
                    self.queryTarget(channel);
                }
                else {
                    if (key !== undefined)
                        self.irc.sendMsg('JOIN ' + channel + ' ' + key);
                    else
                        self.irc.sendMsg('JOIN ' + channel);
                    
                    //self.queryTarget(channel);
                }
            },
            
            queryTarget: function (target) {
                var prevTarget = self.irc.target();
                
                self.irc.target(target);

                self.writeTmpl(target === undefined ? 'queryOff' : 'query', {
                    target: target,
                    prevTarget: prevTarget
                });

                // Update user mode line.
                self.ircElement.find('.targetFragment').fadeOut(null, function () {
                    self.ircElement.find('.targetLabel').text(target);
                    if (target !== undefined && target !== null) {
                        self.ircElement.find('.targetFragment').fadeIn();
                    }
                });
            },
            
            getJoinedChannels: function () {
                var channels = [];
                
                if (self.irc.state() !== undefined) {
                    for (var channel in self.irc.state().channels) {
                        channels.push(channel);
                    }
                }

                return channels.sort(self.stricmp);
            },
            
            getChannelMembers: function(channel) {
                var members = [];
                
                if (self.irc.state() !== undefined) {
                    var channelDesc = self.irc.state().channels[channel];
                    
                    if (channelDesc !== undefined) {
                        for (var member in channelDesc.members) {
                            members.push(member);
                        }
                    }
                }
                
                return members.sort(self.stricmp);
            },
            
            refreshSideBar: function () {
                if (!self.freezeSideBar) {
                    if (self.irc.state() === undefined) {
                        // If no state data, clear everything.
                        self.ircElement.find('.sideBar ul.channelList').empty();
                    }
                    else {
                        // TODO: Incrementally update channel/member lists to avoid rendering flaws of concurrent actions,
                        // such as incoming messages and user actions both changing state.
                        var channelList = self.ircElement.find('.sideBar ul.channelList');
                        var originalScrollTop = channelList.get(0).scrollTop;
                        
                        channelList.empty();

                        $.each(self.getJoinedChannels(), function (i, channel) {
                            var channelDesc = self.irc.state().channels[channel];
                            var channelElement = $('<li><span class="channel">' + channel + '</span><span class="leaveButton" title="Leave channel"></span></li>')
                                // Set topic as tooltip.
                                .find('.channel')
                                    .attr('title', channelDesc.topic)
                                    .end()
                                // Setup leave channel icon.
                                .find('.leaveButton')
                                    .click(function () {
                                        if (self.irc.isActivated()) {
                                            // Update UI and leave the channel.
                                            $(this).parent('li')
                                                .slideUp(400, 'swing', function () {
                                                    self.sendLine('/leave ' + channel);
                                                });
                                        }
                                    })
                                    .end()
                                .appendTo(channelList);
                            
                            var memberList = $('<ul class="memberList"/>')
                                .appendTo(channelElement);
                                
                            
                            $.each(self.getChannelMembers(channel), function (i, member) {
                                var memberDesc = channelDesc.members[member];
                                $('<li><span class="mode">' + memberDesc.mode + '</span><span class="nick">' + member + '</span></li>')
                                    .appendTo(memberList);
                            });
                        });
                        
                        // Scroll back to original spot.
                        channelList.get(0).scrollTop = originalScrollTop;
                        
                        // Apply doubleclick handler to channels and nicks.
                        channelList.find('.nick,.channel')
                            .dblclick(self.dblclickChannelNickHandler);
                    }
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
        // TODO: Test in IE.  May need to bind to $(document).
        $(window)
            .focus(function () {
                // Restore title when user comes back to the window.
                document.title = self.defaultTitle;
                self.isWindowFocused = true;
            })
            .blur(function () {
                self.isWindowFocused = false;
            });
        
        // Setup chatmore event handlers.
        self.ircElement
            .bind('localMessage', function (e, message, type) {
                self.writeTmpl(type, { message: message });
            })
            .bind('processingMessage', function (e, msg) {
                switch (msg.type) {
                case 'state':
                    self.prevState = self.irc.state();
                    break;
                }
            })
            .bind('processedMessage', function (e, msg) {
                switch (msg.type) {
                case 'state':
                    var state = self.irc.state();
                    self.nick = state.nick;
                    self.realname = state.realname;
                    
                    if (self.prevState === undefined || self.stricmp(self.nick, self.prevState.nick) != 0) {
                        // Nick changed.
                        var nickLabel = self.ircElement.find('.nickLabel');
                        nickLabel.fadeOut(null, function () {
                            nickLabel.text(self.nick);
                            nickLabel.fadeIn();
                        });
                    }

                    // Auto-query first channel if selected channel is no longer joined.
                    if (self.irc.target() !== undefined && state.channels[self.irc.target()] === undefined) {
                        self.queryTarget(self.getJoinedChannels()[0]);
                    }
                    
                    break;

                case 'recv':
                    switch (msg.command) {
                    case 'PRIVMSG':
                        // Update title when new messages arrive and user isn't focused on the browser.
                        if (!self.isWindowFocused) {
                            document.title = self.notificationTitle;
                        }

                        if (self.stricmp(msg.info.target, self.irc.state().nick) == 0) {
                            self.writeTmpl(msg.info.isAction ? 'incomingPrivateAction' : 'incomingPrivateMsg', {
                                clientNick: self.irc.state().nick,
                                nick: msg.prefixNick,
                                message: msg.info.text
                            });
                            if (!msg.info.isAction) {
                                // Add this sender to the history of senders.
                                self.addToMsgSenders(msg.prefixNick);
                            }
                        }
                        else
                            self.writeTmpl(msg.info.isAction ? 'incomingChannelAction' : 'incomingChannelMsg', {
                                clientNick: self.irc.state().nick,
                                nick: msg.prefixNick,
                                channel: msg.info.target,
                                message: msg.info.text
                            });
                        break;
                        
                    case 'NOTICE':
                        // Update title when new messages arrive and user isn't focused on the browser.
                        if (!self.isWindowFocused) {
                            document.title = self.notificationTitle;
                        }

                        if (self.stricmp(msg.info.target, self.irc.state().nick) == 0) {
                            self.writeTmpl('incomingPrivateNotice', {
                                clientNick: self.irc.state().nick,
                                nick: msg.prefixNick,
                                message: msg.info.text
                            });

                            // Add this sender to the history of senders.
                            self.addToMsgSenders(msg.prefixNick);
                        }
                        else
                            self.writeTmpl('incomingChannelNotice', {
                                clientNick: self.irc.state().nick,
                                nick: msg.prefixNick,
                                channel: msg.info.target,
                                message: msg.info.text
                            });
                        break;
                        
                    case 'JOIN':
                        self.writeTmpl('join', {
                            nick: msg.prefixNick,
                            ident: msg.prefixUser,
                            host: msg.prefixHost,
                            channel: msg.info.channel
                        });
                        
                        // Auto-query newly joined channel.
                        if (self.stricmp(msg.prefixNick, self.irc.state().nick) == 0) {
                            self.queryTarget(msg.info.channel);
                        }

                        break;
                        
                    case 'PART':
                        self.writeTmpl('leave', {
                            nick: msg.prefixNick,
                            ident: msg.prefixUser,
                            host: msg.prefixHost,
                            channel: msg.info.channel,
                            comment: msg.info.comment
                        });
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
                        self.writeTmpl('userMode', {
                            nick: msg.prefixNick,
                            target: msg.info.target,
                            mode: msg.info.mode
                        });
                        break;
                    
                    case 'NICK':
                        self.writeTmpl('nick', {
                            clientNick: self.irc.state().nick,
                            nick: msg.info.nick,
                            prevNick: msg.prefixNick
                        });
                        
                        // If selected target's nick changes, update target.
                        if (self.irc.target() !== undefined && self.stricmp(msg.prefixNick, self.irc.target()) == 0) {
                            self.queryTarget(msg.info.nick);
                        }
                        break;
                        
                    case 'TOPIC':
                        self.writeTmpl('changeTopic', {
                            clientNick: self.irc.state().nick,
                            channel: msg.info.channel,
                            nick: msg.prefixNick,
                            topic: msg.info.topic
                        });
                        break;
                        
                    case 'QUIT':
                        self.writeTmpl('quit', {
                            nick: msg.prefixNick,
                            message: msg.info.message
                        });
                        break;
                        
                    case 'ERROR':
                        self.writeTmpl('error', {
                            message: msg.info.message
                        });
                        break;

                    case '001': // Welcome
                        if (options.channel !== undefined) {
                            var channels = typeof(options.channel) == 'string' ? [options.channel] : options.channel;
                            for (var i in channels) {
                                self.joinChannel(channels[i]);
                            }
                        };
                        break;
                        
                    case '331': // RPL_NOTOPIC
                        self.writeTmpl('notopic', {
                            channel: msg.info.channel
                        });
                        break;
                        
                    case '332': // RPL_TOPIC
                        self.writeTmpl('topic', {
                            channel: msg.info.channel,
                            topic: msg.info.topic
                        });
                        break;
                        
                    case '333': // Topic set by
                        self.writeTmpl('topicSetBy', {
                            channel: msg.info.channel,
                            nick: msg.info.nick,
                            time: msg.info.time
                        });
                        break;
                        
                    case '391': // RPL_TIME
                        self.writeTmpl('serverTime', {
                            server: msg.info.server,
                            timeString: msg.info.timeString
                        });
                        break;
                        
                    case '433': // ERR_NICKNAMEINUSE
                        self.writeTmpl('nickInUse', {
                            nick: msg.info.nick
                        });
                        break;
                        
                    case '353': // RPL_NAMREPLY
                    case '366': // RPL_ENDOFNAMES
                        // Disregard these messages.
                        break;
                        
                    default:
                        if (/^\d{3}$/.test(msg.command)) {
                            // Any other server message.
                            var m;
                            if (m = /:(.+)/.exec(msg.params)) {
                                self.writeTmpl('serverMsg', { message: m[1] });
                            }
                        }
                        break;
                    }
                }
            })
            .bind('stateChanged', function (e) {
                if (console) console.log(self.irc.state());
                self.refreshSideBar();
            })
            .bind('sendMsg', function (e, rawMsg) {
                if (console) console.log('Sent: ' + rawMsg);
            })
            .bind('activatingClient', function (e, stage, message, params) {
                switch (stage) {
                case 'start':
                    self.ircElement.find('.userEntry').focus();
                    break;
                    
                case 'connecting':
                    var server = params.server + (params.port != 6667 ? (':' + params.port) : '');
                    self.writeTmpl('clientMsg', { message: 'Connecting to IRC server ' + server });
                    break;
                    
                case 'resuming':
                    var server = params.server + (params.port != 6667 ? (':' + params.port) : '');
                    self.writeTmpl('clientMsg', { message: 'Resuming existing IRC connection to ' + server });
                    self.freezeSideBar = false;
                    break;
                    
                case 'activated':
                    self.ircElement
                        .removeClass('deactivated')
                        .addClass('activated');
                    self.reactivateAttempts = 0;
                    self.enableAutoReactivate = true;
                    self.freezeSideBar = false;
                    
                    // Auto-query first channel on activation.
                    var firstChannel = self.getJoinedChannels()[0];
                    if (firstChannel !== undefined) self.queryTarget(firstChannel);
                    break;

                case 'error':
                    self.writeTmpl('error', { message: message });
                    break;
                }
            })
            .bind('deactivatingClient', function () {
                if (self.enableAutoReactivate) {
                    // Attempt reactivation.
                    if (self.reactivateAttempts < self.maxReactivateAttempts) {
                        self.freezeSideBar = true;
                        self.writeTmpl('error', { message: 'Server connection lost.  Retrying connection in ' + self.reactivateDelay + ' seconds...' });

                        setTimeout(function () {
                            self.reactivateAttempts++;
                            self.irc.activateClient();
                        }, self.reactivateDelay * 1000);
                    }
                    else {
                        self.writeTmpl('error', { message: 'Server connection lost and will not reconnect.  Sorry about that.' });
                        self.freezeSideBar = false;
                    }
                }
                else {
                    self.writeTmpl('error', { message: 'Server connection closed.' });
                    self.freezeSideBar = false;
                }
            });
            
        // Setup user entry event handlers.
        self.ircElement.find('.userEntry')
            .click(function (e) {
                // Clicking on user entry assumes changing selection; clears autocomplete state.
                self.autoCompleteReplyIndex = undefined;
                self.autoCompletePrefix = undefined;
            })
            .keydown(function (e) {
                if (e.keyCode == '13') {
                    // Enter.
                    self.sendLine(self.ircElement.find('.userEntry').val());
                    return false;
                }
                else if (e.keyCode == '9') {
                    // Tab.
                    if (e.preventDefault) e.preventDefault();   // Firefox: block default Tab functionality.
                    
                    if (self.irc.isActivated()) {
                        var userEntry = self.ircElement.find('.userEntry').val();
                        
                        if (userEntry == '' || self.autoCompleteReplyIndex !== undefined) {
                            if (self.msgSenders.length) {
                                if (self.autoCompleteReplyIndex === undefined) self.autoCompleteReplyIndex = 0;
                                
                                // Quick send message to next recent sender.
                                self.ircElement.find('.userEntry').val('/msg ' + self.msgSenders[self.autoCompleteReplyIndex] + ' ');
                                
                                self.autoCompleteReplyIndex++;
                                if (self.autoCompleteReplyIndex >= self.msgSenders.length) self.autoCompleteReplyIndex = 0;
                            }
                        }
                        else {
                            // Autocomplete.
                            var caretPos = self.ircElement.find('.userEntry').get(0).selectionEnd;
                            if (self.autoCompletePrefix === undefined) {
                                // Advance caret to end of word.
                                var m1 = userEntry.substr(caretPos).match(/^\S+/);
                                if (m1 != null) caretPos += m1[0].length;
                                
                                // Get last word of user entry, up to the caret position.
                                var m2 = /\S+$/.exec(userEntry.substr(0, caretPos));
                                if (m2 !== null) {
                                    self.autoCompletePrefix = m2[0];
                                    self.autoCompleteSuggest = undefined;
                                }
                            }
                            else {
                                // Delete selected text from last suggestion.
                                self.ircElement.find('.userEntry').each(function () {
                                    var s = '';
                                    if (this.selectionStart > 0) s += userEntry.substr(0, this.selectionStart);
                                    if (this.selectionEnd < userEntry.length) s += userEntry.substr(this.selectionEnd);
                                    userEntry = s;
                                    this.selectionEnd = this.selectionStart;
                                    caretPos = this.selectionStart;
                                });
                            }
                            
                            if (self.autoCompletePrefix !== undefined) {
                                var myNick = self.irc.state().nick;
                                
                                if (self.isChannel(self.autoCompletePrefix)) {
                                    // When string looks like a channel, autocomplete from joined channel list.
                                    var channels = $.grep(self.getJoinedChannels(), function (val) {
                                        return self.startsWith(val, self.autoCompletePrefix, self.stricmp) && self.stricmp(val, myNick) != 0;
                                    });
                                    
                                    self.autoCompleteSuggest = self.getNextMatch(channels, self.autoCompleteSuggest, self.stricmp);
                                        
                                    // Replace last word with autoCompleteSuggest.
                                    if (self.autoCompleteSuggest !== undefined) {
                                        var s = userEntry.substr(0, caretPos).replace(/(\S+)$/, self.autoCompleteSuggest);
                                        userEntry = s + userEntry.substr(caretPos);
                                        self.ircElement.find('.userEntry')
                                            .val(userEntry)
                                            .each(function () {
                                                // Select suggested portion of autocomplete.
                                                this.selectionStart = s.length - self.autoCompleteSuggest.length + self.autoCompletePrefix.length;
                                                this.selectionEnd = s.length;
                                            });
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
                                        var s = userEntry.substr(0, caretPos).replace(/(\S+)$/, self.autoCompleteSuggest);
                                        var wordpos = s.length - self.autoCompleteSuggest.length;
                                        // If this is the only word on the line, assume it's to address the suggested user.
                                        if (wordpos == 0) s += ': ';
                                        userEntry = s + userEntry.substr(caretPos);
                                        self.ircElement.find('.userEntry')
                                            .val(userEntry)
                                            .each(function () {
                                                // Select suggested portion of autocomplete.
                                                this.selectionStart = wordpos + self.autoCompletePrefix.length;
                                                this.selectionEnd = s.length;
                                            });
                                    }
                                }
                            }
                        }
                    }
                    
                    return false;
                }
                else {
                    if (self.autoCompletePrefix !== undefined) {
                        // Typing text on an autocomplete suggestion will clear the selection,
                        // then add the text after the suggestion,
                        // instead of default of deleting the suggestion before adding the text.
                        self.ircElement.find('.userEntry').each(function () {
                            this.selectionStart = this.selectionEnd;
                        });
                    }

                    // All other keyboard activity clears autocomplete state.
                    self.autoCompleteReplyIndex = undefined;
                    self.autoCompletePrefix = undefined;
                }
            })
            .focus();
        
        // Setup resizable console.
        self.ircElement.find('.ircMain').resizable({
            handles: 'se',
            minWidth: 400,
            minHeight: 175,
            resize: function () {
                self.alignUI();
            }
        });
        
        self.alignUI();
    
        if (options.server !== undefined) {
            self.irc = new chatmore(self.ircElement.get(0), options.server, options.port, self.nick, self.realname)
            self.irc.activateClient();
        }
    }
};
