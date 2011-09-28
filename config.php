<?
set_include_path(get_include_path() . PATH_SEPARATOR . 'lib');
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
ini_set('error_reporting', E_ALL);
ini_set('log_errors', true);

// Cannot use the 'files' session save handler.
// It cannot handle concurrent PHP session execution, which causes problems with sending while waiting for received data.
ini_set('session.save_handler', 'sqlite');
ini_set('session.save_path', '/home/ip90904j/tmp/php.sess.db');

$ircConfig = array(
    // Path to create domain sockets.
    'socketFilePath' => '/home/ip90904j/tmp',
    
    // PHP command line options for launching the background process.
    'php_opts' => '-d memory_limit=1M',

    // Timeout waiting for data to read in ms.
    // - Higher timeout means less frequent client reconnections.
    // - If the background process dies while this thread was running,
    //   it will take the remainder of the timeout before an error will be caught.
    'recv_timeout' => 5 * 1000,

    'debug' => array(
        // Include received raw IRC messages in AJAX responses from ircweb2recv.php.
        'recv_send_raw' => true
    )
);

?>
