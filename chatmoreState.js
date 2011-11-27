function chatmoreState() {
    var state = this;
    var colorizeMin = 0;
    var colorizeMax = 31;
    
    // Get FNV-1 hash on a string.
    // http://isthe.com/chongo/tech/comp/fnv/
    // 'hash' is a previous hash to chain.
    var getFNV1 = function (n, hash) {
        if (hash === undefined) hash = 2166136261;
        
        for (var i = 0; i < n.length; i++) {
            hash *= 16777619;
            hash ^= n.charCodeAt(i);
            hash &= 0xffffffff;
        }
        
        return hash;
    };
    
    var isArrayEmpty = function (arr) {
        for (var key in arr) {
           if (arr.hasOwnProperty(key)) return false;
        }
        
        return true;
    };

    state.isModified = false;
    
    // isActivated = true when init.php returns successful connection message.
    state.isActivated = false;
    
    // isRegistered = true when welcome message is received, indicating nickname is valid.
    state.isRegistered = false;
    state.registrationAttemptCount = 0;

    state.nick = undefined;
    state.ident = undefined;
    state.realname = undefined;
    state.channels = {};
    state.users = {};
    
    // Epoch time of last message from recv.php.
    state.lastRecvTime = undefined;
    state.messageCount = 0;
    
    // Session id returned from init.php during activation.
    state.sessionId = undefined;

    state.addChannel = function (channel) {
        if (state.channels[channel] === undefined) {
            //if (window.console) console.log('addchannel(' + channel + ')');
            state.channels[channel] = new channelDesc();
            state.isModified = true;
        }
        
        return state.channels[channel];
    };
    
    state.addUser = function (nick) {
        if (state.users[nick] === undefined) {
            //if (window.console) console.log('addUser(' + nick + ')');
            state.users[nick] = new userDesc();
            state.isModified = true;
        }
        
        return state.users[nick];
    };
    
    state.removeChannel = function (channel) {
        if (state.channels[channel] !== undefined) {
            //if (window.console) console.log('removeChannel(' + channel + ')');
            delete state.channels[channel];
            state.isModified = true;
        }
    };
    
    state.removeUser = function (nick) {
        if (state.users[nick] !== undefined) {
            //if (window.console) console.log('removeUser(' + nick + ')');
            delete state.users[nick];
            state.isModified = true;
        }
    };

    state.clearChannels = function () {
        if (!isArrayEmpty(state.channels)) {
            //if (window.console) console.log('clearChannels()');
            state.channels = {};
            state.isModified = true;
        }
    };
    
    state.clearUsers = function () {
        if (!isArrayEmpty(state.users)) {
            //if (window.console) console.log('clearUsers()');
            state.users = {};
            state.isModified = true;
        }
    };
    
    // Describes a channel on the IRC network.
    function channelDesc() {
        this.mode = undefined;
        
        // = public, * private, @ secret
        this.visibility = undefined;
        
        this.topic = undefined;
        this.topicSetByNick = undefined;
        
        // Epoch timestamp
        this.topicSetTime = undefined;
        
        // Array of $nick => channelMemberDesc objects
        this.members = {};
        
        this.lastRPL_NAMREPLY = 0;
        this.lastRPL_ENDOFNAMES = 0;
        
        this.addMember = function (nick) {
            if (this.members[nick] === undefined) {
                //if (window.console) console.log('addMember(' + nick + ')');
                member = new channelMemberDesc();
                member.mode = '';
                
                // Generate colorize number based on nick.
                nickHash = getFNV1(nick);
                member.colorizeNumber = nickHash % (colorizeMax - colorizeMin + 1) + colorizeMin;
                this.members[nick] = member;
                
                state.isModified = true;
                
                //if (window.console) console.log('colorize ' + nick + ': ' + member.colorizeNumber + ', checksum: ' + nickHash);
            }
            
            return this.members[nick];
        };
        
        this.removeMember = function (nick) {
            if (this.members[nick] !== undefined) {
                //if (window.console) console.log('removeMember(' + nick + ')');
                delete this.members[nick];
                state.isModified = true;
            }
        };
        
        this.clearMembers = function () {
            if (!isArrayEmpty(this.members)) {
                //if (window.console) console.log('clearMembers()');
                this.members = {};
                state.isModified = true;
            }
        };
    }
    
    // Describes a member in a channel.
    function channelMemberDesc() {
        // Nick prefixes: http://www.geekshed.net/2009/10/nick-prefixes-explained/
        // ~ owners
        // & admins
        // @ full operators
        // % half operators
        // + voiced users
        this.mode = undefined;
        this.colorizeNumber = undefined;
    }
    
    // Describes a user on the IRC network.
    function userDesc() {
        this.realname = undefined;
        this.host = undefined;
        this.mode = undefined;
    }
}
