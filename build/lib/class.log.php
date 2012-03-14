<?
// Rudimentary logging wrapper.
class log {
    public static $showInfo = true;
    
    public static function info($message) {
        if (!self::$showInfo) return;
        error_log(sprintf('>>> %s(%d): %s',
            $_SERVER['SCRIPT_NAME'], getmypid(), $message));
    }

    public static function error($message) {
        error_log(sprintf('*** %s(%d): %s',
            $_SERVER['SCRIPT_NAME'], getmypid(), $message));
    }
}
?>