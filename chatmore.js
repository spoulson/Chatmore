// Instantiate chatmore as an object.
// var c = new chatmore(...);
function chatmore(element, server, port, nick, realname) {
    //
    // Private members.
    //
    var obj = this;
    var local;
    local = {
        pollHandle: undefined,
        pollXhr: undefined,
        lastRecvTime: undefined,
        state: undefined,
        isActivated: false,
        
        // Process incoming messages.
        processMessages: function (data) {
            if (data === undefined) return false;
            
            // Timestamp when last received message processing occurs.
            local.lastRecvTime = new Date().getTime();
            
            $.each(data, function (key, msg) {
                $(element).trigger('processingMessage', [ msg ]);
                
                switch (msg.type) {
                case 'recv':
                    if (console) {
                        if (msg.raw !== undefined) console.log(msg.raw);
                        // console.log(msg);
                    }
                    break;
                
                case 'state':
                    if (msg.state !== undefined) {
                        local.state = msg.state;
                        $(element).trigger('stateChanged');
                    }
                    break;

                case 'servermsg':
                    if (console) console.log('servermsg: ' + msg.code + ' ' + msg.message);
                    
                    if (msg.code >= 400) {
                        if (local.isActivated && msg.code == 400) {
                            obj.deactivateClient();
                        }
                    }
                    break;
                }

                $(element).trigger('processedMessage', [ msg ]);
            });
        }
    };
    
    //
    // Public members.
    //
    this.server = server;
    this.port = port;
    
    // Get selected target nick or channel, set via /query.
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
    
    this.state = function () {
        return local.state;
    };
    
    this.isActivated = function () {
        return local.isActivated;
    };
    
    this.activateClient = function () {
        local.isActivated = false;
        local.lastRecvTime = undefined;
        
        $(element).trigger('activatingClient', [ 'start' ]);
        
        var newConnectionFlag = true;
        var errorFlag = false;
        var errorFunc = function (xhr, status, error) {
            $(element).trigger('activatingClient', [ 'error', 'Error during activation: ' + status + ', ' + error ]);
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
                    // if (console) {
                        // console.log('data from init check:');
                        // console.log(data);
                    // }
                    local.processMessages.call(obj, data);
                    
                    // Check for connection ready message.
                    if ($.grep(data, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                        newConnectionFlag = false;
                    }
                },
                error: errorFunc
            }
        );
        
        if (errorFlag) return;
        
        // Create/resume a connection.
        $(element).trigger('activatingClient', [ newConnectionFlag ? 'connecting' : 'resuming' ]);
        
        $.ajax(
            'ircweb2init.php',
            {
                type: 'POST',
                dataType: 'json',
                data: {
                    connect: 1,
                    nick: nick,
                    realname: realname,
                    server: server,
                    port: port
                },
                success: function (data) {
                    // if (console) {
                        // console.log('data from init:');
                        // console.log(data);
                    // }
                    local.processMessages.call(obj, data);
                    
                    // TODO: verify session state has the expected server/port.  If not, reinitialize connection.
                    
                    if ($.grep(data, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                        // Activated.
                        $(element).trigger('activatingClient', [ 'activated' ]);
                        local.isActivated = true;
                    
                        // Repeatedly poll for IRC activity.
                        var pollFunc = function () {
                            local.pollHandle = undefined;
                            local.pollXhr = $.ajax('ircweb2recv.php', {
                                dataType: 'json',
                                success: function (data) {
                                    // Validate data is an array.
                                    if (typeof(data) == 'object') {
                                        local.processMessages.call(obj, data);
                                    }
                                    else {
                                        // Data is invalid!
                                        if (console) {
                                            console.log('Got invalid data:');
                                            console.log(data);
                                        }
                                    }
                                },
                                complete: function () {
                                    // Schedule next poll.
                                    local.pollXhr = undefined;
                                    if (local.isActivated) {
                                        local.pollHandle = setTimeout(pollFunc, 100);
                                    }
                                }
                            });
                        };
                        setTimeout(pollFunc, 0);
                        $(element).trigger('activatedClient');
                    }
                    else {
                        // Error on activation.
                        $(element).trigger('activatingClient', [ 'error', 'Error during activation' ]);
                    }
                },
                error: errorFunc
            });
    };

    this.deactivateClient = function () {
        if (local.isActivated) {
            $(element).trigger('deactivatingClient');
            
            local.isActivated = false;
            
            // Ensure any running ajax call is aborted and stops recurring.
            if (local.pollHandle !== undefined) clearTimeout(local.pollHandle);
            local.pollHandle = undefined;
            if (local.pollXhr !== undefined) local.pollXhr.abort();
            local.pollXhr = undefined;
                    
            $(element).trigger('deactivatedClient');

            local.state = undefined;
            $(element).trigger('stateChanged');
        }
    };
    
    // Send raw message to server.
    // TODO: Consider if postCallback can be implemented as a JQuery Deferred action.
    this.sendMsg = function (rawMsg, postCallback) {
        $(element).trigger('sendMsg', [ rawMsg ]);
        
        $.ajax('ircweb2send.php', {
            async: true,
            type: 'POST',
            data: { msg: rawMsg },
            success: function () {
                if (postCallback) postCallback(rawMsg);
                $(element).trigger('sentMsg', [ rawMsg ]);
            }
        });
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
}