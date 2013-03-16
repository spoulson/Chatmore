<?
require_once 'class.spIrcSessionModel.php';

// Data access layer to session state storage with SQLite.
// Manages a SQLite database.
class spIrcSessionDAL_SQLite {
    const SCHEMA_VERSION = 261;

    private $filename;          // SQLite database filename.
    private $isValid = false;   // Has database been validated by validateDatabase()?
    private $id;                // Record id in Session table.

    //
    // Constructor.
    //
    public function __construct($filename, $viewKey) {
        global $ircConfig;

        // Get or create a session record by viewKey.
        // $filename: Pathname of SQLite database (created by createDatabase).
        $this->filename = $filename;
        if (!file_exists($filename)) $this->createDatabase($filename);

        // Lookup model, create new record if not found.
        $this->id = $this->lookupId($viewKey);
        if ($this->id === null) {
            // Not found, create record.
			log::info(sprintf("Creating new session record for viewKey=%s", $viewKey));
            $socketId = uniqid('', true);
            $model = new spIrcSessionModel();
            $model->viewKey = $viewKey;
            $model->sessionKey = session_id();
            $model->socketFilename = $ircConfig['socket_file_path'] . '/chatmore_' . $socketId . '.sock';
            log::info('state: ' . var_export($model, true));
            $this->id = $this->create($model);
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
            'SELECT id, viewKey, sessionKey, deleted, server, port, socketFilename, createdDate, lastAccessedDate, lastModifiedDate ' .
            'FROM Session ' .
            'WHERE ' .
            '    id = ? AND ' .
            '    sessionKey = ? ' .
            'LIMIT 1;');
        $st->execute(array($this->id, session_id()));
        $row = $st->fetch(PDO::FETCH_ASSOC);
        
        // Populate model object.
        $model = new spIrcSessionModel();
        $model->id = $row['id'];
        $model->viewKey = $row['viewKey'];
        $model->sessionKey = $row['sessionKey'];
        $model->deleted = $row['deleted'];
        $model->server = $row['server'];
        $model->port = $row['port'];
        $model->socketFilename = $row['socketFilename'];
        $model->createdDate = $row['createdDate'];
        $model->lastAccessedDate = $row['lastAccessedDate'];
        $model->lastModifiedDate = $row['lastModifiedDate'];
        
        // Update lastAccessedDate.
        $st = $db->prepare(
            'UPDATE Session ' .
            'SET lastAccessedDate = datetime(\'now\') ' .
            'WHERE ' .
            '    id = ? AND ' .
            '    sessionKey = ?;');
        $st->execute(array($this->id, session_id()));

        $db = null;

        return $model;
    }

    // $model expected to be an instance of spIrcServerStateModel.
    public function save($model) {
        $db = $this->openDatabase();
        if ($db === false) return false;

        $st = $db->prepare(
            'UPDATE Session ' .
            'SET ' .
            '    server = ?, ' .
            '    port = ?, ' .
            '    lastAccessedDate = datetime(\'now\') ' .
            'WHERE ' .
            '    id = ? AND ' .
            '    sessionKey = ?;');
        $st->execute(array(
            $model->server,
            $model->port,
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
                'SET ' .
                '    deleted = 1, ' .
                '    lastModifiedDate = datetime(\'now\') ' .
                'WHERE ' .
                '    id = ? AND ' .
                '    sessionKey = ?;');
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
    private function lookupId($viewKey) {
        $id = null;
        $db = $this->openDatabase();
        
        $st = $db->prepare(
            'SELECT id ' .
            'FROM Session ' .
            'WHERE ' .
            '    viewKey = ? AND ' .
            '    sessionKey = ?;');
        $st->execute(array($viewKey, session_id()));
		$value = $st->fetchColumn(0);
		if ($value !== FALSE) $id = $value;
        
        $db = null;
        
        //log::info(sprintf("lookupId(%s) with sessionKey=%s = %s", $viewKey, session_id(), var_export($id, true)));
        return $id;
    }
    
    // Create a new session record with spIrcServerStateModel object.
    private function create($model) {
        $id = false;
        
        log::info(sprintf('Creating session with viewKey=%s.', $model->viewKey));
        $db = $this->openDatabase();
        
        $modelData = serialize($model);

        $st = $db->prepare(
            'INSERT INTO Session (viewKey, sessionKey, server, port, socketFilename, createdDate, lastAccessedDate, lastModifiedDate) ' .
            'VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'), datetime(\'now\'));');
        $st->execute(array(
            $model->viewKey,
			$model->sessionKey,
            $model->server,
            $model->port,
            $model->socketFilename));
        log::info('Rows affected: ' . $st->rowCount());
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
            "    viewKey varchar(25) NOT NULL,\n" .
            "    sessionKey varchar(25) NOT NULL,\n" .
            "    deleted bit default(0) NOT NULL,\n" .
            "    server varchar(255) NULL,\n" .
            "    port int NULL,\n" .
            "    socketFilename varchar(255) NOT NULL,\n" .
            "    createdDate datetime NOT NULL,\n" .
            "    lastAccessedDate datetime NOT NULL,\n" .
            "    lastModifiedDate datetime NOT NULL\n" .
            ");\n" .
            "CREATE TABLE Config (\n" .
            "    schemaVersion int NOT NULL\n" .
            ");\n" .
            "INSERT INTO Config (schemaVersion)\n" .
            "VALUES (" . spIrcSessionDAL_SQLite::SCHEMA_VERSION . ");");

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
            
            // Rename old database file as backup; append schema version and timestamp.
            if (file_exists($this->filename)) {
                $schemaVersion = $this->getSchemaVersion($db);
                $oldDbFilename = $this->filename . '_' . $schemaVersion . '_' . date('Y-m-d_Hi');
                rename($this->filename, $oldDbFilename);
            }

            $db = null;
            
            $this->createDatabase($this->filename);
            
            $db = new PDO('sqlite:' . $this->filename);
            $this->isValid = true;
        }
        
        return $db;
    }
    
    private function getLastInsertId($db) {
        $st = $db->query('SELECT last_insert_rowid();');
        return $st->fetch(PDO::FETCH_COLUMN, 0);
    }
    
    private function getSchemaVersion($db) {
        $st = $db->query('SELECT schemaVersion FROM Config LIMIT 1;');
        $schemaVersion = $st->fetch(PDO::FETCH_COLUMN, 0);
        
        if ($schemaVersion === false) {
            log::info('Error retrieving the schema version.');
        }
        
        return $schemaVersion;
    }

    private function validateDatabase($db) {
        $rc = false;
        
        // Validate schema version.
        $schemaVersion = $this->getSchemaVersion($db);

        if ($schemaVersion === false) {
            log::info('Unable to validate database.');
        }
        else if ($schemaVersion != self::SCHEMA_VERSION) {
            log::info(sprintf("Schema version mismatch: Got %d when expecting %d.", $schemaVersion, self::SCHEMA_VERSION));
        }
        else {
            // Schema version OK.
            $rc = true;
        }
        
        return $rc;
    }
}

/*
Schema history:

-- Version 261:
-- Added Session.lastAccessedDate
CREATE TABLE Session (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    viewKey varchar(25) NOT NULL,
    sessionKey varchar(25) NOT NULL,
    deleted bit default(0) NOT NULL,
    server varchar(255) NULL,
    port int NULL,
    socketFilename varchar(255) NOT NULL,
    createdDate datetime NOT NULL,
    lastAccessedDate datetime NOT NULL,
    lastModifiedDate datetime NOT NULL
);

CREATE TABLE Config (
    schemaVersion int NOT NULL
);
--
Migrate SQL for previous schema data:
insert into db1.Session (viewKey, sessionKey, deleted, server, port, socketFilename, createdDate, lastAccessedDate, lastModifiedDate) select viewKey, sessionKey, deleted, server, port, socketFilename, createdDate, lastModifiedDate, lastModifiedDate from db2.Session;
--

-- Version 260:
CREATE TABLE Session (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    viewKey varchar(25) NOT NULL,
    sessionKey varchar(25) NOT NULL,
    deleted bit default(0) NOT NULL,
    server varchar(255) NULL,
    port int NULL,
    socketFilename varchar(255) NOT NULL,
    createdDate datetime NOT NULL,
    lastModifiedDate datetime NOT NULL
);

CREATE TABLE Config (
    schemaVersion int NOT NULL
);
--
*/
?>
