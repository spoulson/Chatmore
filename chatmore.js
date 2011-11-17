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
                
                switch (msg.type) {
                case 'recv':
                    if (window.console) {
                        if (msg.raw !== undefined) console.log(msg.raw);
                        console.log(msg);
                    }
                    
                    switch (msg.command) {
                    case '001': // Welcome
                        // If we get the welcome message, we are successfully registered.
                        if (!self.state.isRegistered) {
                            self.state.isRegistered = true;
                            self.state.isModified = true;
                        }
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
    this.state = new chatmoreState();
    this.state.server = server;
    this.state.port = port;
    this.state.nick = nick;
    this.state.realname = realname;
    
    // Get selected target nick or channel, such as by /query command.
    this.target = function (newTarget) {
        if (newTarget === undefined) {
            return local.target;
        }
        else {
            // TODO: trigger target change event.
            if (newTarget === null) newTarget = undefined;
            local.target = newTarget;
        }
    };
    
    this.activateClient = function () {
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
                    
                    for (var msg in data) {
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
                        
                        // Register with IRC server.
                        self.register(self.state.nick, self.state.realname);
                    
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

    this.deactivateClient = function () {
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
    this.sendMsg = function (rawMsg, postCallback) {
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

    this.register = function (nick, realname) {
        self.state.nick = nick;
        self.state.ident = Math.floor(Math.random() * 100000000);
        self.state.realname = realname;
        self.state.isRegistered = false;
        self.state.registrationAttemptCount = 1;
        self.state.isModified = true;
        
        if (window.console) console.log('Registering user "' + self.state.nick + '" (' + self.state.realname + ') on IRC server "' + self.state.server + ':' + self.state.port + '"');
        
        this.sendMsg('USER ' + self.state.ident + ' 0 * :' + self.state.realname);
        this.sendMsg('NICK ' + self.state.nick);
    };
    
    this.sendChannelMsg = function (channel, message) {
        this.sendMsg('PRIVMSG ' + channel + ' ' + message);
    };

    this.sendPrivateMsg = function (nick, message) {
        this.sendMsg('PRIVMSG ' + nick + ' ' + message);
    };
    
    this.sendChannelAction = function (channel, message) {
        var quote = String.fromCharCode(1);
        this.sendMsg('PRIVMSG ' + channel + ' ' + quote + 'ACTION ' + message + quote);
    };

    this.sendPrivateAction = function (nick, message) {
        var quote = String.fromCharCode(1);
        this.sendMsg('PRIVMSG ' + nick + ' ' + quote + 'ACTION ' + message + quote);
    };
    
    this.sendChannelNotice = function (channel, message) {
        this.sendMsg('NOTICE ' + channel + ' ' + message);
    };

    this.sendPrivateNotice = function (nick, message) {
        this.sendMsg('NOTICE ' + nick + ' ' + message);
    };
    
    // Merge options into properties.
    if (options.mustMatchServer !== undefined) local.mustMatchServer = options.mustMatchServer;
    if (options.maxRegistrationAttempts !== undefined) local.maxRegistrationAttempts = options.maxRegistrationAttempts;
}