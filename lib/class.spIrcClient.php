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

    private $socketReadBuf = null;
    public $socketReadBufSize = 1024;
    
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
        //log::info("socketReadBuf size(" . strlen($this->socketReadBuf) . ")");
        $line = null;
        
        while (true) {
            // check for line ending in read buffer.
            $m = null;
            //if (strlen($this->socketReadBuf)) log::info('socketReadBuf: ' . str_replace("\r\n", "$\r\n", $this->socketReadBuf));
            if (preg_match("/^.*?\r\n/", $this->socketReadBuf, $m)) {
                // Found a line.
                $line = $m[0];
                $this->socketReadBuf = substr($this->socketReadBuf, strlen($line));
                //log::info("socket, size(" . strlen($line) . "): $line");
                break;
            }
            
            // Check for data available for read.
            $c = socket_select($r = array($this->socket), $w = null, $e = null, 0, 250 * 1000);
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
            $size = socket_recv($this->socket, $buf, $this->socketReadBufSize, 0);
            if ($size == false) {
                // Read error.
                $errno = socket_last_error($this->socket);
                log::error("socketReadLine error: $errno/" . socket_strerror($errno));
                if ($errno == 0 || $errno == 11) return null;
                return false;
            }

            //log::info("socketReadBuf appended: $buf");
            $this->socketReadBuf .= $buf;
            
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
            if (!preg_match("/(\S+) :([+|-]\w+)( (.+))?/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'mode' => $msgParams[2]
            );
            if (isset($msgParams[4])) $msg['info']['recipient'] = $msgParams[4];
            break;
            
        case 'NICK':
            if (!preg_match("/:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1]
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
            if (!preg_match("/\S+ +\S +(#\w+) +(.+)$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'target' => $msgParams[1],
                'names' => explode(' ', rtrim($msgParams[2]))
            );
            break;
            
        case self::RPL_NOTOPIC:
            if (!preg_match("/^\S+\s+(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
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
        
        return $msg;
    }
    
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
            $channel = $msg['info']['channel'];
            unset($this->state->channels[$channel]);
            $this->state->isModified = true;
            break;
        
        case self::RPL_WHOREPLY:
            $channel = $msg['info']['channel'];
            // if ($this->isChannel($msg['info']['channel'])) {
                // // Store channel data in $whoReply.
                // $this->state->whoReply['names'][$msg['info']['channel']][] = $msg['info']['nick'];
                // $this->state->isModified = true;
            // }
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
            //$this->state->names[$msg['info']['target']] = $msg['info']['names'];
            $channel = $msg['info']['target'];
            if (!isset($this->state->channels[$channel])) {
                $this->state->channels[$channel] = new spIrcChannelDesc();
            }
            
            foreach ($msg['info']['names'] as $name) {
                $m = array();
                preg_match("/^(.)(.+)/", $name, $m);
                $prefix = $m[1];
                $nick = $m[2];
                
                if (!isset($this->state->channels[$channel]->members[$nick])) {
                    $member = new spIrcChannelMemberDesc();
                    $member->mode = $prefix;
                    // TODO: Populate class with member metadata.
                    $this->state->channels[$channel]->members[$nick] = $member;
                }
            
                if (!isset($this->state->users[$nick])) {
                    $user = new spIrcUserDesc();
                    // TODO: Populate class with user metadata.
                    $this->state->users[$nick] = $user;
                }
            }
            
            $this->state->isModified = true;
            break;

        case self::ERR_NOTREGISTERED: // ERR_NOTREGISTERED.
            break;
        }
    }
        
    public function debug_write($text) {
        $text = preg_replace("/[\r\n]/", "", $text);
        $text = preg_replace("/\s{2,}/", " ", $text);
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