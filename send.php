<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.spIrcClient.php';

session_start();

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

$data = array(
    'success' => false,
    'message' => null
);

if (isset($_SESSION['irc'])) {
    $state =& $_SESSION['irc'];
    $socketFile = $state->getSecondarySocketFilename();
    
    if (file_exists($socketFile)) {
        $ircbot = new spIrcClient($socketFile, $state);
        
        if ($ircbot->isConnected()) {
            $raw = $_POST['msg'];
            if (!empty($raw)) {
                log::info("Sending message: '$raw'");
                $ircbot->sendRawMsg("$raw\r\n");
                $ircbot->flushSendBuffer();
                $ircbot->disconnect();
                $data['success'] = true;
                $data['message'] = "OK";
            }
            else {
                $data['message'] = "Error: Nothing to send, 'msg' parameter is empty.";
            }        
        }
        else {
            $data['message'] = "Error: Connection not open, unable to connect to socket.";
        }
    }
    else {
        $data['message'] = "Error: Connection not open, socket no longer available.";
    }
}
else {
    $data['message'] = "Error: Connection not open, no session.";
}

@ob_end_clean();
echo json_encode($data);
?>
