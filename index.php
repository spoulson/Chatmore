<?

session_start();
if (array_key_exists('x', $_GET)) {
    unset($_SESSION['irc']);
}

?>
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
    <link rel="stylesheet" type="text/css" href="css/ui-darkness/jquery-ui-1.8.16.custom.css" />
    <link rel="stylesheet" type="text/css" href="ircweb2.css" />
    <script type="text/javascript" src="jquery-1.6.2.min.js"></script>
    <script type="text/javascript" src="jquery-ui-1.8.16.min.js"></script>
    <script type="text/javascript" src="jquery.tmpl.min.js"></script>
    <script type="text/javascript" src="ircweb2.js"></script>
</head>
<body>

    <div class="ircweb2">
        <div id="commandBar">
            <span id="connectionButtonset">
                <button id="activateButton">Activate</button>
                <button id="deactivateButton">Deactivate</button>
            </span>
        </div>

        <div style="float:left;overflow:hidden">
        
            <div id="ircTabs">
                <ul></ul>
            </div>

            <div id="userEntrySection" class="ui-widget ui-widget-content ui-corner-bl">
                <div id="userEntryModeLine">
                    <span id="nickLabel"></span>
                    <span id="targetFragment" style="display:none">
                        &rarr;
                        <span id="targetLabel"></span>
                    </span>
                </div>
                <div id="userEntryLine">
                    <input type="textbox" id="userEntry" />
                </div>
            </div>

        </div>
        
        <div id="sideBar" class="ui-widget ui-widget-content ui-corner-right">
        </div>
        
        <div id="templates" style="display:none">
            <div id="channelTmpl">
                <div class="ircChannel"></div>
            </div>
        </div>
    </div>
    
    <div id="connectionDialog"></div>
    
</body>
</html>
