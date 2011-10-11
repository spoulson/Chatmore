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
                    if (window.console) {
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
                    if (window.console) console.log('servermsg: ' + msg.code + ' ' + msg.message);
                    
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
    
    this.state = function () {
        return local.state;
    };
    
    this.isActivated = function () {
        return local.isActivated;
    };
    
    this.activateClient = function () {
        local.isActivated = false;
        local.lastRecvTime = undefined;
        
        $(element).trigger('activatingClient', [
            'start',
            undefined,
            { server: server, port: port }
        ]);
        
        var newConnectionFlag = true;
        var errorFlag = false;
        var errorFunc = function (xhr, status, error) {
            $(element).trigger('activatingClient', [
                'error',
                'Error during activation: ' + status + ', ' + error,
                { server: server, port: port }
            ]);
            errorFlag = true;
        };
        
        // Initialize web client.
        // Check for open connection.
        var newConnectionFlag = true;
        
        var initCheckPostData = {
            connect: 0,
            server: server,
            port: port
        };
        if (options.mustMatchServer) initCheckPostData.mustMatchServer = true;
        
        $.ajax(
            'init.php',
            {
                async: false,
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: initCheckPostData,
                success: function (data) {
                    // if (window.console) {
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
        if (newConnectionFlag) {
            $(element).trigger('activatingClient', [
                'connecting',
                undefined,
                { server: server, port: port }
            ]);
        }
        else {
            $(element).trigger('activatingClient', [
                'resuming',
                undefined,
                { server: local.state.server, port: local.state.port }
            ]);
        }
        
        var initPostData = {
            connect: 1,
            nick: nick,
            realname: realname,
            server: server,
            port: port
        };
        if (options.mustMatchServer) initPostData.mustMatchServer = true;
        
        $.ajax(
            'init.php',
            {
                type: 'POST',
                cache: false,
                dataType: 'json',
                data: initPostData,
                success: function (data) {
                    // if (window.console) {
                        // console.log('data from init:');
                        // console.log(data);
                    // }
                    local.processMessages.call(obj, data);
                    
                    if ($.grep(data, function (x) { return x.type == 'servermsg' && x.code == 200; }).length) {
                        // Activated.
                        $(element).trigger('activatingClient', [
                            'activated',
                            undefined,
                            { server: local.state.server, port: local.state.port }
                        ]);
                        local.isActivated = true;
                    
                        // Repeatedly poll for IRC activity.
                        var pollFunc = function () {
                            local.pollHandle = undefined;
                            local.pollXhr = $.ajax('recv.php', {
                                cache: false,
                                dataType: 'json',
                                success: function (data) {
                                    // Validate data is an array.
                                    if (typeof(data) == 'object') {
                                        local.processMessages.call(obj, data);
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
                                    if (local.isActivated) {
                                        local.pollHandle = setTimeout(pollFunc, 100);
                                    }
                                }
                            });
                        };
                        setTimeout(pollFunc, 0);
                        $(element).trigger('activatedClient', [
                            { server: server, port: port }
                        ]);
                    }
                    else {
                        // Error on activation.
                        $(element).trigger('activatingClient', [
                            'error',
                            'Error during activation',
                            { server: server, port: port }
                        ]);
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
    this.sendMsg = function (rawMsg, postCallback) {
        $(element).trigger('sendMsg', [ rawMsg ]);
        
        $.ajax('send.php', {
            async: true,
            type: 'POST',
            cache: false,
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