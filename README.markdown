Chatmore web-based IRC client
=============================

Release 2013-03-15  
Github repo: https://github.com/spoulson/Chatmore  
Shawn Poulson, http://explodingcoder.com

INTRODUCTION
------------
### What does Chatmore do?
 - Chatmore implements the IRC client protocol (RFC 2812) in order to chat in realtime on IRC chat networks.
 - Enables web-based IRC access where installation of a native client is prohibited or inconvenient.
 - User interface is focused on simplistic and functional for ease of use.

### What *doesn't* Chatmore do?
 - Chatmore doesn't make IRC connections from the browser PC.  It only talks over HTTP(S) to the hosting web server.  The web server maintains the IRC connection.
 - There are no tabs or multiple chat windows.  All activity is in one view.
 - Chatmore doesn't do everything because it's not finished.  It is under heavy development, so is currently considered alpha grade software.

### Why use Chatmore?
 - No end-user client installation.  Minimal server requirements.
 - Chatmore aims to be a better web IRC client.  At the time of writing, there are few alternatives for self-hosting web-based IRC clients.
 - You want to access IRC networks from anywhere there's a web browser, such as an Internet cafe, while using a computer that you don't own, etc.

### Why did you build this with PHP?
 - Other languages could be easier, better, faster, and more gooder.  However, half decent PHP web hosting is dirt cheap.

FEATURES
--------
![Screenshot](http://i.imgur.com/14LWANvl.png)

### Tab Completion
 - Tab to reply to users who recently private messaged you.
 - As you type, nickname or channel autosuggestions may appear.  Tab to select one.
![Auto reply tab completion](http://i.imgur.com/1pXYLGJ.png)
![Autosuggest tab completion](http://i.imgur.com/fezDuz8.png)

### Show messages you missed
 - While the chat window does not have focus, incoming messages are highlighted.  When you return to the window, it's clear where you left off.
 - Title bar shows message count.

### Channel and nickname highlighting
 - Anywhere a channel or known nickname appears, it will be highlighted.
 - Nicknames are given a unique color.
 - Doubleclick a channel or nickname to /join or /query for chatting.

SYSTEM REQUIREMENTS
-------------------
### Server
 - PHP 5.2+.
 - Linux/Unix OS.  Windows is not supported.
   - Tested on Debian Linux 3.1, Apache 2.2, PHP 5.2.17

### Client
 - Browser supporting HTML5.
   - Tested browsers on Windows: Chrome 24, Firefox 5, IE9, Safari 5.1.
   - Tested browsers on Mac OS X: Chrome 24, Firefox 18.0.1, Safari 6.

INSTALLATION
------------
\# cd src  
\# make  
- Copy build/* files to a web hosted directory.
- Customize settings in config.php, if necessary.
- In a browser, access the directory's associated URL.

USER ACCESS
-----------
### In a browser, access the hosted URL.  
 Assuming the installed virtual directory is /chatmore.  

 Chatmore accepts access URLs in formats:

http://server/chatmore/  
View landing page, prompting for connection details.

http://server/chatmore/client.php?server=irc.example.com  
http://server/chatmore/client.php?server=irc.example.com&nick=yournick  
http://server/chatmore/client.php?server=irc.example.com&nick=yournick#channel  
http://server/chatmore/client.php?server=irc.example.com&nick=yournick#channel,#channel2  
http://server/chatmore/client.php?server=irc.example.com&port=6667&nick=yournick&realname=yourname#channel

If nick is omitted, use randomly generated nick.  
If #channel is provided, join the channel(s) automatically.

These querystring parameters will also work on the index.php landing page to show the values as defaults in the connection form fields.

KNOWN ISSUES
------------
- UI not compatible with Mobile Safari on iOS.

LICENSING
---------
Unless otherwise attributed, these works are licensed under the Creative Commons Attribution license:  
http://creativecommons.org/licenses/by/3.0/legalcode.
