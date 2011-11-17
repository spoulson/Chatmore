<?
// http://tools.ietf.org/html/rfc2812

require_once 'class.log.php';
require_once 'class.spIrcSessionModel.php';

class spIrcClient {
    // Message types returned from AJAX calls.
    const CLMSG_TYPE_SERVER = 'servermsg';   // PHP server message
    const CLMSG_TYPE_RECV = 'recv';          // Received IRC message

    // Message codes associated with CLMSG_TYPE_SERVER messages.
    const CLMSG_CONNECTION_READY = 200;
    const CLMSG_SESSION_ID = 300;
    const CLMSG_CONNECTION_NOT_OPEN = 400;
    const CLMSG_CONNECTION_ALREADY_ACTIVE = 401;
    const CLMSG_TIMEOUT_ON_OPEN = 500;
    
    // IRC server message codes.
    const RPL_WELCOME = 001;
    const RPL_YOURHOST = 002;
    const RPL_CREATED = 003;
    const RPL_MYINFO = 004;
    const RPL_BOUNCE = 005;
    const RPL_LUSERCLIENT = 251;
    const RPL_LUSEROP = 252;
    const RPL_LUSERUNKNOWN = 253;
    const RPL_LUSERCHANNELS = 254;
    const RPL_LUSERME = 255;
    const RPL_ENDOFWHO = 315;
    const RPL_LISTSTART = 321;
    const RPL_LIST = 322;
    const RPL_LISTEND = 323;
    const RPL_CHANNELMODEIS = 324;
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
    private $socketFile;
    
    private $socketReadBuffer = null;
    private $socketSendBuffer = null;
    
    public $socketReadBufferSize = 1024;
    public $socketSendTimeout = 2000;   // in milliseconds
    public $maxConnectAttempts = 3;
    public $connectAttemptDelay = 500;  // in milliseconds
    
    // Constructor.
    public function spIrcClient($socketFile) {
        $this->socketFile = $socketFile;
        $this->connectSocket();
    }

    // Check $this->isConnected for success status.
    private function connectSocket() {
        $this->isConnected = false;
        
        for ($attempt = 0; $attempt < $this->maxConnectAttempts; $attempt++) {
            $this->socket = socket_create(AF_UNIX, SOCK_STREAM, 0);
            if (socket_connect($this->socket, $this->socketFile)) {
                $this->isConnected = true;
                
                // // Verify connection.
                // if (!$this->isSocketAlive()) {
                    // log::error('Connection verify failed.');
                    // $this->disconnect();
                // }
            }
            
            // Success?
            if ($this->isConnected) return;
            
            log::error('Connection attempt failed...');
            usleep($this->connectAttemptDelay * 1000);
        }
        
        log::error('All connection attempts failed.  Unable to connect!');
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
    
    public function isConnected() {
        return $this->isConnected;
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
        // Ping socket and reconnect on error.
        //if (!$this->isSocketAlive()) $this->connectSocket();

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
            else if ($c == 0) {
                // No more data.
                //log::info("socketReadLine: no data");
                break;
            }

            // Read more data
            $buf = null;
            $size = @socket_recv($this->socket, $buf, $this->socketReadBufferSize, 0);
            if ($size === false) {
                // Read error.
                $errno = socket_last_error($this->socket);
                log::error("socketReadLine error: $errno/" . socket_strerror($errno));
                if ($errno == 0 || $errno == 11) return null;
                return false;
            }
            else if ($size > 0) {
                //log::info("socketReadBuffer appended: $buf");
                $this->socketReadBuffer .= $buf;
            }
            else {
                log::info('socketReadBuffer got 0 bytes from socket_recv!  Connection dropped?');
                return false;
            }
            
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
        //log::info('Parsing: ' . $line);
        
        // Parse raw message for prefix, command, and params.
        if (!preg_match("/^(:(\S+)\s+)?(\w+)(\s+(.+?))?[ ]*\r\n$/", $line, $m)) return false;
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
        if (preg_match("/^(.+?)((!([^@\s]+))?@(\S+))?$/", $msg['prefix'], $m)) {
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
            // Check channel mode/user mode syntax.
            if (preg_match("/([#&+!][^\s,:\cg]+)\s+(.+)/", $params, $msgParams) ||
                preg_match("/(\S+)\s+:(.*)/", $params, $msgParams)) {
                $msg['info'] = array(
                    'target' => $msgParams[1],
                    'mode' => $msgParams[2]
                );
            }
            else return false;
            break;
            
        case 'NICK':
            if (!preg_match("/:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'oldNick' => $msg['prefixNick']
            );
            break;
        
        case 'JOIN':
            if (!preg_match("/^:?([#&+!][^\s,:\cg]+)$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1]
            );
            break;
            
        case 'PART':
            if (!preg_match("/^(\\S+)(\\s+:(.+))?$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1]
            );
            
            if (isset($msgParams[3])) $msg['info']['comment'] = $msgParams[3];
            break;
            
        case 'KICK':
            if (!preg_match("/^(\\S+)\\s+(\\S+)\\s+:[#&+!][^\s,:\cg]+\s+(.*)/", $params, $msgParams)) return false;
            
            $channelList = explode(',', $msgParams[1]);
            $nickList = explode(',', $msgParams[2]);
            
            // Either 1 channel + many nicks, or 1 channel per nick.
            if (count($channelList) == 1 && count($nickList) > 1) {
                // Project channel list to match counts of nicks.
                do {
                    $channelList[] = $channelList[0];
                } while (count($channelList) < count($nickList));
            }
            else if (count($channelList) != count($nickList)) {
                // channel and nick parameters invalid.
                return false;
            }
            
            $kicks = array();
            for ($i = 0; $i < count($channelList); $i++) {
                $kicks[] = array(
                    'channel' => $channelList[$i],
                    'nick' => $nickList[$i]
                );
            }
            
            $msg['info'] = array(
                'kicks' => $kicks,
                'comment' => $msgParams[3]
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
                        
        case self::RPL_LUSEROP:
        case self::RPL_LUSERUNKNOWN:
        case self::RPL_LUSERCHANNELS:
            if (!preg_match("/^(\S+)\s+(\d+)\s+:(.*)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'number' => $msgParams[2],
                'message' => $msgParams[3]
            );
            break;
            
        case self::RPL_ENDOFWHO: // End of WHO list.
            if (!preg_match("/^(#\S+)\s+\S+\s+:.+/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1]
            );
            break;

        case self::RPL_WHOREPLY:
            if (!preg_match("/^(\S+)\s+(#\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+:(\d+)\s+(.+)/", $params, $msgParams)) return false;
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
            // Nick prefixes: http://www.geekshed.net/2009/10/nick-prefixes-explained/
            // ~ owners
            // & admins
            // @ full operators
            // % half operators
            // + voiced users
            if (!preg_match("/\S+\s+([=*@])\s+([#&+!][^\s,:\cg]+)\s+:(.+)/", $params, $msgParams)) return false;
            $names = array();
            foreach (explode(' ', $msgParams[3]) as $name) {
                $m = array();
                if (preg_match("/([~&@%+])?(.+)/", $name, $m)) {
                    $names[] = array(
                        'mode' => $m[1] ? $m[1] : '',
                        'nick' => $m[2]
                    );
                }
            }
            
            $msg['info'] = array(
                'visibility' => $msgParams[1],
                'channel' => $msgParams[2],
                'names' => $names
            );
            break;
            
        case self::RPL_NOTOPIC:
            if (!preg_match("/^\S+\s+([#&+!][^\s,:\cg]+)\s+:/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => null
            );
            break;
            
        case self::RPL_TOPIC:
            if (!preg_match("/^\S+\s+([#&+!][^\s,:\cg]+)\s+:(.*)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'topic' => !empty($msgParams[2]) ? $msgParams[2] : null
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
            
        case self::RPL_CHANNELMODEIS:
            if (!preg_match("/\S+\s+([#&+!][^\s,:\cg]+)\s+(\S+(\s+\S+)?)$/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'mode' => $msgParams[2]
            );
            break;
            
        case self::RPL_LIST:
            if (!preg_match("/^\S+\s+([#&+!][^\s,:\cg]+)\s+(\d+)\s+:(.*)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'memberCount' => $msgParams[2],
                'topic' => $msgParams[3]
            );
            log::info(var_export($msg, true));
            break;
            
        case self::ERR_NOSUCHCHANNEL:
            if (!preg_match("/([#&+!][^\s,:\cg]+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'channel' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;
            
        case self::ERR_NICKNAMEINUSE:
            if (!preg_match("/(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;

        case self::ERR_NOTREGISTERED:
            if (!preg_match("/(\S+)\s+:(.+)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'command' => $msgParams[1],
                'error' => $msgParams[2]
            );
            break;

        // Disregard these messages.
        case self::RPL_LISTSTART:
            return false;
            
        default:
            // All other messages parsed as a simple text message.
            if (!preg_match("/^(\S+)\s+:(.*)/", $params, $msgParams)) return false;
            $msg['info'] = array(
                'nick' => $msgParams[1],
                'message' => $msgParams[2]
            );
            break;
        }
        
        $msg['type'] = self::CLMSG_TYPE_RECV;
        //log::info('Parsed message: ' . var_export($msg, true));
        return $msg;
    }
    
    // Process an incoming message with default logic.
    public function processMsg($msg) {
        //log::info('Processing message: ' . $msg['raw']);
        
        switch ($msg['command']) {
        case 'PING':
            $this->sendRawMsg("PONG :" . $msg['info']['ping'] . "\r\n");
            break;
        }
        
        $this->flushSendBuffer();
    }
    
    // Ping socket with a fake send to see if we're still connected.
    // BUG: This function doesn't work at all.
    public function isSocketAlive() {
        if (!$this->isConnected) return false;
        
        $c = socket_select($r = array(), $w = array($this->socket), $e = array(), 0, 250 * 1000);
        if ($c === false) {
            $errno = socket_last_error($this->socket);
            log::error("Error $errno during socket_select: '" . socket_strerror($errno) . "'");
            return false;
        }
        else if ($c == 0) {
            // Timeout waiting for socket to be writable.
            log::error("Error: timeout on socket_select trying to send buffer.");
            return false;
        }
        
        $size = @socket_send($this->socket, '', 0, 0);
        if ($size === false) {
            $errno = socket_last_error($this->socket);
            
            // Success?
            if ($errno === 0) return true;
            
            // Any other value is an actual error.
        }
        
        return false;
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
            return false;
        }
        else if ($size > 0) {
            log::error("Error while flushing send buffer.  Some data may have been dropped.");
            return false;
        }
        // else {
            // log::info('Send buffer flushed.');
        // }
    }
        
    // Send buffered data to socket.
    // Returns buffer bytes remaining after send attempt.
    public function socketSendBuffer() {
        // Ping socket and reconnect on error.
        //if (!$this->isSocketAlive()) $this->connectSocket();
        
        if (!empty($this->socketSendBuffer)) {
            $c = socket_select($r = array(), $w = array($this->socket), $e = array(), 0, $this->socketSendTimeout);
            if ($c === false) {
                $errno = socket_last_error($this->socket);
                log::error("Error $errno during socket_select: '" . socket_strerror($errno) . "'");
                return false;
            }
            else if ($c == 0) {
                // Timeout waiting for socket to be writable.
                log::error("Error: timeout on socket_select trying to send buffer.");
                return false;
            }
            
            $size = @socket_write($this->socket, $this->socketSendBuffer);
            if ($size === false) {
                $errno = socket_last_error($this->socket);
                log::error("Error $errno during socket_write: '" . socket_strerror($errno) . "', while trying to send message: $line");
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
            
            //log::info("done");
            @flush();
            
            return strlen($this->socketSendBuffer);
        }
        else {
            // No data to send.
            return 0;
        }
    }

    // Send raw message.
    // Message line must end with \r\n.
    public function sendRawMsg($line)
    {
        $this->socketSendBuffer .= $line;
        //log::info("Sent: " . $line);
    }
    
    public function isChannel($target) {
        return preg_match("/^[#&+!][^\s,:\cg]+/", $target);
    }
}
?>