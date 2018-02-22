/*  
 Client-side logic for Wordpress CLI theme
 R. McFarland, 2006, 2007, 2008
 http://thrind.xamai.ca/
 
 jQuery rewrite and overhaul
 Chromakode, 2010
 http://www.chromakode.com/
*/
/**** start from http://snippets.dzone.com/posts/show/701 ****/
// Removes leading whitespaces
function ltrim(value) {
    if (value) {
        var re = /\s*((\S+\s*)*)/;
        return value.replace(re, '$1');
    }
    return '';
}

// Removes ending whitespaces
function rtrim(value) {
    if (value) {
        var re = /((\s*\S+)*)\s*/;
        return value.replace(re, '$1');
    }
    return '';
}

// Removes leading and ending whitespaces
function trim(value) {
    if (value) {
        return ltrim(rtrim(value));
    }
    return '';
} /**** end from http://snippets.dzone.com/posts/show/701 ****/

function entityEncode(str) {
    str = str.replace(/&/g, '&amp;');
    str = str.replace(/</g, '&lt;');
    str = str.replace(/>/g, '&gt;');
    str = str.replace(/  /g, ' &nbsp;');
    if (/msie/i.test(navigator.userAgent)) {
        str = str.replace('\n', '&nbsp;<br />');
    } else {
        str = str.replace(/\x0D/g, '&nbsp;<br />');
    }
    return str;
}

var TerminalShell = {
    commands: {
        help: function(terminal) {
            terminal.print($('<h3>help</h3>'));
            cmd_list = $('<ul>');
            $.each(this.commands, function(name, func) {
                cmd_list.append($('<li>').text(name));
            });
            terminal.print(cmd_list);
        }, 
        clear: function(terminal) {
            terminal.clear();
        }
    },
    filters: [],
    fallback: null,
    lastCommand: null,
    process: function(terminal, cmd) {
        try {
            $.each(this.filters, $.proxy(function(index, filter) {
                cmd = filter.call(this, terminal, cmd);
            }, this));
            var cmd_args = cmd.split(' ');
            var cmd_name = cmd_args.shift();
            cmd_args.unshift(terminal);
            if (this.commands.hasOwnProperty(cmd_name)) {
                this.commands[cmd_name].apply(this, cmd_args);
            } else {
                if (!(this.fallback && this.fallback(terminal, cmd))) {
                    terminal.print('Unrecognized command. Type "help" for assistance.');
                }
            }
            this.lastCommand = cmd;
        } catch (e) {
            terminal.print($('<p>').addClass('error').text('An internal error occured: '+e));
            terminal.setWorking(false);
        }
    }
};
var Terminal = {
    buffer: '',
    pos: 0,
    history: [],
    historyPos: 0,
    promptActive: true,
    cursorBlinkState: true,
    _cursorBlinkTimeout: null,
    spinnerIndex: 0,
    _spinnerTimeout: null,
    output: TerminalShell,
    lastcompletion: '',
    
    config: {
        scrollStep:         20,
        scrollSpeed:        100,
        bg_color:           '#000',
        fg_color:           '#FFF',
        cursor_blink_time:  700,
        cursor_style:       'block',
        prompt:             'guest@'+location.hostname+':/$ ',
        spinnerCharacters:  ['[   ]','[.  ]','[.. ]','[...]'],
        spinnerSpeed:       250,
        typingSpeed:        50
    },
    
    sticky: {
        keys: {
            ctrl: false,
            alt: false,
            scroll: false
        },
        
        set: function(key, state) {
            this.keys[key] = state;
            $('#'+key+'-indicator').toggle(this.keys[key]);
        },
        
        toggle: function(key) {
            this.set(key, !this.keys[key]);
        },
        
        reset: function(key) {
            this.set(key, false);
        },
        
        resetAll: function(key) {
            $.each(this.keys, $.proxy(function(name, value) {
                this.reset(name);
            }, this));
        }
    },
    
    init: function() {
        function ifActive(func) {
            return function() {
                if (Terminal.promptActive) {
                    // console.log('ifActive',func,this,arguments);
                    func.apply(this, arguments);//?
                }
            };
        }
        // pc
        $(document)
            .keypress($.proxy(ifActive(function(e){
                this.setFocus();
                // console.log('press',e.which,e.target);
                if (e.which >= 32 && e.which <= 126) {   
                    var character = String.fromCharCode(e.which);
                    // console.log('char',character);
                    var letter = character.toLowerCase();
                } else {
                    return;
                };
                if ($.browser.opera && !(/[\w\s]/.test(character))) {
                    return; // sigh.
                };
                if (this.sticky.keys.ctrl) {
                    if (letter == 'w') {
                        this.deleteWord();
                    } else if (letter == 'h') {
                        Terminal.deleteCharacter(false);
                    } else if (letter == 'l') {
                        this.clear();
                    } else if (letter == 'a') {
                        this.setPos(0);
                    } else if (letter == 'e') {
                        this.setPos(this.buffer.length);
                    } else if (letter == 'd') {
                        this.runCommand('logout');
                    }
                } else {
                    if (character) {
                        this.addCharacter(character);
                        e.preventDefault();
                    }
                }
            }), this))
            // .on('keydown',function(e){console.log('document',e.which,e.target);})
            // .bind('keydown', '=', function(e){console.log('command',e)})
            .bind('keydown', 'return', ifActive(function(e) { Terminal.processInputBuffer(); }))
            .bind('keydown', 'backspace', ifActive(function(e) { e.preventDefault();Terminal.deleteCharacter(e.shiftKey); }))
            .bind('keydown', 'del', ifActive(function(e) { Terminal.deleteCharacter(true); }))
            .bind('keydown', 'left', ifActive(function(e) { Terminal.moveCursor(-1); }))
            .bind('keydown', 'right', ifActive(function(e) { Terminal.moveCursor(1); }))
            .bind('keydown', 'up', ifActive(function(e) {
                e.preventDefault();
                if (e.shiftKey || Terminal.sticky.keys.scroll) {
                    Terminal.scrollLine(-1);
                } else if (e.ctrlKey || Terminal.sticky.keys.ctrl) {
                    Terminal.scrollPage(-1);
                } else {
                    Terminal.moveHistory(-1);
                }
            }))
            .bind('keydown', 'down', ifActive(function(e) {
                e.preventDefault();
                if (e.shiftKey || Terminal.sticky.keys.scroll) {
                    Terminal.scrollLine(1);
                } else if (e.ctrlKey || Terminal.sticky.keys.ctrl) {
                    Terminal.scrollPage(1);
                } else {
                    Terminal.moveHistory(1);
                }
            }))
            .bind('keydown', 'pageup', ifActive(function(e) { Terminal.scrollPage(-1); }))
            .bind('keydown', 'pagedown', ifActive(function(e) { Terminal.scrollPage(1); }))
            .bind('keydown', 'home', ifActive(function(e) {
                e.preventDefault();
                if (e.ctrlKey || Terminal.sticky.keys.ctrl) {
                    Terminal.jumpToTop();
                } else {
                    Terminal.setPos(0);
                }
            }))
            .bind('keydown', 'end', ifActive(function(e) {
                e.preventDefault();
                if (e.ctrlKey || Terminal.sticky.keys.ctrl) {
                    Terminal.jumpToBottom();
                } else {
                    Terminal.setPos(Terminal.buffer.length);
                }
            }))
            .bind('keydown', 'tab', function(e) {
                e.preventDefault();
                Terminal.autocomplete()
            })
            .keyup(function(e) {
                var keyName = $.hotkeys.specialKeys[e.which];
                if (keyName in {'ctrl':true, 'alt':true, 'scroll':true}) {
                    Terminal.sticky.toggle(keyName);
                } else if (!(keyName in {'left':true, 'right':true, 'up':true, 'down':true})) {
                    Terminal.sticky.resetAll();
                }
            });
        // mobile client
        $('.clipboard')
            .bind('keydown', 'return', function(e) { Terminal.processInputBuffer(); })
            .bind('keydown', 'backspace',function(e){e.preventDefault();Terminal.deleteCharacter(e.shiftKey);})
        // keep bottom
        $(window).resize(this.setFocus);
        this.setCursorState(true);
        this.setWorking(false);
        $('#prompt').html(this.config.prompt);
        $('#screen').hide().fadeIn('fast', function() {
            $('#screen').triggerHandler('cli-load');
        });
    },

    setFocus: function(){
        $('#screen').scrollTop($('#screen')[0].scrollHeight);
    },
    
    setCursorState: function(state, fromTimeout) {
        this.cursorBlinkState = state;
        if (this.config.cursor_style == 'block') {
            if (state) {
                $('#cursor').css({color:this.config.bg_color, backgroundColor:this.config.fg_color});
            } else {
                $('#cursor').css({color:this.config.fg_color, background:'none'});
            }
        } else {
            if (state) {
                $('#cursor').css('textDecoration', 'underline');
            } else {
                $('#cursor').css('textDecoration', 'none');
            }
        }
        
        // (Re)schedule next blink.
        if (!fromTimeout && this._cursorBlinkTimeout) {
            window.clearTimeout(this._cursorBlinkTimeout);
            this._cursorBlinkTimeout = null;
        }
        this._cursorBlinkTimeout = window.setTimeout($.proxy(function() {
            this.setCursorState(!this.cursorBlinkState, true);
        },this), this.config.cursor_blink_time);
    },
    
    updateInputDisplay: function() {
        var left = '', underCursor = ' ', right = '';

        if (this.pos < 0) {
            this.pos = 0;
        }
        if (this.pos > this.buffer.length) {
            this.pos = this.buffer.length;
        }
        if (this.pos > 0) {
            left = this.buffer.substr(0, this.pos);
        }
        if (this.pos < this.buffer.length) {
            underCursor = this.buffer.substr(this.pos, 1);
        }
        if (this.buffer.length - this.pos > 1) {
            right = this.buffer.substr(this.pos + 1, this.buffer.length - this.pos - 1);
        }

        $('#lcommand').text(left);
        $('#cursor').text(underCursor);
        if (underCursor == ' ') {
            $('#cursor').html('&nbsp;');
        }
        $('#rcommand').text(right);
        $('#prompt').text(this.config.prompt);
        return;
    },
    
    clearInputBuffer: function() {
        this.buffer = '';
        this.pos = 0;
        this.updateInputDisplay();
    },
    
    clear: function() {
        $('#display').html('');
    },
    
    addCharacter: function(character) {
        var left = this.buffer.substr(0, this.pos);
        var right = this.buffer.substr(this.pos, this.buffer.length - this.pos);
        this.buffer = left + character + right;
        this.pos++;
        this.updateInputDisplay();
        this.setCursorState(true);
    },
    
    deleteCharacter: function(forward) {
        var offset = forward ? 1 : 0;
        if (this.pos >= (1 - offset)) {
            var left = this.buffer.substr(0, this.pos - 1 + offset);
            var right = this.buffer.substr(this.pos + offset, this.buffer.length - this.pos - offset);
            this.buffer = left + right;
            this.pos -= 1 - offset;
            this.updateInputDisplay();
        }
        this.setCursorState(true);
    },
    
    deleteWord: function() {
        if (this.pos > 0) {
            var ncp = this.pos;
            while (ncp > 0 && this.buffer.charAt(ncp) !== ' ') {
                ncp--;
            }
            left = this.buffer.substr(0, ncp - 1);
            right = this.buffer.substr(ncp, this.buffer.length - this.pos);
            this.buffer = left + right;
            this.pos = ncp;
            this.updateInputDisplay();
        }
        this.setCursorState(true);
    },
    
    moveCursor: function(val) {
        this.setPos(this.pos + val);
    },
    
    setPos: function(pos) {
        if ((pos >= 0) && (pos <= this.buffer.length)) {
            this.pos = pos;
            Terminal.updateInputDisplay();
        }
        this.setCursorState(true);
    },
    
    moveHistory: function(val) {
        var newpos = this.historyPos + val;
        if ((newpos >= 0) && (newpos <= this.history.length)) {
            if (newpos == this.history.length) {
                this.clearInputBuffer();
            } else {
                this.buffer = this.history[newpos];
            }
            this.pos = this.buffer.length;
            this.historyPos = newpos;
            this.updateInputDisplay();
            this.jumpToBottom();
        }
        this.setCursorState(true);
    },
    
    addHistory: function(cmd) {
        this.historyPos = this.history.push(cmd);
    },

    jumpToBottom: function() {
        $('#screen').animate({scrollTop: $('#screen')[0].scrollHeight}, this.config.scrollSpeed, 'linear');
    },

    jumpToTop: function() {
        $('#screen').animate({scrollTop: 0}, this.config.scrollSpeed, 'linear');
    },
    
    scrollPage: function(num) {
        $('#screen').animate({scrollTop: $('#screen').scrollTop() + num * ($('#screen').height() * .75)}, this.config.scrollSpeed, 'linear');
    },

    scrollLine: function(num) {
        $('#screen').scrollTop($('#screen').scrollTop() + num * this.config.scrollStep);
    },

    print: function(text) {
        if (!text) {
            $('#display').append($('<div>'));
        } else if( text instanceof jQuery ) {
            $('#display').append(text);
        } else {
            var av = Array.prototype.slice.call(arguments, 0);
            $('#display').append($('<p>').text(av.join(' ')));
        }
        this.jumpToBottom();
    },
    
    processInputBuffer: function() {
        this.print($('<p>').addClass('command').text(this.config.prompt + this.buffer));
        var cmd = trim(this.buffer);
        this.clearInputBuffer();
        if (cmd.length == 0) {
            return false;
        }
        this.addHistory(cmd);
        if (this.output) {
            return this.output.process(this, cmd);//TerminalShell.process
        } else {
            return false;
        }
    },
    
    setPromptActive: function(active) {
        this.promptActive = active;
        $('#inputline').toggle(this.promptActive);
    },
    
    setWorking: function(working) {
        if (working && !this._spinnerTimeout) {
            $('#display .command:last-child').add('#bottomline').first().append($('#spinner'));
            this._spinnerTimeout = window.setInterval($.proxy(function() {
                if (!$('#spinner').is(':visible')) {
                    $('#spinner').fadeIn();
                }
                this.spinnerIndex = (this.spinnerIndex + 1) % this.config.spinnerCharacters.length;
                $('#spinner').text(this.config.spinnerCharacters[this.spinnerIndex]);
            },this), this.config.spinnerSpeed);
            this.setPromptActive(false);
            $('#screen').triggerHandler('cli-busy');
        } else if (!working && this._spinnerTimeout) {
            clearInterval(this._spinnerTimeout);
            this._spinnerTimeout = null;
            $('#spinner').fadeOut();
            this.setPromptActive(true);
            $('#screen').triggerHandler('cli-ready');
        }
    },
    
    runCommand: function(text) {
        var index = 0;
        var mine = false;
        
        this.promptActive = false;
        var interval = window.setInterval($.proxy(function typeCharacter() {
            if (index < text.length) {
                this.addCharacter(text.charAt(index));
                index += 1;
            } else {
                clearInterval(interval);
                this.promptActive = true;
                this.processInputBuffer();
            }
        }, this), this.config.typingSpeed);
    },

    autocomplete: function(){
        var lookup = this.buffer.substr(0,this.pos)
        if(lookup.length > 0 && this.output.commands){
            var potentials = Object.keys(this.output.commands).filter(
                $.proxy(function(x){
                    return lookup  == x.substr(0,lookup.length)
                }), this).sort();
            if(potentials.length > 0){
                var newloc = potentials.indexOf(this.lastcompletion)+1
                if(newloc == potentials.length){newloc = 0;}
                this.lastcompletion = potentials[newloc];
                this.buffer = this.lastcompletion;
                this.updateInputDisplay();
            }
            
        }
    }
};

// xkcd_cli
function pathFilename(path) {
    var match = /\/([^\/]+)$/.exec(path);
    if (match) {
        return match[1];
    }
}

function getRandomInt(min, max) {
    // via https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Math/random#Examples
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
    return items[getRandomInt(0, items.length-1)];
}

var xkcd = {
    latest: null,
    last: null,
    cache: {},
    base: '//dynamic.xkcd.com/api-0/jsonp/comic/',
    
    get: function(num, success, error) {
        if (num == null) {
            path = '';
        } else if (Number(num)) {
            path = String(num);
        } else {
            error(false);
            return false;
        }

        if (num in this.cache) {
            this.last = this.cache[num];
            success(this.cache[num]);
        } else {
            return $.ajax({
                url: this.base+path,
                dataType: 'jsonp',
                success: $.proxy(function(data) {
                    this.last = this.cache[num] = data;
                    success(data);
                }, this),
                fail: error});
        }
    }
};
//xkcdDisplay commands
var xkcdDisplay = TerminalShell.commands['display'] = function(terminal, path) {
    function fail() {
        terminal.print($('<p>').addClass('error').text('display: unable to open image "'+path+'": No such file or directory.'));
        terminal.setWorking(false);
    }
            
    if (path) {
        var num = Number(String(path).match(/^\d+/));
        // filename = pathFilename(path); 
        if (num > xkcd.latest.num) {
            terminal.print("Time travel mode not enabled.");
            return;
        }
    } else {
        var num = xkcd.last.num;
    }
    
    terminal.setWorking(true);
    xkcd.get(num, function(data) {
        // if (!filename || (filename == pathFilename(data.img))) {
        if(data.img){
            $('<img>')
                .hide()
                .load(function() {
                    terminal.print($('<h3>').text(data.num+": "+data.title));
                    $(this).fadeIn();
                    
                    var comic = $(this);
                    if (data.link) {
                        comic = $('<a>').attr('href', data.link).append($(this));
                    }
                    terminal.print(comic);
                    
                    terminal.setWorking(false);
                })
                .attr({src:data.img, alt:data.title, title:data.alt})
                .addClass('comic');
        } else {
            fail();
        }
    }, fail);
};

TerminalShell.commands['next'] = function(terminal) {
    xkcdDisplay(terminal, xkcd.last.num+1);
};

TerminalShell.commands['previous'] =
TerminalShell.commands['prev'] = function(terminal) {
    xkcdDisplay(terminal, xkcd.last.num-1);
};

TerminalShell.commands['first'] = function(terminal) {
    xkcdDisplay(terminal, 1);
};

TerminalShell.commands['latest'] =
TerminalShell.commands['last'] = function(terminal) {
    xkcdDisplay(terminal, xkcd.latest.num);
};

TerminalShell.commands['random'] = function(terminal) {
    xkcdDisplay(terminal, getRandomInt(1, xkcd.latest.num));
};

TerminalShell.commands['goto'] = function(terminal, subcmd) {
    $('#screen').one('cli-ready', function(e) {
        terminal.print('Did you mean "display"?');
    });
    xkcdDisplay(terminal, 292);
};

// terminal commands
TerminalShell.commands['sudo'] = function(terminal) {
    var cmd_args = Array.prototype.slice.call(arguments);
    cmd_args.shift(); // terminal
    if (cmd_args.join(' ') == 'make me a sandwich') {
        terminal.print('Okay.');
    } else {
        var cmd_name = cmd_args.shift();
        cmd_args.unshift(terminal);
        cmd_args.push('sudo');
        if (TerminalShell.commands.hasOwnProperty(cmd_name)) {
            this.sudo = true;
            // apply
            this.commands[cmd_name].apply(this, cmd_args);
            delete this.sudo;
        } else if (!cmd_name) {
            terminal.print('sudo what?');
        } else {
            terminal.print('sudo: '+cmd_name+': command not found');
        }
    }
};

// '!!' execute last command
TerminalShell.filters.push(function (terminal, cmd) {
    if (/!!/.test(cmd)) {
        var newCommand = cmd.replace('!!', this.lastCommand);
        terminal.print(newCommand);
        return newCommand;
    } else {
        return cmd;
    }
});


// shut down 
TerminalShell.commands['shutdown'] = TerminalShell.commands['poweroff'] = function(terminal) {
    if (this.sudo) {
        terminal.print('Bye Bye!');
        terminal.print();
        terminal.print('please enter "ctrl + w" ');
        return $('#screen').fadeOut();
    } else {
        terminal.print('Must be root.');
    }
};

TerminalShell.commands['restart'] = TerminalShell.commands['reboot'] = function(terminal) {
    if (this.sudo) {
        TerminalShell.commands['poweroff'](terminal).queue(function(next) {
            window.location.reload();
        });
    } else {
        terminal.print('Must be root.');
    }
};

TerminalShell.commands['logout'] =
TerminalShell.commands['exit'] = 
TerminalShell.commands['quit'] = function(terminal) {
    terminal.print('Bye.');
    $('#prompt, #cursor').hide();
    terminal.promptActive = false;
};


// open url
function linkFile(url) {
    return {type:'dir', enter:function() {
        window.location = url;
    }};
}

// file system
Filesystem = {
    'readme.txt': {type:'file', read:function(terminal) {
        terminal.print($('<h3>').text('1.Terminal emulator by Javascript'));
        terminal.print('use `cd`,`ls`,`cat`,`rm`,`apt-get`,`wget`,`man`,`locate`,`sudo` command just like use *nix !');
        terminal.print('or some other command you even can\'t imagine it.Have fun!');
        terminal.print($('<h3>').text('2.A xkcd comic view'));
        terminal.print('use `display [number]` to show xkcd comic,`next` and `prev` for page turning');
        terminal.print($('<h3>').text('3.Adventure game'));
        terminal.print('use `look` `go [east|wast|north|south]` to move ');
        terminal.print();
    }},
    'license.txt': {type:'file', read:function(terminal) {
        terminal.print($('<h2>').html('fork from <a href="https://github.com/chromakode/xkcdfools">chromakode / xkcdfools</a>'))
        terminal.print($('<p>').html('Client-side logic for Wordpress CLI theme :: <a href="http://thrind.xamai.ca/">R. McFarland, 2006, 2007, 2008</a>'));
        terminal.print($('<p>').html('jQuery rewrite and overhaul :: <a href="http://www.chromakode.com/">Chromakode, 2010</a>'));
        terminal.print();
        $.each([
            'This program is free software; you can redistribute it and/or',
            'modify it under the terms of the GNU General Public License',
            'as published by the Free Software Foundation; either version 2',
            'of the License, or (at your option) any later version.',
            '',
            'This program is distributed in the hope that it will be useful,',
            'but WITHOUT ANY WARRANTY; without even the implied warranty of',
            'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
            'GNU General Public License for more details.',
            '',
            'You should have received a copy of the GNU General Public License',
            'along with this program; if not, write to the Free Software',
            'Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.'
        ], function(num, line) {
            terminal.print(line);
        });
    }},
    'Contact': {type:'path',links:{
            weibo:'',
            github:'',
            douban:'',
            v2ex:'',
            twitter:'',
            mail:''
        }
    }
};
Filesystem['blog']   = linkFile('http://blog.xavierskip.com');
Filesystem['mail']   = linkFile('mailto:xavierskip@gmail.com');
Filesystem['telegram']   = linkFile('https://telegram.me/skipto');


TerminalShell.pwd = Filesystem; // this.pwd = Filrsystem

TerminalShell.commands['cd'] = function(terminal, path) {
    if (path in this.pwd) {
        if (this.pwd[path].type == 'dir') {
            this.pwd[path].enter(terminal);
        } else if (this.pwd[path].type == 'file') {
            terminal.print('cd: '+path+': Not a directory');
        }
    } else {
        terminal.print('cd: '+path+': No such file or directory');
    }
};

TerminalShell.commands['dir'] =
TerminalShell.commands['ls'] = function(terminal, path) {
    var name_list = $('<ul>');
    $.each(this.pwd, function(name, obj) {
        if (obj.type == 'dir') {
            name += '/';
        }
        name_list.append($('<li>').text(name));
    });
    terminal.print(name_list);
};

TerminalShell.commands['cat'] = function(terminal, path) {
    if (path in this.pwd) {
        if (this.pwd[path].type == 'file') {
            this.pwd[path].read(terminal);
        } else if (this.pwd[path].type == 'dir') {
            terminal.print('cat: '+path+': Is a directory');
        }
    } else if (pathFilename(path) == 'alt.txt') { //xkcd comic
        terminal.setWorking(true);
        num = Number(path.match(/^\d+/));
        if (num > xkcd.latest.num) {
            terminal.print("Time travel mode not enabled.");
            return;
        }
        xkcd.get(num, function(data) {
            terminal.print(data.alt);
            terminal.setWorking(false);
        }, function() {
            terminal.print($('<p>').addClass('error').text('cat: "'+path+'": No such file or directory.'));
            terminal.setWorking(false);
        });
    } else {
        terminal.print('no cat!');
    }
};

TerminalShell.commands['rm'] = function(terminal, flags, path) {
    if (flags && flags[0] != '-') {
        path = flags;
    }
    if (!path) {
        terminal.print('rm: missing operand');
    } else if (path in this.pwd) {
        if (this.pwd[path].type == 'file') {
            delete this.pwd[path];
        } else if (this.pwd[path].type == 'dir') {
            if (/r/.test(flags)) {
                delete this.pwd[path];
            } else {
                terminal.print('rm: cannot remove '+path+': Is a directory');
            }
        }
    } else if (flags == '-rf' && path == '/') {
        if (this.sudo) {
            TerminalShell.commands = {};
        } else {
            terminal.print('哼！自己开个虚拟机去试，别在这里');
        }
    }
};

TerminalShell.commands['******'] = function(terminal) {
    // termainal.************
    terminal.print($('<a>').text('*** FREE SHIPPING ENABLED ***').attr('href', 'http://store.xkcd.com/'));
}; 

TerminalShell.commands['reddit'] = function(terminal, num) {
    num = Number(num);
    if (num) {
        url = 'http://xkcd.com/'+num+'/';
    } else {
        var url = window.location;
    }
    terminal.print($('<iframe src="http://www.reddit.com/static/button/button1.html?width=140&url='+encodeURIComponent(url)+'&newwindow=1" height="22" width="140" scrolling="no" frameborder="0"></iframe>'));
};

TerminalShell.commands['write'] =
TerminalShell.commands['irc'] = function(terminal, nick) {
    if (nick) {
        $('.irc').slideUp('fast', function() {
            $(this).remove();
        });
        var url = "http://widget.mibbit.com/?server=irc.foonetic.net&channel=%23xkcd";
        if (nick) {
            url += "&nick=" + encodeURIComponent(nick);
        }
        TerminalShell.commands['curl'](terminal, url).addClass('irc');
    } else {
        terminal.print('usage: irc <nick>');
    }
};
TerminalShell.commands['unixkcd'] = function(terminal) {
    TerminalShell.commands['curl'](terminal, "http://www.xkcd.com/unixkcd/");
};

TerminalShell.commands['wget'] = TerminalShell.commands['curl'] = function(terminal, dest) {
    if (dest) {
        terminal.setWorking(true);
        var browser = $('<div>')
            .addClass('browser')
            .append($('<iframe>')
                    .attr('src', dest).width("100%").height(600)
                    .one('load', function() {
                        terminal.setWorking(false);
                    }));
        terminal.print(browser);
        return browser;
    } else {
        terminal.print("Please specify a URL.");
    }
};

TerminalShell.commands['apt-get'] = function(terminal, subcmd) {
    if (!this.sudo && (subcmd in {'update':true, 'upgrade':true, 'dist-upgrade':true})) {
        terminal.print('E: Unable to lock the administration directory, are you root?');
    } else {
        if(subcmd == 'update'){
            terminal.print("Reading package lists...")
            terminal.print("Done");
        }else if (subcmd == 'upgrade') {  // browser
            if (($.browser.name == 'msie') || ($.browser.name == 'firefox' && $.browser.versionX < 3)) {
                terminal.print($('<p>').append($('<a>').attr('href', 'http://abetterbrowser.org/').text('To complete installation, click here.')));
            }else {
                terminal.print('This looks pretty good to me.');
            }
        } else if (subcmd == 'dist-upgrade') {           // Operating system
            var longNames = {'win':'Windows', 'mac':'OS X', 'linux':'Linux'};
            var name = $.os.name;
            if (name in longNames) {
                name = longNames[name];
            } else {
                name = 'something fancy';
            }
            terminal.print('You are already running '+name+'.');
        } else if (subcmd == 'moo') {
            terminal.print('        (__)');
            terminal.print('        (oo)');
            terminal.print('  /------\\/ ');
            terminal.print(' / |    ||  ');
            terminal.print('*  /\\---/\\  ');
            terminal.print('   ~~   ~~  '); 
            terminal.print('...."Have you mooed today?"...');
        } else if (subcmd == 'girlfriend') {
            terminal.print('正在读取软件包列表...完成');
            terminal.print('正在分析软件包的依赖关系...完成');
            terminal.print('有一些软件包无法被安装。');
            terminal.print('下列的信息可能会对解决问题有所帮助:');
            terminal.print('下列的软件包有不能满足的依赖关系:');
            terminal.print('girlfriend: 依赖 house 但是没有安装');
            terminal.print('girlfriend: 依赖 car   但是没有安装');
            terminal.print('hourse,car: 依赖 money 但是没有安装');
            terminal.print('E: 无法安装的软件包');
            terminal.print('just kidding');
        } else if (!subcmd) {
            terminal.print('This APT has Super Cow Powers.');
        } else {
            terminal.print('E: Invalid operation '+subcmd);
        }
    }
};
// answer
function oneLiner(terminal, msg, msgmap) {
    if (msgmap.hasOwnProperty(msg)) {
        terminal.print(msgmap[msg]);
        return true;
    } else {
        return false;
    }
}

TerminalShell.commands['man'] = function(terminal, what) {
    pages = {
        'last': 'Man, last night was AWESOME.',
        'help': 'Man, help me out here.',
        'next': 'Request confirmed; you will be reincarnated as a man next.',
        'cat':  'You are now riding a half-man half-cat.'
    };
    if (!oneLiner(terminal, what, pages)) {
        terminal.print('Oh, man man man!');
    }
};

TerminalShell.commands['locate'] = function(terminal, what) {
    keywords = {
        'ninja': 'Ninja can not be found!',
        'keys': 'Have you checked your coat pocket?',
        'joke': 'Joke found on user.',
        'problem': 'Problem exists between keyboard and chair.',
        'raptor': 'BEHIND YOU!!!'
    };
    if (!oneLiner(terminal, what, keywords)) {
        terminal.print('Locate what?');
    }
};

Adventure = {
    rooms: {
        0:{description:'You are at a computer using unixkcd.', exits:{west:1, south:10}},
        1:{description:'Life is peaceful there.', exits:{east:0, west:2}},
        2:{description:'In the open air.', exits:{east:1, west:3}},
        3:{description:'Where the skies are blue.', exits:{east:2, west:4}},
        4:{description:'This is what we\'re gonna do.', exits:{east:3, west:5}},
        5:{description:'Sun in wintertime.', exits:{east:4, west:6}},
        6:{description:'We will do just fine.', exits:{east:5, west:7}},
        7:{description:'Where the skies are blue.', exits:{east:6, west:8}},
        8:{description:'This is what we\'re gonna do.', exits:{east:7}},
        10:{description:'A dark hallway.', exits:{north:0, south:11}, enter:function(terminal) {
                if (!Adventure.status.lamp) {
                    terminal.print('You are eaten by a grue.');
                    Adventure.status.alive = false;
                    Adventure.goTo(terminal, 666);
                }
            }
        },
        11:{description:'Bed. This is where you sleep.', exits:{north:10}},
        666:{description:'You\'re dead!'}
    },
    
    status: {
        alive: true,
        lamp: false
    },
    
    goTo: function(terminal, id) {
        Adventure.location = Adventure.rooms[id];
        Adventure.look(terminal);
        if (Adventure.location.enter) {
            Adventure.location.enter(terminal);
        }
    }
};
Adventure.location = Adventure.rooms[0];

TerminalShell.commands['look'] = Adventure.look = function(terminal) {
    terminal.print(Adventure.location.description); 
    if (Adventure.location.exits) {
        terminal.print();
        
        var possibleDirections = [];
        $.each(Adventure.location.exits, function(name, id) {
            possibleDirections.push(name);
        });
        terminal.print('Exits: '+possibleDirections.join(', '));
    }
};

TerminalShell.commands['go'] = Adventure.go = function(terminal, direction) {
    if (Adventure.location.exits && direction in Adventure.location.exits) {
        Adventure.goTo(terminal, Adventure.location.exits[direction]);
    } else if (!direction) {
        terminal.print('Go where?');
    } else if (direction == 'down') {
        terminal.print("On our first date?");
    } else {
        terminal.print('You cannot go '+direction+'.');
    }
};

TerminalShell.commands['light'] = function(terminal, what) {
    if (what == "lamp") {
        if (!Adventure.status.lamp) {
            terminal.print('You set your lamp ablaze.');
            Adventure.status.lamp = true;
        } else {
            terminal.print('Your lamp is already lit!');
        }
    } else {
        terminal.print('Light what?');
    }
};

TerminalShell.commands['sleep'] = function(terminal, duration) {
    duration = Number(duration);
    if (!duration) {
        duration = 5;
    }
    terminal.setWorking(true);
    terminal.print("You take a nap.");
    $('#screen').fadeOut(1000);
    window.setTimeout(function() {
        terminal.setWorking(false);
        $('#screen').fadeIn();
        terminal.print("You awake refreshed.");
    }, 1000*duration);
};

// No peeking!
// TerminalShell.commands['help'] = TerminalShell.commands['halp'] = function(terminal) {
//     terminal.print('That would be cheating!');
// }; 

TerminalShell.fallback = function(terminal, cmd) {
    oneliners = {
        'make me a sandwich': 'What? Make it yourself.',
        'make love': 'I put on my robe and wizard hat.',
        'i read the source code': '<3',
        'pwd': 'You are in a maze of twisty passages, all alike.',
        'lpr': 'PC LOAD LETTER',
        'hello joshua': 'How about a nice game of Global Thermonuclear War?',
        'xyzzy': 'Nothing happens.',
        'date': 'March 32nd',
        'hello': 'Why hello there!',
        'who': 'Doctor Who?',
        'xkcd': 'Yes?',
        'su': 'God mode activated. Remember, with great power comes great ... aw, screw it, go have fun.',
        'fuck': 'I have a headache.',
        'whoami': 'You are Richard Stallman.',
        'nano': 'Seriously? Why don\'t you just use Notepad.exe? Or MS Paint?',
        'top': 'It\'s up there --^',
        'moo':'moo',
        'ping': 'There is another submarine three miles ahead, bearing 225, forty fathoms down.',
        'find': 'What do you want to find? Kitten would be nice.',
        'hello':'Hello.','more':'Oh, yes! More! More!',
        'your gay': 'Keep your hands off it!',
        'hi':'Hi.','echo': 'Echo ... echo ... echo ...',
        'bash': 'You bash your head against the wall. It\'s not very effective.','ssh': 'ssh, this is a library.',
        'uname': 'Illudium Q-36 Explosive Space Modulator',
        'finger': 'Mmmmmm...',
        'kill': 'Terminator deployed to 1984.',
        'use the force luke': 'I believe you mean source.',
        'use the source luke': 'I\'m not luke, you\'re luke!',
        'serenity': 'You can\'t take the sky from me.',
        'enable time travel': 'TARDIS error: Time Lord missing.',
        'ed': 'You are not a diety.'
    };
    oneliners['emacs'] = 'You should really use vim.';
    oneliners['vi'] = oneliners['vim'] = 'You should really use emacs.';
    
    cmd = cmd.toLowerCase();
    if (!oneLiner(terminal, cmd, oneliners)) {
        if (cmd == "asl" || cmd == "a/s/l") {
            terminal.print(randomChoice([
                '2/AMD64/Server Rack',
                '328/M/Transylvania',
                '6/M/Battle School',
                '48/M/The White House',
                '7/F/Rapture',
                'Exactly your age/A gender you\'re attracted to/Far far away.',
                '7,831/F/Lothlórien',
                '42/M/FBI Field Office'
            ]));
        } else if  (cmd == "hint") {
            terminal.print(randomChoice([
                'We offer some really nice polos.',
                $('<p>').html('This terminal will remain available at <a href="http://xkcd.com/unixkcd/">http://xkcd.com/unixkcd/</a>'),
                'Use the source, Luke!',
                'There are cheat codes.'
            ]));
        } else if (cmd == 'find kitten') {
            terminal.print($('<iframe width="800" height="600" src="http://www.robotfindskitten.net/rfk.swf"></iframe>'));
        } else if (cmd == 'buy stuff') {
            Filesystem['store'].enter();
        } else if (cmd == 'time travel') {
            xkcdDisplay(terminal, 630);
        } else if (/:\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;\s*:/.test(cmd)) {
            Terminal.setWorking(true);
        } else {
            $.get("/miss", {cmd: cmd});
            return false;
        }
    }
    return true;
};
// touch event
var Tevent ={
    startX: null,
    startY: null,
    endX: null,
    endY: null,
    move: false,
    focus: false
}
// main
var konamiCount = 0;
$(document).ready(function() {
    function noData() {
        Terminal.print($('<p>').addClass('error').text('Unable to load startup data. :-('));
        Terminal.promptActive = true;
    };
    // mobile touch event 
    var c = document.getElementById('screen').querySelector('.clipboard');
    window.addEventListener("touchstart",function(e){
        var pos = e.changedTouches[0];
        Tevent.startX = pos.screenX;
        Tevent.startY = pos.screenY;
        Tevent.move = false;
        console.log(pos.identifier,'start')
    });
    window.addEventListener("touchmove",function(e){
        // console.log('move',e.changedTouches);
        e.preventDefault();
        Tevent.move = true;
    });
    window.addEventListener("touchend",function(e){
        e.preventDefault();
        var pos = e.changedTouches[0];
        console.log(pos.identifier,'end')
        var distX = pos.screenX - Tevent.startX;
        var distY = pos.screenY - Tevent.startY;
        var deg = Math.atan2(Math.abs(distY),Math.abs(distX))*180/Math.PI;
        console.log('x',distX,'y',distY,'tan',deg);
        if (Tevent.move){
            if (deg<23){ // left or right
                if (distX>10){
                    Terminal.setFocus();
                    Terminal.moveHistory(-1); // previous
                }else if(distX<-10){
                    Terminal.setFocus();
                    Terminal.moveHistory(1); // next
                };
            }else if(deg>45){// up and down
                if(distY > 100){
                    // console.log('pagedown')
                    Terminal.scrollPage(-1);
                }else if(100 >= distY && distY > 10){
                    // console.log('linedown',-1*parseInt(distY/10))
                    Terminal.scrollLine(-1*parseInt(distY/10));
                }else if(-10 > distY && distY >= -100){
                    // console.log('lineup',-1*parseInt(distY/10))
                    Terminal.scrollLine(-1*parseInt(distY/10));
                }else if(distY < -100){
                    // console.log('pageup')
                    Terminal.scrollPage(1);
                }
            };
        } else{// click
            if(!Tevent.focus){
                c.focus();
                Tevent.focus = true;
            }else{
                c.blur();
                Tevent.focus = false;
            }
        };
    });
    // ready for xkcd comic
    $('#screen').bind('cli-load', function(e) {
        // TerminalShell.commands['goto']
        xkcd.get(null, function(data) {
            if (data) {
                xkcd.latest = data;
                $('#screen').one('cli-ready', function(e) {
                    // Terminal.runCommand('cat readme.txt');
                    // Terminal.runCommand('display '+xkcd.latest.num+'/'+pathFilename(xkcd.latest.img));
                }); 
            } else {
                noData();
            }
        }, noData);
    });
    // up up down down b a b a
    $(document).konami(function(){
        function shake(elems) {
            elems.css('position', 'relative');
            return window.setInterval(function() {
                elems.css({top:getRandomInt(-3, 3), left:getRandomInt(-3, 3)});
            }, 100);    
        }
        
        if (konamiCount == 0) {
            $('#screen').css('text-transform', 'uppercase');
        } else if (konamiCount == 1) {
            $('#screen').css('text-shadow', 'gray 0 0 2px');
        } else if (konamiCount == 2) {
            $('#screen').css('text-shadow', 'green 10px 10px 30px');
        } else if (konamiCount == 3) {
            shake($('#screen'));
        } else if (konamiCount == 4) {
            $('#screen').css('background', 'url(http://ww2.sinaimg.cn/large/6afb06cdgw1eq0yc6avzhj20jg0el3zh.jpg) center no-repeat');
        }
        
        $('<div>')
            .height('100%').width('100%')
            .css({background:'white', position:'absolute', top:0, left:0})
            .appendTo($('body'))
            .show()
            .fadeOut(1000);
        
        if (Terminal.buffer.substring(Terminal.buffer.length-2) == 'ba') {
            Terminal.buffer = Terminal.buffer.substring(0, Terminal.buffer.length-2);
            Terminal.updateInputDisplay();
        }
        TerminalShell.sudo = true;
        konamiCount += 1;
    });
    // Kill Opera's backspace keyboard action.
    document.onkeydown = document.onkeypress = function(e) { return $.hotkeys.specialKeys[e.keyCode] != 'backspace'; };
    // start 
    $('#welcome').show();
    Terminal.init();
    // Terminal.promptActive = false;
    Terminal.runCommand('cat readme.txt')
});
/*
 * jQuery Hotkeys Plugin
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Based upon the plugin by Tzury Bar Yochay:
 * http://github.com/tzuryby/hotkeys
 *
 * Original idea by:
 * Binny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/
 */

/*
 * One small change is: now keys are passed by object { keys: '...' }
 * Might be useful, when you want to pass some other data to your handler
 */

(function(jQuery) {

  jQuery.hotkeys = {
    version: "0.8",

    specialKeys: {
      8: "backspace",9: "tab",10: "return",13: "return",16: "shift",
      17: "ctrl",18: "alt",19: "pause",20: "capslock",27: "esc",
      32: "space",33: "pageup",34: "pagedown",35: "end",36: "home",
      37: "left",38: "up",39: "right",40: "down",45: "insert",46: "del",
      59: ";",61: "=",96: "0",97: "1",98: "2",99: "3",100: "4",101: "5",
      102: "6",103: "7",104: "8",105: "9",106: "*",107: "+",109: "-",
      110: ".",111: "/",112: "f1",113: "f2",114: "f3",115: "f4",
      116: "f5",117: "f6",118: "f7",119: "f8",120: "f9",121: "f10",
      122: "f11",123: "f12",144: "numlock",145: "scroll",173: "-",
      186: ";",187: "=",188: ",",189: "-",190: ".",191: "/",192: "`",
      219: "[",220: "\\",221: "]",222: "'"
    },

    shiftNums: {
      "`": "~","1": "!","2": "@","3": "#","4": "$","5": "%","6": "^",
      "7": "&","8": "*","9": "(","0": ")","-": "_","=": "+",";": ": ",
      "'": "\"",",": "<",".": ">","/": "?","\\": "|"
    },

    // excludes: button, checkbox, file, hidden, image, password, radio, reset, search, submit, url
    textAcceptingInputTypes: [
      "text", "password", "number", "email", "url", "range", "date", "month", "week", "time", "datetime",
      "datetime-local", "search", "color", "tel"],

    // default input types not to bind to unless bound directly
    textInputTypes: /textarea|input|select/i,

    options: {
      filterInputAcceptingElements: true,
      filterTextInputs: true,
      filterContentEditable: true
    }
  };

  function keyHandler(handleObj) {
    if (typeof handleObj.data === "string") {
      handleObj.data = {
        keys: handleObj.data
      };
    }

    // Only care when a possible input has been specified
    if (!handleObj.data || !handleObj.data.keys || typeof handleObj.data.keys !== "string") {
      return;
    }

    var origHandler = handleObj.handler,
      keys = handleObj.data.keys.toLowerCase().split(" ");

    handleObj.handler = function(event) {
      //      Don't fire in text-accepting inputs that we didn't directly bind to
      if (this !== event.target &&
        (jQuery.hotkeys.options.filterInputAcceptingElements &&
          jQuery.hotkeys.textInputTypes.test(event.target.nodeName) ||
          (jQuery.hotkeys.options.filterContentEditable && jQuery(event.target).attr('contenteditable')) ||
          (jQuery.hotkeys.options.filterTextInputs &&
            jQuery.inArray(event.target.type, jQuery.hotkeys.textAcceptingInputTypes) > -1))) {
        return;
      }

      var special = event.type !== "keypress" && jQuery.hotkeys.specialKeys[event.which],
        character = String.fromCharCode(event.which).toLowerCase(),
        modif = "",
        possible = {};

      jQuery.each(["alt", "ctrl", "shift"], function(index, specialKey) {

        if (event[specialKey + 'Key'] && special !== specialKey) {
          modif += specialKey + '+';
        }
      });

      // metaKey is triggered off ctrlKey erronously
      if (event.metaKey && !event.ctrlKey && special !== "meta") {
        modif += "meta+";
      }

      if (event.metaKey && special !== "meta" && modif.indexOf("alt+ctrl+shift+") > -1) {
        modif = modif.replace("alt+ctrl+shift+", "hyper+");
      }

      if (special) {
        possible[modif + special] = true;
      }
      else {
        possible[modif + character] = true;
        possible[modif + jQuery.hotkeys.shiftNums[character]] = true;

        // "$" can be triggered as "Shift+4" or "Shift+$" or just "$"
        if (modif === "shift+") {
          possible[jQuery.hotkeys.shiftNums[character]] = true;
        }
      }

      for (var i = 0, l = keys.length; i < l; i++) {
        if (possible[keys[i]]) {
          return origHandler.apply(this, arguments);
        }
      }
    };
  }

  jQuery.each(["keydown", "keyup", "keypress"], function() {
    jQuery.event.special[this] = {
      add: keyHandler
    };
  });

})(jQuery || this.jQuery || window.jQuery);

/*!
jQuery Browser Plugin
    * Version 2.3
    * 2008-09-17 19:27:05
    * URL: http://jquery.thewikies.com/browser
    * Description: jQuery Browser Plugin extends browser detection capabilities and can assign browser selectors to CSS classes.
    * Author: Nate Cavanaugh, Minhchau Dang, & Jonathan Neal
    * Copyright: Copyright (c) 2008 Jonathan Neal under dual MIT/GPL license.
*/

(function ($) {
    $.browserTest = function (a, z) {
        var u = 'unknown', x = 'X', m = function (r, h) {
            for (var i = 0; i < h.length; i = i + 1) {
                r = r.replace(h[i][0], h[i][1]);
            }

            return r;
        }, c = function (i, a, b, c) {
            var r = {
                name: m((a.exec(i) || [u, u])[1], b)
            };

            r[r.name] = true;

            r.version = (c.exec(i) || [x, x, x, x])[3];

            if (r.name.match(/safari/) && r.version > 400) {
                r.version = '2.0';
            }

            if (r.name === 'presto') {
                r.version = ($.browser.version > 9.27) ? 'futhark' : 'linear_b';
            }
            r.versionNumber = parseFloat(r.version, 10) || 0;
            r.versionX = (r.version !== x) ? (r.version + '').substr(0, 1) : x;
            r.className = r.name + r.versionX;

            return r;
        };

        a = (a.match(/Opera|Navigator|Minefield|KHTML|Chrome/) ? m(a, [
            [/(Firefox|MSIE|KHTML,\slike\sGecko|Konqueror)/, ''],
            ['Chrome Safari', 'Chrome'],
            ['KHTML', 'Konqueror'],
            ['Minefield', 'Firefox'],
            ['Navigator', 'Netscape']
        ]) : a).toLowerCase();

        $.browser = $.extend((!z) ? $.browser : {}, c(a, /(camino|chrome|firefox|netscape|konqueror|lynx|msie|opera|safari)/, [], /(camino|chrome|firefox|netscape|netscape6|opera|version|konqueror|lynx|msie|safari)(\/|\s)([a-z0-9\.\+]*?)(\;|dev|rel|\s|$)/));

        $.layout = c(a, /(gecko|konqueror|msie|opera|webkit)/, [
            ['konqueror', 'khtml'],
            ['msie', 'trident'],
            ['opera', 'presto']
        ], /(applewebkit|rv|konqueror|msie)(\:|\/|\s)([a-z0-9\.]*?)(\;|\)|\s)/);

        $.os = {
            name: (/(win|mac|linux|sunos|solaris|iphone)/.exec(navigator.platform.toLowerCase()) || [u])[0].replace('sunos', 'solaris')
        };

        if (!z) {
            $('html').addClass([$.os.name, $.browser.name, $.browser.className, $.layout.name, $.layout.className].join(' '));
        }
    };

    $.browserTest(navigator.userAgent);
})(jQuery);

/*!
 * jQuery Konami code trigger v. 0.1
 *
 * Copyright (c) 2009 Joe Mastey
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
(function($){
    $.fn.konami             = function( fn, params ) {
        params              = $.extend( {}, $.fn.konami.params, params );
        this.each(function(){
            var tgt         = $(this);
            tgt.bind( 'konami', fn )
               .bind( 'keyup', function(event) { $.fn.konami.checkCode( event, params, tgt ); } );
        });
        return this;
    };
    
    $.fn.konami.params      = {
        'code'      : [38, 38, 40, 40, 37, 39, 37, 39, 66, 65],
        'step'      : 0
    };
    
    $.fn.konami.checkCode   = function( event, params, tgt ) {
        if(event.keyCode == params.code[params.step]) {
            params.step++;
        } else {
            params.step     = 0;
        }
        
        if(params.step == params.code.length) {
            tgt.trigger('konami');
            params.step     = 0;
        }
    };
})(jQuery);
