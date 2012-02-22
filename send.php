<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.spIrcClient.php';

$viewKey = $_POST['viewKey'];

session_start();

$session = new spIrcSessionDAL_SQLite($sessionDbFilename, $viewKey);
$state = $session->load();

log::info('Got state: ' . var_export($state, true));

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

$data = array();

if ($state !== null) {
    $socketFile = $state->secondarySocketFilename;
    
    if (file_exists($socketFile)) {
        $ircbot = new spIrcClient($socketFile);
        
        if ($ircbot->isConnected()) {
            $raw = $_POST['msg'];
            if (!empty($raw)) {
                log::info("Sending message: '$raw'");
                $ircbot->sendRawMsg("$raw\r\n");
                $ircbot->flushSendBuffer();
                $ircbot->disconnect();
            }
            else {
                // Empty message.
                $data[] = array(
                    'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    'message' => 'Nothing to send, \'msg\' parameter is empty.',
                    'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
                );
            }        
        }
        else {
            // Unable to connect to socket.
            $data[] = array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Connection not open.  Unable to connect to socket.',
                'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
            );
        }
    }
    else {
        // Socket no longer available.
        $session->delete();
        $data[] = array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Connection not open.  Socket no longer available.',
            'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
        );
    }
}
else {
    // No session.
    $data[] = array(
        'type' => spIrcClient::CLMSG_TYPE_SERVER,
        'message' => 'Connection not open.  No session.',
        'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
    );
}

//log::info("Returned message(s): " . var_export($data, true));

@ob_end_clean();
echo json_encode($data);
exit;
?>
