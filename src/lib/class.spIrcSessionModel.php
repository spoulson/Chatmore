<?
// State model for use in server side processing only.
class spIrcSessionModel {
    // Read-only properties:
    public $id;         // int
    public $viewKey;    // varchar(25)
    public $sessionKey; // varchar(25)
    public $deleted;    // bit
    
    public $socketFilename;

    // Modifyable properties:
    // IRC server:port.
    public $server;
    public $port;

    // Epoch times.
    public $createdDate;
    public $lastAccessedDate;
    public $lastModifiedDate;
}
?>
