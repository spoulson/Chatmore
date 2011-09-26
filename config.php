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
    'socketFilePath' => '/home/ip90904j/tmp',
    'php_opts' => '-d memory_limit=1M',
    'debug' => array(
        'recv_send_raw' => true
    )
);

?>
