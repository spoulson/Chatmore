<?
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
require_once 'config.php';
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

if (($connectMode == 0 || $connectMode == 1) && isset($_SESSION['irc'])) {
    // Validate session for resume.
    error_log("Validate session.");
    $state =& $_SESSION['irc'];
    $socketFile = $state->getSocketFilename();
    error_log("Socket file: $socketFile");
    
    if (!file_exists($socketFile)) {
        // If socket file is missing, clear client state and reinitialize.
        error_log("Uh oh, socket file is missing, reinitializing session.");
        // TODO: Reconnect and attempt to restore joined channels.
        unset($_SESSION['irc']);
    }
    else {
        // Check if we can connect to domain socket.
        if (!validateSocketFile($socketFile, 5)) {
            // No answer.  Assume listening process is dead and reinitialize.
            // TODO: Reconnect and attempt to restore joined channels.
            error_log("Uh oh, socket file isn't connecting, reinitializing session.");
            unset($_SESSION['irc']);
        }
    }
}
else if ($connectMode == 2) {
    unset($_SESSION['irc']);
    break;
}

// Create client state if missing.
if (!isset($_SESSION['irc'])) {
    error_log('Initializing session.');
    $state =& new spIrcClientState();
    $state->nick = $_POST['nick'];
    $state->realname = $_POST['realname'];
    $state->ident = uniqid();
    $state->host = $_POST['server'] . ':' . (isset($_POST['port']) ? $_POST['port'] : 6667);
    error_log('server: ' . $state->host);
    error_log('nick/realname: ' . $state->nick . '/' . $state->realname);
    $_SESSION['irc'] = $state;

    if ($connectMode == 0) {
        // No connection open to resume.
        error_log("Connection not open.");
        @ob_clean();
        echo json_encode(array(
            'msgs' => array(
                array(
                    'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    'message' => 'Connection not open.',
                    'code' => spIrcClient::CLMSG_NOT_OPEN
                )
            )
        ));
        exit;
    }
    else if ($connectMode == 1 || $connectMode == 2) {
        $state =& $_SESSION['irc'];
        $socketFile = $state->getSocketFilename();
        error_log("Socket file: $socketFile");
        if (file_exists($socketFile)) unlink($socketFile);

        // Kick off background IRC proxy connection.
        $cmd = "php " . $ircConfig['php_opts'] . " lib/ircConnection.php $socketFile " . $state->host . ' &';
        error_log("Instantiating IRC process: $cmd");
        pclose(popen($cmd, 'r'));
        
        // Wait for socket to be created.  5 second timeout.
        for ($i = 0; $i < 50; $i++) {
            if (file_exists($socketFile)) break;
            usleep(100 * 1000);
        }
        
        if (!file_exists($socketFile)) {
            // Timeout waiting for socket file to be created.
            error_log("Timeout waiting for IRC connection to open.");
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
        error_log("Found socket file.");
        
        // Socket is ready.  Connect to server and initialize the IRC connection.
        $ircbot = new spIrcClient($socketFile, $state);
        $ircbot->register($state->nick, $state->ident, $state->realname);
        $ircbot->disconnect();
        error_log("IRC connection ready.");
    }
}

// Open connection is available.
error_log("Connection ready.");
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

?>
