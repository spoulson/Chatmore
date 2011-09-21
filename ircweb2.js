(function () {

    var irc;
    irc = {
        parentElement: undefined,
        intervalPollHandle: undefined,
        pollInterval: 500,
        lastRecvTime: undefined,
        statusInterval: 1000,
        statusPollHandle: undefined,
        statusTimeout: 5,
        state : undefined,
        isActivated: false,
        quitMessage: 'Chatmore IRC client',
        
        localState: {
            nick: 'lamer' + Math.floor(Math.random() * 10000),
            realname: 'lame user',
            server: 'irc.dsm.org',
            port: 6667,
            target: undefined, // Selected target nick or channel, set via /query.
            lastMsgSender: undefined,
            autoCompleteString: undefined,
            autoCompleteSuggest: undefined
        },

        // IRC client message templates.
        tmpls: {
            timestamp: '<span class="timestamp">[${irc.getTimestamp()}]&nbsp;</span>',
            notePrefix: '<span class="prefix">***</span>',
            error: '{{tmpl "timestamp"}}<span class="error">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            usage: '{{tmpl "timestamp"}}<span class="usage">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            help: '{{tmpl "timestamp"}}<span class="help">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            serverMsg: '{{tmpl "timestamp"}}<span class="serverMsg">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            clientMsg: '{{tmpl "timestamp"}}<span class="clientMsg">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            outgoingChannelMsg: '{{tmpl "timestamp"}}<span class="channelMsg"><span class="prefix">&lt;<span class="channel">${channel}</span>:<span class="nick">${clientNick}</span>&gt;</span> <span class="message">${message}</span></span>',
            outgoingPrivateMsg: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-&gt; *<span class="nick">${nick}</span>*</span> <span class="message">${message}</span></span>',
            outgoingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg"><span class="prefix">&lt;<span class="channel">${channel}</span></span>&gt; *</span> <span class="nick">${clientNick}</span> <span class="message">${message}</span></span>',
            outgoingPrivateAction: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-&gt; *<span class="nick">${nick}</span>*</span> <span class="nick">${clientNick}</span> <span class="message">${message}</span></span>',
            outgoingChannelNotice: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-<span class="channel">${channel}</span>-</span> <span class="message">${message}</span></span>',
            outgoingPrivateNotice: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-<span class="nick">${nick}</span>-</span> <span class="message">${message}</span></span>',
            incomingChannelMsg:
                '{{tmpl "timestamp"}}' +
                '<span class="channelMsg' +
                    '{{if message.toLowerCase().indexOf(clientNick.toLowerCase()) != -1}} nickHighlight{{/if}}' + '">' +
                    '<span class="prefix">&lt;<span class="channel">${channel}</span>:<span class="nick">${nick}</span>&gt;</span> ' +
                    '<span class="message">${message}</span></span>',
            incomingPrivateMsg: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">*<span class="nick">${nick}</span>*</span> <span class="message">${message}</span></span>',
            incomingChannelAction: '{{tmpl "timestamp"}}<span class="channelMsg"><span class="prefix">&lt;<span class="channel">${channel}</span></span>&gt; *</span> <span class="nick">${nick}</span> <span class="message">${message}</span></span>',
            incomingPrivateAction: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">*<span class="nick">${nick}</span></span> <span class="message">${message}</span></span>',
            incomingPrivateNotice: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-<span class="nick">${nick}</span>-</span> <span class="message">${message}</span></span>',
            incomingChannelNotice: '{{tmpl "timestamp"}}<span class="PRIVMSG"><span class="prefix">-<span class="channel">${channel}</span>:<span class="nick">${nick}</span>-</span> <span class="message">${message}</span></span>',
            queryOff: '{{tmpl "timestamp"}}' +
                '<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">' +
                '{{if /^#/.test(prevTarget)}}' +
                    'You are no longer talking to channel <span class="channel">${prevTarget}</span>' +
                '{{else}}' +
                    'Ending conversation with <span class="nick">${prevTarget}</span>' +
                '{{/if}}' +
                '</span>',
            query: '{{tmpl "timestamp"}}' +
                '<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">' +
                '{{if /^#/.test(target)}}' +
                    'You are now talking to channel <span class="channel">${target}</span>' +
                '{{else}}' +
                    'Starting conversation with <span class="nick">${target}</span>' +
                '{{/if}}' +
                '</span>',
            queryOffChannel: '{{tmpl "timestamp"}}<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">You are no longer talking to channel <span class="channel">${channel}</span></span></span>',
            queryOffNick: '{{tmpl "timestamp"}}<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">Ending conversation with <span class="nick">${nick}</span></span></span>',
            queryChannel: '{{tmpl "timestamp"}}<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">You are now talking to channel <span class="channel">${channel}</span></span></span>',
            queryNick: '{{tmpl "timestamp"}}<span class="queryMsg">{{tmpl "notePrefix"}} <span class="message">Starting conversation with <span class="nick">${nick}</span></span></span>',
            join: '{{tmpl "timestamp"}}<span class="JOIN">{{tmpl "notePrefix"}} <span class="message"><span class="nick">${nick}</span> (${ident}@${host}) has joined channel <span class="channel">${channel}</span></span>',
            leave: '{{tmpl "timestamp"}}<span class="PART">{{tmpl "notePrefix"}} <span class="message"><span class="nick">${nick}</span> has left channel <span class="channel">${channel}</span></span>',
            nick: '{{tmpl "timestamp"}}{{tmpl "notePrefix"}} <span class="NICK"><span class="message">' +
                '{{if clientNick.toLowerCase() == prevNick.toLowerCase()}}' +
                    'Nick changed to <span class="nick">${nick}</span>' +
                '{{else}}' +
                    '<span class="nick">${prevNick}</span> is now known as <span class="nick">${nick}</span>' +
                '{{/if}}' +
                '</span></span>',
            nickInUse: '{{tmpl "timestamp"}}<span class="serverMsg">{{tmpl "notePrefix"}} <span class="message">Nickname <span class="nick">${nick}</span> is already in use.</span></span>',
            notopic: '{{tmpl "timestamp"}}<span class="TOPIC">{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; <span class="message">No topic is set</span></span>',
            topic: '{{tmpl "timestamp"}}<span class="TOPIC">{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; <span class="message">The current topic is: <span class="topicMessage">${topic}</span></span></span>',
            changeTopic: '{{tmpl "timestamp"}}<span class="TOPIC">{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; <span class="message"><span class="nick">${nick}</span> ' +
                '{{if topic == ""}}' +
                    'has cleared the topic' +
                '{{else}}' +
                    'has changed the topic to: <span class="topicMessage">${topic}</span>' +
                '{{/if}}' +
                '</span></span>',
            topicSetBy: '{{tmpl "timestamp"}}<span class="TOPIC">{{tmpl "notePrefix"}} &lt;<span class="channel">${channel}</span>&gt; <span class="message">Topic set by <span class="nick">${nick}</span> on <span class="time">${irc.formatTime(time)}</span></span></span>',
            serverTime: '{{tmpl "timestamp"}}<span class="TIME">{{tmpl "notePrefix"}} <span class="message">Server time for <span class="server">${server}</span>: <span class="time">${timeString}</span></span></span>',
            quit: '{{tmpl "timestamp"}}<span class="QUIT">{{tmpl "notePrefix"}} <span class="message">Signoff: <span class="nick">${nick}</span> (${message})</span></span>',
            error: '{{tmpl "timestamp"}}<span class="ERROR">{{tmpl "notePrefix"}} <span class="message">${message}</span></span>',
            userMode: '{{tmpl "timestamp"}}<span class="MODE">{{tmpl "notePrefix"}} <span class="message">Mode change "<span class="userMode">${mode}</span>" for user <span class="nick">${target}</span> by <span class="nick">${nick}</span></span></span>'
        },

        // Client /command definitions.
        cmdDefs: {
            help: {
                helpUsage: 'Usage: /help &lt;command&gt;',
                helpText: [
                    'Show help for client commands.',
                    'Commands:',
                    ' clear - Clear the chat console',
                    ' cleartopic - Clear the selected channel\'s topic',
                    ' join - Join a channel',
                    ' leave - Leave a channel',
                    ' me - Send an action message',
                    ' motd - Get the server message of the day',
                    ' msg - Send a private message',
                    ' nick - Change your nick',
                    ' notice - Send a notice to a nick or channel',
                    ' query - Select a target for messaging',
                    ' quit - Quit IRC session',
                    ' time - Get the server time',
                    ' topic - Get or set the selected channel\'s topic',
                    ' who - Get info on a nick'
                ],
                parseParam: function (param, meta) {
                    if (param === undefined) param = 'help';
                    
                    if (irc.cmdDefs[param] === undefined) {
                        meta.error = 'Error: Cannot get help on unknown command "' + param + '".';
                        return false;
                    }

                    meta.cmd = param;
                },
                exec: function (meta) {
                    var cmdDef = irc.cmdDefs[meta.cmd];
                    irc.writeTmpl('usage', { message: cmdDef.helpUsage });
                    var write = function (text) {
                        irc.writeTmpl('help', { message: text });
                    };
                    
                    if (typeof(cmdDef.helpText) === 'object')
                        $.each(cmdDef.helpText, function (i, text) {
                            write(text);
                        });
                    else
                        write(cmdDef.helpText);
                }
            },
            raw: {
                helpUsage: 'Usage: /raw &gt;IRC request message&lt;',
                helpText: 'Send a raw IRC request based on RFC2812.',
                parseParam: function (param, meta) {
                    meta.param = param;
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to send a raw IRC request.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.sendMsg(meta.param);
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
                
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to get server time.';
                        return false;
                    }
                },
                exec: function (meta) {
                    if (meta.server !== undefined && meta.server.length > 0)
                        irc.sendMsg('TIME ' + meta.server);
                    else
                        irc.sendMsg('TIME');
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
                
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to get server motd.';
                        return false;
                    }
                },
                exec: function (meta) {
                    if (meta.server !== undefined && meta.server.length > 0)
                        irc.sendMsg('MOTD ' + meta.server);
                    else
                        irc.sendMsg('MOTD');
                }
            },
            clear: {
                helpUsage: 'Usage: /clear',
                helpText: 'Clear the chat console.',
                parseParam: function () { },
                exec: function (meta) {
                    $(irc.parentElement).find('.ircChannel').html('');
                }
            },
            query: {
                helpUsage: 'Usage: /query &lt;nick|#channel&gt;',
                helpText: 'Select a nick or channel to send messages.',
                parseParam: function (param, meta) {
                    if (param === undefined) {
                        meta.error = irc.cmdDefs['query'].helpUsage;
                        return false;
                    }
                    
                    var params = param.split(' ', 1);
                    meta.target = params[0];
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to query a target.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.queryTarget(meta.target);
                }
            },
            me: {
                helpUsage: 'Usage: /me &lt;message&gt;',
                helpText: 'Send an action message to currently selected channel or nick.',
                parseParam: function (param, meta) {
                    var usage = irc.cmdDefs['msg'].helpUsage;
                    
                    if (param === undefined) {
                        meta.error = usage;
                        return false;
                    }
                    
                    meta.target = irc.localState.target;
                    meta.message = param;
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to send an action message.';
                        return false;
                    }
                },
                exec: function (meta) {
                    if (/^#/.test(meta.target)) 
                        irc.sendChannelAction(meta.target, meta.message);
                    else
                        irc.sendPrivateAction(meta.target, meta.message);
                }
            },
            msg: {
                helpUsage: 'Usage: /msg &lt;nick|#channel&gt; &lt;message&gt;',
                helpText: 'Send a private message to a nick.',
                parseParam: function (param, meta) {
                    var usage = irc.cmdDefs['msg'].helpUsage;
                    
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
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to send a message.';
                        return false;
                    }
                },
                exec: function (meta) {
                    if (/^#/.test(meta.target)) 
                        irc.sendChannelMsg(meta.target, meta.message);
                    else
                        irc.sendPrivateMsg(meta.target, meta.message);
                }
            },
            notice: {
                helpUsage: 'Usage: /notice &lt;nick|#channel&gt; &lt;message&gt;',
                helpText: 'Send a notice to a nick or channel.',
                parseParam: function (param, meta) {
                    var usage = irc.cmdDefs['msg'].helpUsage;
                    
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
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to send a notice.';
                        return false;
                    }
                },
                exec: function (meta) {
                    if (/^#/.test(meta.target)) 
                        irc.sendChannelNotice(meta.target, meta.message);
                    else
                        irc.sendPrivateNotice(meta.target, meta.message);
                }
            },
            topic: {
                helpUsage: 'Usage: /topic [message]',
                helpText: 'Get or set the selected channel\'s topic',
                parseParam: function (param, meta) {
                    if (irc.localState.target === undefined) {
                        meta.error = 'Error: No target selected.  Use: /query &lt;nick|#channel&gt;.';
                        return false;
                    }
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to get or set the topic.';
                        return false;
                    }
                    
                    meta.topic = param;
                },
                exec: function (meta) {
                    if (meta.topic === undefined) {
                        irc.sendMsg('TOPIC ' + irc.localState.target);
                    }
                    else {
                        irc.sendMsg('TOPIC ' + irc.localState.target + ' :' + meta.topic);
                    }
                }
            },
            cleartopic: {
                helpUsage: 'Usage: /cleartopic',
                helpText: 'Clear the selected channel\'s topic',
                parseParam: function (param, meta) {
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to clear the topic.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.sendMsg('TOPIC ' + irc.localState.target + ' :');
                }
            },
            who: {
                helpUsage: 'Usage: /who',
                helpText: 'Get info on a nick.',
                exec: function () {
                    irc.sendMsg('WHO');
                }
            },
            join: {
                helpUsage: 'Usage: /join &lt;#channel&gt;',
                helpText: 'Join a channel.',
                parseParam: function (param, meta) {
                    if (param === undefined) {
                        meta.error = irc.cmdDefs['join'].helpUsage;
                        return false;
                    }
                    
                    var params = param.split(' ', 1);
                    meta.channel = params[0].replace(/^([^#])/, '#$1');
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to join a channel.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.sendMsg('JOIN ' + meta.channel, function () {
                        irc.queryTarget(meta.channel);
                    });
                }
            },
            leave: {
                helpUsage: 'Usage: /leave [#channel]',
                helpText: [
                    'Leave a channel.',
                    'If channel omitted, leaves channel currently selected by /query.'
                ],
                parseParam: function (param, meta) {
                    if (param === undefined) {
                        if (irc.localState.target === undefined) {
                            meta.error = irc.cmdDefs['leave'].helpUsage;
                            return false;
                        }
                        else {
                            meta.channel = irc.localState.target;
                        }
                    }
                    else {
                        var params = param.split(' ', 1);
                        meta.channel = params[0].replace(/^([^#])/, '#$1');
                    }
                    
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to leave a channel.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.sendMsg('PART ' + meta.channel, function () {
                        if (irc.localState.target == meta.channel) irc.queryTarget();
                    });
                }
            },
            nick: {
                helpUsage: 'Usage: /nick &lt;nickname&gt;',
                helpText: 'Change your nick.',
                parseParam: function (param, meta) {
                    if (param === undefined) {
                        meta.error = irc.cmdDefs['nick'].helpUsage;
                        return false;
                    }
                    
                    var params = param.split(' ', 1);
                    meta.nick = params[0];

                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to change your nickname.';
                        return false;
                    }
                },
                exec: function (meta) {
                    irc.sendMsg('NICK ' + meta.nick);
                }
            },
            quit: {
                helpUsage: 'Usage: /quit [message]',
                helpText: 'Quit IRC session.',
                parseParam: function (param, meta) {
                    meta.message = param;
                
                    if (!irc.isActivated) {
                        meta.error = 'Error: Must be connected to quit.';
                        return false;
                    }
                },
                exec: function (meta) {
                    var message = meta.message;
                    if (message == '') message = irc.quitMessage;
                    irc.sendMsg('QUIT :' + message);
                }
            }
        },

        activateClient: function () {
            irc.isActivated = false;
            irc.lastRecvTime = undefined;
            var parent = $(irc.parentElement);
            parent.find('.activateButton').button('disable').removeClass('ui-state-hover');
            parent.find('.deactivateButton').button('disable').removeClass('ui-state-hover');
            
            var newConnectionFlag = true;
            var errorFlag = false;
            var errorFunc = function (xhr, status, error) {
                irc.writeTmpl('error', {
                    message: 'Error during activation: ' + status + ', ' + error
                });
                parent.find('.activateButton').button('enable');
                errorFlag = true;
            };
            
            // Initialize web client.
            // Check for open connection.
            var newConnectionFlag = true;
            
            $.ajax(
                'ircweb2init.php',
                {
                    async: false,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        connect: 0
                    },
                    success: function (data) {
                        if (console) {
                            console.log('data from init check:');
                            console.log(data);
                        }
                        irc.processMessages(data);
                        
                        // Check for connection ready message.
                        if ($.grep(data.msgs, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                            newConnectionFlag = false;
                        }
                    },
                    error: errorFunc
                }
            );
            
            if (errorFlag) {
                parent.find('.activateButton').button('enable');
                return;
            }
            
            // Create/resume a connection.
            irc.writeTmpl('clientMsg', {
                message: (newConnectionFlag ? 'Connecting to IRC server' : 'Resuming existing IRC connection')
            });
            
            $.ajax(
                'ircweb2init.php',
                {
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        connect: 1,
                        nick: irc.localState.nick,
                        realname: irc.localState.realname,
                        server: irc.localState.server,
                        port: irc.localState.port
                    },
                    success: function (data) {
                        if (console) {
                            console.log('data from init:');
                            console.log(data);
                        }
                        irc.processMessages(data);
                        
                        if ($.grep(data.msgs, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                            // Activated.
                            irc.writeTmpl('clientMsg', { message: 'Activated' });
                            irc.isActivated = true;
                            parent.find('.deactivateButton').button('enable');
                        
                            // Periodically poll for IRC activity.
                            var pollLock = false;
                            irc.intervalPollHandle = setInterval(function () {
                                // Basic locking to attempt to prevent overlapping requests.
                                if (!pollLock) {
                                    pollLock = true;
                                    $.ajax('ircweb2recv.php', {
                                        dataType: 'json',
                                        success: function (data) {
                                            // Validate data.
                                            if (typeof(data) == 'object') {
                                                if (typeof(data.msgs) == 'object') {
                                                    irc.processMessages(data);
                                                    pollLock = false;
                                                    return;
                                                }
                                            }

                                            if (console) {
                                                console.log('Got invalid data:');
                                                console.log(data);
                                            }
                                            
                                            pollLock = false;
                                        },
                                        error: function () {
                                            pollLock = false;
                                        }
                                    });
                                }
                            }, irc.pollInterval);
                            
                            // Periodically check that polls to ircweb2recv are still occurring within reasonable time.
                            irc.statusPollHandle = setInterval(function() {
                                time = new Date().getTime();
                                if (irc.lastRecvTime !== undefined && time - irc.lastRecvTime > (irc.statusTimeout * 1000)) {
                                    // Status check timeout.
                                    if (console) console.log('Status timeout!');
                                    irc.deactivateClient();
                                    // TODO: try to auto-reactivate up to a few times.
                                }
                            }, irc.statusInterval);
                        }
                        else {
                            // Error on activation.
                            irc.writeTmpl('clientMsg', { message: 'Error during activation' });
                            parent.find('.activateButton').button('enable');
                        }
                    },
                    error: errorFunc
                });
        },

        deactivateClient: function () {
            irc.isActivated = false;
            var parent = $(irc.parentElement);
            parent.find('.deactivateButton').button('disable').removeClass('ui-state-hover');
            clearInterval(irc.intervalPollHandle);
            clearInterval(irc.statusPollHandle);
            parent
                .removeClass('activated')
                .addClass('deactivated');
            parent.find('.activateButton').button('enable');
            irc.writeTmpl('clientMsg', { message: 'Deactivated' });
        },

        // Send raw message to server.
        sendMsg: function (rawMsg, postCallback) {
            $.post(
                'ircweb2send.php',
                { msg: rawMsg },
                function () {
                    if (console) console.log('Sent: ' + rawMsg);
                    if (postCallback) postCallback(rawMsg);
                }
            );
        },

        sendChannelMsg: function (channel, message) {
            irc.writeTmpl('outgoingChannelMsg', {
                clientNick: irc.state.nick,
                channel: channel,
                message: message
            });
            irc.sendMsg('PRIVMSG ' + channel + ' ' + message);
        },

        sendPrivateMsg: function (nick, message) {
            irc.writeTmpl('outgoingPrivateMsg', {
                clientNick: irc.state.nick,
                nick: nick,
                message: message
            });
            irc.sendMsg('PRIVMSG ' + nick + ' ' + message);
        },
        
        sendChannelAction: function (channel, message) {
            irc.writeTmpl('outgoingChannelAction', {
                clientNick: irc.state.nick,
                channel: channel,
                message: message
            });
            var quote = String.fromCharCode(1);
            irc.sendMsg('PRIVMSG ' + channel + ' ' + quote + 'ACTION ' + message + quote);
        },

        sendPrivateAction: function (nick, message) {
            irc.writeTmpl('outgoingPrivateAction', {
                clientNick: irc.state.nick,
                nick: nick,
                message: message
            });
            var quote = String.fromCharCode(1);
            irc.sendMsg('PRIVMSG ' + nick + ' ' + quote + 'ACTION ' + message + quote);
        },
        
        sendChannelNotice: function (channel, message) {
            irc.writeTmpl('outgoingChannelNotice', {
                clientNick: irc.state.nick,
                channel: channel,
                message: message
            });
            irc.sendMsg('NOTICE ' + channel + ' ' + message);
        },

        sendPrivateNotice: function (nick, message) {
            irc.writeTmpl('outgoingPrivateNotice', {
                clientNick: irc.state.nick,
                nick: nick,
                message: message
            });
            irc.sendMsg('NOTICE ' + nick + ' ' + message);
        },

        // Send line from user entry.
        // Parse out client commands.
        // Non-commands are messages sent to selected target.
        sendLine: function (text) {
            // Parse out command and parameters.
            var m;
            if (m = /^\/(\S+)(\s+(.+))?/.exec(text)) {
                var cmd = m[1].toLowerCase();
                var param = m[3];
                
                if (irc.cmdDefs[cmd] === undefined) {
                    irc.writeTmpl('error', { message: 'Error: Unknown client command "' + cmd + '".' });
                }
                else {
                    var meta = {};
                    var cmdDef = irc.cmdDefs[cmd];
                    if (cmdDef.parseParam && cmdDef.parseParam(param, meta) === false) {
                        if (meta.error) irc.writeTmpl('error', { message: meta.error });
                    }
                    else {
                        cmdDef.exec(meta);
                    }
                }
            }
            // Send text to selected target.
            else if (irc.isActivated) {
                // Sanitize input.
                if (irc.localState.target !== undefined) {
                    text = text.replace(/([\n\r])/gm, '');
                    if (text.length > 0) {
                        if (/^#/.test(irc.localState.target))
                            irc.sendChannelMsg(irc.localState.target, text);
                        else
                            irc.sendPrivateMsg(irc.localState.target, text);
                    }
                }
                else {
                    irc.writeTmpl('error', { message: 'Error: No target selected.  Use: /query <nick|#channel>.' });
                }
            }
            else {
                irc.writeTmpl('error', { message: 'Error: Cannot send message, client not activated.' });
            }
            
            $(irc.parentElement).find('.userEntry').val('');
        },

        getTimestamp: function () {
            var d = new Date();
            return d.getHours() + ':' + irc.padZero(d.getMinutes(), 2);
        },
        
        formatTime: function(time) {
            var d = new Date();
            d.setTime(time * 1000);
            return d.toLocaleString();
        },

        padZero: function (n, digits) {
            var z = new Array(digits + 1).join('0');
            var pn = '' + z + n;
            return pn.substring(pn.length - digits);
        },

        // Convert URL patterns into HTML links.
        linkifyText: function (text) {
            return text.replace(irc.linkifyRegex, '<a href="$1" target="_blank">$1</a>');
        },
        linkifyRegex: /(https?:\/\/([^\.\/\:]+(\.[^\.\/\:]+)*)(:\d+)?(\/[^\s\?\/<>]*)*(\?([^=&<>]+=[^=&<>]*(&[^=&<>]+=[^=&<>]*)*)?)?(#[\w_\-]+)?)/g,

        // Show a line of html in irc client.
        writeLine: function (html) {
            var ircChannel = $(irc.parentElement).find('#tabConsole .ircChannel');
            var el = ircChannel.get(0);

            var write = function (html) {
                var atBottom = el.scrollTop >= (el.scrollHeight - el.clientHeight);
                html = irc.linkifyText(html);
                $('<div class="line"/>')
                    .append(html)
                    .appendTo(ircChannel);
                if (atBottom) el.scrollTop = el.scrollHeight;
            };
            
            if (typeof(html) === 'object')
                $.each(html, function (i, html) {
                    write(html);
                });
            else
                write(html);
        },

        writeTmpl: function (templateName, data) {
            data['irc'] = irc;
            irc.writeLine(
                $('<div/>')
                    .append($.tmpl(templateName, data))
                    .html()
            );
        },

        queryTarget: function (newTarget) {
            irc.writeTmpl((newTarget === undefined) ? 'queryOff' : 'query', {
                target: newTarget,
                prevTarget: irc.localState.target
            });
            
            irc.localState.target = newTarget;
            var parent = $(irc.parentElement);
            parent.find('.targetFragment').fadeOut(null, function () {
                parent.find('.targetLabel').text(irc.localState.target);
                if (irc.localState.target !== undefined && irc.localState.target !== null) {
                    parent.find('.targetFragment').fadeIn();
                }
            });
        },

        // Process incoming messages.
        processMessages: function (data) {
            if (data === undefined) return false;
            
            // Timestamp when last received message processing occurs.
            irc.lastRecvTime = new Date().getTime();
            
            $.each(data.msgs, function (key, msg) {
                switch (msg.type) {
                case 'recv':
                    if (console) {
                        if (msg.raw !== undefined) console.log(msg.raw);
                        console.log(msg);
                    }
                    
                    switch (msg.command) {
                    case 'PRIVMSG':
                        if (msg.info.target.toLowerCase() == irc.state.nick.toLowerCase()) {
                            irc.writeTmpl(msg.info.isAction ? 'incomingPrivateAction' : 'incomingPrivateMsg', {
                                clientNick: irc.state.nick,
                                nick: msg.prefixNick,
                                message: msg.info.text
                            });
                            if (!msg.info.isAction) irc.localState.lastMsgSender = msg.prefixNick;
                        }
                        else
                            irc.writeTmpl(msg.info.isAction ? 'incomingChannelAction' : 'incomingChannelMsg', {
                                clientNick: irc.state.nick,
                                nick: msg.prefixNick,
                                channel: msg.info.target,
                                message: msg.info.text
                            });
                        break;
                        
                    case 'NOTICE':
                        if (msg.info.target.toLowerCase() == irc.state.nick.toLowerCase()) {
                            irc.writeTmpl('incomingPrivateNotice', {
                                clientNick: irc.state.nick,
                                nick: msg.prefixNick,
                                message: msg.info.text
                            });
                            irc.localState.lastMsgSender = msg.prefixNick;
                        }
                        else
                            irc.writeTmpl('incomingChannelNotice', {
                                clientNick: irc.state.nick,
                                nick: msg.prefixNick,
                                channel: msg.info.target,
                                message: msg.info.text
                            });
                        break;
                        
                    case 'JOIN':
                        irc.writeTmpl('join', {
                            nick: msg.prefixNick,
                            ident: msg.prefixUser,
                            host: msg.prefixHost,
                            channel: msg.info.channel
                        });
                        break;
                        
                    case 'PART':
                        irc.writeTmpl('leave', {
                            nick: msg.prefixNick,
                            ident: msg.prefixUser,
                            host: msg.prefixHost,
                            channel: msg.info.channel
                        });
                        break;
                        
                    case 'MODE':
                        irc.writeTmpl('userMode', {
                            nick: msg.prefixNick,
                            target: msg.info.target,
                            mode: msg.info.mode
                        });
                        break;
                    
                    case 'NICK':
                        irc.writeTmpl('nick', {
                            clientNick: irc.state.nick,
                            nick: msg.info.nick,
                            prevNick: msg.prefixNick
                        });
                        break;
                        
                    case 'TOPIC':
                        irc.writeTmpl('changeTopic', {
                            clientNick: irc.state.nick,
                            channel: msg.info.channel,
                            nick: msg.prefixNick,
                            topic: msg.info.topic
                        });
                        break;
                        
                    case 'QUIT':
                        irc.writeTmpl('quit', {
                            nick: msg.prefixNick,
                            message: msg.info.message
                        });
                        break;
                        
                    case 'ERROR':
                        irc.writeTmpl('error', {
                            message: msg.info.message
                        });
                        break;

                    case '331': // RPL_NOTOPIC
                        irc.writeTmpl('notopic', {
                            channel: msg.info.channel
                        });
                        break;
                        
                    case '332': // RPL_TOPIC
                        irc.writeTmpl('topic', {
                            channel: msg.info.channel,
                            topic: msg.info.topic
                        });
                        break;
                        
                    case '333': // Topic set by
                        irc.writeTmpl('topicSetBy', {
                            channel: msg.info.channel,
                            nick: msg.info.nick,
                            time: msg.info.time
                        });
                        break;
                        
                    case '391': // RPL_TIME
                        irc.writeTmpl('serverTime', {
                            server: msg.info.server,
                            timeString: msg.info.timeString
                        });
                        break;
                        
                    case '433': // ERR_NICKNAMEINUSE
                        irc.writeTmpl('nickInUse', {
                            nick: msg.info.nick
                        });
                        break;
                        
                    default:
                        if (/^\d{3}$/.test(msg.command)) {
                            // Any other server message.
                            var m;
                            if (m = /:(.+)/.exec(msg.params)) {
                                irc.writeTmpl('serverMsg', { message: m[1] });
                            }
                        }
                        
                        break;
                    }
                
                case 'state':                
                    if (msg.state !== undefined) {
                        var prevState = irc.state;
                        irc.state = msg.state;
                        if (console) {
                            console.log('Client state:');
                            console.log(irc.state);
                        }
                        
                        if (prevState === undefined || irc.state.nick != prevState.nick) {
                            // Nick changed.
                            var nickLabel = $(irc.parentElement).find('.nickLabel');
                            nickLabel.fadeOut(null, function () {
                                nickLabel.text(irc.state.nick);
                                nickLabel.fadeIn();
                            });
                        }
                    }
                    break;

                case 'servermsg':
                    if (console) console.log('servermsg: ' + msg.code + ' ' + msg.message);
                    
                    if (msg.code >= 400) {
                        // Don't show "Connection not open" when already disconnected.
                        // Normally this happens during activation when a new connection must be made.
                        if (irc.isActivated || msg.code != 400) {
                            irc.writeTmpl('error', { message: msg.message });
                        }
                        
                        if (irc.isActivated && msg.code == 400) {
                            irc.deactivateClient();
                        }
                    }
                    else {
                        if (msg.code == 200) {
                            // Disregard 200 connection ready message.  Not important for display.
                            // Ensure status indicator is activated.
                            $(irc.parentElement)
                                .removeClass('deactivated')
                                .addClass('activated');
                        }
                        else {
                            irc.writeTmpl('serverMsg', { message: msg.message });
                        }
                    }
                    break;
                }
            });
        },

        // Resize elements to proper alignment based on #ircTabs dimensions.
        alignUI: function () {
            var parent = $(irc.parentElement);
            var ircTabs = parent.find('.ircTabs');
            var tabConsole = parent.find('#tabConsole');
            var ircChannel = parent.find('.ircChannel');
            var userEntrySection = parent.find('.userEntrySection');
            var userEntryLine = parent.find('.userEntryLine');
            var userEntry = parent.find('.userEntry');
            var commandBar = parent.find('.commandBar');
            var sideBar = parent.find('.sideBar');
            tabConsole
                .outerWidth(ircTabs.width())
                .outerHeight(ircTabs.height() - ircTabs.children('.ui-tabs-nav').outerHeight());
            ircChannel
                .width(tabConsole.width())
                .height(tabConsole.height());
            userEntrySection.outerWidth(ircTabs.outerWidth());
            userEntryLine
                .width(userEntrySection.width())
                .innerHeight(userEntry.outerHeight() + 4 /* margin not included in outerHeight? */);
            userEntry.width(userEntryLine.width());
            commandBar.outerWidth(ircTabs.outerWidth());
            sideBar.outerHeight(ircTabs.outerHeight() + userEntrySection.outerHeight());
        }
    };

    // Initialization.
    $(function () {
        irc.parentElement = $('.ircweb2').get(0);
        var parent = $(irc.parentElement);
    
        // Compile templates.
        $.each(irc.tmpls, function (name, tmpl) {
            $.template(name, tmpl);
        });

        // Client command aliases.
        irc.cmdDefs['j'] = irc.cmdDefs['join'];
        irc.cmdDefs['l'] = irc.cmdDefs['leave'];
        irc.cmdDefs['m'] = irc.cmdDefs['msg'];
        irc.cmdDefs['n'] = irc.cmdDefs['notice'];
        irc.cmdDefs['q'] = irc.cmdDefs['query'];

        parent.find('.userEntry')
            .keydown(function (e) {
                if (e.keyCode == '13') {
                    // Enter.
                    irc.sendLine(parent.find('.userEntry').val());
                    return false;
                }
                else if (e.keyCode == '9') {
                    // Tab.
                    if (e.preventDefault) e.preventDefault();
                    
                    if (irc.isActivated) {
                        var userEntry = parent.find('.userEntry').val();
                        
                        if (userEntry == '') {
                            if (irc.localState.lastMsgSender !== undefined) {
                                // Quick send message to last sender.
                                parent.find('.userEntry').val('/msg ' + irc.localState.lastMsgSender + ' ');
                            }
                        }
                        else {
                            // Autocomplete nick.
                            if (irc.localState.autoCompleteString === undefined) {
                                // Get last word of user entry;
                                var m = /(\S+)$/.exec(userEntry);
                                if (m !== null) {
                                    irc.localState.autoCompleteString = m[1];
                                }
                            }
                            
                            if (irc.localState.autoCompleteString !== undefined) {
                                if (console) console.log('autocomplete on: ' + irc.localState.autoCompleteString);
                                
                                // TODO: Iterate over channel members and get next alphabetic match after autoCompleteSuggest.
                            }
                        }
                    }
                    
                    return false;
                }
                else {
                    irc.localState.autoCompleteString = undefined;
                }
            })
            .focus();
        
        // Create console tab from template.
        parent.find('.channelTmpl')
            .clone()
            .attr('id', 'tabConsole')
            .appendTo(parent.find('.ircTabs'));

        // Setup tabs.
        parent.find('.ircTabs')
            .tabs({
                // tabTemplate: "<li><a href='#{href}'>#{label}</a> <span class='ui-icon ui-icon-close'>Remove Tab</span></li>"
            })
            .removeClass('ui-corner-all')
            .addClass('ui-corner-tl')
            .tabs('add', '#tabConsole', 'Console');

        //  Setup buttons.
        parent.find('.activateButton').button({
            icons: { primary: 'ui-icon-star' }
        });
        parent.find('.deactivateButton').button({
            icons: { primary: 'ui-icon-close' },
            disabled: true
        });
        parent.find('.connectionButtonset').buttonset();

        // Setup event handlers.
        parent.find('.activateButton').click(irc.activateClient);
        parent.find('.deactivateButton').click(irc.deactivateClient);
        
        // Setup resizable console.
        parent.find('.ircTabs').resizable({
            handles: 'se',
            minWidth: 400,
            minHeight: 175,
            resize: function () {
                irc.alignUI();
            }
        });
        
        irc.alignUI();
    });

})();
