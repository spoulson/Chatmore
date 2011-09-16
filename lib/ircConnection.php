<?
// TODO: set_error_handler/set_exception_handler implementations.
// Clean up sockets on error/exception.

ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');

require_once 'class.log.php';
require_once 'class.spSocketProxy.php';

set_time_limit(0);
ignore_user_abort(true);
@ob_end_flush();

// Parse command line.
$socketFile = $argv[1];
list($host, $port) = explode(':', $argv[2], 2);
if (empty($port)) $port = 6667;

function connectToIrcServer() {
    global $ircSocket, $host, $port;
    $ircSocket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    socket_connect($ircSocket, $host, $port);
    return $ircSocket;
}

log::info("Creating proxy...");
umask(0);
$proxy = new spSocketProxy($socketFile, 1);
$proxy->setProxySocketFunc(create_function('', 'return connectToIrcServer();'));
$proxy->idleTimeout = 300;
$proxy->pollTimeout = 5000;
log::info("Done.");

// Poll loop.
while ($proxy->poll() !== false) {
    // Fake sleep to release cycles to OS.
    usleep(0);
}

cleanup();
exit;

function cleanup() {
    // Shut down.
    log::info("Proxy shut down.");

    if (!empty($ircSocket)) {
        log::info("Closing IRC connection...");
        socket_shutdown($ircSocket, 2);
        socket_close($ircSocket);
        log::info("Closed.");
    }

    unlink($socketFile);
}

?>
