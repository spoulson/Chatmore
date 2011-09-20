<?
// Rudimentary logging wrapper.
class log {
    public static $showInfo = true;
    
    public static function info($message) {
        if (!self::$showInfo) return;
        $script = $_SERVER['SCRIPT_NAME'];
        error_log(">>> " . $script . ": $message");
    }

    public static function error($message) {
        $script = $_SERVER['SCRIPT_NAME'];
        error_log("*** $script: $message");
    }
}
?>