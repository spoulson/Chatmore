<?
// TODO: set_error_handler/set_exception_handler implementations.

//ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
include_once 'class.spSocketProxy.php';

set_time_limit(0);
ignore_user_abort(true);

// Parse command line.
$socketFile = $argv[1];
list($host, $port) = explode(':', $argv[2], 2);
if (empty($port)) $port = 6667;

header('Content-type: text/plain');
@ob_end_flush();

function connectToIrcServer() {
    global $ircSocket, $host, $port;
    $ircSocket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    socket_connect($ircSocket, $host, $port);
    return $ircSocket;
}

echo "Creating proxy...\r\n";
umask(0);
$proxy = new spSocketProxy($socketFile, 1);
$proxy->setProxySocketFunc(create_function('', 'return connectToIrcServer();'));
$proxy->idleTimeout = 300;
echo "Done.\r\n";

// Poll loop.
while ($proxy->poll() !== false) {
    // Fake sleep to release cycles to OS.
    usleep(0);
}

// Shut down.
echo "Proxy shut down.\r\n";

if (!empty($ircSocket)) {
    echo "Closing IRC connection...\r\n";
    socket_shutdown($ircSocket, 2);
    socket_close($ircSocket);
    echo "Closed.\r\n";
}

unlink($socketFile);
?>
