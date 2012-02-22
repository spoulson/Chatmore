<?
require_once 'class.spIrcSessionModel.php';

// Data access layer to session state storage with SQLite.
// Manages a SQLite database.
class spIrcSessionDAL_SQLite {
    const SCHEMA_VERSION = 0x102;   // Note, keep in sync with value inserted into Config in createDatabase().

    private $filename;          // SQLite database filename.
    private $isValid = false;   // Has database been validated by validateDatabase()?
    private $id;                // Record id in Session table.

    //
    // Constructor.
    //
    public function __construct() {
        global $ircConfig;
        $args = func_get_args();

        if (count($args) == 3) {
            // Constructor to create a session record from server/port arguments.
            // $filename: Pathname of SQLite database (created by createDatabase).
            list($filename, $server, $port) = $args;
            $this->filename = $filename;
            if (!file_exists($filename)) $this->createDatabase($filename);

            // Lookup model, create new record if not found.
            $this->id = $this->lookupId($server, $port);
            if ($this->id === null) {
				log::info("Creating new session record for server=" . $server . ", port=" . $port);
                $sessionId = uniqid('', true);
                $model = new spIrcSessionModel();
                $model->server = $server;
                $model->port = $port;
                $model->primarySocketFilename = $ircConfig['socketFilePath'] . '/chatmore_' . $sessionId . '1.sock';
                $model->secondarySocketFilename = $ircConfig['socketFilePath'] . '/chatmore_' . $sessionId . '2.sock';
                log::info('state: ' . var_export($model, true));
                $this->create($model);
            }
			else {
				log::info("Found session record id=" . $this->id . " for server=" . $server . ", port=" . $port);
			}
        }
        else if (count($args) == 2) {
            // Constructor to existing session record.
            list($filename, $id) = $args;
            $this->filename = $filename;
            if (!file_exists($filename)) $this->createDatabase($filename);
            
            $this->id = $id;
        }
        else {
            $message = sprintf('Constructor to %s called with unsupported number of arguments (%d).',
                get_class($this), count($args));
            throw new Exception($message);
        }
    }
    
    //
    // Public methods.
    //
    public function getId() {
        return $this->id;
    }
    
    // Returns spIrcServerStateModel object.
    public function load() {
        $db = $this->openDatabase();
        if ($db === false) return false;

        // Load model fields from database.
        $st = $db->prepare(
            'SELECT server, port, primarySocketFilename, secondarySocketFilename, deleted ' .
            'FROM Session ' .
            'WHERE ' .
            '    id = ? AND ' .
            '    sessionKey = ? ' .
            'LIMIT 1;');
        $st->execute(array($this->id, session_id()));
        $row = $st->fetch(PDO::FETCH_ASSOC);
        
        $db = null;

        // Populate model object.
        $model = new spIrcSessionModel();
        $model->server = $row['server'];
        $model->port = $row['port'];
        $model->primarySocketFilename = $row['primarySocketFilename'];
        $model->secondarySocketFilename = $row['secondarySocketFilename'];
        $model->deleted = $row['deleted'];
        
        return $model;
    }
    
    // $model expected to be an instance of spIrcServerStateModel.
    public function save($model) {
        $db = $this->openDatabase();
        if ($db === false) return false;

        $st = $db->prepare(
            'UPDATE Session ' .
            'SET ' .
            '    lastModifiedDate = datetime(\'now\') ' .
            'WHERE ' .
            '    id = ? AND ' .
            '    sessionKey = ?;');
        $st->execute(array(
            $this->id,
            session_id()));
        
        $rc = $st->rowCount() > 0;
        $db = null;
        
        return $rc;
    }
    
    // Delete this session record.
    public function delete() {
        log::info('Deleting session id ' . $this->id . '.');
        $rc = false;
        
        if ($this->id !== null) {
            $db = $this->openDatabase();
            if ($db === false) return false;
            
            $st = $db->prepare(
                'UPDATE Session ' .
                'SET deleted = 1, ' .
                '    lastModified = datetime(\'now\') ' .
                'WHERE ' .
                '    id = ? AND ' .
                '    sessionKey = ?;');
            log::info(sprintf('errorCode: %s, errorInfo: %s', $db->errorCode, $db->errorInfo));
            $st->execute(array($this->id, session_id()));
            
            $rc = $st->rowCount() > 0;
            log::info('Affected ' . $st->rowCount() . ' rows.');
            
            $db = null;
            
            // Invalidate this instance.
            $this->filename = null;
            $this->isValid = false;
            $this->id = null;
        }
        else {
            $rc = true;
        }
        
        return $rc;
    }
    
    // Delete and recreate session.
    public function reinitialize($model) {
        //$this->delete();
        //$this->create($model);
        $this->save($model);
    }
    
    //
    // Private Methods.
    //
    // Reverse lookup model, return id if found; NULL if not found.
    private function lookupId($server, $port) {
        $id = null;
        log::info("lookupId(" . $server . ", " . $port . ") by sessionKey=" . session_id());

        $db = $this->openDatabase();
        
        $st = $db->prepare(
            'SELECT id ' .
            'FROM Session ' .
            'WHERE ' .
            '    sessionKey = ? AND ' .
            '    server = ? AND ' .
            '    port = ? ' .
            'LIMIT 1;');
        $st->execute(array(session_id(), $server, $port));
		$value = $st->fetchColumn(0);
		if ($value !== FALSE) $id = $value;
        
        $db = null;
        
        log::info("lookupId() = " . var_export($id, true));
        return $id;
    }
    
    // Create a new session record with spIrcServerStateModel object.
    private function create($model) {
        $id = false;
        
        log::info(sprintf('Creating session to server %s:%d.', $model->server, $model->port));
        $db = $this->openDatabase();
        
        $modelData = serialize($model);

        $st = $db->prepare(
            'INSERT INTO Session (sessionKey, server, port, primarySocketFilename, secondarySocketFilename, createdDate, lastModifiedDate) ' .
            'VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'));');
        $st->execute(array(
			session_id(),
            $model->server,
            $model->port,
            $model->primarySocketFilename,
            $model->secondarySocketFilename));
        if ($st->rowCount() > 0) {
            $id = $this->getLastInsertId($db);
        }
        
        $db = null;
        
        log::info("Created session ID: " . var_export($id, true));
        $this->id = $id;
        return $id;
    }

    private function createDatabase($filename) {
        log::info(sprintf('Creating session database at path: "%s"', $filename));
        if (file_exists($filename) && unlink($filename) === FALSE) {
            log::error(sprintf('Unable to delete existing session database at path: "%s"', $filename));
            return;
        }
        
        $db = new PDO('sqlite:' . $filename);
        $db->exec(
            "CREATE TABLE Session (\n" .
            "    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,\n" .
            "    sessionKey varchar(25) NOT NULL,\n" .
            "    server varchar(255) NOT NULL,\n" .
            "    port int NOT NULL,\n" .
            "    primarySocketFilename varchar(255) NOT NULL,\n" .
            "    secondarySocketFilename varchar(255) NOT NULL,\n" .
            "    deleted bit default(0) NOT NULL,\n" .
            "    createdDate datetime NOT NULL,\n" .
            "    lastModifiedDate datetime NOT NULL\n" .
            ");\n" .
            "CREATE TABLE Config (\n" .
            "    schemaVersion int NOT NULL\n" .
            ");\n" .
            "INSERT INTO Config (schemaVersion)\n" .
            "VALUES (258);");

        $db = null;
    }

    private function openDatabase() {
        $db = new PDO('sqlite:' . $this->filename);

        // Ensure database is validated once per class instance.
        if ($this->isValid || $this->validateDatabase($db)) {
            $this->isValid = true;
        }
        else {
            // Recreate database.
            log::info(sprintf('Recreating database after validation error: "%s"', $this->filename));
            $db = null;
            $this->createDatabase($this->filename);
            $db = new PDO('sqlite:' . $this->filename);
        }
        
        return $db;
    }

    private function getLastInsertId($db) {
        $st = $db->query('SELECT last_insert_rowid();');
        return $st->fetch(PDO::FETCH_COLUMN, 0);
    }

    private function validateDatabase($db) {
        $rc = false;
        
        // Validate schema version.
        $st = $db->query(
            'SELECT schemaVersion ' .
            'FROM Config ' .
            'LIMIT 1;');
        $schemaVersion = $st->fetch(PDO::FETCH_COLUMN, 0);

        if ($schemaVersion === false) {
            log::info('Error retrieving the schema version.');
        }
        else if ($schemaVersion != self::SCHEMA_VERSION) {
            log::info(sprintf("Schema version mismatch: Got 0x%04X when expecting 0x%04X.", $schemaVersion, self::SCHEMA_VERSION));
        }
        else {
            // Schema version OK.
            $rc = true;
        }
        
        return $rc;
    }
}
?>
