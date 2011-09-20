<?

session_start();
if (array_key_exists('x', $_GET)) {
    unset($_SESSION['irc']);
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <link rel="stylesheet" type="text/css" href="css/ui-darkness/jquery-ui-1.8.16.custom.css" />
    <link rel="stylesheet" type="text/css" href="ircweb2.css" />
    <script type="text/javascript" src="jquery-1.6.2.min.js"></script>
    <script type="text/javascript" src="jquery-ui-1.8.16.min.js"></script>
    <script type="text/javascript" src="jquery.tmpl.min.js"></script>
    <script type="text/javascript" src="ircweb2.js"></script>
</head>
<body>

    <div class="ircweb2">
        <div class="commandBar">
            <span class="connectionButtonset">
                <button class="activateButton">Activate</button>
                <button class="deactivateButton">Deactivate</button>
            </span>
        </div>

        <div style="float:left;overflow:hidden">
        
            <div class="ircTabs">
                <ul></ul>
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
                    <input type="textbox" class="userEntry" />
                </div>
            </div>

        </div>
        
        <div class="sideBar ui-widget ui-widget-content ui-corner-right">
        </div>
        
        <div id="templates" style="display:none">
            <div class="channelTmpl">
                <div class="ircChannel"></div>
            </div>
        </div>
    </div>
    
    <div id="connectionDialog"></div>
    
</body>
</html>
