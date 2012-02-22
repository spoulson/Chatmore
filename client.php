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
if (isset($_GET['port'])) $opts['port'] = intval($_GET['port']);
    

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
            var ircElementTmpl = $('.chatmore').clone();
            
            var getChannelsFromHash = function () {
                var channels = document.location.hash.split(',');
                if (channels[0] == '') return [ ];
                else return channels;
            };
            
            var setHashWithChannels = function (channels) {
                var hash = channels.sort().join(',');
                if (document.location.hash !== hash) document.location.hash = hash;
            };

            var newViewKey = function () {
                return Math.random().toString(36).substr(2, 8);
            };
            
            var getQueryString = function () {
                var m = window.location.search.match(/^\?(.+)/);
                if (m) return m[1];
            };
            
            // http://stackoverflow.com/a/647272/3347
            var parseQueryString = function (qs) {
                var result = { };
                var queryString = location.search.substring(1);
                var re = /([^&=]+)=([^&]*)/g;
                var m;
                
                while (m = re.exec(queryString)) {
                    result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
                }

                return result;
            };
            
            var toQueryString = function (arr) {
                var args = [ ];
                for (var i in arr) {
                    var val = arr[i];
                    if (val === undefined || val === null)
                        args.push(encodeURIComponent(i));
                    else
                        args.push(encodeURIComponent(i) + '=' + encodeURIComponent(val));
                }
                
                return args.join('&');
            };

            var startClient = function (opts) {
                $('.chatmore').replaceWith(ircElementTmpl.clone());
                $('.chatmore')
                    .chatmore(opts)
                    .chatmore('stateChanged', function (e, state) {
                        if (window.console) console.log('User event: stateChanged');
                        setHashWithChannels(state.getChannels());
                    })
                    .chatmore('processedMessage', function (e, msg) {
                        if (msg.type === 'servermsg') {
                            if (msg.code === 402) {
                                // Session deleted.
                                var query = parseQueryString(getQueryString());
                                query['viewKey'] = newViewKey();

                                if (window.history.replaceState) {
                                    // HTML5: Restart client with new viewKey without reloading; update URL to reflect viewKey.
                                    var updatedUrl = document.location.pathname + '?' + toQueryString(query) + document.location.hash;
                                    window.history.replaceState(null, document.title, updatedUrl);
                                    opts.viewKey = query['viewKey'];
                                    startClient(opts);
                                }
                                else {
                                    // HTML4: Redirect back with new viewKey.
                                    warnOnUnload = false;
                                    document.location.search = '?' + toQueryString(query);
                                }
                            }
                        }
                    });
                    
                stretchClient();
            };

            // Stretch client element to width/height of browser window space.
            var stretchClient = function () {
                var ircElement = $('.chatmore');
                var atBottom = ircElement.chatmore('isAtBottom');
                
                ircElement.chatmore('resize', {
                    width: $(window).width() - ircElement.parent().outerWidth() + ircElement.parent().width(),
                    height: $(window).height() - ircElement.parent().outerHeight() + ircElement.parent().height()
                });
                
                if (atBottom) ircElement.chatmore('scrollToBottom');
            };
            
            $(window).resize(stretchClient);

            // Provide popup warning when navigating away from this page.
            var warnOnUnload = true;
            $(window).bind('beforeunload', function () {
                if (warnOnUnload) return 'You are about to navigate away from the Chatmore IRC client, which may disconnect from your session.';
            });

            // Prepare chatmore options.
            var opts = <?=json_encode($opts)?>;
            $.extend(opts, chatmoreDefaults);
            
            // Parse hash string for channels.
            var channels = getChannelsFromHash();
            if (channels.length > 0) opts.channel = channels;
            
            // Startup the IRC client.
            startClient(opts);
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
