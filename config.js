$(function () {
    // Default configuration.
    var defaults = {
        server: 'irc.dsm.org',
        channel: '#gvr4',
        mustMatchServer: false
    };
    
    // Parse querystring.
    var opts = {};
    if (querystring !== undefined) {
        var form = {};
        var pairs = querystring.split('&');
        
        for (var i in pairs) {
            var pair = pairs[i].split('=');
            var key = decodeURIComponent(pair[0]);
            var value = decodeURIComponent(pair[1]);
            
            if (typeof(form[key]) === 'string') {
                form[key] = [ form[key], value ];
            }
            else if (typeof(form[key]) === 'object') {
                form[key].push(value);
            }
            else {
                form[key] = value;
            }
        }
        
        if (form.server !== undefined) opts.server = form.server;
        if (form.port !== undefined) opts.port = form.port;
        if (form.nick !== undefined) opts.nick = form.nick;
    }
    
    // Parse anchor string.
    var m = window.location.href.match(/#(.+)/);
    if (m !== null) {
        opts.channel = '#' + m[1];
    }
    
    // Determine if any options were set.
    // If not, assume defaults.
    var objectSize = function (obj) {
        var count = 0;
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) count++;
        }
        return count;
    };
    
    var clone;
    clone = function(obj) {
        var newObj = (obj instanceof Array) ? [] : {};
        for (i in obj) {
            if (obj[i] && typeof(obj[i]) === "object")
                newObj[i] = clone(obj[i]);
            else
                newObj[i] = obj[i];
        }
        return newObj;
    };
    
    if (objectSize(opts) == 0) opts = clone(defaults);
    else opts.mustMatchServer = true;
    
    // TODO: If no server provided, popup dialog requesting connection details.
    
    // Startup the IRC client.
    $('.ircweb2').chatmore(opts);
});
