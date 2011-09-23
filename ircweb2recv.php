<?
// TODO: Handle when domain socket doesn't connect.

ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

// Timeout waiting for data to read.
$timeout = 120 * 1000;

set_time_limit($timeout/1000 + 5);
session_start();

header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');

if (isset($_SESSION['irc'])) {
    // Resuming a session.
    $state =& $_SESSION['irc'];
    $socketFile = $state->getSocketFilename();
    if (file_exists($socketFile)) {
        $ircbot = new spIrcClient($socketFile, $state);
        
        $data = array();
        
        // Read all messages waiting in queue.
        $messageCount = 0;
        do {
            // TODO: Separate socket reads from buffer reads.(?)
            $line = $ircbot->checkIncomingMsg($timeout);

            if ($line !== null && $line !== false) {
                // Got a message.
                $msg = $ircbot->parseMsg($line);
                //log::info('msg = ' . var_export($msg, true));
                
                if ($msg !== false) {
                    $prevState = clone $state;
                    
                    $msg['type'] = spIrcClient::CLMSG_TYPE_RECV;
                    $data[] = $msg;
                    
                    // Do default processing on the message.
                    $ircbot->processMsg($msg);
                    
                    // Check for change in state.
                    if ($state->isModified) {
                        // Send client state.
                        $data[] = array(
                            'type' => spIrcClient::CLMSG_TYPE_STATE,
                            'state' => $state
                        );
                    }
                }
            }
            
            $timeout = 0;   // Only block socket_select for the first iteration.
            $messageCount++;
            usleep(0);
        } while ($line !== null && $line !== false && $messageCount < 200);

        $ircbot->disconnect();
    }
}
else {
    // No session.
    $data = array(
        array(
            'type' => spIrcClient::CLMSG_TYPE_SERVER,
            'message' => 'Connection not open.',
            'code' => spIrcClient::CLMSG_CONNECTION_NOT_OPEN
        )
    );
}

// Send received messages data as JSON.
@ob_clean();
echo json_encode($data);
exit;

?>
