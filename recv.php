<?
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

$timeout = $ircConfig['recv_timeout'];

set_time_limit($timeout/1000 + 5);

session_start();
$session = new spIrcSessionDAL_SQLite($sessionDbFilename, $_GET['id']);
$state = $session->load();
log::info(print_r($state, true));

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

if ($state !== null && !$state->deleted) {
    $socketFile = $state->primarySocketFilename;

    if (file_exists($socketFile)) {
        $ircbot = new spIrcClient($socketFile);

        if ($ircbot->isConnected()) {
            $data = array();
            $messageCount = 0;
            
            // Read all messages waiting in queue.
            do {
                //log::info("checkIncomingMsg()...");
                $line = $ircbot->checkIncomingMsg($timeout);

                if ($line !== null && $line !== false) {
                    // Got a message.
                    $msg = $ircbot->parseMsg($line);
                    
                    if ($msg !== false) {
                        if ($msg['type'] == spIrcClient::CLMSG_TYPE_RECV) {
                            // If message type is RECV, it can be sent to the client.
                            $data[] = $msg;
                        }
                        
                        // Do default processing on the message.
                        $ircbot->processMsg($msg);
                    }
                }
                
                $timeout = 0;   // Only block socket_select for the first iteration.
                $messageCount++;
                usleep(0);
            } while (
                $line !== null && $line !== false &&    // Break if error returned.
                $messageCount < 200 &&                  // Break if too many messages.  Endless loop?
                $ircbot->isConnected());                // Break if disconnected.

            $ircbot->disconnect();
        }
        else {
            // Unable to connect to socket.
            $data = array(
                array(
                    'type' => spIrcClient::CLMSG_TYPE_SERVER,
                    'message' => 'Connection not open.  Unable to connect to socket.',
                    'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
                )
            );
        }
    }
    else {
        // Socket no longer available.
        $session->delete();
        $data = array(
            array(
                'type' => spIrcClient::CLMSG_TYPE_SERVER,
                'message' => 'Connection not open.  Socket no longer available.',
                'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
            )
        );
    }
}
else {
    // No session.
    $data = array(
        array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Connection not open.  No session.',
            'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
        )
    );
}
//log::info("Returned message(s): " . var_export($data, true));

// Send received messages data as JSON.
@ob_end_clean();
echo json_encode($data);

exit;
?>
