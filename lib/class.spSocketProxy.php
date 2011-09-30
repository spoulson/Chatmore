<?
// Creates and listens to two Unix domain sockets: primary and secondary.
// Primary domain socket allows client read/write, secondary is client write-only.
// Proxies client I/O with a given proxy socket handle.
// Primary socket is kept alive as client connects and disconnects as it needs.
// Received proxy socket data is buffered and flushed when client connects.
// Client connections to either primary or secondary domain sockets will close
// previously connected client sockets.

require_once 'class.log.php';

class spSocketProxy {
    private $primaryDomainSocketFile;
    private $primaryDomainSocket = null;
    private $secondaryDomainSocketFile;
    private $secondaryDomainSocket = null;
    private $primaryClientSocket = null;
    private $secondaryClientSocket = null;
    private $proxySocket = null;
    private $proxySocketFunc = null;
    private $idleTime;
    private $proxyBuffer = null;
    private $clientBuffer = null;
    
    public $idleTimeout = 300;  // in seconds
    public $pollTimeout = 100;  // in milliseconds
    public $proxyReadBufSize = 10240;
    public $clientReadBufSize = 10240;
    
    public function spSocketProxy($primaryDomainSocketFile, $secondaryDomainSocketFile) {
        $this->primaryDomainSocketFile = $primaryDomainSocketFile;
        $this->secondaryDomainSocketFile = $secondaryDomainSocketFile;
        
        // Create domain socket file and listen.
        if (file_exists($this->primaryDomainSocketFile)) unlink($this->primaryDomainSocketFile) || die("Error removing stale primary client socket file!");
        if (file_exists($this->secondaryDomainSocketFile)) unlink($this->secondaryDomainSocketFile) || die("Error removing stale secondary client socket file!");
        $this->primaryDomainSocket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        $this->secondaryDomainSocket = socket_create(AF_UNIX, SOCK_STREAM, 0);
        socket_bind($this->primaryDomainSocket, $this->primaryDomainSocketFile) || die("Error binding primary domain socket!");
        socket_bind($this->secondaryDomainSocket, $this->secondaryDomainSocketFile) || die("Error binding secondary domain socket!");
        socket_listen($this->primaryDomainSocket) || die("Error listening to primary domain socket!");
        socket_listen($this->secondaryDomainSocket) || die("Error listening to secondary domain socket!");
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
    // Returns false if client is connected and proxy disconnected.
    public function poll() {
        // If the domain socket closes, quit.  This is too fatal of an error to be worth trying to recover from.
        if (!$this->isPrimaryDomainSocketConnected() || !$this->isSecondaryDomainSocketConnected()) {
            log::error("poll() aborted; Domain socket is disconnected!");
            return false;
        }
        
        // If proxy socket is disconnected, don't quit until the client buffer is flushed.
        if (empty($this->clientBuffer) && !$this->isProxySocketConnected()) {
            log::error("poll() aborted; Proxy socket is disconnected!");
            return false;
        }

        // Check all sockets for activity.
        $rSelect = array($this->primaryDomainSocket, $this->secondaryDomainSocket);
        $wSelect = array();
        $eSelect = array();
        if ($this->isProxySocketConnected()) {
            $rSelect[] = $this->proxySocket;
            if (!empty($this->proxyBuffer)) $wSelect[] = $this->proxySocket;
        }
        if ($this->isPrimaryClientSocketConnected()) {
            // PrimaryClientSocket doubles as R/W socket.
            $rSelect[] = $this->PrimaryClientSocket;
            if (!empty($this->clientBuffer)) $wSelect[] = $this->PrimaryClientSocket;
        }
        if ($this->isSecondaryClientSocketConnected()) {
            // SecondaryClientSocket can only be written to by client.
            $rSelect[] = $this->SecondaryClientSocket;
        }
        
        // Wait for a socket to become available.
        $newPrimaryClientSocket = null;
        $newSecondaryClientSocket = null;
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
                
                if ($socket === $this->primaryDomainSocket) {
                    // Check for a domain socket connection that we can accept.
                    if ($c = @socket_accept($socket)) {
                        //log::info("Accepted primary client connection: $c");
                        $newPrimaryClientSocket = $c;
                    }
                }
                else if ($socket === $this->secondaryDomainSocket) {
                    // Check for a domain socket connection that we can accept.
                    if ($c = @socket_accept($socket)) {
                        //log::info("Accepted secondary client connection: $c");
                        $newSecondaryClientSocket = $c;
                    }
                }
                else if ($socket === $this->proxySocket) {
                    if ($this->isProxySocketConnected()) {
                        // Data waiting in proxy socket.
                        //log::info("rP");
                        $size = @socket_recv($socket, $buf, $this->proxyReadBufSize, 0);
                        if ($size) {
                            //log::info("proxy: $buf");
                            log::info("Buffering to client, size(" . strlen($buf) . ")");
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
                else if ($socket === $this->PrimaryClientSocket) {
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
                            $this->PrimaryClientSocket = null;
                        }
                    }
                    else if ($size) {
                        //log::info("client: $buf");
                        log::info("Buffering to proxy, size(" . strlen($buf) . ")");
                        $this->proxyBuffer .= $buf;
                    }
                    else {
                        // Got 0 bytes; assume connection was closed.
                        //log::info("Client connection was closed.");
                        socket_shutdown($socket, 2);
                        socket_close($socket);
                        $this->PrimaryClientSocket = null;
                    }
                }
                else if ($socket === $this->SecondaryClientSocket) {
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
                            $this->SecondaryClientSocket = null;
                        }
                    }
                    else if ($size) {
                        //log::info("client: $buf");
                        log::info("Buffering to proxy, size(" . strlen($buf) . ")");
                        $this->proxyBuffer .= $buf;
                    }
                    else {
                        // Got 0 bytes; assume connection was closed.
                        //log::info("Client connection was closed.");
                        socket_shutdown($socket, 2);
                        socket_close($socket);
                        $this->SecondaryClientSocket = null;
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
                else if ($socket === $this->PrimaryClientSocket) {
                    // Client socket ready for writing.
                    //log::info("wC");
                    log::info("Sending " . strlen($this->clientBuffer) . " to client... ");
                    $size = @socket_send($socket, $this->clientBuffer, strlen($this->clientBuffer), 0);
                    if ($size === false) {
                        // Error with client, close its connection.
                        $errno = socket_last_error($socket);
                        log::error("Error $errno sending to client, closing client connection: " . socket_strerror($errno));
                        socket_shutdown($socket, 2);
                        socket_close($socket);
                        $this->PrimaryClientSocket = null;
                    }
                    else {
                        // Reset idle timer when client attempts to read.
                        $this->idleTime = time();

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
                else {
                    // Unknown socket?
                    log::error("Error: unknown socket found in wSelect: $socket");
                }
            }
        }

        // Respond to newly accepted client socket.
        if (!empty($newPrimaryClientSocket)) {
            if ($this->isPrimaryClientSocketConnected()) {
                log::info('Dropping Primary client socket connection.');
                socket_shutdown($this->PrimaryClientSocket, 2);
                socket_close($this->PrimaryClientSocket);
            }
            $this->PrimaryClientSocket = $newPrimaryClientSocket;
            log::info('Primary client socket connected.');

            // Connect proxy socket on initial client connection.
            if (!$this->isProxySocketConnected()) {
                $this->connectProxySocket();
            }
        }
        if (!empty($newSecondaryClientSocket)) {
            if ($this->isSecondaryClientSocketConnected()) {
                log::info('Dropping Secondary client socket connection.');
                socket_shutdown($this->SecondaryClientSocket, 2);
                socket_close($this->SecondaryClientSocket);
            }
            $this->SecondaryClientSocket = $newSecondaryClientSocket;
            log::info('Secondary client socket connected.');

            // Connect proxy socket on initial client connection.
            if (!$this->isProxySocketConnected()) {
                $this->connectProxySocket();
            }
        }
        
        // Check idle timeout.
        if ($this->idleTime != null && (time() - $this->idleTime) >= $this->idleTimeout) {
            log::error("Idle timeout.  Disconnecting!");
            $this->disconnect();
            return false;
        }
    }
    
    private function isPrimaryDomainSocketConnected() {
        return !empty($this->primaryDomainSocket);
    }
    
    private function isSecondaryDomainSocketConnected() {
        return !empty($this->secondaryDomainSocket);
    }

    private function isPrimaryClientSocketConnected() {
        return !empty($this->PrimaryClientSocket);
    }

    private function isSecondaryClientSocketConnected() {
        return !empty($this->SecondaryClientSocket);
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
        if ($this->isPrimaryClientSocketConnected()) {
            socket_shutdown($this->PrimaryClientSocket);
            socket_close($this->PrimaryClientSocket);
            $this->PrimaryClientSocket = null;
        }
        if ($this->isSecondaryClientSocketConnected()) {
            socket_shutdown($this->SecondaryClientSocket);
            socket_close($this->SecondaryClientSocket);
            $this->SecondaryClientSocket = null;
        }
        
        // Close domain socket.
        if ($this->isPrimaryDomainSocketConnected()) {
            socket_shutdown($this->primaryDomainSocket);
            socket_close($this->primaryDomainSocket);
            if (file_exists($this->primaryDomainSocketFile)) unlink($this->primaryDomainSocketFile);
            $this->primaryDomainSocket = null;
        }
        if ($this->isSecondaryDomainSocketConnected()) {
            socket_shutdown($this->secondaryDomainSocket);
            socket_close($this->secondaryDomainSocket);
            if (file_exists($this->secondaryDomainSocketFile)) unlink($this->secondaryDomainSocketFile);
            $this->secondaryDomainSocket = null;
        }
        
        log::info('Disconnected.');
    }
}
?>
