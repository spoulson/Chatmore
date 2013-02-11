<?
// TODO: set_error_handler/set_exception_handler implementations.
// Clean up sockets on error/exception.

$tmpDir = dirname($_SERVER['SCRIPT_FILENAME']) . '/../tmp';

ini_set('error_log', "$tmpDir/php_errors.log");

require_once 'class.log.php';
require_once 'class.spSocketProxy.php';

set_time_limit(0);
ignore_user_abort(true);
@ob_end_flush();

// Parse command line.
$primarySocketFile = $argv[1];
list($host, $port) = explode(':', $argv[2], 2);
if (empty($port)) $port = 6667;

function connectToIrcServer() {
    global $ircSocket, $host, $port;
    log::info('Connecting to IRC server ' . $host . ':' . $port);
    $ircSocket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    socket_connect($ircSocket, $host, $port);
    return $ircSocket;
}

function cleanup() {
    global $ircSocket, $proxy;
    
    // Shut down.
    log::info("Proxy shut down.");
    $proxy->disconnect();

    if (!empty($ircSocket)) {
        log::info("Closing IRC connection...");
        socket_shutdown($ircSocket, 2);
        socket_close($ircSocket);
        $ircSocket = null;
        log::info("Closed.");
    }

    if (file_exists($primarySocketFile)) unlink($primarySocketFile);
}

log::info("Creating proxy...");
umask(0);
$proxy = new spSocketProxy($primarySocketFile);
$proxy->setProxySocketFunc(create_function('', 'return connectToIrcServer();'));
log::info("Done.");

// Poll loop.
while ($proxy->poll() !== false) {
    // Fake sleep to release cycles to OS.
    usleep(0);
}

cleanup();
exit;
?>
