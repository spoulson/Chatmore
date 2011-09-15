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
    
    // User/channel modes array.
    // array(
    //    $nick => $,
    //    $channel => $
    // )
    public $modes = array();
    
    // Names array by channel.
    // array(
    //    $channel => array($nick, $nick, ...)
    // )
    public $names = array();

    // Array of spIrcChannelDesc objects.
    public $channels = array();
    
    public function spIrcClientState() {
        $this->sessionId = uniqid('', true);
    }
    
    public function getSocketFilename() {
        global $ircConfig;
        return $ircConfig['socketFilePath'] . '/ircweb2_' . $this->sessionId . '.sock';
    }
}

class spIrcChannelDesc {
    public $mode;
    public $topic;
    public $topicSetByNick;
    public $topicSetTime;
}
?>
