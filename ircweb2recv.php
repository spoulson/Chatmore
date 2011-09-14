<?
ini_set('error_log', '/home/ip90904j/tmp/php_errors.log');
require_once 'config.php';
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
        do {
            $line = $ircbot->checkIncomingMsg();

            if ($line !== null && $line !== false) {
                // Got a message.
                $msg = $ircbot->parseMsg($line);
                error_log('msg = ' . var_export($msg, true));
                
                if ($msg !== false) {
                    $prevState = clone $state;
                    
                    $msg['type'] = spIrcClient::CLMSG_TYPE_RECV;
                    $data['msgs'][] = $msg;
                    
                    // Response to message.
                    switch ($msg['command']) {
                    // case self::RPL_WELCOME:
                        // // Wait for welcome message to join channel.
                        // // echo "Joining channel..\r\n";
                        // $ircbot->joinChannel('#sp');
                        // break;

                    // case 'PRIVMSG':
                        // process_bot_commands($msg);
                        // break;
                    }

                    // Do default processing on the message.
                    $ircbot->processMsg($msg);
                    
                    // // Check for nick change.
                    // if ($prevState->nick != $state->nick) {
                    
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
                    
            sleep(0);
            
        } while ($line !== null && $line !== false);

        $ircbot->disconnect();
    }
}

// Send received messages data as JSON.
@ob_clean();
echo json_encode($data);
exit;


function process_bot_commands($msg) {
    global $ircbot, $state;
    $matches = array();
    
    if (preg_match("/^!(\w+)( (.+))?/", $msg['info']['text'], $matches)) {
        $botCommand = $matches[1];
        $botParams = isset($matches[3]) ? $matches[3] : null;
        $target = $ircbot->isChannel($msg['info']['target']) ? $msg['info']['target'] : $msg['prefixNick'];
        //$ircbot->debug_write('msg = ' . print_r($msg , true));
        //$ircbot->debug_write("botCommand = '" . $botCommand . "', botParams = '" . $botParams . "'");

        // Commands that can be in channel or /msg'd.
        switch ($botCommand) {
        case 'trivia':
            $ircbot->msg($target, 'User error: ID10T.');
            break;
            
        case 'yomama':
            $text = get_momma_joke();
            if (!empty($botParams)) {
                if ($msg['info']['target'] == $state->nick) {
                    // /msg bot with parameters, address to nick/channel.
                    $p = explode(' ', trim($botParams), 2);
                    $target = $p[0];
                    if (count($p) == 2) {
                        // Write in channel, directed to a nick.
                        $target = $p[0];
                        $text = $p[1] . ': ' . $text;
                    }
                }
                else {
                    $p = explode(' ', trim($botParams), 2);
                    if (count($p) > 0) {
                        $text = $p[0] . ': ' . $text;
                    }
                }
            }

            $ircbot->msg($target, $text);
            break;
            
        case 'insult':
            $text = get_insult();
            if ($msg['info']['target'] == $state->nick) {
                if (!empty($botParams)) {
                    // /msg bot with parameters, address to nick/channel.
                    $p = explode(' ', trim($botParams), 2);
                    $target = $p[0];
                    if (count($p) == 2) {
                        // Write in channel, directed to a nick.
                        $target = $p[0];
                        $text = $p[1] . ': ' . $text;
                    }
                }
            }
            else if (!empty($botParams)) {
                $p = explode(' ', trim($botParams));
                if (count($p) > 0) {
                    $text = $p[0] . ': ' . $text;
                }
            }
            
            $ircbot->msg($target, $text);
            break;

        case 'showstate':
            $ircbot->debug_write('state = ' . print_r($state, true));
            break;
            
        }
        
        // Commands that can only be /msg'd by me.
        if ($msg['info']['target'] == $state->nick && $msg['prefixNick'] == 'spoulson') {
            switch ($botCommand) {
            case 'quit':
                $quitFlag = true;
                break;

            case 'join':
                $ircbot->joinChannel($botParams);
                break;
            
            case 'leave':
                $ircbot->leaveChannel($botParams);
                break;
            
            case 'say':
                $p = explode(' ', $botParams, 2);
                $ircbot->debug_write("say '" . $p[1] . "' to '" . $p[0] . "'");
                $ircbot->msg($p[0], $p[1]);
                break;
            
            case 'nick':
                $ircbot->setNick($botParams);
                break;
                
            case 'raw':
                $ircbot->sendRawMsg($botParams);
                break;
            }
        }
    }
}
?>
