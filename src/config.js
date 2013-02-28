// Default configuration.
var chatmoreDefaults = {
    // Defaults for launch page.
    nick: undefined,
    realname: undefined,
    server: 'irc.dsm.org',
    port: 6667,
    channel: undefined,
    
    // Activate immediately on loading client.php.  Otherwise, user must enter /connect.
    activateImmediately: true,
    
    // Maximum lines in console before roll off.
    maximumConsoleLines: 20000,
    
    // Delay between polls to recv.php for incoming messages.
    pollIntervalDelayMs: 1000,
    
    // Enable /list client command.
    enableList: false
};
