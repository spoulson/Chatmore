<?
require_once 'config.php';

session_start();

// If 'x' parameter exists in query string, reset session state.
if (array_key_exists('x', $_GET)) {
    unset($_SESSION['irc']);

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
    <link rel="stylesheet" type="text/css" href="css/ui-darkness/jquery-ui-1.8.16.custom.css" />
    <link rel="stylesheet" type="text/css" href="ircweb2.css" />
    <script type="text/javascript" src="jquery-1.6.2.min.js"></script>
    <script type="text/javascript" src="jquery-ui-1.8.16.min.js"></script>
    <script type="text/javascript" src="jquery.tmpl.min.js"></script>
    <script type="text/javascript" src="chatmore.js"></script>
    <script type="text/javascript" src="chatmoreUI.js"></script>
    <script type="text/javascript" src="config.js"></script>
    <script type="text/javascript">
        $(function () {
            // Determine padding+margin of BODY element.
            var paddingX = $(document.body).outerWidth() - $(document.body).width();
            var paddingY = $(document.body).outerHeight() - $(document.body).height();
            
            // Stretch client element to width/height of browser window space.
            var stretchClient = function () {
                //if (window.console) console.log('resize to: (' + $(window).width() + ',' + $(window).height() + ')');
                $('.ircweb2').chatmore('resize', {
                    width: $(window).width() - paddingX,
                    height: $(window).height() - paddingY
                });
            };
            
            $(window).resize(stretchClient);

            stretchClient();
        });
    </script>
</head>
<body>

    <div class="ircweb2 ui-widget">
        <div style="float:left;overflow:hidden">

            <div class="ircConsole ui-widget-content ui-corner-tl">
                <div class="content ui-corner-all"></div>
            </div>

            <div class="userEntrySection ui-widget ui-widget-content ui-corner-bl">
                <div class="userEntryModeLine">
                    <div class="activationIndicator"></div>
                    <span class="nickLabel"></span>
                    <span class="targetFragment" style="display:none">
                        &rarr;
                        <span class="targetLabel"></span>
                    </span>
                </div>
                <div class="userEntryLine">
                    <input type="text" class="userEntry" />
                </div>
            </div>
        </div>
        
        <div class="sideBar ui-widget ui-widget-content ui-corner-right">
            <ul class="channelList"></ul>
        </div>
    </div>
    
    <div id="connectionDialog"></div>
</body>
</html>
