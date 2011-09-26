<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.spIrcClient.php';

session_start();

header('Content-type: text/plain');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

if (isset($_SESSION['irc'])) {
    $state =& $_SESSION['irc'];
    $socketFile = $state->getSecondarySocketFilename();
    if (file_exists($socketFile)) {
        $ircbot = new spIrcClient($socketFile, $state);
        
        $raw = $_POST['msg'];
        if (!empty($raw)) {
            $ircbot->sendRawMsg("$raw\r\n");
            $ircbot->flushSendBuffer();
        }
        
        $ircbot->disconnect();
    }
}

?>
