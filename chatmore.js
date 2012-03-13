/*
Instantiate chatmore as an object.
var c = new chatmore(...);
element: Associated HTML DOM object
options array: {
    maxRegistrationAttempts: 3, // Maximum attempts to register in the event of a nick collision during registration.
    maxResendAttempts: 4        // Maximum retries to resend messages after encountering an error in delivery.
}
*/
function chatmore(element, viewKey, server, port, nick, realname, options) {
    if (options === undefined) options = { };
    
    //
    // Private members.
    //
    var self = this;
    var local;
    local = {
        pollHandle: undefined,
        pollXhr: undefined,
        pauseRecv: false,

        // Process incoming messages.
        processMessages: function (data) {
            if (data === undefined) return false;
            
            // Timestamp when last received message processing occurs.
            self.state.lastRecvTime = new Date().getTime();
            
            $.each(data, function (key, msg) {
                $(element).trigger('processingMessage.chatmore', [ msg ]);
                
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
                        if (self.stricmp(msg.prefixNick, self.state.nick) === 0) {
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
                            if (self.stricmp(kick.nick, self.state.nick) === 0) {
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
                        if (self.stricmp(msg.prefixNick, self.state.nick) === 0) {
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
                            self.state.channels[msg.info.channel].topic = (msg.info.topic !== '') ? msg.info.topic : undefined;
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
                        if (self.state.channels[msg.info.channel] !== undefined) {
                            self.state.channels[msg.info.channel].lastRPL_ENDOFNAMES = self.state.messageCount;
                        }
                        break;
                        
                    case '433': // ERR_NICKNAMEINUSE
                        // If nick collision before successful registration, modify nick and try again.
                        if (!self.state.isRegistered) {
                            if (self.state.registrationAttemptCount < self.options.maxRegistrationAttempts) {
                                if (self.state.baseNick === undefined) self.state.baseNick = self.state.nick;
                                self.state.nick = '' + self.state.baseNick + '_' + self.state.registrationAttemptCount;
                                self.state.registrationAttemptCount++;
                                self.state.isModified = true;
                                
                                $(element).trigger('localMessage.chatmore', [ null, 'clientMsg', { code: 'R1' } ]);
                                
                                self.sendMsg('NICK ' + self.state.nick);
                            }
                            else {
                                // Trigger error message when connection attempts max out.
                                $(element).trigger('localMessage.chatmore', [ null, 'error', { code: 'RE1', maxRegistrationAttempts: self.options.maxRegistrationAttempts } ]);
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

                    if (msg.code >= 400) {
                        if (self.state.isActivated && msg.code === 400) {
                            self.deactivateClient();
                        }
                    }
                    break;
                }

                // Raise processedMessage event.
                $(element).trigger('processedMessage.chatmore', [ msg ]);
                
                // Check if state has been changed, raise stateChanged event.
                if (self.state.isModified) {
                    $(element).trigger('stateChanged.chatmore');
                    self.state.isModified = false;
                }
            });
        }
    };
    
    //
    // Public members.
    //
    // Apply defaults for unspecified options.
    self.options = $.extend({
        maxRegistrationAttempts: 3,
        maxResendAttempts: 4
    }, options);
    
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
        
        $(element).trigger('activatingClient.chatmore', [
            'start',
            undefined,
            { server: self.state.server, port: self.state.port }
        ]);
        
        var newConnectionFlag = true;
        var errorFlag = false;
        var errorHandler = function (message) {
            $(element).trigger('activatingClient.chatmore', [
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
        $.ajax('init.php',
            {
                async: false,
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: {
                    connect: 0,
                    viewKey: viewKey,
                    server: self.state.server,
                    port: self.state.port
                },
                success: function (data) {
                    try {
                        local.processMessages.call(self, data);

                        $.each(data, function (idx, msg) {
                            if (msg.type === 'servermsg') {
                                // Check for connection ready message, which indicates a resumable connection.
                                if (msg.code === 200) {
                                    newConnectionFlag = false;
                                }
                                else if (msg.code > 400) {
                                    // All error codes except 400 will abort activation.
                                    errorHandler(msg.message);
                                    errorFlag = true;
                                }
                            }
                        });
                    }
                    catch (e) {
                        // Exception during activation.  Client state is undetermined.  User may need to start over.
                        if (window.console) {
                            console.error('Exception caught while processing messages:');
                            console.error(data);
                            console.error(e);
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
            $(element).trigger('activatingClient.chatmore', [
                'connecting',
                undefined,
                {
                    server: self.state.server,
                    port: self.state.port
                }
            ]);
        }
        else {
            $(element).trigger('activatingClient.chatmore', [
                'resuming',
                undefined,
                {
                    server: self.state.server,
                    port: self.state.port
                }
            ]);
        }
        
        $.ajax('init.php',
            {
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: {
                    connect: 1,
                    viewKey: viewKey
                },
                success: function (data) {
                    try {
                        local.processMessages.call(self, data);

                        if ($.grep(data, function (x) { return x.type === 'servermsg' && x.code === 200; }).length) {
                            // Activated.
                            $(element).trigger('activatingClient.chatmore', [
                                'activated',
                                undefined,
                                { server: self.state.server, port: self.state.port }
                            ]);
                            self.state.isActivated = true;

                            if (newConnectionFlag) {
                                // Register with IRC server.
                                self.register(self.state.nick, self.state.realname);
                            }

                            // Repeatedly poll for IRC activity.
                            var pollFunc = function () {
                                if (local.pauseRecv) {
                                    setTimeout(pollFunc, 100);
                                }
                                else {
                                    local.pollHandle = undefined;
                                    local.pollXhr = $.ajax('recv.php',
                                        {
                                            cache: false,
                                            data: {
                                                viewKey: viewKey
                                            },
                                            dataType: 'json',
                                            success: function (data) {
                                                // Validate data is an array.
                                                if (typeof(data) === 'object') {
                                                    try {
                                                        local.processMessages.call(self, data);
                                                    }
                                                    catch (e) {
                                                        if (window.console) {
                                                            console.error('Exception caught while processing messages:');
                                                            console.error(data);
                                                            console.error(e);
                                                        }
                                                    }
                                                }
                                                else {
                                                    // Data is invalid!
                                                    if (window.console) {
                                                        console.warn('Got invalid data:');
                                                        console.warn(data);
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
                            $(element).trigger('activatedClient.chatmore', [
                                { server: self.state.server, port: self.state.port }
                            ]);
                        }
                        else {
                            // Error on activation.
                            $(element).trigger('activatingClient.chatmore', [
                                'error',
                                'Error during activation',
                                { server: self.state.server, port: self.state.port }
                            ]);
                        }
                    }
                    catch (e) {
                        // Exception during activation.  Client state is undetermined.  User may need to start over.
                        if (window.console) {
                            console.error('Exception caught while processing messages:');
                            console.error(data);
                            console.error(e);
                        }
                    }
                },
                error: ajaxErrorFunc
            });
    };

    self.deactivateClient = function () {
        if (self.state.isActivated) {
            $(element).trigger('deactivatingClient.chatmore');
            
            self.state.isActivated = false;
            
            // Ensure any running ajax call is aborted and stops recurring.
            if (local.pollHandle !== undefined) clearTimeout(local.pollHandle);
            local.pollHandle = undefined;
            if (local.pollXhr !== undefined) local.pollXhr.abort();
            local.pollXhr = undefined;
                    
            $(element).trigger('deactivatedClient.chatmore');
        }
    };
    
    // Send raw message to server.
    self.sendMsg = function (rawMsg, postCallback) {
        var sendHandler = function (resendCount) {
            var resendHandler = function () {
                // Give up after 3 resends.
                if (resendCount < self.options.maxResendAttempts) {
                    if (window.console) console.warn('Resending: ' + rawMsg);

                    // First attempt retry immediately.
                    // Successive attempts delay a moment.
                    var retryDelay = resendCount > 0 ? 3000 : 100;
                    setTimeout(function () { sendHandler(resendCount + 1); }, retryDelay);
                }
            };

            $(element).trigger('sendingMessage.chatmore', [ rawMsg, resendCount ]);
            
            $.ajax('send.php',
                {
                    async: true,
                    type: 'POST',
                    dataType: 'json',
                    cache: false,
                    data: {
                        viewKey: viewKey,
                        msg: rawMsg
                    },
                    success: function (data) {
                        if (postCallback) postCallback(rawMsg);
                        $(element).trigger('sentMessage.chatmore', [ rawMsg, resendCount ]);
                
                        // Validate data is an array.
                        if (typeof(data) === 'object') {
                            try {
                                local.processMessages.call(self, data);
                            }
                            catch (e) {
                                if (window.console) {
                                    console.error('Exception caught while processing messages:');
                                    console.error(data);
                                    console.error(e);
                                }
                            }
                        }
                        else {
                            // Data is invalid!
                            if (window.console) {
                                console.warn('Got invalid data:');
                                console.warn(data);
                            }
                        
                            resendHandler();
                            
                            return false;
                        }
                    },
                    error: function (event, xhr) {
                        $(element).trigger('errorSendingMessage.chatmore', [ xhr, rawMsg, resendCount ]);
                        
                        resendHandler();
                    }
                });
        };
        
        sendHandler(0);
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
}