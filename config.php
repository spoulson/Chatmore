<?
$tmpdir = './tmp';

set_include_path(get_include_path() . PATH_SEPARATOR . 'lib');
ini_set('error_log', "$tmpdir/php_errors.log");
ini_set('error_reporting', E_ALL);
ini_set('log_errors', true);

// Limit session cookie to only this virtual directory.
$script_url = $_SERVER['SCRIPT_URL'];
if ($script_url == '/') {
    $script_path = '/';
}
else if (substr($script_url, -1) == '/') {
    $script_path = substr($script_url, 0, strlen($script_url) - 1);
}
else {
    $script_path = dirname($script_url);
}

ini_set('session.cookie_path', $script_path);

// Use SQLite session save handler.
// Cannot use the 'files' session save handler.
// files is unable to handle concurrent PHP session execution, which
// causes blocking issues when sending while waiting for received messages
// in a separate request.
ini_set('session.save_handler', 'sqlite');
ini_set('session.save_path', "$tmpdir/php.sess.db");

$ircConfig = array(
    // Path to create domain sockets.
    'socketFilePath' => $tmpdir,
    
    // PHP command line options for launching the background process.
    'php_opts' => '-d memory_limit=1M',

    // Client side timeout in ms waiting for ircweb2recv.php to return data.
    // - Higher timeout means less frequent client reconnections.
    // - If the background process dies while the recv thread was running,
    //   the error will not be caught until timeout.
    'recv_timeout' => 30 * 1000,

    'debug' => array(
        // Include received raw IRC messages in AJAX responses from ircweb2recv.php.
        'recv_send_raw' => true
    )
);

?>
