<?
// scriptPath is URI to script directory.
$scriptName = $_SERVER['SCRIPT_NAME'];
if ($scriptName == '/') {
    $scriptPath = '/';
}
else if (substr($scriptName, -1) == '/') {
    $scriptPath = substr($scriptName, 0, strlen($scriptName) - 1);
}
else {
    $scriptPath = dirname($scriptName);
}

$tmpDir = dirname($_SERVER['SCRIPT_FILENAME']) . '/tmp';
$sessionDbFilename = $tmpDir . '/session.db';

set_include_path(get_include_path() . PATH_SEPARATOR . 'lib');
ini_set('error_log', "$tmpDir/php_errors.log");
ini_set('error_reporting', E_ALL);
ini_set('log_errors', true);

// Use SQLite session save handler.
// Cannot use the 'files' session save handler.
// files is unable to handle concurrent PHP session execution, which
// causes blocking issues when sending while waiting for received messages
// in a separate request.
ini_set('session.save_handler', 'sqlite');
ini_set('session.save_path', "$tmpDir/php.sess.db");

require_once('class.spIrcSessionDAL_SQLite.php');

// IRC client's server-side configuration.
$ircConfig = array(
    // IRC server/port policy, or null to allow user-specified server/port.
    'server' => null,
    'port' => null,
    
    // Path to create domain sockets.
    'socketFilePath' => $tmpDir,
    
    // PHP command line options for launching the background process.
    'php_opts' => '-d memory_limit=4M',

    // Client side timeout in ms waiting for recv.php to return data.
    // - Higher timeout means less frequent client reconnections.
    // - If the background process dies while the recv thread was running,
    //   the error will not be caught until timeout.
    'recv_timeout' => 30 * 1000,

    'debug' => array(
        // Include received raw IRC messages in AJAX responses from recv.php.
        'recv_send_raw' => true
    )
);

?>
