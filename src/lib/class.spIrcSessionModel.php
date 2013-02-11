<?
// State model for use in server side processing only.
class spIrcSessionModel {
    // Read-only properties:
    public $id;         // int
    public $viewKey;    // varchar(25)
    public $sessionKey; // varchar(25)
    public $deleted;    // bit
    
    public $primarySocketFilename;

    // Modifyable properties:
    // IRC server:port.
    public $server;
    public $port;
}
?>
