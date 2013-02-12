<?
// Creates and listens on a Unix domain socket for client connection and proxies bidirectional data to a given proxy socket.
// Proxy socket is kept alive as client sockets connect and disconnect to send or receive data.
// Data is buffered between client and proxy.

require_once 'class.log.php';

class spSocketProxy {
    private $domainSocketFile;
    private $domainSocket = null;
    private $clientSocket = null;
    private $proxySocket = null;
    private $proxySocketFunc = null;
    private $proxySocketInitialized = false;
    private $proxyIdleTime;
    private $clientIdleTime;
    private $proxyBuffer = null;
    private $clientBuffer = null;
    
    public $proxyIdleTimeout = 300;     // in seconds of inactivity from proxy socket.
    public $clientIdleTimeout = 300;    // in seconds of inactivity from client socket.  Must agree with $ircConfig['recv_timeout'] in config.php.
    public $pollTimeout = 100;          // in milliseconds
    public $proxyReadBufSize = 262144;
    public $clientReadBufSize = 262144;
    
    public function spSocketProxy($domainSocketFile) {
        $this->domainSocketFile = $domainSocketFile;

        // Create domain socket file and listen.
        if (file_exists($this->domainSocketFile)) unlink($this->domainSocketFile) || die("Error removing stale client socket file!");
        $this->domainSocket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        socket_bind($this->domainSocket, $this->domainSocketFile) || die("Error binding domain socket!");
        socket_listen($this->domainSocket) || die("Error listening to domain socket!");
    }
    
    public function setProxySocket($proxySocket) {
        $this->proxySocketFunc = null;
        $this->proxySocket = $proxySocket;
        $this->proxySocketInitialized = true;
    }
    
    public function setProxySocketFunc($func) {
        // Callback returns socket.
        // Called on initial client connection.
        $this->proxySocketFunc = $func;
    }
    
    // Poll socket for activity.
    // Returns false if domain socket is disconnected.
    // Returns false if client is connected and proxy disconnected.
    public function poll() {
        // If the domain socket closes, quit.  This is too fatal of an error to be worth trying to recover from.
        if (!$this->isDomainSocketConnected()) {
            log::error("poll() aborted; Domain socket is disconnected!");
            return false;
        }
        
        // If proxy socket is disconnected, don't quit until the client buffer is flushed.
        if (empty($this->clientBuffer) && $this->proxySocketInitialized && !$this->isProxySocketConnected()) {
            log::error("poll() aborted; Proxy socket is disconnected!");
            return false;
        }

        // Check all sockets for activity.
        $rSelect = array();
        $wSelect = array();
        $eSelect = array();
        if ($this->isProxySocketConnected()) {
            $rSelect[] = $this->proxySocket;
            if (!empty($this->proxyBuffer)) $wSelect[] = $this->proxySocket;
        }
        if ($this->isClientSocketConnected()) {
            // ClientSocket doubles as R/W socket.
            $rSelect[] = $this->clientSocket;
            if (!empty($this->clientBuffer)) $wSelect[] = $this->clientSocket;
        }
        else {
            // If no client is connected, listen for connection attempts on domain socket.
            $rSelect[] = $this->domainSocket;
        }
        
        // Wait for a socket to become available.
        $newClientSocket = null;
        $select = socket_select($rSelect, $wSelect, $eSelect, 0, $this->pollTimeout * 1000);
        
        if ($select === false) {
            $errno = socket_last_error();
            if ($errno != 11) {
                log::error("Error during socket_select(): $errno/" . socket_strerror($errno));
            }
            usleep(250 * 1000);
        }
        else {
            // Check for reads.
            foreach ($rSelect as $socket) {
                $buf = null;
                
                if ($socket === $this->domainSocket) {
                    // Check for a domain socket connection that we can accept.
                    if ($c = @socket_accept($socket)) {
                        //log::info("Accepted client connection: $c");
                        $newClientSocket = $c;
                    }
                }
                else if ($socket === $this->proxySocket) {
                    if ($this->isProxySocketConnected()) {
                        // Data waiting in proxy socket.
                        //log::info("rP");
                        // Reset idle timer when reading from proxy socket.
                        $this->proxyIdleTime = time();

                        $size = @socket_recv($socket, $buf, $this->proxyReadBufSize, 0);
                        if ($size) {
                            //log::info("proxy: $buf");
                            //log::info("Buffering to client, size(" . strlen($buf) . ")");
                            $this->clientBuffer .= $buf;
                        }
                        else {
                            // Got 0 bytes; assume connection was closed.
                            log::info("Proxy connection was closed.");
                            socket_shutdown($socket, 2);
                            socket_close($socket);
                            $this->proxySocket = null;
                        }
                    }
                }
                else if ($socket === $this->clientSocket) {
                    // Data waiting in client socket.
                    //log::info("rC");
                    $size = @socket_recv($socket, $buf, $this->clientReadBufSize, 0);
                    if ($size === false) {
                        $errno = socket_last_error($socket);
                        // 11 = no data available.
                        if ($errno != 11) {
                            // Error with client, close its connection.
                            log::error("Error $errno receiving from client, closing client connection: " . socket_strerror($errno));
                            socket_shutdown($socket, 2);
                            socket_close($socket);
                            $this->clientSocket = null;
                        }
                    }
                    else if ($size) {
                        //log::info("client: $buf");
                        // Reset idle timer when client attempts to write.
                        $this->clientIdleTime = time();

                        //log::info("Buffering to proxy, size(" . strlen($buf) . ")");
                        $this->proxyBuffer .= $buf;
                    }
                    else {
                        // Got 0 bytes; assume connection was closed.
                        //log::info("Client connection was closed.");
                        socket_shutdown($socket, 2);
                        socket_close($socket);
                        $this->clientSocket = null;
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
                        //log::info("wP");
                        log::info("Sending " . strlen($this->proxyBuffer) . " bytes to proxy...");
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
                                log::info("sent $size of buffered " . (strlen($this->proxyBuffer) - $size) . " bytes ");
                                $this->proxyBuffer = substr($this->proxyBuffer, $size);
                            }
                            else {
                                $this->proxyBuffer = null;
                            }
                            //log::info("done");
                        }
                    }
                }
                else if ($socket === $this->clientSocket) {
                    // Client socket ready for writing.
                    //log::info("wC");
                    log::info("Sending " . strlen($this->clientBuffer) . " bytes to client... ");
                    $size = @socket_send($socket, $this->clientBuffer, strlen($this->clientBuffer), 0);
                    if ($size === false) {
                        // Error with client, close its connection.
                        $errno = socket_last_error($socket);
                        log::error("Error $errno sending to client, closing client connection: " . socket_strerror($errno));
                        socket_shutdown($socket, 2);
                        socket_close($socket);
                        $this->clientSocket = null;
                    }
                    else {
                        if ($size < strlen($this->clientBuffer)) {
                            // Not all bytes were sent.  Buffer the remainder.
                            log::info("sent $size of buffered " . (strlen($this->clientBuffer) - $size) . " bytes ");
                            $this->clientBuffer = substr($this->clientBuffer, $size);
                        }
                        else {
                            $this->clientBuffer = null;
                        }
                        //log::info("done");
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
                log::info('Dropping client socket connection in order to accept new client connection.');
                socket_shutdown($this->clientSocket, 2);
                socket_close($this->clientSocket);
            }
            $this->clientSocket = $newClientSocket;

            // Reset idle timer when client connects to domain socket.
            $this->clientIdleTime = time();

            //log::info('Client socket connected.');

            // Connect proxy socket on initial client connection.
            if (!$this->isProxySocketConnected()) {
                $this->connectProxySocket();
            }
        }
        
        // Check idle timeouts.
        if ($this->proxyIdleTime !== null && (time() - $this->proxyIdleTime) >= $this->proxyIdleTimeout) {
            log::error("Server idle timeout of " . $this->proxyIdleTimeout . " seconds.  Disconnecting!");
            $this->disconnect();
            return false;
        }
        
        if ($this->clientIdleTime !== null && (time() - $this->clientIdleTime) >= $this->clientIdleTimeout) {
            log::error("Client idle timeout of " . $this->clientIdleTimeout . " seconds.  Disconnecting!");
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
            $this->proxySocketInitialized = true;

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
