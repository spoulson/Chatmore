<?
set_include_path(get_include_path() . PATH_SEPARATOR . 'lib');
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');

$ircConfig = array(
    'socketFile' => 'sock',
    'socketFilePath' => '/home/ip90904j/tmp',
    'nick' => 'spbot2',
    'ident' => 'spbot2',
    'realname' => 'esspee',
    'php_opts' => '-d memory_limit=1M',
    'debug' => array(
        'recv_send_raw' => true
    )
);

?>
