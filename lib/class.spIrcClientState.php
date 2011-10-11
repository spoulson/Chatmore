<?
class spIrcClientState
{
    public $isModified = false;
    
    private $sessionId;

    // Nickname.
	public $nick;
    
    // Valid nick flag.  True if server verifies this client has this nick.
    public $isNickValid = false;
    
    // Ident.
    public $ident;
    
    // Real name.
    public $realname;
    
    // IRC server:port.
    public $server;
    public $port;
    
    public $channels = array(); // Array of $channel => spIrcChannelDesc objects.
    public $users = array();    // Array of $nick => spIrcUserDesc objects.
    
    public function spIrcClientState() {
        $this->sessionId = uniqid('', true);
    }
    
    public function getPrimarySocketFilename() {
        global $ircConfig;
        return $ircConfig['socketFilePath'] . '/chatmore_' . $this->sessionId . '1.sock';
    }

    public function getSecondarySocketFilename() {
        global $ircConfig;
        return $ircConfig['socketFilePath'] . '/chatmore_' . $this->sessionId . '2.sock';
    }
}

// Describes a channel on the IRC network.
class spIrcChannelDesc {
    public $mode;
    
    // = public, * private, @ secret
    public $visibility;
    
    public $topic;
    public $topicSetByNick;
    public $topicSetTime;       // Epoch timestamp
    public $members = array();  // Array of $nick => spIrcChannelMemberDesc objects
}

// Describes a member in a channel.
class spIrcChannelMemberDesc {
    // Nick prefixes: http://www.geekshed.net/2009/10/nick-prefixes-explained/
    // ~ owners
    // & admins
    // @ full operators
    // % half operators
    // + voiced users
    public $mode = '';
}

// Describes a user on the IRC network.
class spIrcUserDesc {
    public $realname;
    public $host;
    public $mode;
}

?>
