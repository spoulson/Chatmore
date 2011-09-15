<?
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

session_start();

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

// connect = 0 when client side is testing for a session resume.
// connect = 1 when client side wants to make a new IRC connection with provided server/nick.
// connect = 2 when client side always wants to create a new connection.

$connectMode = $_POST['connect'];

if ($connectMode == 0) {
    $valid = validateSession();
    
    if ($valid) {
        // Connection open and ready to resume.
        log::info("Connection ready.");
        @ob_clean();
        echo json_encode(array(
            'msgs' => array(
                array(
                    'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    'message' => 'Connection ready.',
                    'code' => spIrcClient::CLMSG_CONNECTION_READY
                )
            )
        ));
    }
    else {
        // No connection open to resume.
        log::info("Connection not open.");
        @ob_clean();
        echo json_encode(array(
            'msgs' => array(
                array(
                    'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    'message' => 'Connection not open.',
                    'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
                )
            )
        ));
    }
    
    exit;
}

if ($connectMode == 2) {
    unset($_SESSION['irc']);
}

// Initialize client state if invalid.
if (!validateSession()) {
    log::info('Initializing session.');
    $state =& initializeSession(
        $_POST['nick'],
        uniqid(),
        $_POST['realname'],
        $_POST['server'] . ':' . (isset($_POST['port']) ? $_POST['port'] : 6667));

    if ($connectMode == 1 || $connectMode == 2) {
        $state =& $_SESSION['irc'];
        $socketFile = $state->getSocketFilename();
        log::info("Socket file: $socketFile");
        if (file_exists($socketFile)) unlink($socketFile);

        // Kick off background IRC proxy connection.
        $cmd = "php " . $ircConfig['php_opts'] . " lib/ircConnection.php $socketFile " . $state->host . ' &';
        log::info("Instantiating IRC process: $cmd");
        pclose(popen($cmd, 'r'));
        
        // Wait for socket to be created.  5 second timeout.
        for ($i = 0; $i < 50; $i++) {
            if (file_exists($socketFile)) break;
            usleep(100 * 1000);
        }
        
        if (!file_exists($socketFile)) {
            // Timeout waiting for socket file to be created.
            log::error("Timeout waiting for IRC connection to open.");
            @ob_clean();
            echo json_encode(array(
                'msgs' => array(
                    array(
                        'type' => spIrcClient::CLMSG_TYPE_SERVER,
                        'message' => 'Timeout waiting for IRC connection to open.',
                        'code' => spIrcClient::CLMSG_TIMEOUT_ON_OPEN
                    )
                )
            ));
            exit;
        }
        log::info("Found socket file.");
        
        // Socket is ready.  Connect to server and initialize the IRC connection.
        $ircbot = new spIrcClient($socketFile, $state);
        $ircbot->register($state->nick, $state->ident, $state->realname);
        $ircbot->disconnect();
    }
}

// Open connection is available.
log::info("Connection ready.");
@ob_clean();
echo json_encode(array(
    'msgs' => array(
        array(
            'type' => spIrcClient::CLMSG_TYPE_STATE,
            'state' => $_SESSION['irc']
        ),
        array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Connection ready.',
            'code' => spIrcClient::CLMSG_CONNECTION_READY
        )
    )
));

exit;


// Validate session for resume connection.
// Return true if session references an active socket connection.
function validateSession() {
    log::info("Validate session.");
    
    if (!isset($_SESSION['irc'])) return false;
    
    $state =& $_SESSION['irc'];
    $socketFile = $state->getSocketFilename();
    log::info("Socket file: $socketFile");
    
    if (!file_exists($socketFile)) {
        // If socket file is missing, clear client state and reinitialize.
        log::info("Uh oh, socket file is missing, reinitializing session.");
        // TODO: Reconnect and attempt to restore joined channels.
        unset($_SESSION['irc']);
    }
    else {
        // Check if we can connect to domain socket.
        if (!validateSocketFile($socketFile, 5)) {
            // No answer.  Assume listening process is dead and reinitialize.
            // TODO: Reconnect and attempt to restore joined channels.
            log::info("Uh oh, socket file isn't connecting, reinitializing session.");
            unset($_SESSION['irc']);
        }
    }
}

// Validate domain socket by knocking.
// Return true if connection is possible.
function validateSocketFile($socketFile, $timeout_sec, $timeout_usec = 0) {
    $socket = socket_create(AF_UNIX, SOCK_STREAM, 0);
    socket_set_option($socket, SOL_SOCKET, SO_SNDTIMEO, array('sec' => $timeout_sec, 'usec' => $timeout_usec)); 
    
    if (socket_connect($socket, $socketFile)) {
        // Success.
        socket_shutdown($socket, 2);
        socket_close($socket);
        return true;
    }
    
    socket_close($socket);
    return false;
}

// Initialize new session state object.
// Return object.
function initializeSession($nick, $ident, $realname, $host) {
    $state = new spIrcClientState();
    $state->nick = $nick;
    $state->realname = $realname;
    $state->ident = $ident;
    $state->host = $host;
    log::info('server: ' . $state->host);
    log::info('nick/realname: ' . $state->nick . '/' . $state->realname);
    $_SESSION['irc'] =& $state;
    return $state;
}
?>
