<?
// http://tools.ietf.org/html/rfc2812

require_once 'class.spIrcClientState.php';

class spIrcClient
{
    // Message types returned from AJAX calls.
    const CLMSG_TYPE_SERVER = 'servermsg';   // PHP server message
    const CLMSG_TYPE_STATE = 'state';        // IRC client state
    const CLMSG_TYPE_RECV = 'recv';          // Received IRC message

    // Message codes associated with CLMSG_TYPE_SERVER messages.
    const CLMSG_CONNECTION_READY = 200;
    const CLMSG_NOT_OPEN = 400;
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
    const ERR_NOTREGISTERED = 451;
    
    const WHOMODE_DISCOVERY = 1;
    const WHOMODE_SAVENAMES = 2;

    // IRC socket.
	private $socket;
    
    // spIrcClientState object.
    private $state;

    private $socketReadBuf = null;
    
    // Constructor.
	public function spIrcClient($socketFile, &$state) {
        $this->state =& $state;
        $this->state->isModified = false;
		$this->socket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        socket_connect($this->socket, $socketFile) || die("Could not connect to socket file!\n");
		
        // Query for current state.
        // If resuming an active connection, will discover current nick and joined channels.
        // If this is really a new connection, the response will trigger a registration.
        //$this->who(null, WHOMODE_DISCOVERY);
	}
    
    // Disconnect from IRC proxy domain socket.
    public function disconnect() {
        if (!empty($this->socket)) {
            echo "Disconnecting from IRC socket...\n";
            socket_shutdown($this->socket, 2);
            socket_close($this->socket);
        }
        else {
            echo "Already disconnected from IRC socket...\n";
        }
    }

    // Check if incoming message is found, returns:
    // raw message string.
    // null if no message waiting.
    // false if connection is closed.
    public function checkIncomingMsg() {
        $line = $this->socketReadLine();
        if ($line === false) return false;
        if ($line === null) return null;
        $this->parseMsg($line);
        
        return $line;
    }
    
    private function socketReadLine() {
        //echo "socketReadBuf size(" . strlen($this->socketReadBuf) . ")\n";
        $line = null;
        
        while (true) {
            // check for line ending in read buffer.
            $m = null;
            //echo 'socketReadBuf: ' . $this->socketReadBuf . "\n";
            if (preg_match("/^[^\\n|\\r]*\\r\\n/", $this->socketReadBuf, $m)) {
                // Found a line.
                $line = $m[0];
                $this->socketReadBuf = substr($this->socketReadBuf, strlen($line));
                //echo "socket, size(" . strlen($line) . "): $line\n";
                break;
            }
            
            // Check for data available for read.
            $c = socket_select($r = array($this->socket), $w = null, $e = null, 0, 250 * 1000);
            if ($c === false) {
                $errno = socket_last_error($this->socket);
                if ($errno != 0 && $errno != 11) {
                    echo "socketReadLine error during socket_select: $errno/" . socket_strerror($errno) . "\n";
                    return false;
                }
            }
            else if ($c === 0) {
                // No more data.
                //echo "socketReadLine: no data\n";
                break;
            }

            // Read more data
            $buf = null;
            $size = socket_recv($this->socket, $buf, 1024, 0);
            if ($size == false) {
                // Read error.
                $errno = socket_last_error($this->socket);
                echo "socketReadLine error: $errno/" . socket_strerror($errno) . "\n";
                if ($errno == 0 || $errno == 11) return null;
                return false;
            }

            //echo "socketReadBuf appended: $buf\n";
            $this->socketReadBuf .= $buf;
            
            // Loop and attempt to read a line again.
        }
        
        return $line;
    }
    
    // private function socketReadLine1() {
        // // Check if data is waiting on the socket.
        // if (!socket_select($r = array($this->socket), $w = null, $e = null, 0, 250 * 1000))
            // return null;

        // $line = socket_read($this->socket, 10240, PHP_NORMAL_READ);
        
        // // Last socketReadLine() may have left an EOL on the stream.  Ignore it and read again.
        // if ($line == "\r" || $line == "\n")
            // $line = socket_read($this->socket, 10240, PHP_NORMAL_READ);

        // if ($line === false) {
            // $errno = socket_last_error($this->socket);
            // echo "socketReadLine error: $errno/" . socket_strerror($errno) . "\n";
            // if ($errno == 0 || $errno == 11) return null;
            // return false;
        // }
        // else
            // echo "socket, size(" . strlen($line) . "): $line\n";

        // return $line;
    // }

    // Process an incoming message with default logic.
    public function processMsg($msg) {
        switch ($msg['command']) {
        case 'PING':
            $this->pong($msg);
            break;
            
        case 'MODE':
            // Store user or channel mode string.
            $this->state->modes[$msg['info']['target']] = $msg['info']['mode'];
            $this->state->isModified = true;
            break;
            
        case 'NICK':
            if ($msg['prefixNick'] == $this->state->nick) {
                // Client user changed nick.
                $this->state->nick = $msg['info']['nick'];
                $this->state->isNickValid = true;
                $this->state->isModified = true;
            }
            break;

        case 'PART':
            // Clean up state when leaving a channel.
            unset($this->state->modes[$msg['info']['channel']]);
            unset($this->state->names[$msg['info']['channel']]);
            $this->state->isModified = true;
            break;
        
        case self::RPL_ENDOFWHO: // End of WHO list.
            if ($this->state->whoMode == WHOMODE_DISCOVERY) {
                // Discovery mode is initiated by the constructor to determine if this is
                // a resumed connection.  If so, we get RPL_ENDOFWHO containing valid nick.
                // Otherwise, ERR_NOTREGISTERED.
                // Then, send a WHO with this nick to find current joined channels.
                $this->state->nick = $msg['info']['target'];
                $this->state->isNickValid = true;
                $this->state->isModified = true;
                
                // Re-request WHO with this validated nick to get channel info.
                // Save names list built from RPL_WHOREPLY messages.
                $this->who($this->state->nick, WHOMODE_SAVENAMES);
            }
            else {
                // mode 1: Save names list gathered from WHO replies.
                if ($this->state->whoMode == WHOMODE_SAVENAMES) {
                    $this->state->names = $this->state->whoReply['names'];
                    $this->state->isModified = true;
                }
            }
            
            if ($this->state->whoReply !== null) {
                $this->state->whoReply = null;
                $this->state->isModified = true;
            }
            break;

        case self::RPL_WHOREPLY:
            if ($this->isChannel($msg['info']['channel'])) {
                // Store channel data in $whoReply.
                $this->state->whoReply['names'][$msg['info']['channel']][] = $msg['info']['nick'];
                $this->state->isModified = true;
            }
            break;
            
        case self::RPL_TOPIC:
            $this->state->topicReply['topic'] = $msg['info']['topic'];
            $this->state->isModified = true;
            break;
            
        case self::RPL_NOTOPIC:
            $this->state->topicReply['topic'] = '';
            $this->state->isModified = true;
            break;
            
        case 333: // topic reply set by/timestamp.
            $this->state->topicReply['setByNick'] = $msg['info']['setByNick'];
            $this->state->topicReply['setTime'] = $msg['info']['setTime'];
            $this->state->isModified = true;
            break;
            
        case self::RPL_NAMREPLY: // NAMES list.
            $this->state->names[$msg['info']['target']] = $msg['info']['names'];
            $this->state->isModified = true;
            break;

        case self::ERR_NOTREGISTERED: // ERR_NOTREGISTERED.
            // If receiving this error from WHO in discovery mode, we assume
            // this is a new connection and must be registered.
            // if ($msg['info']['command'] == 'who' && $this->state->whomode == whomode_discovery) {
                // // send registration commands.
                // $this->sendrawmsg("user " . $this->state->ident . " * irc.dsm.org :" . $this->state->realname . "\r\n");
                // $this->setnick($this->state->nick);
            // }
            break;
        }
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
        $matches = array();
        $msg = null;
        
        // Parse raw message for prefix, command, and params.
        if (!preg_match("/^(:(\\S+) )?(\\w+)( (.+?))?\\r\\n$/", $line, $matches)) return false;
        $msg = array(
            'raw' => $line,
            'prefix' => isset($matches[2]) ? $matches[2] : null,
            'command' => $matches[3],
            'params' => $matches[5]
        );

        // Parse prefix.
        $matches = array();
        if (preg_match("/^([\\w-\.]+)((!([\\w-\.]+))?@([\\w-\.]+))?$/", $msg['prefix'], $matches)) {
            $msg['prefixNick'] = $matches[1];
            if (isset($matches[4])) $msg['prefixUser'] = $matches[4];
            if (isset($matches[5])) $msg['prefixHost'] = $matches[5];
        }
        
        // Parse params depending on command.
        $msgParams = array();
        switch ($msg['command']) {
        case 'PRIVMSG':
            if (!preg_match("/^(\\S+) :(.+)/", $msg['params'], $msgParams)) return false;
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
        
        case 'MODE':
            if (!preg_match("/(\S+) :([+|-]\w+)( (.+))?/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'mode' => $msgParams[2]
            );
            if (isset($msgParams[4])) $msg['info']['recipient'] = $msgParams[4];
            break;
            
        case 'NICK':
            if (!preg_match("/:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1]
            );
            break;
            
        case 'JOIN':
            if (!preg_match("/:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1]
            );
            break;
            
        case 'PART':
            $msg['info'] = array(
                'channel' => $msg['params']
            );
            break;
            
        case 'TOPIC':
            if (!preg_match("/:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'topic' => $msgParams[1]
            );
            break;
            
        case self::RPL_ENDOFWHO: // End of WHO list.
            if (!preg_match("/^(\\S+) +\\S+ +:.+/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1]
            );
            break;

        case self::RPL_WHOREPLY:
            if (!preg_match("/^(\\S+) +(\\S+) +(\\S+) +(\\S+) +(\\S+) +(\\S+) +(\\S+) +:(\\d+) +(.+)/", $msg['params'], $msgParams)) return false;
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
            if (!preg_match("/\\S+ +\\S +(#\\w+) +(.+)$/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'names' => explode(' ', rtrim($msgParams[2]))
            );
            break;
            
        case self::RPL_NOTOPIC:
            if (!preg_match("/^\\S+\\s+(\\S+)\\s+:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'topic' => null
            );
            break;
            
        case self::RPL_TOPIC:
            if (!preg_match("/^(\\S+)\\s+:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => $msgParams[2]
            );
            break;
            
        case 333: // Topic set by
            if (!preg_match("/^\\S+\\s+(\\S+)\\s+(\\S+)\\s+(\\d+)$/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'nick' => $msgParams[2],
                'time' => $msgParams[3]
            );
            break;

        case self::RPL_TIME:
            if (!preg_match("/^(\\S+)\\s+:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'server' => $msgParams[1],
                'timeString' => $msgParams[2]
            );
            break;
            
        case self::ERR_NOSUCHCHANNEL:
            if (!preg_match("/(\\S+) :(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;

        case self::ERR_NOTREGISTERED:
            if (!preg_match("/(\\S+) +:(.+)/", $msg['params'], $msgParams)) return false;
            $msg['info'] = array(
                'command' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;
        }
        
        return $msg;
    }
    
    public function debug_write($text) {
        $text = preg_replace("/[\\r\\n]/", "", $text);
        $text = preg_replace("/\\s{2,}/", " ", $text);
        $this->msg('#sp', $text);
    }

	// Send raw message.
    // Message line must end with \r\n.
	public function sendRawMsg($line)
	{
        //socket_set_block($this->socket);
        $c = socket_select($r = null, $w = array($this->socket), $e = null, 2, 0);
        if ($c == false) {
            $errno = socket_last_error($this->socket);
            echo "sendRawMsg error: $errno/" . socket_strerror($errno) . " trying to send message: $line";
            return false;
        }
        else if ($c == 0) {
            // Timeout waiting for socket to be writable.
            echo "sendRawMsg timeout on socket_select trying to send message: $line";
            return false;
        }
        
        socket_write($this->socket, $line);
        @flush();
        
        echo "sent: " . $line;
	}
    
    public function isChannel($target) {
        return !!preg_match("/^#/", $target);
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
    }

	public function setNick($nick) {
        $this->state->nick = $nick;
        $this->sendRawMsg("NICK $nick\r\n");
    }
    
    public function who($mask = null, $whoMode = null) {
        $this->state->whoReply = array(
            //'modes' => array(),
            'names' => array()
        );
        $this->state->whoMode = $whoMode;

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
	public function pong($msg) {
        $param = empty($msg['params']) ? (':' . $this->state->host) : $msg['params'];
        $this->sendRawMsg("PONG $param\r\n");
    }
    
	public function quit($quitMsg = "") {
        $this->sendRawMsg("QUIT :$quitMsg\r\n");
    }
}

?>