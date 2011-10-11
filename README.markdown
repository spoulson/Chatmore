Chatmore web-based IRC client
=============================

Release 0.01, 2011-09-14  
Github repo: https://github.com/spoulson/Chatmore  
Shawn Poulson, http://explodingcoder.com

INTRODUCTION
------------

### What does Chatmore do?
 - Chatmore implements the IRC client protocol (RFC 2812) in order to chat in realtime on IRC chat networks.
 - Enables web-based IRC access where installation of a native client is prohibited or inconvenient.

### What *doesn't* Chatmore do?
 - Chatmore doesn't make IRC connections from the browser PC.  It only talks over HTTP(S) to the hosting web server.  The web server maintains the IRC connection.
 - Chatmore doesn't do everything because it's not finished.  It is under heavy development, so is currently considered alpha grade software.

### Why use Chatmore?
 - No end-user client installation.
 - Chatmore aims to be a better web IRC client.  At the time of writing, there are few alternatives for self-hosting web-based IRC clients.
 - You want to access IRC networks from anywhere there's a web browser, such as an Internet cafe, while using a computer that you don't own, etc.

### Why did you build this with PHP?
 - Other languages could be easier, better, faster, and more gooder.  However, half decent PHP web hosting is dirt cheap.

SYSTEM REQUIREMENTS
-------------------

### Server
 - PHP 5.2+.
 - Linux/Unix OS.  Windows is not supported.

### Client
 - Browser supporting HTML5.
 - Tested on browsers on Windows: Firefox 5+, Chrome 13+, IE9, Safari 5.1.

INSTALLATION
------------

- Copy all files to a web hosted directory.
- Customize settings in config.php.
- In a browser, access the directory's associated URL.

USER ACCESS
-----------
### In a browser, access the directory's associated URL.  
 Assuming the installed virtual directory is /chatmore.  

 Chatmore accepts access URLs in formats:

http://server/chatmore/  
Startup with defaults.

http://server/chatmore/?server=irc.example.com  
http://server/chatmore/?server=irc.example.com&nick=yournick  
http://server/chatmore/?server=irc.example.com&nick=yournick#channel
http://server/chatmore/?server=irc.example.com&nick=yournick#channel,#channel2

Connect to IRC server name.  
If nick is omitted, use randomly generated nick.  
If #channel is provided, join the channel(s) automatically.

### Alternatively, user friendly URLs:
http://server/irc.example.com  
http://server/irc.example.com/yournick  
http://server/irc.example.com/yournick#channel

To implement, update .htaccess in parent directory:  
Assuming /chatmore is the chat client virtual directory, append /.htaccess with:

    RewriteEngine On  
    # http://server/<IRC server>  
    RewriteRule ^/?([^/]*\.[^/]*)/?(#.+)?$ /chatmore/?server=$1$2  
    # http://server/<IRC server>/<nick>  
    RewriteRule ^/?([^/]*\.[^/]*)/([^/]+)[^#]*(#.+)?$ /chatmore/?server=$1&nick=$2$3

LICENSING
---------

Unless otherwise attributed, these works are licensed under the Creative Commons Attribution license:  
http://creativecommons.org/licenses/by/3.0/legalcode.
