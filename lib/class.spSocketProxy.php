<?
// Creates and listens to a Unix domain socket;
// proxies its connection with a given proxy socket handle.
// Proxy socket I/O is buffered in event domain socket connection is dropped.
// Flushes buffers when domain socket is reconnected.

require_once 'class.log.php';

class spSocketProxy {
    private $domainSocketFile;
    private $domainSocket = null;
    private $proxySocket = null;
    private $proxySocketFunc = null;
    private $clientSocket = null;
    private $idleTime;
    private $proxyBuffer = null;
    private $clientBuffer = null;
    
    public $idleTimeout = 60;   // in seconds
    public $pollTimeout = 1000; // in milliseconds
    
    public function spSocketProxy($domainSocketFile) {
        $this->domainSocketFile = $domainSocketFile;
        
        // Create domain socket file and listen.
        if (file_exists($this->domainSocketFile)) unlink($this->domainSocketFile) || die("Error removing stale socket file!");
        $this->domainSocket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        socket_bind($this->domainSocket, $this->domainSocketFile) || die("Error binding domain socket!");
        socket_listen($this->domainSocket) || die("Error listening to domain socket!");
    }
    
    public function setProxySocket($proxySocket) {
        $this->proxySocketFunc = null;
        $this->proxySocket = $proxySocket;
    }
    
    public function setProxySocketFunc($func) {
        // Callback returns socket.
        // Called on initial client connection.
        $this->proxySocketFunc = $func;
    }
    
    // Poll socket for activity.
    // Returns false if domain socket is disconnected.
    public function poll() {
        if (!$this->isDomainSocketConnected()) {
            log::error("Domain socket is disconnected!");
            return false;
        }
        
        if ($this->isClientSocketConnected() && !$this->isProxySocketConnected()) {
            log::error("Proxy socket is disconnected!");
            return false;
        }

        // Check all sockets for activity.
        $rSelect = array($this->domainSocket);
        $wSelect = array();
        $eSelect = array($this->domainSocket);
        if ($this->isProxySocketConnected()) {
            $rSelect[] = $this->proxySocket;
            if (!empty($this->proxyBuffer)) $wSelect[] = $this->proxySocket;
            $eSelect[] = $this->proxySocket;
        }
        if ($this->isClientSocketConnected()) {
            $rSelect[] = $this->clientSocket;
            if (!empty($this->clientBuffer)) $wSelect[] = $this->clientSocket;
            $eSelect[] = $this->proxySocket;
        }
        
        // Wait for a socket to become available.
        $newClientSocket = null;
        $select = socket_select($rSelect, $wSelect, $eSelect, 0, $this->pollTimeout * 1000);
        
        if ($select === false) {
            $errno = socket_last_error();
            if ($errno != 11) {
                log::error("Error $errno during socket_select().");
            }
            usleep(250 * 1000);
        }
        else {
            // Check for exceptions.
            foreach ($eSelect as $socket) {
                $errno = socket_last_error($socket);
                $errstr = socket_strerror($errno);
                
                if ($socket === $this->proxySocket) {
                    log::error("Exception on proxy socket: $errno/$errstr");
                }
                else if ($socket === $this->clientSocket) {
                    log::error("Exception on client Socket: $errno/$errstr.");
                }
            }
        
            // Check for reads.
            foreach ($rSelect as $socket) {
                $buf = null;
                
                if ($socket === $this->domainSocket) {
                    // Check for a domain socket connection that we can accept.
                    if ($c = @socket_accept($this->domainSocket)) {
                        //echo "Accepted client connection: $c\n";
                        $newClientSocket = $c;
                    }
                }
                else if ($socket === $this->proxySocket) {
                    if ($this->isProxySocketConnected()) {
                        // Data waiting in proxy socket.
                        //echo "rP";
                        $size = @socket_recv($this->proxySocket, $buf, 10240, 0);
                        if ($size) {
                            //log::info("proxy: $buf");
                            log::info("Buffering to client, size(" . strlen($buf) . ")");
                            $this->clientBuffer .= $buf;
                        }
                        else {
                            // Got 0 bytes; assume connection was closed.
                            log::info("Proxy connection was closed.");
                            socket_shutdown($this->proxySocket, 2);
                            socket_close($this->proxySocket);
                            $this->proxySocket = null;
                        }
                    }
                }
                else if ($socket === $this->clientSocket) {
                    if ($this->isClientSocketConnected()) {
                        // Data waiting in client socket.
                        //echo "rC";
                        $size = @socket_recv($this->clientSocket, $buf, 10240, 0);
                        if ($size === false) {
                            $errno = socket_last_error($this->clientSocket);
                            // 11 = no data available.
                            if ($errno != 11) {
                                // Error with client, close its connection.
                                log::error("Error $errno receiving from client, closing client connection: " . socket_strerror($errno));
                                socket_shutdown($this->clientSocket, 2);
                                socket_close($this->clientSocket);
                                $this->clientSocket = null;
                            }
                        }
                        else if ($size) {
                            //log::info("client: $buf");
                            log::info("Buffering to proxy, size(" . strlen($buf) . ")");
                            $this->proxyBuffer .= $buf;
                        }
                        else {
                            // Got 0 bytes; assume connection was closed.
                            //echo "Client connection was closed.\n";
                            socket_shutdown($this->clientSocket, 2);
                            socket_close($this->clientSocket);
                            $this->clientSocket = null;
                        }
                    }
                }
                else {
                    // Unknown socket?
                    log::error("Error: unknown socket found in rSelect: $socket");
                }
            }

            // Check for writes.
            foreach ($wSelect as $socket) {
                if ($socket === $this->proxySocket) {
                    if ($this->isProxySocketConnected()) {
                        // Proxy socket ready for writing.
                        //echo "wP";
                        log::info("Sending " . strlen($this->proxyBuffer) . " to proxy...");
                        $size = @socket_send($this->proxySocket, $this->proxyBuffer, strlen($this->proxyBuffer), 0);
                        if ($size === false) {
                            // Error with proxy socket!
                            $errno = socket_last_error($this->proxySocket);
                            log::error("Error $errno sending to proxy socket: " . socket_strerror($errno));
                            //$this->disconnect();
                            return false;
                        }
                        else {
                            if ($size < strlen($this->proxyBuffer)) {
                                // Not all bytes were sent.  Buffer the remainder.
                                log::info("sent($size) buffered(" . (strlen($this->proxyBuffer) - $size) . ") ");
                                $this->proxyBuffer = substr($this->proxyBuffer, $size);
                            }
                            else {
                                $this->proxyBuffer = null;
                            }
                            log::info("done");
                        }
                    }
                }
                else if ($socket === $this->clientSocket) {
                    if ($this->isClientSocketConnected()) {
                        // Client socket ready for writing.
                        //echo "wC";
                        log::info("Sending " . strlen($this->clientBuffer) . " to client... ");
                        $size = @socket_send($this->clientSocket, $this->clientBuffer, strlen($this->clientBuffer), 0);
                        if ($size === false) {
                            // Error with client, close its connection.
                            $errno = socket_last_error($this->clientSocket);
                            log::error("Error $errno sending to client, closing client connection: " . socket_strerror($errno));
                            socket_shutdown($this->clientSocket, 2);
                            socket_close($this->clientSocket);
                            $this->clientSocket = null;
                        }
                        else {
                            if ($size < strlen($this->clientBuffer)) {
                                // Not all bytes were sent.  Buffer the remainder.
                                log::info("sent($size) buffered(" . (strlen($this->clientBuffer) - $size) . ") ");
                                $this->clientBuffer = substr($this->clientBuffer, $size);
                            }
                            else {
                                $this->clientBuffer = null;
                            }
                            log::info("done");
                        }
                    }
                }
                else {
                    // Unknown socket?
                    log::error("Error: unknown socket found in wSelect: $socket");
                }
            }
        }

        // Respond to newly accepted client socket.
        if (!empty($newClientSocket)) {
            if ($this->isClientSocketConnected()) {
                socket_shutdown($this->clientSocket, 2);
                socket_close($this->clientSocket);
            }

            $this->clientSocket = $newClientSocket;

            // Connect proxy socket on initial client connection.
            if (!$this->isProxySocketConnected()) {
                $this->connectProxySocket();
            }
        }
        
        // Check idle timeout.
        if ($this->isClientSocketConnected()) {
            $this->idleTime = time();
        }
        else if ($this->idleTime != null && (time() - $this->idleTime) >= $this->idleTimeout) {
            log::error("Idle timeout.  Disconnecting client!");
            $this->disconnect();
            return false;
        }
    }
    
    private function isDomainSocketConnected() {
        return !empty($this->domainSocket);
    }
    
    private function isClientSocketConnected() {
        return !empty($this->clientSocket);
    }

    private function isProxySocketConnected() {
        return !empty($this->proxySocket);
    }
    
    private function connectProxySocket() {
        // Only connect socket once.
        if (!empty($this->proxySocketFunc)) {
            log::info("Connecting proxy socket...");

            $func = $this->proxySocketFunc;
            $this->proxySocket = $func();
            $this->proxySocketFunc = null;

            log::info("Connected.");
        }
    }
    
    public function disconnect() {
        log::info('Disconnecting...');

        // Close client connection.
        if ($this->isClientSocketConnected()) {
            socket_shutdown($this->clientSocket);
            socket_close($this->clientSocket);
            $this->clientSocket = null;
        }
        
        // Close domain socket.
        if ($this->isDomainSocketConnected()) {
            socket_shutdown($this->domainSocket);
            socket_close($this->domainSocket);
            if (file_exists($this->domainSocketFile)) unlink($this->domainSocketFile);
            $this->domainSocket = null;
        }
        
        log::info('Disconnected.');
    }
}
?>
