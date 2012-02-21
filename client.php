<?
require_once 'config.php';

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
    <link rel="stylesheet" type="text/css" href="themes/atwood/atwood.css" />
    <script type="text/javascript" src="jquery-1.7.1.min.js"></script>
    <script type="text/javascript" src="jquery-ui-1.8.16.min.js"></script>
    <script type="text/javascript" src="jquery.tmpl.min.js"></script>
    <script type="text/javascript" src="chatmoreState.js"></script>
    <script type="text/javascript" src="chatmore.js"></script>
    <script type="text/javascript" src="chatmoreUI.js"></script>
    <script type="text/javascript" src="config.js"></script>
    <script type="text/javascript">
        $(function () {
            // Parse querystring.
            var opts = { };
            var form = { };
            var pairs = '<?=$_SERVER['QUERY_STRING']?>'.split('&');
            
            for (var i in pairs) {
                var pair = pairs[i].split('=');
                var key = decodeURIComponent(pair[0]);
                var value = decodeURIComponent(pair[1]);
                
                if (typeof(form[key]) === 'string') {
                    form[key] = [ form[key], value ];
                }
                else if (typeof(form[key]) === 'object') {
                    form[key].push(value);
                }
                else {
                    form[key] = value;
                }
                
                if (form.server !== undefined) opts.server = form.server;
                if (form.port !== undefined) opts.port = form.port;
                if (form.nick !== undefined) opts.nick = form.nick;
            }
            
            // Parse anchor string.
            var m = window.location.href.match(/(#.+)/);
            if (m !== null) {
                opts.channel = m[1].split(',');
            }
            
            // Determine if any options were set.
            // If not, assume defaults.
            var objectSize = function (obj) {
                var count = 0;
                for (var prop in obj) {
                    if (obj.hasOwnProperty(prop)) count++;
                }
                return count;
            };
            
            var clone;
            clone = function(obj) {
                var newObj = (obj instanceof Array) ? [] : {};
                for (i in obj) {
                    if (obj[i] && typeof(obj[i]) === "object")
                        newObj[i] = clone(obj[i]);
                    else
                        newObj[i] = obj[i];
                }
                return newObj;
            };
            
            if (objectSize(opts) == 0) opts = clone(chatmoreDefaults);
            else opts.mustMatchServer = true;
            
            // Startup the IRC client.
            var ircElement = $('.chatmore');
            ircElement.chatmore(opts);

            // Stretch client element to width/height of browser window space.
            var stretchClient = function () {
                var atBottom = ircElement.chatmore('isAtBottom');
                
                ircElement.chatmore('resize', {
                    width: $(window).width() - ircElement.parent().outerWidth() + ircElement.parent().width(),
                    height: $(window).height() - ircElement.parent().outerHeight() + ircElement.parent().height()
                });
                
                if (atBottom) ircElement.chatmore('scrollToBottom');
            };
            
            $(window).resize(stretchClient);

            stretchClient();
        });
    </script>
</head>
<body>

    <div class="chatmore ui-widget">
        <div style="float:left;overflow:hidden">

            <div class="ircConsole ui-widget-content ui-corner-tl">
                <div class="content ui-corner-all"></div>
            </div>

            <div class="userEntrySection ui-widget-content ui-corner-bl">
                <div class="userEntryModeLine">
                    <div class="activationIndicator"></div>
                    <div class="nickLabel nick"></div>
                    <div class="targetFragment" style="display:none">
                        <div class="targetLabel"></div>
                    </div>
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
