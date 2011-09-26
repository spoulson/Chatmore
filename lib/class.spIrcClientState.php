<?
class spIrcClientState
{
    public $isModified = false;
    
    private $sessionId;

    // WHO reply array.
    // array(
    //    names => $namesarray,
    //    modes => $modesarray
    // )
    public $whoReply;
    
    // Nickname.
	public $nick;
    
    // Valid nick flag.  True if server verifies this client has this nick.
    public $isNickValid = false;
    
    // Ident.
    public $ident;
    
    // Hostname.
    public $host;
    
    // Real name.
    public $realname;
    
    public $channels = array(); // Array of $channel => spIrcChannelDesc objects.
    public $users = array();    // Array of $nick => spIrcUserDesc objects.
    
    public function spIrcClientState() {
        $this->sessionId = uniqid('', true);
    }
    
    public function getPrimarySocketFilename() {
        global $ircConfig;
        return $ircConfig['socketFilePath'] . '/ircweb2_' . $this->sessionId . '1.sock';
    }

    public function getSecondarySocketFilename() {
        global $ircConfig;
        return $ircConfig['socketFilePath'] . '/ircweb2_' . $this->sessionId . '2.sock';
    }
}

// Describes a channel on the IRC network.
class spIrcChannelDesc {
    public $mode;
    public $topic;
    public $topicSetByNick;
    public $topicSetTime;       // Epoch timestamp
    public $members = array();  // Array of $nick => spIrcChannelMemberDesc objects
    public $joinTime;
    public $lastMsgTime;
}

// Describes a member in a channel.
class spIrcChannelMemberDesc {
    public $mode;
}

// Describes a user on the IRC network.
class spIrcUserDesc {
    public $realname;
    public $host;
    public $mode;
}

?>
