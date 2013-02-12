<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

$connectMode = intval($_POST['connect']);
$viewKey = $_POST['viewKey'];

$data = array();
session_start();

log::info("Initiating connectMode $connectMode with viewKey=$viewKey");

// Create or retrieve session state.
$session = getSession($viewKey);
$state = $session->load();
log::info('Got session state: ' . var_export($state, true));

// If session has been deleted, return error message to client.
if ($state->deleted) {
    $data[] =
        array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Session has been deleted.',
            'code' => spIrcClient::CLMSG_SESSION_UNAVAILABLE
        );
    @ob_clean();
    echo json_encode($data);
    exit;
}

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

// connect = 0 when client side is testing for a session resume.
// connect = 1 when client side wants to make a new IRC connection with provided server/nick.
// connect = 2 when client side always wants to create a new connection.

if ($connectMode === 0) {
    // Validate form parameters.
    $isValid = true;
    $server = coalesce($ircConfig['server'], $_POST['server']);
    $port = coalesce($ircConfig['port'], $_POST['port'], 6667);
	
    if (empty($server)) {
        // Invalid.
        $data[] =
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Server not provided.',
                'code' => spIrcClient::CLMSG_INVALID_ARGUMENTS
            );
        $isValid = false;
    }

    if (!is_numeric($port)) {
        $data[] =
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Invalid server port.',
                'code' => spIrcClient::CLMSG_INVALID_ARGUMENTS
            );
        $isValid = false;
    }
    
    if ($isValid) {
        // If this is a new session, initialize with connection details.
        if (empty($state->server)) {
            $state->server = $server;
            $state->port = $port;
            $session->save($state);
            
            log::info('Session state initialized: ' . var_export($state, true));
        }

        // Validate session.
        validateSession($state, $data);
    }
    
    log::info('connectMode 0 returned: ' . var_export($data, true));

    @ob_clean();
    echo json_encode($data);
    exit;
}

if ($connectMode === 2) {
    // Force reconnection by clearing client state.
    // <Not implemented>
}
else if (!validateSession($state)) {
    connect($state);
}

// Open connection is available.
// Return session id.
log::info("Connection ready.");
$data = array(
    array(
        'type' => spIrcClient::CLMSG_TYPE_SERVER,
        'message' => 'Connection ready.',
        'code' => spIrcClient::CLMSG_CONNECTION_READY
    )
);

log::info("connectMode $connectMode returned: " . var_export($data, true));

@ob_clean();
echo json_encode($data);
exit;

// http://stackoverflow.com/a/1013502/3347
function coalesce() {
    $args = func_get_args();
    foreach ($args as $arg) {
        if (!empty($arg)) {
            return $arg;
        }
    }
    return null;
}

function getSession($viewKey) {
    global $sessionDbFilename;
    log::info('Retrieving session by viewKey=' . $viewKey);
    $session = new spIrcSessionDAL_SQLIte($sessionDbFilename, $viewKey);
    return $session;
}

function connect($state) {
    global $ircConfig, $session;

    log::info('connect()');
    if (file_exists($state->socketFilename)) unlink($state->socketFilename);

    // Kick off background IRC proxy connection.
    $cmd = sprintf('php %s lib/ircConnection.php %s %s:%d &',
       $ircConfig['php_opts'],
       $state->socketFilename,
       $state->server,
       $state->port);
    log::info("Instantiating IRC proxy process: $cmd");
    $rc = pclose(popen($cmd, 'rb'));
    
    // Wait for socket to be created.  5 second timeout.
    for ($i = 0; $i < 50; $i++) {
        if (file_exists($state->socketFilename)) break;
        usleep(100 * 1000);
    }

    if (!file_exists($state->socketFilename)) {
        // Timeout waiting for socket file to be created.
        log::error("Timeout waiting for IRC connection to open.");
        @ob_clean();
        echo json_encode(array(
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Timeout waiting for IRC connection to open.',
                'code' => spIrcClient::CLMSG_TIMEOUT_ON_OPEN
            )
        ));
        exit;
    }
    log::info("Found socket file.");
    
    $session->save($state);
}

// Validate session for resume connection.
// Return true if session references an active socket connection.
function validateSession($state, &$data = array()) {
    log::info("Validate session.");

    $socketFile = $state->socketFilename;
    log::info("Socket file: $socketFile");

    // Check if we can connect to domain socket.
    if (!validateSocketFile($socketFile, 5)) {
        // No answer.  Assume listening process is dead and reinitialize.
        log::info("Uh oh, socket file isn't connecting, session invalid.");

        // No connection open to resume.
        log::info("Connection not open.");
        $data[] =
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Connection not open.',
                'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
            );
        return false;
    }
    
    log::info('Session is valid.');
    
    // Connection open and ready to resume.
    log::info("Connection ready.");
    $data[] =
        array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Connection ready.',
            'code' => spIrcClient::CLMSG_CONNECTION_READY
        );
    return true;
}

// Validate domain socket by knocking.
// Return true if connection is possible.
function validateSocketFile($socketFile, $timeout_sec, $timeout_usec = 0) {
    if (!file_exists($socketFile)) {
        log::info('Socket connection invalid: socket file is missing.');
        return false;
    }
    
    $socket = socket_create(AF_UNIX, SOCK_STREAM, 0);
    socket_set_option($socket, SOL_SOCKET, SO_SNDTIMEO, array('sec' => $timeout_sec, 'usec' => $timeout_usec)); 
    
    if (socket_connect($socket, $socketFile)) {
        // Success.
        log::info('Socket connection valid.');
        socket_shutdown($socket, 2);
        socket_close($socket);
        return true;
    }
    
    log::info('Socket connection invalid: Connection time out.');
    socket_close($socket);
    return false;
}

// Initialize new session state object.
// Return object.
function initializeSession($server, $port) {
    global $session;
    
    $state = new spIrcSessionModel();
    $state->server = $server;
    $state->port = $port;
    
    log::info("Session initialized for connection to $server:$port");
    $session->save($state);
    return $state;
}
?>
