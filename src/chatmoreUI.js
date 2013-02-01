(function () {
    //
    // Private static variables.
    //
    // Registry of layout plugin instances.
    var layouts = { };

    var globalMethods = {
        layouts: function () {
            return layouts;
        }
    };

    //
    // Private static functions.
    //
    var isEmpty = function (text) {
        return text === undefined || text === null || text === '';
    };

    //
    // Global chatmore jQuery plugin.
    //
    $.chatmore = function () {
        var method = arguments[0];
        var args = Array.prototype.slice.call(arguments, 1);
        return globalMethods[method].apply(null, args);
    };
    
    //
    // Object chatmore jQuery plugin.
    //
    $.fn.chatmore = function () {
        // charemoreUI constructor() | constructor({options})
        if (arguments.length === 0 || typeof(arguments[0]) === 'object') {
            // Construct UI widget.
            var userOptions = arguments.length > 0 ? arguments[0] : { };
            
            // Parse options.
            var options = {
                port: 6667,
                title: document.title,
                viewKey: '',
                nick: 'user' + Math.floor(Math.random() * 10000),
                quitMessage: 'Chatmore IRC client',
                reactivateAttempts: 6,
                reactivateDelay: 10,
                layout: undefined                   // Layout name.  Undefined will pick 'default' or first layout in registry.
            };
            $.extend(options, userOptions);
            if (isEmpty(options.realname)) options.realname = options.nick;
            if (typeof(options.channel) === 'object') autoJoinChannels = options.channel;
            else if (!isEmpty(options.channel)) autoJoinChannels.push(options.channel);
                
            var getLayoutPlugin = function () {
                if (options.layout === undefined) {
                    if ('default' in layouts) {
                        return layouts['default'];
                    }
                    else {
                        for (var name in layouts) {
                            if (data.propertyIsEnumerable(prop)) return layouts[name];
                        }
                        
                        if (window.console) console.warn('Error initializing Chatmore:  No layout plugins have been loaded!');
                        return false;
                    }
                }
                else {
                    return layouts[options.layout];
                }
            };
    
            var self = {
                //
                // Private members.
                //
                ircElement: $(this),                // Chatmore parent jQuery element.
                irc: undefined,                     // Chatmore client object.
                options: options,
                autoJoinChannels: [ ],              // Channels provided at startup.
                prevState: undefined,
                enableAutoReactivate: true,
                reactivateAttempts: 0,
                isPendingActivation: false,
                layoutPlugin: getLayoutPlugin(),    // Selected layout plugin instance.
                
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
                        helpText: 'Clear the selected channel\'s topic.',
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
                    connect: {
                        helpUsage: 'Usage: /connect',
                        helpText: 'Reconnect after disconnection.',
                        parseParam: function () { },
                        exec: function (meta) {
                            if (self.isPendingActivation) {
                                meta.error = 'Error: Cannot reconnect while connection attempt is pending.  Enter /quit to abort connection attempt.';
                                return false;
                            }
                            else if (self.irc.state.isActivated) {
                                meta.error = 'Error: Cannot reconnect while still connected.';
                                return false;
                            }
                            self.irc.activateClient();
                        }
                    },
                    deop: {
                        helpUsage: 'Usage: /deop &lt;nick&gt; [nick ...]',
                        helpText: 'Revoke channel operator status from a user.',
                        parseParam: function (param, meta) {
                            if (param === undefined) {
                                meta.error = self.cmdDefs['deop'].helpUsage;
                                return false;
                            }
                            
                            meta.channel = self.irc.target();
                            meta.nicks = param.split(/\s+/);
                            
                            if (isEmpty(meta.channel) || !self.isChannel(meta.channel)) {
                                meta.error = 'Error: Must select a channel to revoke operator status.';
                                return false;
                            }
                            
                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to revoke operator status.';
                                return false;
                            }
                        },
                        exec: function (meta) {
                            var os = Array(meta.nicks.length + 1).join('o');
                            var nicks = meta.nicks.join(' ');
                            self.irc.sendMsg('MODE ' + meta.channel + ' -' + os + ' ' + nicks);
                        }
                    },
                    devoice: {
                        helpUsage: 'Usage: /devoice &lt;nick&gt; [nick ...]',
                        helpText: 'Revoke channel voice status from a user.',
                        parseParam: function (param, meta) {
                            if (param === undefined) {
                                meta.error = self.cmdDefs['devoice'].helpUsage;
                                return false;
                            }
                            
                            meta.channel = self.irc.target();
                            meta.nicks = param.split(/\s+/);
                            
                            if (isEmpty(meta.channel) || !self.isChannel(meta.channel)) {
                                meta.error = 'Error: Must select a channel to revoke voice status.';
                                return false;
                            }
                            
                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to revoke voice status.';
                                return false;
                            }
                        },
                        exec: function (meta) {
                            var os = Array(meta.nicks.length + 1).join('v');
                            var nicks = meta.nicks.join(' ');
                            self.irc.sendMsg('MODE ' + meta.channel + ' -' + os + ' ' + nicks);
                        }
                    },
                    help: {
                        helpUsage: 'Usage: /help &lt;command&gt;',
                        helpText: [
                            'Show help for client commands.',
                            'Commands:',
                            ' clear - Clear the chat console',
                            ' cleartopic - Clear the channel\'s topic (must be an operator)',
                            ' connect - Reconnect to IRC server',
                            ' join - Join a channel',
                            ' kick - Kick user from channel (must be an operator)',
                            ' leave - Leave a channel',
                            ' list - Get channel listing',
                            ' me - Send an action message',
                            ' motd - Get the server message of the day',
                            ' msg - Send a private message',
                            ' nick - Change your nick',
                            ' notice - Send a notice to a user or channel',
                            ' op/deop - Grant/revoke channel operator status to a user (must be an operator)',
                            ' query - Select a target for messaging',
                            ' quit - Quit IRC session',
                            ' quote - Send raw IRC message',
                            ' time - Get the server time',
                            ' topic - Get or set the channel\'s topic (must be an operator)',
                            ' voice/devoice - Grant/revoke channel voice to a user (must be an operator)',
                            ' who - Get info on a user'
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
                        helpText: 'Kick user from channel.',
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
                        helpText: 'Send an action message to currently selected channel or user.',
                        parseParam: function (param, meta) {
                            var usage = self.cmdDefs['msg'].helpUsage;
                            
                            if (param === undefined) {
                                meta.error = usage;
                                return false;
                            }
                            
                            meta.target = self.irc.target();
                            meta.message = param;
                            
                            if (isEmpty(meta.target)) {
                                meta.error = 'Error: Must select a channel or nick to send a message.';
                                return false;
                            }
                            
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
                            if (m === null) {
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
                        helpText: 'Send a private message to a user.',
                        parseParam: function (param, meta) {
                            var usage = self.cmdDefs['msg'].helpUsage;
                            
                            if (param === undefined) {
                                meta.error = usage;
                                return false;
                            }
                            
                            var m = /^(\S+)\s+(.+)$/.exec(param);
                            if (m === null || m.length !== 3) {
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
                                //self.addToMsgSenders(meta.target);
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
                        helpText: 'Send a notice to a user or channel.',
                        parseParam: function (param, meta) {
                            var usage = self.cmdDefs['msg'].helpUsage;
                            
                            if (param === undefined) {
                                meta.error = usage;
                                return false;
                            }
                            
                            var m = /^(\S+)\s+(.+)$/.exec(param);
                            if (m === null || m.length !== 3) {
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
                    op: {
                        helpUsage: 'Usage: /op &lt;nick&gt; [nick ...]',
                        helpText: 'Grant channel operator status to a user.',
                        parseParam: function (param, meta) {
                            if (param === undefined) {
                                meta.error = self.cmdDefs['op'].helpUsage;
                                return false;
                            }
                            
                            meta.channel = self.irc.target();
                            meta.nicks = param.split(/\s+/);
                            
                            if (isEmpty(meta.channel) || !self.isChannel(meta.channel)) {
                                meta.error = 'Error: Must select a channel to grant operator status.';
                                return false;
                            }
                            
                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to grant operator status.';
                                return false;
                            }
                        },
                        exec: function (meta) {
                            var os = Array(meta.nicks.length + 1).join('o');
                            var nicks = meta.nicks.join(' ');
                            self.irc.sendMsg('MODE ' + meta.channel + ' +' + os + ' ' + nicks);
                        }
                    },
                    query: {
                        helpUsage: 'Usage: /query &lt;nick|#channel&gt;',
                        helpText: 'Select a user or channel to send messages.',
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
                            
                            if (isEmpty(meta.param)) {
                                meta.error = 'Missing parameter to /quote.';
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
                            meta.topic = param;

                            if (self.irc.target() === undefined) {
                                meta.error = 'Error: No target selected.  Doubleclick a channel or user on the side bar or enter: /query &lt;nick|#channel&gt;.';
                                return false;
                            }
                            
                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to get or set the topic.';
                                return false;
                            }
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
                    voice: {
                        helpUsage: 'Usage: /voice &lt;nick&gt; [nick ...]',
                        helpText: 'Grant channel voice status to a user.',
                        parseParam: function (param, meta) {
                            if (param === undefined) {
                                meta.error = self.cmdDefs['voice'].helpUsage;
                                return false;
                            }
                            
                            meta.channel = self.irc.target();
                            meta.nicks = param.split(/\s+/);
                            
                            if (isEmpty(meta.channel) || !self.isChannel(meta.channel)) {
                                meta.error = 'Error: Must select a channel to grant voice status.';
                                return false;
                            }
                            
                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to grant voice status.';
                                return false;
                            }
                        },
                        exec: function (meta) {
                            var os = Array(meta.nicks.length + 1).join('v');
                            var nicks = meta.nicks.join(' ');
                            self.irc.sendMsg('MODE ' + meta.channel + ' +' + os + ' ' + nicks);
                        }
                    },
                    who: {
                        helpUsage: 'Usage: /who &lt;nick | channel&gt;',
                        helpText: 'Get info on a user or all users in a channel.',
                        parseParam: function (param, meta) {
                            meta.target = param;

                            if (!self.irc.state.isActivated) {
                                meta.error = 'Error: Must be connected to get WHO information.';
                                return false;
                            }
                            
                            if (isEmpty(meta.target)) {
                                meta.error = 'Missing parameter to /quote.';
                                return false;
                            }
                        },
                        exec: function (meta) {
                            self.irc.sendMsg('WHO ' + meta.target);
                        }
                    }
                },
    
                // Send line from user entry.
                // Parse out client commands and execute action.
                // If not a command, send as message to current target.
                sendLine: function (text) {
                    // Parse out command and parameters.
                    var m = /^\/(\S+)(\s+(.+))?/.exec(text);
                    if (m) {
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
    
                stricmp: function (a, b) {
                    return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
                },
                
                writeTmpl: function(templateName, data) {
                    self.layoutPlugin.writeTemplate(self, templateName, data);
                },
                
                startsWith: function (subject, prefix, comparer) {
                    return subject.length >= prefix.length &&
                        comparer(subject.substr(0, prefix.length), prefix) === 0;
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
                
                clearSelection: function () {
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    }
                    else if (document.selection) {
                        document.selection.empty();
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
                        channels = $.map(self.irc.state.channels, function (val, channel) {
                            return channel;
                        });
                    }
    
                    return channels.sort(self.stricmp);
                },
                
                getChannelMembers: function (channel) {
                    var members = [ ];
                    
                    if (self.irc.state !== undefined) {
                        var channelDesc = self.irc.state.channels[channel];
                        
                        if (channelDesc !== undefined) {
                            members = $.map(channelDesc.members, function (val, member) {
                                return member;
                            });
                        }
                    }
                    
                    return members.sort(self.stricmp);
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
                
                // Accept presented autosuggest.
                acceptAutoSuggest: function () {
                    if (self.autoCompletePrefix !== undefined) {
                        // Accept autocomplete.
                        self.ircElement.find('.userEntry').each(function () {
                            // Set value and move caret to end.
                            /*
                            this.selectionStart = this.selectionEnd;
                            */
                            
                            // Clear autocomplete state.
                            self.autoCompletePrefix = undefined;

                            $(this)
                                .tooltip('option', 'content', '')
                                .tooltip('close');
                        });
                    }
                },
                
                // Reject presented autosuggest.
                rejectAutoSuggest: function () {
                    if (self.autoCompletePrefix !== undefined) {
                        // Reject autocomplete.
                        self.ircElement.find('.userEntry').each(function () {
                            // Remove autocomplete suggestion.
                            /*
                            var s = $(this).val();
                            var s1 = this.selectionStart > 1 ? s.substr(0, this.selectionStart) : '';
                            var s2 = this.selectionEnd < s.length ? s.substr(this.selectionEnd) : '';
                            var caretPos = this.selectionStart;
                            
                            $(this).val(s1 + s2);
                            this.selectionStart = caretPos;
                            this.selectionEnd = caretPos;
                            */

                            $(this)
                                .tooltip('option', 'content', '')
                                .tooltip('close');
                        });
                        
                        self.autoCompletePrefix = undefined;
                    }
                },
                
                // Scan user entry at caret position for autosuggest.
                scanAutoSuggest: function () {
                    // Autocomplete.
                    var caretPos = userEntry[0].selectionEnd;
                    if (self.autoCompletePrefix === undefined) {
                        // Advance caret to end of word.
                        var m1 = s.substr(caretPos).match(/^\S+/);
                        if (m1 !== null) caretPos += m1[0].length;
                        
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
                                return self.startsWith(val, self.autoCompletePrefix, self.stricmp) && self.stricmp(val, myNick) !== 0;
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
                                return self.startsWith(val, self.autoCompletePrefix, self.stricmp) && self.stricmp(val, myNick) !== 0;
                            });
                            
                            self.autoCompleteSuggest = self.getNextMatch(nicks, self.autoCompleteSuggest, self.stricmp);
                                
                            // Replace last word with autoCompleteSuggest.
                            if (self.autoCompleteSuggest !== undefined) {
                                var s1 = s.substr(0, caretPos).replace(/(\S+)$/, self.autoCompleteSuggest);
                                var wordpos = s1.length - self.autoCompleteSuggest.length;
                                // If this is the only word on the line, assume it's to address the suggested user.
                                if (wordpos === 0) s1 += ': ';
                                s = s1 + s.substr(caretPos);
                                userEntry.val(s);
    
                                // Select suggested portion of autocomplete.
                                userEntry[0].selectionStart = wordpos + self.autoCompletePrefix.length;
                                userEntry[0].selectionEnd = s1.length;
                            }
                        }
                    }
                },
                
                //
                // Public API.
                //
                methods: {
                    // Activate client.
                    activateClient: function () {
                        self.irc.activateClient();
                        return self.ircElement;
                    },
                    // Deactivate client.
                    deactivateClient: function () {
                        self.irc.deactivateClient();
                        return self.ircElement;
                    },
                    // Resize chatmoreUI element.
                    // Omit width/height to resize to fit.
                    resize: function (width, height) {
                        self.layoutPlugin.resize(self, width, height);
                        return self.ircElement;
                    },
                    // Scroll console to bottom.
                    scrollToBottom: function () {
                        self.layoutPlugin.scrollToBottom(self);
                        return self.ircElement;
                    },
                    //
                    // Property getters.
                    //
                    // Determine if console is scrolled to the bottom.
                    isAtBottom: function () {
                        return self.layoutPlugin.isAtBottom(self);
                    },
                    //
                    // Customization API.
                    //
                    // Get layout registry hash.
                    layouts: function () {
                        return layouts;
                    },
                    // Set and initialize a layout plugin.
                    setLayout: function (name) {
                        if (name in layouts) {
                            // Clean up previous layout plugin.
                            if (self.layoutPlugin !== undefined) self.layoutPlugin.destroy(self);
                            
                            // Initialize new layout plugin.
                            self.layoutPlugin = layouts[name];
                            self.layoutPlugin.initialize(self);
                        }
                        else if (window.console) {
                            console.warn('Attempted to use Chatmore layout that does not exist: ' + name);
                        }
                    },
                    //
                    // Event binding methods.
                    //
                    // Bind event 'localMessage'.  Signature: callback(e, msg)
                    onLocalMessage: function (callback) {
                        self.ircElement.on('localMessage.chatmore', function (e, msg) {
                            callback.call(self.ircElement, e, msg);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'stateChanged'.  Signature: callback(e, state)
                    onStateChanged: function (callback) {
                        self.ircElement.on('stateChanged.chatmore', function (e) {
                            callback.call(self.ircElement, e, self.irc.state);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'processingMessage'.  Signature: callback(e, msg)
                    onProcessingMessage: function (callback) {
                        self.ircElement.on('processingMessage.chatmore', function (e, msg) {
                            callback.call(self.ircElement, e, msg);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'processedMessage'.  Signature: callback(e, msg)
                    onProcessedMessage: function (callback) {
                        self.ircElement.on('processedMessage.chatmore', function (e, msg) {
                            callback.call(self.ircElement, e, msg);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'sendingMessage'.  Signature: callback(e, rawMsg, resendCount)
                    onSendingMessage: function (callback) {
                        self.ircElement.on('sendingMessage.chatmore', function (e, rawMsg, resendCount) {
                            callback.call(self.ircElement, e, rawMsg, resendCount);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'sentMessage'.  Signature: callback(e, rawMsg, resendCount)
                    onSentMessage: function (callback) {
                        self.ircElement.on('sentMessage.chatmore', function (e, rawMsg, resendCount) {
                            callback.call(self.ircElement, e, rawMsg, resendCount);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'errorSendingMessage'.  Signature: callback(e, xhr, rawMsg, resendCount)
                    onErrorSendingMessage: function (callback) {
                        self.ircElement.on('errorSendingMessage.chatmore', function (e, xhr, rawMsg, resendCount) {
                            callback.call(self.ircElement, e, xhr, rawMsg, resendCount);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'activatingClient'.  Signature: callback(e, stage, message, params)
                    onActivatingClient: function (callback) {
                        self.ircElement.on('activatingClient.chatmore', function (e, stage, message, params) {
                            callback.call(self.ircElement, e, stage, message, params);
                        });
                        return self.ircElement;
                    },
                    // Bind event 'deactivatingClient'.  Signature: callback(e)
                    onDeactivatingClient: function (callback) {
                        self.ircElement.on('deactivatingClient.chatmore', function (e) {
                            callback.call(self.ircElement, e);
                        });
                        return self.ircElement;
                    }
                }
            };
    
            //
            // Initialization.
            //
            // Setup layout.
            self.ircElement
                .empty()
                .off()
                .data('chatmore', self); // Persist object in DOM element.
    
            self.layoutPlugin.initialize(self);
    
            // Client command aliases.
            self.cmdDefs['j'] = self.cmdDefs['join'];
            self.cmdDefs['k'] = self.cmdDefs['kick'];
            self.cmdDefs['l'] = self.cmdDefs['leave'];
            self.cmdDefs['m'] = self.cmdDefs['msg'];
            self.cmdDefs['n'] = self.cmdDefs['notice'];
            self.cmdDefs['q'] = self.cmdDefs['query'];
    
            // Setup chatmore event handlers.
            self.ircElement
                .on('localMessage.chatmore', function (e, message, type, data) {
                    if (window.console) console.log('UI event: localMessage');
                    switch (data.code) {
                    case 'R1':
                        // Retrying registration with new nick.
                        self.writeTmpl('retryRegistration', {});
                        break;
                        
                    case 'RE1':
                        // Registration failed.  Abort activation.
                        var m = data.maxRegistrationAttempts > 1 ?
                            'Registration failed.  Unable to register with a unique nickname after ' + data.maxRegistrationAttempts + ' attempts.  Please reconnect with a unique nickname.' :
                            'Registration failed.  Please reconnect with a unique nickname.';
                        self.writeTmpl(type, { message: m });
                            
                        self.enableAutoReactivate = false;
                        self.irc.deactivateClient();
                        break;
                    
                    default:
                        self.writeTmpl(type, { message: message });
                    }
                    
                    self.layoutPlugin.onLocalMessage(self, message, type, data);
                })
                .on('processingMessage.chatmore', function (e, msg) {
                    if (msg.type === 'recv') {
                        // Ensure user is in user state.
                        self.irc.state.addUser(msg.prefixNick);
    
                        // ERR_NICKNAMEINUSE
                        if (msg.command === '433') {
                            self.writeTmpl('nickInUse', { msg: msg });
                        }
                    }
                    
                    self.layoutPlugin.onProcessingMessage(self, msg);
                })
                .on('processedMessage.chatmore', function (e, msg) {
                    if (msg.type === 'recv') {
                        switch (msg.command) {
                        case 'PRIVMSG':
                            if (self.stricmp(msg.info.target, self.irc.state.nick) === 0)
                                self.writeTmpl(msg.info.isAction ? 'incomingPrivateAction' : 'incomingPrivateMsg', { msg: msg });
                            else
                                self.writeTmpl(msg.info.isAction ? 'incomingChannelAction' : 'incomingChannelMsg', { msg: msg });
                            break;
                        
                        case 'NOTICE':
                            if (self.stricmp(msg.info.target, self.irc.state.nick) === 0)
                                self.writeTmpl('incomingPrivateNotice', { msg: msg });
                            else
                                self.writeTmpl('incomingChannelNotice', { msg: msg });
                            break;
                            
                        case 'JOIN':
                            self.writeTmpl('join', { msg: msg });
    
                            // Auto-query newly joined channel.
                            if (self.stricmp(msg.prefixNick, self.irc.state.nick) === 0) {
                                self.queryTarget(msg.info.channel);
                            }
    
                            break;
                            
                        case 'PART':
                            self.writeTmpl('leave', { msg: msg });                        
                            break;
                            
                        case 'KICK':
                            var kickMsg = $.extend(true, { }, msg);
                            delete kickMsg.info.kicks;
                            $.each(msg.info.kicks, function (i, kick) {
                                kickMsg.info.kick = kick;
                                self.writeTmpl('kick', { msg: kickMsg });
                            });
                            break;
                            
                        case 'MODE':
                            self.writeTmpl('mode', { msg: msg });
                            break;
                        
                        case 'NICK':
                            self.writeTmpl('nick', { msg: msg });
                                                    
                            // If selected target's nick changes, update target.
                            if (self.irc.target() !== undefined && self.stricmp(msg.prefixNick, self.irc.target()) === 0) {
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
                            if (self.autoJoinChannels !== undefined && self.autoJoinChannels.length > 0) {
                                $.each(self.autoJoinChannels.sort(self.stricmp).reverse(), function (idx, channel) {
                                    if (window.console) console.log('Joining channel: ' + channel);
                                    self.irc.sendMsg('JOIN ' + channel);
                                });
                            }
                            break;
                            
                        case '252': // RPL_LUSEROP
                        case '253': // RPL_LUSERUNKNOWN
                        case '254': // RPL_LUSERCHANNELS
                            self.writeTmpl('serverMsg', {
                                number: msg.info.number,
                                message: msg.info.message
                            });
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
                            
                        case '352': // RPL_WHOREPLY
                            self.writeTmpl('who', { msg: msg });
                            break;
                            
                        case '391': // RPL_TIME
                            self.writeTmpl('serverTime', { msg: msg });
                            break;
                            
                        case '403': // ERR_NOSUCHCHANNEL
                            self.writeTmpl('serverMsg', { message: msg.info.message });
                            break;
                            
                        case '477': // ERR_NOCHANMODES
                            self.writeTmpl('serverMsg', {
                                channel: msg.info.channel,
                                message: msg.info.message
                            });
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
                    
                    self.layoutPlugin.onProcessedMessage(self, msg);
                })
                .on('stateChanged.chatmore', function (e) {
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
    
                    // Auto-query first channel if selected user/channel is no longer available.
                    var target = self.irc.target();
                    if (target !== undefined) {
                        var isChannel = self.isChannel(target);
                        if (isChannel && !(target in state.channels)) {
                            var channel = self.getJoinedChannels()[0];
                            if (window.console) console.log('Selected channel is no longer joined.  Selecting first channel: ' + channel);
                            self.queryTarget(channel);
                        }
                        else if (!isChannel && !(target in state.users)) {
                            var channel = self.getJoinedChannels()[0];
                            if (window.console) console.log('Selected user is no longer available.  Selecting first channel: ' + channel);
                            self.queryTarget(channel);
                        }
                    }
                    
                    self.layoutPlugin.onStateChanged(self);
                    
                    self.prevState = self.clone(self.irc.state);
                })
                .on('sendingMessage.chatmore', function (e, rawMsg, resendCount) {
                    self.layoutPlugin.onSendingMessage(self, rawMsg, resendCount);
                })
                .on('errorSendingMessage.chatmore', function (e, xhr, rawMsg, resendCount) {
                    if (window.console) {
                        console.warn('Error sending message: ' + rawMsg + ', resendCount: ' + resendCount);
                        console.warn(xhr);
                    }
                    self.layoutPlugin.onErrorSendingMessage(self, xhr, rawMsg, resendCount);

                    if (resendCount == self.irc.options.maxResendAttempts) {
                        // Give user error that a message could not be sent after max attempts.
                        self.writeTmpl('error', { message: 'Unable to send message: ' + rawMsg });
                    }
                    else if (resendCount == 2) {
                        // Give user warning that a message could not be sent after a second attempt.
                        self.writeTmpl('error', { message: 'Error sending message to server, will try again: ' + rawMsg });
                    }
                })
                .on('activatingClient.chatmore', function (e, stage, message, params) {
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
    
                        // Auto-join channels.
                        var channels = self.autoJoinChannels.sort(self.stricmp);
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
                        break;
    
                    case 'error':
                        if (window.console) console.log('UI event: activatingClient error');
                        self.isPendingActivation = false;
                        self.writeTmpl('error', { message: message });
                        break;
                    }
                    
                    self.layoutPlugin.onActivatingClient(self, stage, message, params);
                })
                .on('deactivatingClient.chatmore', function () {
                    if (window.console) console.log('UI event: deactivatingClient');
                    self.ircElement
                        .removeClass('activated')
                        .addClass('deactivated');
                    
                    if (self.enableAutoReactivate) {
                        // Attempt reactivation.
                        if (self.reactivateAttempts < self.options.reactivateAttempts) {
                            //self.freezeSideBar = true;
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
                            //self.freezeSideBar = false;
                        }
                    }
                    else {
                        self.isPendingActivation = false;
                        self.writeTmpl('error', { message: 'Server connection closed.' });
                        //self.freezeSideBar = false;
                    }
                    
                    self.layoutPlugin.onDeactivatingClient(self);
                });
                
            // Setup user event handlers.
            $.each([ 'onStateChanged', 'onLocalMessage', 'onProcessingMessage', 'onProcessedMessage', 'onSendingMessage',
                'onErrorSendingMessage', 'onSentMessage', 'onActivatingClient', 'onDeactivatingClient' ],
                function (idx, event) {
                    if (event in options) {
                        self.ircElement.chatmore(event, options[event]);
                    }
                }
            );
                        
            // Create chatmore client.
            self.irc = new chatmore(self.ircElement[0], options);
            if (options.activateImmediately) self.irc.activateClient();
            
            return self.ircElement;
        }
        else {
            // Invoke named method against chatmoreUI object.
            var method = arguments[0];
            var args = Array.prototype.slice.call(arguments, 1);
            var self = $(this).data('chatmore');
            return self.methods[method].apply(self, args);
        }
    };
})();
