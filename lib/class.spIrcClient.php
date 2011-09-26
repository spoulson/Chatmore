<?
// http://tools.ietf.org/html/rfc2812

require_once 'class.log.php';
require_once 'class.spIrcClientState.php';

class spIrcClient
{
    // Message types returned from AJAX calls.
    const CLMSG_TYPE_SERVER = 'servermsg';   // PHP server message
    const CLMSG_TYPE_STATE = 'state';        // IRC client state
    const CLMSG_TYPE_RECV = 'recv';          // Received IRC message

    // Message codes associated with CLMSG_TYPE_SERVER messages.
    const CLMSG_CONNECTION_READY = 200;
    const CLMSG_CONNECTION_NOT_OPEN = 400;
    const CLMSG_TIMEOUT_ON_OPEN = 500;

    // IRC server message codes.
    const RPL_WELCOME = 001;
    const RPL_ENDOFWHO = 315;
    const RPL_WHOREPLY = 352;
    const RPL_NAMREPLY = 353;
    const RPL_ENDOFNAMES = 366;
    const RPL_NOTOPIC = 331;
    const RPL_TOPIC = 332;
    const RPL_TIME = 391;

    const ERR_NOSUCHCHANNEL = 403;
    const ERR_NICKNAMEINUSE = 433;
    const ERR_NOTREGISTERED = 451;
    
    private $isConnected = false;

    // IRC socket.
	private $socket;
    
    // spIrcClientState object.
    private $state;

    private $socketReadBuffer = null;
    private $socketSendBuffer = null;
    
    public $socketReadBufferSize = 1024;
    public $socketSendTimeout = 2000;   // in milliseconds
    
    // Constructor.
	public function spIrcClient($socketFile, &$state) {
        $this->state =& $state;
        $this->state->isModified = false;
		$this->socket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        if (socket_connect($this->socket, $socketFile)) {
            $this->isConnected = true;
        }
	}
    
    // Disconnect from IRC proxy domain socket.
    public function disconnect() {
        if (!empty($this->socket)) {
            //log::info("Disconnecting from IRC socket.");
            socket_shutdown($this->socket, 2);
            socket_close($this->socket);
            $this->socket = null;
        }
        // else {
            // log::info("Already disconnected from IRC socket.");
        // }
    }

    // Check if incoming message is found, returns:
    // raw message string.
    // null if no message waiting.
    // false if connection is closed.
    public function checkIncomingMsg($timeout) {
        $line = $this->socketReadLine($timeout);
        if ($line === false) return false;
        if ($line === null) return null;
        return $line;
    }
    
    private function socketReadLine($timeout = 0) {
        //log::info("socketReadBuffer size(" . strlen($this->socketReadBuffer) . ")");
        $line = null;
        
        while (true) {
            // check for line ending in read buffer.
            $m = null;
            //if (strlen($this->socketReadBuffer)) log::info('socketReadBuffer: ' . $this->socketReadBuffer);
            if (preg_match("/^.*?\r\n/", $this->socketReadBuffer, $m)) {
                // Found a line in the buffer.
                $line = $m[0];
                $this->socketReadBuffer = substr($this->socketReadBuffer, strlen($line));
                //log::info("Read line: $line");
                break;
            }
            
            // Check for data available for read.
            $c = socket_select($r = array($this->socket), $w = null, $e = null, 0, $timeout * 1000);
            if ($c === false) {
                $errno = socket_last_error($this->socket);
                if ($errno != 0 && $errno != 11) {
                    log::error("socketReadLine error during socket_select: $errno/" . socket_strerror($errno));
                    return false;
                }
            }
            else if ($c === 0) {
                // No more data.
                //log::info("socketReadLine: no data");
                break;
            }

            // Read more data
            $buf = null;
            $size = socket_recv($this->socket, $buf, $this->socketReadBufferSize, 0);
            if ($size == false) {
                // Read error.
                $errno = socket_last_error($this->socket);
                log::error("socketReadLine error: $errno/" . socket_strerror($errno));
                if ($errno == 0 || $errno == 11) return null;
                return false;
            }

            //log::info("socketReadBuffer appended: $buf");
            $this->socketReadBuffer .= $buf;
            
            // Loop and attempt to read a line again.
        }
        
        //if (strlen($line)) log::info("socketReadLine: $line");
        return $line;
    }

    // Parse raw message to message array.
    // array(
    //    prefix => $,
    //    command => $,
    //    params => $,
    //    info => array( ... )
    // )
    // returns false if parse failed.
    public function parseMsg($line) {
        global $ircConfig;
        $m = array();
        $msg = null;
        
        // Parse raw message for prefix, command, and params.
        if (!preg_match("/^(:(\S+) )?(\w+)( (.+?))?\r\n$/", $line, $m)) return false;
        $params = $m[5];
        $msg = array(
            'prefix' => isset($m[2]) ? $m[2] : null,
            'command' => $m[3]
        );
        
        if ($ircConfig['debug']['recv_send_raw']) {
            $msg['raw'] = $line;
            $msg['params'] = $params;
        }
        
        // Parse prefix.
        $m = array();
        if (preg_match("/^(.+?)((!([\w-\.]+))?@([\w-\.]+))?$/", $msg['prefix'], $m)) {
            $msg['prefixNick'] = $m[1];
            if (isset($m[4])) $msg['prefixUser'] = $m[4];
            if (isset($m[5])) $msg['prefixHost'] = $m[5];
        }
        
        // Parse params depending on command.
        $msgParams = array();
        switch ($msg['command']) {
        case 'PRIVMSG':
            if (!preg_match("/^(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            if (preg_match("/^\x{01}ACTION\s+([^\x{01}]+)\x{01}$/", $msgParams[2], $msgParams['action'])) {
                $msg['info'] = array(
                    'target' => $msgParams[1],
                    'text' => $msgParams['action'][1],
                    'isAction' => true
                );
            }
            else {
                $msg['info'] = array(
                    'target' => $msgParams[1],
                    'text' => $msgParams[2]
                );
            }
            break;
            
        case 'NOTICE':
            if (!preg_match("/^(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'text' => $msgParams[2]
            );
            break;
        
        case 'MODE':
            if (!preg_match("/(\S+) :(([+-][iwoOr]+)+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'mode' => $msgParams[2]
            );
            if (isset($msgParams[4])) $msg['info']['recipient'] = $msgParams[4];
            break;
            
        case 'NICK':
            if (!preg_match("/:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'oldNick' => $msg['prefixNick']
            );
            break;
        
        case 'JOIN':
            if (!preg_match("/:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1]
            );
            break;
            
        case 'PART':
            $msg['info'] = array(
                'channel' => $params
            );
            break;
            
        case 'TOPIC':
            if (!preg_match("/^(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => $msgParams[2]
            );
            break;
            
        case 'PING':
            preg_match("/^:(.+)/", $params, $msgParams);
            $msg['info'] = array(
                'ping' => isset($msgParams[1]) ? $msgParams[1] : $this->state->host
            );
            break;
            
        case 'QUIT':
            preg_match("/^:?(.+)/", $params, $msgParams);
            $msg['info'] = array(
                'message' => $msgParams[1]
            );
            break;
            
        case 'ERROR':
            if (!preg_match("/^:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'message' => $msgParams[1]
            );
            break;
            
        case self::RPL_ENDOFWHO: // End of WHO list.
            if (!preg_match("/^(\S+) +\S+ +:.+/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1]
            );
            break;

        case self::RPL_WHOREPLY:
            if (!preg_match("/^(\S+) +(\S+) +(\S+) +(\S+) +(\S+) +(\S+) +(\S+) +:(\d+) +(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[2],
                'user' => $msgParams[3],
                'host' => $msgParams[4],
                'server' => $msgParams[5],
                'nick' => $msgParams[6],
                'mode' => $msgParams[7],
                'hopcount' => $msgParams[8],
                'realname' => $msgParams[9]
            );
            break;
            
        case self::RPL_NAMREPLY: // NAMES list.
            if (!preg_match("/\S+\s+\S\s+(#\w+)\s+:(.+)$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'names' => explode(' ', rtrim($msgParams[2]))
            );
            break;
            
        case self::RPL_NOTOPIC:
            if (!preg_match("/^\S+\s+(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => null
            );
            break;
            
        case self::RPL_TOPIC:
            if (!preg_match("/^\S+\s+(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => $msgParams[2]
            );
            break;
            
        case 333: // Topic set by
            if (!preg_match("/^\S+\s+(\S+)\s+(\S+)\s+(\d+)$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'nick' => $msgParams[2],
                'time' => $msgParams[3]
            );
            break;

        case self::RPL_TIME:
            if (!preg_match("/^\S+\s+(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'server' => $msgParams[1],
                'timeString' => $msgParams[2]
            );
            break;
            
        case self::ERR_NOSUCHCHANNEL:
            if (!preg_match("/(\S+) :(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;
            
        case self::ERR_NICKNAMEINUSE:
            if (!preg_match("/(\S+) :(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;

        case self::ERR_NOTREGISTERED:
            if (!preg_match("/(\S+) +:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'command' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;
        }

        //log::info('Parsed message: ' . var_export($msg, true));
        return $msg;
    }
    
    // Process an incoming message with default logic.
    public function processMsg($msg) {
        log::info('Processing message: ' . $msg['raw']);

        switch ($msg['command']) {
        case 'PING':
            $this->pong($msg);
            break;
            
        case 'MODE':
            // Store user or channel mode string.
            $target = $msg['info']['target'];
            if (preg_match('/^#/', $target)) {
                // Channel mode.
                if (!isset($this->state->channels[$target])) {
                    $this->state->channels[$target] = new spIrcChannelDesc();
                }
                $this->state->channels[$target]->mode = $msg['info']['mode'];
            }
            else {
                // User mode.
                if (!isset($this->state->users[$target])) {
                    $this->state->users[$target] = new spIrcUserDesc();
                }
                $this->state->users[$target]->mode = $msg['info']['mode'];
            }
            $this->state->isModified = true;
            break;
            
        case 'NICK':
            if ($msg['prefixNick'] == $this->state->nick) {
                // Client user changed nick.
                $this->state->nick = $msg['info']['nick'];
                $this->state->isNickValid = true;
            }
            
            // Adjust user list.
            $nick = $msg['info']['nick'];
            $oldNick = $msg['info']['oldNick'];
            $this->state->users[$nick] = $this->state->users[$oldNick];
            unset($this->state->users[$oldNick]);
            
            // Adjust channel members.
            foreach ($this->state->channels as $channel) {
                if (isset($channel->members[$oldNick])) {
                    $channel->members[$nick] = $channel->members[$oldNick];
                    unset($channel->members[$oldNick]);
                }
            }
            
            $this->state->isModified = true;
            break;

        case 'PART':
            // Clean up state when leaving a channel.
            $channel = $msg['info']['channel'];
            unset($this->state->channels[$channel]);
            $this->state->isModified = true;
            break;
            
        // case self::RPL_WHOREPLY:
            // break;
            
        case self::RPL_TOPIC:
            $this->state->channels[$msg['info']['channel']]->topic = $msg['info']['topic'];
            $this->state->isModified = true;
            break;
            
        case self::RPL_NOTOPIC:
            $this->state->channels[$msg['info']['channel']]->topic = null;
            $this->state->isModified = true;
            break;
            
        case 333: // topic reply set by/timestamp.
            $channel = $msg['info']['channel'];
            $this->state->channels[$channel]->topicSetByNick = $msg['info']['setByNick'];
            $this->state->channels[$channel]->topicSetTime = $msg['info']['setTime'];
            $this->state->isModified = true;
            break;
            
        case self::RPL_NAMREPLY: // NAMES list.
            $channel = $msg['info']['target'];
            if (!isset($this->state->channels[$channel])) {
                $this->state->channels[$channel] = new spIrcChannelDesc();
            }
            
            foreach ($msg['info']['names'] as $name) {
                $m = array();
                if (preg_match("/^(\W?)(.+)/", $name, $m)) {
                    $prefix = $m[1];
                    $nick = $m[2];
                    
                    if (!isset($this->state->channels[$channel]->members[$nick])) {
                        $memberDesc = new spIrcChannelMemberDesc();
                        $memberDesc->mode = $prefix;
                        $this->state->channels[$channel]->members[$nick] = $memberDesc;
                    }
                
                    if (!isset($this->state->users[$nick])) {
                        $this->state->users[$nick] = new spIrcUserDesc();
                    }
                }
            }
            
            $this->state->isModified = true;
            break;

        case self::ERR_NOTREGISTERED: // ERR_NOTREGISTERED.
            break;
        }
        
        $this->flushSendBuffer();
    }
    
    public function flushSendBuffer() {
        // Send buffer until empty, with up to 5 error retries.  Give up after 50 send attempts.
        $size = null;
        $errorCount = 0;
        $sendCount = 0;
        
        do {
            $size = $this->socketSendBuffer();
            if ($size === false) $errorCount++;
            $sendCount++;
        } while ($sendCount < 50 && $errorCount < 5 && ($size === false || $size > 0));
        
        if ($size === false) {
            log::error("Error while flushing send buffer.  Cannot send.");
        }
        else if ($size > 0) {
            log::error("Error while flushing send buffer.  Some data may have been dropped.");
        }
    }
        
    // Send buffered data to socket.
    // Returns buffer bytes remaining after send attempt.
    public function socketSendBuffer() {
        $c = socket_select($r = null, $w = array($this->socket), $e = null, 0, $this->socketSendTimeout);
        if ($c === false) {
            $errno = socket_last_error($this->socket);
            log::error("Error during socket_select: $errno/" . socket_strerror($errno));
            return false;
        }
        else if ($c == 0) {
            // Timeout waiting for socket to be writable.
            log::error("Error: timeout on socket_select trying to send buffer.");
            return false;
        }
        
        $size = socket_write($this->socket, $this->socketSendBuffer);
        if ($size === false) {
            $errno = socket_last_error($this->socket);
            log::error("Error during socket_write: $errno/" . socket_strerror($errno) . " trying to send message: $line");
            return false;
        }
        else if ($size != strlen($this->socketSendBuffer)) {
            // Not all bytes were sent.
            log::info("sent($size) buffered(" . (strlen($this->socketSendBuffer) - $size) . ") ");
            $this->socketSendBuffer = substr($this->socketSendBuffer, $size);
        }
        else {
            log::info("sent($size)");
            $this->socketSendBuffer = null;
        }
        
        log::info("done");
        @flush();
        
        return strlen($this->socketSendBuffer);
    }

	// Send raw message.
    // Message line must end with \r\n.
	public function sendRawMsg($line)
	{
        $this->socketSendBuffer .= $line;
        
        //log::info("sent: " . $line);
	}
    
    public function isChannel($target) {
        return preg_match("/^[^#]/", $target);
    }
	
    //
    // Client commands
    //
    public function register($nick, $ident, $realname) {
        $this->state->nick = $nick;
        $this->state->isNickValid = false;
        $this->state->ident = $ident;
        $this->state->host = null;
        $this->state->realname = $realname;
        
        $this->sendRawMsg("USER " . $this->state->ident . " 0 * :" . $this->state->realname . "\r\n");
        $this->setNick($this->state->nick);
        $this->flushSendBuffer();
    }

	public function setNick($nick) {
        $this->state->nick = $nick;
        $this->sendRawMsg("NICK $nick\r\n");
    }
    
    public function who($mask = null) {
        $this->state->whoReply = array(
            //'modes' => array(),
            'names' => array()
        );

        if (empty($mask))
            $this->sendRawMsg("WHO\r\n");
        else
            $this->sendRawMsg("WHO $mask\r\n");
    }
    
	public function joinChannel($channel) {
        $this->sendRawMsg("JOIN :$channel\r\n");
    }
    
	public function leaveChannel($channel) {
        $this->sendRawMsg("PART :$channel\r\n");
    }

	public function listChannels() {
        $this->sendRawMsg("LIST\r\n");
    }
    
	public function getTopic($channel) {
        $this->sendRawMsg("TOPIC $channel\r\n");
    }

    // Send message text to a user or channel.
	public function msg($target, $text) {
        $this->sendRawMsg("PRIVMSG $target :$text\r\n");
    }

    // Response to a PING message.
    // Expects $msg['info']['ping'] to contain ping parameter.
	public function pong($msg) {
        $param = $msg['info']['ping'];
        $this->sendRawMsg("PONG :$param\r\n");
    }
    
	public function quit($quitMsg = "") {
        $this->sendRawMsg("QUIT :$quitMsg\r\n");
    }
}

?>