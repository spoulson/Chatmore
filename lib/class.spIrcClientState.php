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
    
    public function addChannel($channel) {
        if (!isset($this->channels[$channel])) {
            $this->channels[$channel] = new spIrcChannelDesc();
        }
        
        return $this->channels[$channel];
    }
    
    public function addUser($nick) {
        if (!isset($this->users[$nick])) {
            $this->users[$nick] = new spIrcUserDesc();
        }
        
        return $this->users[$nick];
    }
    
    public function removeChannel($channel) {
        unset($this->channels[$channel]);
    }
    
    public function removeUser($nick) {
        unset($this->users[$nick]);
    }

    public function clearChannels() {
        $this->channels = array();
    }
    
    public function clearUsers() {
        $this->users = array();
    }
    
    // Get FNV-1 hash on a string or number.
    // $hash is a previous hash to build upon.
    public static function getFNV1($n, $hash = 2166136261) {
        if (is_numeric($n)) {
            while ($n > 0) {
                $octet = $n & 0xff;
                $hash *= 16777619;
                $hash ^= $octet;
                $hash &= 0xffffffff;
                $n >>= 8;
                $n &= 0x00ffffff;
            }
        }
        else {
            $len = strlen($n);
            for ($i = 0; $i < $len; $i++) {
                $hash *= 16777619;
                $hash ^= ord(substr($n, $i, 1));
                $hash &= 0xffffffff;
            }
        }
        
        return $hash;
    }
}

// Describes a channel on the IRC network.
class spIrcChannelDesc {
    const COLORIZE_MIN = 0;
    const COLORIZE_MAX = 31;
    public $mode;
    
    // = public, * private, @ secret
    public $visibility;
    
    public $topic;
    public $topicSetByNick;
    public $topicSetTime;       // Epoch timestamp
    public $members = array();  // Array of $nick => spIrcChannelMemberDesc objects
    
    public function addMember($nick) {
        if (!isset($this->members[$nick])) {
            $member = new spIrcChannelMemberDesc();
            
            // Generate colorize number based on nick.
            $nickHash = spIrcClientState::getFNV1($nick);
            $member->colorizeNumber = $nickHash % (self::COLORIZE_MAX - self::COLORIZE_MIN + 1) + self::COLORIZE_MIN;
            $this->members[$nick] = $member;

            log::info("colorize $nick: " . $member->colorizeNumber . ", checksum: $nickHash");
        }
        
        return $this->members[$nick];
    }
    
    public function removeMember($nick) {
        unset($this->members[$nick]);
    }
    
    public function clearMembers() {
        $this->members = array();
    }
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
    
    public $colorizeNumber = 0;
}

// Describes a user on the IRC network.
class spIrcUserDesc {
    public $realname;
    public $host;
    public $mode;
}

?>
