<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

// Check if a session exists to this server:port, or create new.
$sessionId = isset($_GET['id']) ? $_GET['id'] : null;
$server = $_GET['server'];
$port = isset($_GET['port']) ? $_GET['port'] : '6667';

$connectMode = $_POST['connect'];
$data = array();

session_start();

// Create or retrieve session state.
if ($sessionId === null) {
    log::info('Creating session');
    $session = new spIrcSessionDAL_SQLite($sessionDbFilename, $server, $port);

    // Return message indicating new session Id.
    $data[] = array(
        'type' => spIrcClient::CLMSG_TYPE_SERVER,
        'code' => spIrcClient::CLMSG_SESSION_ID,
        'sessionId' => $session->getId()
    );
}
else {
    log::info('Retrieving session Id ' . $sessionId);
    $session = new spIrcSessionDAL_SQLIte($sessionDbFilename, $sessionId);
}

$state = $session->load();

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

// connect = 0 when client side is testing for a session resume.
// connect = 1 when client side wants to make a new IRC connection with provided server/nick.
// connect = 2 when client side always wants to create a new connection.

if ($connectMode == 0) {
    // Validate session only.
    $valid = validateSession($state, $data);
    log::info('connectMode 0 returned: ' . var_export($data, true));
    
    @ob_clean();
    echo json_encode($data);
    exit;
}

if ($connectMode == 2) {
    // Force reconnection by clearing client state.
    //unset($_SESSION[$clientStateKey]);
    //$state = initializeSession(
    //    //$_POST['nick'],
    //    //uniqid(),
    //    //$_POST['realname'],
    //    $_POST['server'],
    //    $_POST['port']);
}
else if (!validateSession($state)) {
    // Initialize client state if invalid.
    // if (isset($_SESSION[$clientStateKey])) {
        // $state = $_SESSION[$clientStateKey];
        // if ($state->local->recvInProgress) {
            // // Cannot reinitialize state, recv.php already active in another thread.
            // @ob_clean();
            // echo json_encode(array(
                // array(
                    // 'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    // 'message' => 'Connection already active in this session.',
                    // 'code' => spIrcClient::CLMSG_CONNECTION_ALREADY_ACTIVE
                // )
            // ));
            // exit;
        // }
    // }

    log::info('Initializing session.');
    //unset($_SESSION[$clientStateKey]);
    //$state = initializeSession(
    //    //$_POST['nick'],
    //    //uniqid(),
    //    //$_POST['realname'],
    //    $_POST['server'],
    //    $_POST['port']);

    log::info('initialized state: ' . var_export($state, true));
    connect($state);
}

// Open connection is available.
// Return session id.
log::info("Connection ready.");
$data = array(
    array(
        'type' => spIrcClient::CLMSG_TYPE_SERVER,
        'message' => 'Connection ready.',
        'code' => spIrcClient::CLMSG_CONNECTION_READY,
        'session' => $session->getId()
    )
);

log::info('connectMode 1/2 returned: ' . var_export($data, true));

@ob_clean();
echo json_encode($data);

exit;

function connect($state) {
    global $ircConfig, $session;
    
    log::info("Primary Socket file: " . $state->primarySocketFilename);
    log::info("Secondary Socket file: " . $state->primarySocketFilename);
    if (file_exists($state->primarySocketFilename)) unlink($state->primarySocketFilename);
    if (file_exists($state->secondarySocketFilename)) unlink($state->secondarySocketFilename);

    // Kick off background IRC proxy connection.
    $cmd = sprintf('php %s lib/ircConnection.php %s %s %s &',
       $ircConfig['php_opts'],
       $state->primarySocketFilename,
       $state->secondarySocketFilename,
       $state->server);
    log::info("Instantiating IRC process: $cmd");
    pclose(popen($cmd, 'r'));
    
    // Wait for socket to be created.  5 second timeout.
    for ($i = 0; $i < 50; $i++) {
        if (file_exists($state->primarySocketFilename)) break;
        usleep(100 * 1000);
    }
    
    if (!file_exists($state->primarySocketFilename)) {
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
    //log::info('state: ' . var_export($state, true));

    $socketFile = $state->primarySocketFilename;
    log::info("Socket file: $socketFile");

    $server = $_POST['server'];
    $port = $_POST['port'];
    
    // // Check if session and POST server names match.
    // if (isset($_POST['mustMatchServer']) && $_POST['mustMatchServer'] &&
        // $state->server != $server || $state->port != $port) {
        // log::info("Server:port '" . $server . ':' . $port . " are different than existing session '" . $state->server . ':' . $state->port . "', session invalid.");
        
        // // No connection open to resume.
        // log::info("Connection not open.");
        // $data[] =
            // array(
                // 'type' => spIrcClient::CLMSG_TYPE_SERVER,
                // 'message' => 'Connection not open.',
                // 'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
            // );
        // return false;
    // }
    
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
    
    if ($state->server->recvInProgress) {
        // Cannot reinitialize state, recv.php already active in another thread.
        log::info('recv.php already active in another thread.');
        $data[] =
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Connection already active in this session.',
                'code' => spIrcClient::CLMSG_CONNECTION_ALREADY_ACTIVE
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
function initializeSession(/*$nick, $ident, $realname,*/ $server, $port) {
    global $session;
    //global $clientStateKey;
    
    // $state = new spIrcClientState();
    // $state->nick = $nick;
    // $state->realname = $realname;
    // $state->ident = $ident;
    // $state->server = $server;
    // $state->port = $port;

    $state = new spIrcSessionModel();
    //$state->client->nick = $nick;
    //$state->client->realname = $realname;
    //$state->client->ident = $ident;
    $state->server = $server;
    $state->port = $port;
    
    log::info("Session initialized for connection to $server:$port");
    $session->save($state);
    return $state;
}
?>
