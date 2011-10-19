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
            log::info("addChannel($channel)");
            $this->channels[$channel] = new spIrcChannelDesc($this);
            $this->isModified = true;
        }
        
        return $this->channels[$channel];
    }
    
    public function addUser($nick) {
        if (!isset($this->users[$nick])) {
            log::info("addUser($nick)");
            $this->users[$nick] = new spIrcUserDesc($this);
            $this->isModified = true;
        }
        
        return $this->users[$nick];
    }
    
    public function removeChannel($channel) {
        if (isset($this->channels[$channel])) {
            log::info("removeChannel($channel)");
            unset($this->channels[$channel]);
            $this->isModified = true;
        }
    }
    
    public function removeUser($nick) {
        if (isset($this->users[$nick])) {
            log::info("removeUser($nick)");
            unset($this->users[$nick]);
            $this->isModified = true;
        }
    }

    public function clearChannels() {
        if (count($this->channels) > 0) {
            log::info('clearChannels()');
            $this->channels = array();
            $this->isModified = true;
        }
    }
    
    public function clearUsers() {
        if (count($this->users) > 0) {
            log::info('clearUsers()');
            $this->users = array();
            $this->isModified = true;
        }
    }
    
    // Get FNV-1 hash on a string or number.
    // http://isthe.com/chongo/tech/comp/fnv/
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
    
    private $state;
    
    public function spIrcChannelDesc($state) {
        $this->state =& $state;
    }
    
    public function addMember($nick) {
        if (!isset($this->members[$nick])) {
            log::info("addMember($nick)");
            $member = new spIrcChannelMemberDesc($this->state);
            
            // Generate colorize number based on nick.
            $nickHash = spIrcClientState::getFNV1($nick);
            $member->colorizeNumber = $nickHash % (self::COLORIZE_MAX - self::COLORIZE_MIN + 1) + self::COLORIZE_MIN;
            $this->members[$nick] = $member;

            $this->state->isModified = true;
            
            //log::info("colorize $nick: " . $member->colorizeNumber . ", checksum: $nickHash");
        }
        
        return $this->members[$nick];
    }
    
    public function removeMember($nick) {
        if (isset($this->members[$nick])) {
            log::info("removeMember($nick)");
            unset($this->members[$nick]);
            $this->state->isModified = true;
        }
    }
    
    public function clearMembers() {
        if (count($this->members) > 0) {
            log::info("clearMembers()");
            $this->members = array();
            $this->state->isModified = true;
        }
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
    
    private $state;
    
    public function spIrcChannelMemberDesc($state) {
        $this->state =& $state;
    }
}

// Describes a user on the IRC network.
class spIrcUserDesc {
    public $realname;
    public $host;
    public $mode;
    
    private $state;
    
    public function spIrcUserDesc($state) {
        $this->state =& $state;
    }
}

?>
