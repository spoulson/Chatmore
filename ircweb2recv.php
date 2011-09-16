<?
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
ini_set('display_errors', false);

require_once 'config.php';
require_once 'class.log.php';
require_once 'class.spIrcClient.php';

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
        
        $data = array(
            'msgs' => array()
        );
        
        // Read all messages waiting in queue.
        $messageCount = 0;
        do {
            // TODO: Separate socket reads from buffer reads.
            $line = $ircbot->checkIncomingMsg();

            if ($line !== null && $line !== false) {
                // Got a message.
                $msg = $ircbot->parseMsg($line);
                //log::info('msg = ' . var_export($msg, true));
                
                if ($msg !== false) {
                    $prevState = clone $state;
                    
                    $msg['type'] = spIrcClient::CLMSG_TYPE_RECV;
                    $data['msgs'][] = $msg;
                    
                    // Do default processing on the message.
                    $ircbot->processMsg($msg);
                    
                    // Check for change in state.
                    if ($state->isModified) {
                        // Send client state.
                        $data['msgs'][] = array(
                            'type' => spIrcClient::CLMSG_TYPE_STATE,
                            'state' => $state
                        );
                    }
                }
            }
            
            $messageCount++;
            usleep(0);
        } while ($line !== null && $line !== false && $messageCount < 50);

        $ircbot->disconnect();
    }
}

// Send received messages data as JSON.
@ob_clean();
echo json_encode($data);
exit;

?>
