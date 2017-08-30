2014-03-02

[方法]

TerminalShell
======

TerminalShell.commands.help(terminal)
    print commands list

TerminalShell.commands.clear(terminal)
    clear the screen

TerminalShell.process(terminal,cmd)
    execute commands

TerminalShell.filters [list]

Terminal
=====

Terminal.init()
    screen display initialization, bound keyboard event and keyboard input handler.

Terminal.setFocus()
    keep bottom

Terminal.setCursorState(state, fromTimeout)
    cursor blink

Terminal.updateInputDisplay()
    update screen display

Terminal.clearInputBuffer()
    clear inputline

Terminal.clear()
    clear screen

Terminal.addCharacter(character)
    input character

Terminal.deleteCharacter([true|false])
    delete the char that position of cursor when the argument is true otherwise delete the char before the position of cursor

Terminal.deleteWord()
    delete the world in inputline

Terminal.moveCursor(index)
    move the cursor

Terminal.setPos(index)
    set the cursor position,if the index out of the length of command buffer  and  index below zero then do nothing.

Terminal.moveHistory(number)
    move to the index of command history list 

Terminal.addHistory(cmd)
    append to the command history list

Terminal.jumpToBottom()
    focus to bottom

Terminal.jumpToTop()
    display scrool to top

Terminal.scrollPage(number)
    scroll the number of page

Terminal.scrollLine(number)
    scroll the distance equal number times Terminal.config.scroolStep

Terminal.print(text)
    print the content

Terminal.processInputBuffer()
    execute the Terminal.buffer command. Terminal.output = TerminalShell

Terminal.setPromptActive([true|false])
    prompt active or not

Terminal.setWorking([true|false])
    sign of loading 
    
Terminal.runCommand(cmd)
    emulate input cmd and run cmd
    
xkcd
=====

xkcd.get(num, success, error)

xkcdDisplay = TerminalShell.commands['display'](terminal, path)


[可输入命令]


xkcdDisplay
=======

next
previous,prev
first
latest|last
random
goto

commands TerminalShell.commands[cmd]
========
# reaple commands '!!'' to last command

sudo
shutdown|poweroff
restart|reboot
logout|exit|quit
cd
dir|ls
cat [^\d+alt.txt]
rm [-rf]
******
reddit [number]
write|irc [nickname]
unixkcd
wget|curl
apt-get [update|upgrage|dist-upgrade|moo|girfriend]
man
locate

Adventure
=========
look
go [down]
light [lamp]
sleep [time]



