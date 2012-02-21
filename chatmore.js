// Instantiate chatmore as an object.
// var c = new chatmore(...);
// element: Associated HTML DOM object
// options array:
//    mustMatchServer:
//       when true, allows resuming connection, regardless of server
//       when false, allows resuming connection only if server/port match constructor parameters
function chatmore(element, server, port, nick, realname, options) {
    if (options === undefined) options = {};
    
    //
    // Private members.
    //
    var self = this;
    var local;
    local = {
        pollHandle: undefined,
        pollXhr: undefined,
        pauseRecv: false,
        mustMatchServer: false,
        maxRegistrationAttempts: 3,

        // Process incoming messages.
        processMessages: function (data) {
            if (data === undefined) return false;
            
            // Timestamp when last received message processing occurs.
            self.state.lastRecvTime = new Date().getTime();
            
            $.each(data, function (key, msg) {
                $(element).trigger('processingMessage', [ msg ]);
                
                self.state.messageCount++;

                switch (msg.type) {
                case 'recv':
                    if (window.console) {
                        if (msg.raw !== undefined) console.log(msg.raw);
                        //console.log(msg);
                    }
                    
                    switch (msg.command) {
                    case 'JOIN':
                        if (self.state.channels[msg.info.channel] === undefined) {
                            self.state.addChannel(msg.info.channel);
                            
                            // Get channel mode.
                            self.sendMsg('MODE ' + msg.info.channel);
                        }
                        
                        self.state.channels[msg.info.channel].addMember(msg.prefixNick);
                        break;
                        
                    case 'PART':
                        // Clean up state when leaving channel.
                        if (self.stricmp(msg.prefixNick, self.state.nick) == 0) {
                            // Current user leaving channel, remove channel from state.
                            self.state.removeChannel(msg.info.channel);
                        }
                        else {
                            // Another user leaving channel, remove member form channel state.
                            self.state.channels[msg.info.channel].removeMember(msg.prefixNick);
                        }
                        break;
                        
                    case 'KICK':
                        $.each(msg.info.kicks, function (i, kick) {
                            if (self.stricmp(kick.nick, self.state.nick) == 0) {
                                self.state.removeChannel(kick.channel);
                            }
                            else {
                                self.state.channels[kick.channel].removeMember(kick.nick);
                            }
                        });
                        break;
                        
                    case 'MODE':
                        if (self.isChannel(msg.info.target)) {
                            if (self.state.channels[msg.info.target] !== undefined) {
                                // Request fully qualified channel mode string.
                                self.sendMsg('MODE ' + msg.info.target);
                                
                                // Get channel members to capture possible user flag changes.
                                self.sendMsg('NAMES ' + msg.info.target);
                            }
                        }
                        else {
                            // Save user mode in state.
                            self.state.addUser(msg.info.target);
                            self.state.users[msg.info.target].mode = msg.info.mode;
                            self.state.isModified = true;
                        }
                        break;

                    case 'NICK':
                        if (self.stricmp(msg.prefixNick, self.state.nick) == 0) {
                            // Change current user's nick.
                            self.state.nick = msg.info.nick;
                        }
                        
                        self.renameNick(msg.info.oldNick, msg.info.nick);
                        break;
                        
                    case 'QUIT':
                        // Remove user from state.
                        $.each(self.state.channels, function (i, channel) {
                            channel.removeMember(msg.prefixNick);
                        });
                        
                        self.state.removeUser(msg.prefixNick);
                        break;

                    case '001': // Welcome
                        // If we get the welcome message, we are successfully registered.
                        if (!self.state.isRegistered) {
                            self.state.isRegistered = true;
                            self.state.isModified = true;
                        }
                        break;

                    case '324': // RPL_CHANNELMODEIS
                        if (self.state.channels[msg.info.channel] !== undefined) {
                            // Only update state if joined to this channel.
                            self.state.channels[msg.info.channel].mode = msg.info.mode;
                            self.state.isModified = true;
                        }
                        break;
                        
                    case '331': // RPL_NOTOPIC
                        if (self.state.channels[msg.info.channel] !== undefined) {
                            self.state.channels[msg.info.channel].topic = undefined;
                            self.state.isModified = true;
                        }
                        break;
                        
                    case '332': // RPL_TOPIC
                        if (self.state.channels[msg.info.channel] !== undefined) {
                            self.state.channels[msg.info.channel].topic = (msg.info.topic != '') ? msg.info.topic : undefined;
                            self.state.isModified = true;
                        }
                        break;
                        
                    case '333': // Topic set by
                        if (self.state.channels[msg.info.channel] !== undefined) {
                            self.state.channels[msg.info.channel].topicSetByNick = msg.info.nick;
                            self.state.channels[msg.info.channel].topicSetTime = msg.info.time;
                            self.state.isModified = true;
                        }
                        break;
                        
                    case '403': // ERR_NOSUCHCHANNEL
                        // If channel is listed as joined channel, remove it.
                        self.state.removeChannel(msg.info.channel);
                        break;

                    case '353': // RPL_NAMREPLY
                        var channelDesc = self.state.addChannel(msg.info.channel);
                        channelDesc.visibility = msg.info.visibility;
                        if (channelDesc.lastRPL_NAMREPLY < channelDesc.lastRPL_ENDOFNAMES) {
                            // First RPL_NAMREPLY since last RPL_ENDOFNAMES?  Clear the channel's member listing.
                            channelDesc.clearMembers();
                        }
                        
                        $.each(msg.info.names, function (i, name) {
                            self.state.addUser(name.nick);
                            memberDesc = channelDesc.addMember(name.nick);
                            memberDesc.mode = name.mode;
                        });
                        
                        channelDesc.lastRPL_NAMREPLY = self.state.messageCount;
                        self.state.isModified = true;
                        break;
                        
                    case '366': // RPL_ENDOFNAMES
                        // Track last RPL_ENDOFNAMES for the channel.
                        // Used to terminate RPL_NAMREPLY messages.
                        self.state.channels[msg.info.channel].lastRPL_ENDOFNAMES = self.state.messageCount;
                        break;
                        
                    case '433': // ERR_NICKNAMEINUSE
                        // If nick collision before successful registration, modify nick and try again.
                        if (!self.state.isRegistered) {
                            if (self.state.registrationAttemptCount < local.maxRegistrationAttempts) {
                                if (self.state.baseNick === undefined) self.state.baseNick = self.state.nick;
                                self.state.nick = '' + self.state.baseNick + '_' + self.state.registrationAttemptCount;
                                self.state.registrationAttemptCount++;
                                self.state.isModified = true;
                                
                                $(element).trigger('localMessage', [ null, 'clientMsg', { code: 'R1' } ]);
                                
                                self.sendMsg('NICK ' + self.state.nick);
                            }
                            else {
                                // Trigger error message when connection attempts max out.
                                $(element).trigger('localMessage', [ null, 'error', { code: 'RE1', maxRegistrationAttempts: local.maxRegistrationAttempts } ]);
                            }
                        }
                        break;
                    }
                    break;
                
                case 'servermsg':
                    if (window.console) {
                        if (msg.message !== undefined) {
                            console.log('servermsg: ' + msg.code + ' ' + msg.message);
                        }
                        else {
                            console.log('servermsg: ' + msg.code);
                        }
                    }

                    if (msg.code == 300) { // define session key
                        self.state.sessionId = msg.sessionId;
                        if (window.console) console.log('Session Key: ' + self.state.sessionId);
                    }
                    else if (msg.code >= 400) {
                        if (self.state.isActivated && msg.code == 400) {
                            self.deactivateClient();
                        }
                    }
                    break;
                }

                // Raise processedMessage event.
                $(element).trigger('processedMessage', [ msg ]);
                
                // Check if state has been changed, raise stateChanged event.
                if (self.state.isModified) {
                    $(element).trigger('stateChanged');
                    self.state.isModified = false;
                }
            });
        }
    };
    
    //
    // Public members.
    //
    // Client state model.  Initialize client state with constructor parameters.
    self.state = new chatmoreState();
    self.state.server = server;
    self.state.port = port;
    self.state.nick = nick;
    self.state.realname = realname;
    self.state.isModified = true;
    
    // Get selected target nick or channel, such as by /query command.
    self.target = function (newTarget) {
        if (newTarget === undefined) {
            return local.target;
        }
        else {
            // TODO: trigger target change event.
            if (newTarget === null) newTarget = undefined;
            local.target = newTarget;
        }
    };
    
    self.activateClient = function () {
        self.state.isActivated = false;
        self.state.lastRecvTime = undefined;
        
        $(element).trigger('activatingClient', [
            'start',
            undefined,
            { server: self.state.server, port: self.state.port }
        ]);
        
        var newConnectionFlag = true;
        var errorFlag = false;
        var errorHandler = function (message) {
            $(element).trigger('activatingClient', [
                'error',
                message,
                { server: self.state.server, port: self.state.port }
            ]);
        };
        var ajaxErrorFunc = function (xhr, status, error) {
            errorHandler('Error during activation: ' + status + ', ' + error);
            errorFlag = true;
        };
        
        // Initialize web client.
        // Check for open connection.
        var newConnectionFlag = true;

        var initCheckPostData = {
            connect: 0,
            server: self.state.server,
            port: self.state.port
        };
        if (local.mustMatchServer) initCheckPostData.mustMatchServer = true;
        
        $.ajax(
            'init.php?server=' + self.state.server + '&port=' + self.state.port,
            {
                async: false,
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: initCheckPostData,
                success: function (data) {
                    local.processMessages.call(self, data);
                    
                    for (var idx in data) {
                        var msg = data[idx];
                        if (msg.type == 'servermsg') {
                            // Check for connection ready message, which indicates a resumable connection.
                            if (msg.code == 200) {
                                newConnectionFlag = false;
                            }
                            // 401: CLMSG_CONNECTION_ALREADY_ACTIVE.
                            else if (msg.code == '401') {
                                errorHandler('Connection already active in this session.');
                                errorFlag = true;
                            }
                        }
                    }
                },
                error: ajaxErrorFunc
            }
        );
        
        if (errorFlag) {
            return;
        }
        
        // Create/resume a connection.
        if (newConnectionFlag) {
            $(element).trigger('activatingClient', [
                'connecting',
                undefined,
                {
                    server: self.state.server,
                    port: self.state.port
                }
            ]);
        }
        else {
            $(element).trigger('activatingClient', [
                'resuming',
                undefined,
                {
                    server: self.state.server,
                    port: self.state.port
                }
            ]);
        }
        
        var initPostData = {
            connect: 1,
            nick: self.state.nick,
            realname: self.state.realname,
            server: self.state.server,
            port: self.state.port
        };
        if (local.mustMatchServer) initPostData.mustMatchServer = true;
        
        $.ajax(
            'init.php?id=' + self.state.sessionId + '&server=' + self.state.server + '&port=' + self.state.port,
            {
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: initPostData,
                success: function (data) {
                    local.processMessages.call(self, data);
                    
                    if ($.grep(data, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                        // Activated.
                        $(element).trigger('activatingClient', [
                            'activated',
                            undefined,
                            { server: self.state.server, port: self.state.port }
                        ]);
                        self.state.isActivated = true;
                        
                        if (newConnectionFlag) {
                            // Register with IRC server.
                            self.register(self.state.nick, self.state.realname);
                        }
                        else {
                            self.sendMsg('NICK ' + self.state.nick);
                        }
                
                        // Repeatedly poll for IRC activity.
                        var pollFunc = function () {
                            if (local.pauseRecv) {
                                setTimeout(pollFunc, 100);
                            }
                            else {
                                local.pollHandle = undefined;
                                local.pollXhr = $.ajax('recv.php', {
                                    cache: false,
                                    data: { id: self.state.sessionId },
                                    dataType: 'json',
                                    success: function (data) {
                                        // Validate data is an array.
                                        if (typeof(data) == 'object') {
                                            local.processMessages.call(self, data);
                                        }
                                        else {
                                            // Data is invalid!
                                            if (window.console) {
                                                console.log('Got invalid data:');
                                                console.log(data);
                                            }
                                        }
                                    },
                                    complete: function () {
                                        // Schedule next poll.
                                        local.pollXhr = undefined;
                                        if (self.state.isActivated) {
                                            local.pollHandle = setTimeout(pollFunc, 100);
                                        }
                                    }
                                });
                            }
                        };
                        setTimeout(pollFunc, 0);
                        $(element).trigger('activatedClient', [
                            { server: self.state.server, port: self.state.port }
                        ]);
                    }
                    else {
                        // Error on activation.
                        $(element).trigger('activatingClient', [
                            'error',
                            'Error during activation',
                            { server: self.state.server, port: self.state.port }
                        ]);
                    }
                },
                error: ajaxErrorFunc
            });
    };

    self.deactivateClient = function () {
        if (self.state.isActivated) {
            $(element).trigger('deactivatingClient');
            
            self.state.isActivated = false;
            
            // Ensure any running ajax call is aborted and stops recurring.
            if (local.pollHandle !== undefined) clearTimeout(local.pollHandle);
            local.pollHandle = undefined;
            if (local.pollXhr !== undefined) local.pollXhr.abort();
            local.pollXhr = undefined;
                    
            $(element).trigger('deactivatedClient');
        }
    };
    
    // Send raw message to server.
    self.sendMsg = function (rawMsg, postCallback) {
        $(element).trigger('sendMsg', [ rawMsg ]);
        
        $.ajax('send.php?id=' + self.state.sessionId, {
            async: true,
            type: 'POST',
            dataType: 'json',
            cache: false,
            data: { msg: rawMsg },
            success: function (data) {
                if (postCallback) postCallback(rawMsg);
                $(element).trigger('sentMsg', [ rawMsg ]);
                
                // Validate data is an array.
                if (typeof(data) == 'object') {
                    local.processMessages.call(self, data);
                }
                else {
                    // Data is invalid!
                    if (window.console) {
                        console.log('Got invalid data:');
                        console.log(data);
                    }
                }
            }
        });
    };

    self.register = function (nick, realname) {
        self.state.nick = nick;
        self.state.ident = Math.floor(Math.random() * 100000000);
        self.state.realname = realname;
        self.state.isRegistered = false;
        self.state.registrationAttemptCount = 1;
        self.state.isModified = true;
        
        if (window.console) console.log('Registering user "' + self.state.nick + '" (' + self.state.realname + ') on IRC server "' + self.state.server + ':' + self.state.port + '"');
        
        self.sendMsg('USER ' + self.state.ident + ' 0 * :' + self.state.realname);
        self.sendMsg('NICK ' + self.state.nick);
    };
    
    self.sendChannelMsg = function (channel, message) {
        this.sendMsg('PRIVMSG ' + channel + ' ' + message);
    };

    self.sendPrivateMsg = function (nick, message) {
        this.sendMsg('PRIVMSG ' + nick + ' ' + message);
    };
    
    self.sendChannelAction = function (channel, message) {
        var quote = String.fromCharCode(1);
        this.sendMsg('PRIVMSG ' + channel + ' ' + quote + 'ACTION ' + message + quote);
    };

    self.sendPrivateAction = function (nick, message) {
        var quote = String.fromCharCode(1);
        this.sendMsg('PRIVMSG ' + nick + ' ' + quote + 'ACTION ' + message + quote);
    };
    
    self.sendChannelNotice = function (channel, message) {
        this.sendMsg('NOTICE ' + channel + ' ' + message);
    };

    self.sendPrivateNotice = function (nick, message) {
        this.sendMsg('NOTICE ' + nick + ' ' + message);
    };

    self.renameNick = function (oldNick, newNick) {
        // Adjust channel members.
        $.each(self.state.channels, function (i, channel) {
            if (channel.members[oldNick] !== undefined) {
                channel.members[newNick] = channel.members[oldNick];
                channel.removeMember(oldNick);
            }
        });
        
        // Adjust user list.
        self.state.users[newNick] = self.state.users[oldNick];
        self.state.removeUser(oldNick);
        
        self.state.isModified = true;
    };

    self.stricmp = function (a, b) {
        return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
    };

    self.isChannel = function (target) {
        return target.match(/^[#&+!][^\s,:\cg]+/);
    };

    // Merge options into properties.
    if (options.mustMatchServer !== undefined) local.mustMatchServer = options.mustMatchServer;
    if (options.maxRegistrationAttempts !== undefined) local.maxRegistrationAttempts = options.maxRegistrationAttempts;
}