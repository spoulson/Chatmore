<?
function redirectNewViewKey() {
    // Generate random viewKey string.
    $viewKey = substr(base_convert(rand(0, 1679616), 10, 36) . base_convert(rand(0, 1679616), 10, 36), 0, 8);
    $_GET['viewKey'] = $viewKey;
    $redirectUrl = $_SERVER['SCRIPT_URI'] . '?' . http_build_query($_GET);
    
    header('Location: ' . $redirectUrl);
}

// Check for viewKey in querystring.
// If not found, generate one and redirect back with viewKey included.
if (!isset($_GET['viewKey'])) {
    redirectNewViewKey();
    exit;
}

require_once 'config.php';

// Parse querystring into options array to pass to chatmore.
$opts = array(
    'viewKey' => $_GET['viewKey']
);

if (isset($_GET['nick'])) $opts['nick'] = $_GET['nick'];
if (isset($_GET['realname'])) $opts['realname'] = $_GET['realname'];
if (isset($_GET['server'])) $opts['server'] = $_GET['server'];
if (isset($_GET['port'])) $opts['port'] = $_GET['port'];

session_start();

// If 'x' parameter exists in query string, reset session state.
if (array_key_exists('x', $_GET)) {
    session_destroy();

    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Experimental IRC chat client</title>
    <base href="<?=$scriptPath?>/" />
    <link rel="stylesheet" type="text/css" href="style.css" />
    <link rel="stylesheet" type="text/css" href="jqueryui/default/default.css" />
    <link rel="stylesheet" type="text/css" href="layouts/fullpage/fullpage.css" />
    <script type="text/javascript" src="jquery-1.7.1.min.js"></script>
    <script type="text/javascript" src="jquery-ui-1.8.16.min.js"></script>
    <script type="text/javascript" src="jquery.tmpl.min.js"></script>
    <!--<script type="text/javascript" src="chatmoreState.js"></script>
    <script type="text/javascript" src="chatmore.js"></script>
    <script type="text/javascript" src="chatmoreUI.js"></script>
    <script type="text/javascript" src="chatmoreUI.fullpage.js"></script>-->
    <script type="text/javascript" src="chatmoreAll.min.js"></script>
    <script type="text/javascript" src="config.js"></script>
    <script type="text/javascript">
        $(function () {
            // Prepare chatmore options.
            var opts = $.extend({ }, chatmoreDefaults);
            var userOpts = <?=json_encode($opts)?>;
            $.extend(opts, userOpts);
            
            // Startup the IRC client.
            $('#chatmore').chatmore(opts);
        });
    </script>
</head>
<body>

    <div id="chatmore"></div>
    <div id="connectionDialog"></div>
</body>
</html>
