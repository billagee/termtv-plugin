'use strict';

/**
 * @constructor
 */
function TTVEmulator(opts)
{
    // somewhat vt102, somewhat xterm

    var emu = this;

    emu.changeCallback  = opts.change;
    emu.specialCallback = opts.special;
    emu.cursorCallback  = opts.cursor;
    emu.debugLevel      = opts.debugLevel;

    emu.debug = function(txt)
    {
        opts.debug ? opts.debug("emulate.js: "+txt) : alert("emulate.js: "+txt);
    }


    emu.width  = opts.width  || 80;
    emu.height = opts.height || 24;

    emu.initialize();

    return emu;
}

TTVEmulator.prototype.initialize = function ()
{
    this.scr = {};

    // All properties need initialization because of cloning
    this.cursor = {};
    this.cursor.x = 0;
    this.cursor.y = 0;
    this.cursor.bold = false;
    this.cursor.underline = false;
    this.cursor.lowintensity = false;
    this.cursor.blink = false;
    this.cursor.reversed = false; // state, fcolor and bcolor are flipped when this is
    this.cursor.invisible = false; // TODO: implement
    this.cursor.fcolor = 7;
    this.cursor.bcolor = 0;
    this.cursor.visible = true;

    // character-wide
    this.scr.c = {};
    this.scr.c.text = [];
    this.scr.c.bold = [];
    this.scr.c.underline = [];
    this.scr.c.lowintensity = [];
    this.scr.c.blink = [];
    this.scr.c.fcolor = [];
    this.scr.c.bcolor = [];
    this.scr.reverseScreen = false;
    this.scr.cursorStorage = clone(this.cursor);
    this.scr.cursorPosStorage = { };
    this.scr.cursorPosStorage.x = 0;
    this.scr.cursorPosStorage.y = 0;
    this.scr.autoWrap = true;

    // FIXME: An array of cursor-type object would significantly decrease
    // code size and most probably increase efficiency (except 'reverseScreen')
    for (var i=0; i<this.width*this.height; i++)
    {
        this.scr.c.text.push(' ');
        this.scr.c.bold.push(false);
        this.scr.c.underline.push(false);
        this.scr.c.lowintensity.push(false);
        this.scr.c.blink.push(false);
        this.scr.c.fcolor.push(7);
        this.scr.c.bcolor.push(0);
    }

    this.scralt = clone(this.scr);

    this.mode = {};
    this.mode.cursorKeyANSI = true;
    this.mode.scroll = 'jump'; // | smooth
    this.mode.reverseScreen = false;
    this.mode.originMode = 'screen'; // | marginHome
    this.mode.autoRepeat = true;
    this.mode.mouseTrackingDown = false;
    this.mode.mouseTrackingUp = false;
    this.mode.currentScreen = 1;
    this.mode.keyboardLocked = false;
    this.mode.insert = false;
    this.mode.insertLimited = 0;
    this.mode.localEcho = true;
    this.mode.newLineMode = 'cr'; // | crlf

    this.margins = {};
    this.margins.top = 0;
    this.margins.bottom = this.height-1;

    this.tabs = {};
    for (var t=0; t<this.width; t++)
        this.tabs[t] = t % 8 == 0;

    this.windowTitle = '';
    this.iconTitle = '';

    this.charsets = {};
    this.charsets.g0 = 'us';
    this.charsets.g1 = 'line';
    this.charsets.active = 'g0';
}

TTVEmulator.prototype.freeze = function ()
{
    // Clone the object
    return clone(this);
};

TTVEmulator.prototype.thaw = function (obj)
{
    this.scr      = clone(obj.scr);
    this.scralt   = clone(obj.scralt);

    this.mode     = clone(obj.mode);
    this.cursor   = clone(obj.cursor);
    this.margins  = clone(obj.margins);
    this.tabs     = clone(obj.tabs);
    this.charsets = clone(obj.charsets);

    this.windowTitle = obj.windowTitle;
    this.iconTitle   = obj.iconTitle;

    for (var y=0; y<this.height; y++)
        this.postChange(y, 0, this.height-1);

    this.postSpecial({ 'title': obj.windowTitle,  'icon': obj.iconTitle });
    this.postCursor();
};

function unpack_unicode(hex)
{
    return String.fromCharCode(parseInt(hex, 16));
}

TTVEmulator.prototype.charmap =
{
    us: { }, // not existing implies consistent with unicode
    uk: {
        '#': unpack_unicode("A3") // pound symbol
    },
    line: {
        '_': ' ',
        '`': unpack_unicode("2666"), // diamond
        'a': unpack_unicode("2591"), // checkerboard
        'b': unpack_unicode("2409"), // HT
        'c': unpack_unicode("240C"), // FF
        'd': unpack_unicode("240D"), // CR
        'e': unpack_unicode("240A"), // LF
        'f': unpack_unicode("B0"),   // degree symbol
        'g': unpack_unicode("B1"),   // plusminus
        'h': unpack_unicode("2424"), // NL
        'i': unpack_unicode("240B"), // VT
        'j': unpack_unicode("2518"), // corner lr
        'k': unpack_unicode("2510"), // corner ur
        'l': unpack_unicode("250C"), // corner ul
        'm': unpack_unicode("2514"), // corner ll
        'n': unpack_unicode("253C"), // meeting +
        //'o': unpack_unicode(""),   // scan 1 horizontal
        //'p': unpack_unicode(""),   // scan 3 horizontal
        'q': unpack_unicode("2500"), // scan 5 horizontal
        //'r': unpack_unicode(""),   // scan 7 horizontal
        //'s': unpack_unicode(""),   // scan 9 horizontal
        't': unpack_unicode("2524"), // vertical meet right
        'u': unpack_unicode("251C"), // vertical meet left
        'v': unpack_unicode("2534"), // horizontal meet top
        'w': unpack_unicode("252C"), // horizontal meet bottom
        'x': unpack_unicode("2502"), // vertical bar
        'y': unpack_unicode("2264"), // less than or equal to
        'z': unpack_unicode("2265"), // greater than or equal to
        '{': unpack_unicode("3C0"),  // pi
        '|': unpack_unicode("2260"), // not equal to
        '}': unpack_unicode("A3"),   // pound symbol
        '~': unpack_unicode("B7")    // center dot
    }
};

TTVEmulator.prototype.postChange = function (y, minx, maxx)
{
    if (this.changeCallback)
        this.changeCallback(y, minx, maxx);
};

TTVEmulator.prototype.postSpecial = function (obj)
{
    if (this.specialCallback)
        this.specialCallback(obj);
};

TTVEmulator.prototype.postCursor = function()
{
    if (this.cursorCallback)
        this.cursorCallback(this.cursor.x, this.cursor.y, this.cursor.visible);
},

TTVEmulator.prototype.ev_setWindowTitle = function(title)
{
    if (this.debugLevel>2) this.debug("SET_WINDOW_TITLE= "+title);

    this.windowTitle = title;
    this.postSpecial({ title: title });
};

TTVEmulator.prototype.ev_setIconTitle = function(title)
{
    if (this.debugLevel>2) this.debug("SET_ICON_TITLE= "+title);
    this.iconTitle = title;
    this.postSpecial({ icon: title });
};

TTVEmulator.prototype.ev_setWindowIconTitle = function(title)
{
    if (this.debugLevel>2) this.debug("SET_TITLE= "+title);
    this.windowTitle = title;
    this.iconTitle = title;
    this.postSpecial({ title: title, icon:title });
};

TTVEmulator.prototype.ev_resetMargins = function ()
{
    if (this.debugLevel>2) this.debug("RESET_MARGIN=1 "+this.height);
    this.ev_setMargins(1,this.height, true);
};

TTVEmulator.prototype.ev_setMargins = function(top, bottom, shown)
{
    if (!shown && this.debugLevel>2)
        this.debug("SET_MARGIN="+top+" "+bottom);

    top -= 1;
    bottom -= 1;

    if (top+1>=bottom)
        top = bottom-1;

    if (top<0)
        top = 0;

    if (top>this.height-2)
        top = this.height-2;

    if (bottom<1)
        bottom = 1;

    if (bottom>this.height-1)
        bottom = this.height-1;

    if (top+1>=bottom)
        this.debug("numbers do not obey the laws of arithmetic in setMargins");

    this.margins.top = top;
    this.margins.bottom = bottom;

    this.ev_goto(1, 1);
};

TTVEmulator.prototype.ev_cursorStack = function(action, all)
{
    if (this.debugLevel>2) this.debug("CURSOR_STACK="+action+" [+attrib="+all+"]");

    if (action=='push')
    {
        if (all)
            this.scr.cursorStorage = clone(this.cursor);
        else
        {
            this.scr.cursorPosStorage.x = this.cursor.x;
            this.scr.cursorPosStorage.y = this.cursor.y;
        }
    }
    if (action=='pop')
    {
        if (all)
            this.cursor = clone(this.scr.cursorStorage);
        else
        {
            this.cursor.x = this.scr.cursorPosStorage.x;
            this.cursor.y = this.scr.cursorPosStorage.y;;
        }
    }

    this.postCursor();

    //this.debug("Can't do cursorStack action "+action);
};

TTVEmulator.prototype.ev_setAttribute = function (attr, shown)
{
    if (!shown && this.debugLevel>2)
        this.debug("SET_ATTRIB="+(!attr[0]?'0':attr));

    // Would that be faster?
    // attr[0] = parseInt(attr[0], 10)

    /*
     0	     Reset / Normal	all attributes off
     1	     Bold or increased intensity
     2	     Faint (decreased intensity)
     3       Italic
     4       Single underline
     5       Blink (slow  < 150/min)
     6       Blink (rapid >=150/min)
     7       Negative
     8       Conceal
     9       Crossed out
     10      Primary (default) font
     11-19   nth alternate font (11==first, ...)
     20      Fraktur
     21	     Bold off or underline double
     22      Normal color (neither bold nor faint)
     23      italic / fraktur off
     24      underline single / underline double off
     25      blink off
     27      inverse off
     28      conceal off
     29      crossed out off
     30-37   foreground color
     38      forground 256-color/24bit color
     39      default foreground color
     40-47   background color
     38      background 256-color/24bit color
     39      default background color
     51      framed
     52      encircled
     53      overlined
     54      framed/circled off
     55      overlined off
     60      idiogram underline or right side line
     61      idiogram double underline or double right side line
     62      idiogram overline or left side line
     63      idiogram double overline or double left side line
     64      idiogram stress marking
     90-99   foreground color, high intensity
     100-109 background color, low intensity
     */

    var fg, bg;

    // This is sorted roughly with the frequency of appearance
    if (!attr[0] || attr[0]==0) {
        this.cursor.bold = false;
        this.cursor.underline = false;
        this.cursor.lowintensity = false;
        this.cursor.blink = false;  // term uses this as 'bold' for the background color
        this.cursor.reversed = false;
        this.cursor.invisible = false; // not supported by konsole
        fg = 7;
        bg = 0;
    } else if (attr[0]>=30 && attr[0]<=37) {
        fg = attr[0]-30;
    } else if (attr[0]==39) {
        fg = 7;
    } else if (attr[0]>=40 && attr[0]<=47) {
        bg = attr[0]-40;
    } else if (attr[0]==49 ) {
        bg = 0;
    } else if (attr[0]>=90 && attr[0]<=97) {
        fg = attr[0]-90+10;                // Set foreground color, high intensity
    } else if (attr[0]==99) {
        fg = 7;
    } else if (attr[0]>=100 && attr[0]<=107) {
        bg = attr[0]-100+10;                  // Set background color, high intensity
    } else if (attr[0]==109) {
        bg = 0;
    } else if (attr[0]==1) {    // suggest: lowintense=false
        this.cursor.bold = true;
        this.cursor.lowintensity = false;
    } else if (attr[0]==2) {    // suggest: bold=false
        this.cursor.lowintensity = true; /* not widely supported */
        this.cursor.bold= false; /* not widely supported */
    } else if (attr[0]==21) {   // suggest: same as 22
        // this.cursor.bold = false; /* not widely supported */
    } else if (attr[0]==22) {
        this.cursor.lowintensity = false;
        this.cursor.bold = false;
    } else if (attr[0]==7 || attr[0]==27) {
        // There is only action needed when the stae changed.

        if (attr[0]==7 && !this.cursor.reversed)
        {
            this.cursor.reversed = true;
            fg = this.cursor.fcolor;
            bg = this.cursor.bcolor;
        }
        if (attr[0]==27 && this.cursor.reversed)
        {
            this.cursor.reversed = false;
            bg = this.cursor.fcolor;
            fg = this.cursor.bcolor;
        }
    } else if (attr[0]==4 || attr[0]==24) {
        this.cursor.underline = attr[0]==4;
    } else if (attr[0]==5 || attr[0]==25) {
        this.cursor.blink = attr[0]==5;
    } else if (attr[0]==8 || attr[0]==28) {
        this.cursor.invisible = attr == 8;
    } else if (attr[0]==10) {
        this.ev_switchCharset('g0', undefined);       // linux console
    } else if (attr[0]==11) {
        this.ev_switchCharset('g1', undefined);       // linux console
    } else if (attr[0]==38 && attr[1]==5) {
        if (attr[2]<8)
            // 0x00-0x07:  standard colors (as in ESC [ 30..37 m)
            fg = attr[2];
        else if (attr[2]<16)
            // 0x08-0x0f:  high intensity colors (as in ESC [ 90..97 m)
            fg = attr[2]-2;
        else if (attr[3]<232) {
            // 0x10-0xe7:  6*6*6=216 colors: 16 + 36*r + 6*g + b (0 <= r,g,b <= 5)
            var b = ((attr[3] - 16)%6);
            var g = ((attr[3] - 16)/6) %6;
            var r = ((attr[3] - 16)/36)%6;
        } else {
            // 0xe8-0xff:  grayscale from black to white in 24 steps
            var b = (attr[3] - 232)*11;  // 0 - 253
            var g = (attr[3] - 232)*11;  // 0 - 253
            var r = (attr[3] - 232)*11;  // 0 - 253
        }
        this.debug("Warning: 256-foreground color (" + attr[2] + ") not supported.");
        attr = attr.slice(2);
    } else if (attr[0]==48 && attr[1]==5) {
        if (attr[2]<8)
            bg = attr[2];
        else if (attr[2]<0x10)
            bg = attr[2]-2;
        this.debug("Warning: 256-background color (" + attr[2] + ") not supported.");
        attr = attr.slice(2);
    } else if (attr[0]==38 && attr[1]==2) {
        var b = attr[5];
        var g = attr[4];
        var r = attr[3];
        this.debug("Warning: 24bit color (" + attr.slice(2) + ") not supported.");
        attr = attr.slice(4);
    } else if (attr[0]==48 && attr[1]==2) {
        this.debug("Warning: 24bit color (" + attr.slice(2) + ") not supported.");
        attr = attr.slice(4);
    } else {
        this.debug("Warning: ignoring setAttribute(" + attr + ")");
    }

    if (this.cursor.reversed ^ this.scr.reverseScreen)
    {
        var x = fg;
        fg = bg;
        bg = x;
    }

    if (fg!=undefined)
        this.cursor.fcolor = fg;
    if (bg!=undefined)
        this.cursor.bcolor = bg;

    if (attr.length>1)
        this.ev_setAttribute(attr.slice(1), true);
};

TTVEmulator.prototype.ev_normalString = function (str)
{
    if (this.debugLevel>2)
        this.debug("STRING=["+this.cursor.x+"/"+this.cursor.y+";"+this.cursor.fcolor+";"+this.cursor.bcolor+";"+str+"]["+str.length+"]");

    for (var i=0; i<str.length; i++)
        this.ev_normalChar(str[i], true);
};

TTVEmulator.prototype.ev_normalChar = function(ch, shown)
{
    if (/*!shown &&*/ this.debugLevel>2)
        this.debug("CHAR=["+this.cursor.x+"/"+this.cursor.y+";"+this.cursor.fcolor+";"+this.cursor.bcolor+";"+ch+"]");

    // charmapping
    if ( this.charsets.active &&
        this.charsets[this.charsets.active] &&
        this.charmap[this.charsets[this.charsets.active]] &&
        this.charmap[this.charsets[this.charsets.active]][ch] )
        ch = this.charmap[this.charsets[this.charsets.active]][ch];

    // wrapping
    if (this.cursor.x==this.width)
    {
        // cursor is on the margin, we can't put a character there
        if (this.scr.autoWrap)
        {
            var b = this.mode.originMode == 'screen' ? this.height : this.margins.bottom+1;

            this.cursor.x = 0;
            this.cursor.y++;
            if (this.cursor.y>=b)
            {
                if (this.cursor.y==b)
                    this.scroll(1);
                this.cursor.y = b-1;
            }
        }
        else
        {
            // temporarily
            this.cursor.x--;
        }
    }

    // put on screen
    if (this.mode.insert)
    {
        this.removeCharAt(this.width-1, this.cursor.y);
        this.insertCharAt(ch, this.cursor.x, this.cursor.y);

        this.postChange(this.cursor.y, this.cursor.x, this.width-1);
    }
    else
    {
        this.overwriteCharAt(ch, this.cursor.x, this.cursor.y);
        this.postChange(this.cursor.y, this.cursor.x, this.cursor.x);
    }

    // stepping
    this.cursor.x++;
    this.postCursor();
};

TTVEmulator.prototype.ev_specialChar = function (key)
{
    if (this.debugLevel>2)
        this.debug("SPECIAL_CHAR="+key);

    switch (key)
    {
    case 'carriageReturn':
        this.cursor.x = 0;
        this.postCursor();
        break;

    case 'backspace':
        if (this.cursor.x>0)
        {
            this.cursor.x--;
            this.postCursor();
        }
        break;

    case 'lineFeed':
    case 'formFeed':
    case 'verticalTab':
        this.cursor.y++;
        if (this.cursor.y==this.margins.bottom+1)
        {
            this.scroll(1);
            this.cursor.y = this.margins.bottom;
        }
        if (this.cursor.y>=this.height) {
            this.cursor.y = this.height-1;
        }
        if (this.mode.newLineMode=='crlf')
        {
            this.cursor.x = 0;
        }
        this.postCursor();
        break;

    case 'horizontalTab':
        do {
            this.cursor.x++;
        } while (this.cursor.x<this.width && !this.tabs[this.cursor.x]);

        this.postCursor();
        break;

    case 'bell':
        this.postSpecial({ 'bell': 'bell' });
        break;

    default:
        this.debug("Warning: skipping specialChar event for key "+key);
    }
};

TTVEmulator.prototype.ev_arrow = function (dir, count)
{
    if (this.debugLevel>2) this.debug("ARROW=["+this.cursor.x+"/"+this.cursor.y+"] + "+dir+" "+count);

    var t = this.mode.originMode == 'screen' ? 0 : this.margins.top;
    var b = this.mode.originMode == 'screen' ? this.height : this.margins.bottom+1;

    switch ( dir )
    {
    case 'up':
        this.cursor.y -= count;
        if (this.cursor.y<t)
            this.cursor.y = t;
        break;

    case 'down':
        this.cursor.y += count;
        if (this.cursor.y>=b)
            this.cursor.y = b-1;
        break;

    case 'left':
        this.cursor.x -= count;
        if (this.cursor.x<0)
            this.cursor.x = 0;
        break;

    case 'right':
        this.cursor.x += count;
        if (this.cursor.x>=this.width)
            this.cursor.x = this.width-1;
        break;

    default:
        this.debug("Can't handle arrow event with direction "+dir);
        return;
    }

    this.postCursor();
}

TTVEmulator.prototype.ev_insertChars = function (count)
{
    if (this.debugLevel>2) this.debug("INSERT_CHARS="+count);
    //this.mode.insertLimited = value;

    // FIXME: The removal can be done in a single step
    for (var i=0; i<count; i++)
    {
        this.removeCharAt(this.width-1, this.cursor.y);
        this.insertCharAt(' ', this.cursor.x, this.cursor.y);
    }

    this.postChange(this.cursor.y, this.cursor.x, this.width-1);
}

TTVEmulator.prototype.ev_deleteChars = function (count)
{
    if (this.debugLevel>2) this.debug("DELETE_CHARS="+count);

    // FIXME: The removal can be done in a single step
    for (var i=0; i<count; i++)
    {
        this.insertDefaultCharAt(this.width-1, this.cursor.y);
        this.removeCharAt(this.cursor.x, this.cursor.y);
    }

    this.postChange(this.cursor.y, this.cursor.x, this.width-1);
}

TTVEmulator.prototype.ev_deleteLines = function(count)
{
    if (this.debugLevel>2) this.debug("DELETE_LINES="+count);

    if (this.cursor.y>this.margins.bottom)
        return;

    if (this.cursor.y<this.margins.top)
        return;

    // FIXME: This can be done in a single step
    for (var i=0; i<count; i++)
    {
        for (var y=this.cursor.y; y<this.margins.bottom; y++)
            this.moveLine(y+1, y); // copy line from y+1 to y

        for (var x=0; x<this.width; x++)
            this.setCharToDefaultAt(x, this.margins.bottom);
    }

    for (var y=this.cursor.y; y<=this.margins.bottom; y++)
        this.postChange(y, 0, this.width-1);
}

TTVEmulator.prototype.ev_insertLines = function (count)
{
    if (this.debugLevel>2) this.debug("INSERT_LINES="+count);

    if (this.cursor.y>this.margins.bottom)
        return;

    if (this.cursor.y<this.margins.top)
        return;

    // FIXME: This can be done in a single step
    for (var i=0; i<count; i++)
    {
        for (var y=this.margins.bottom; y>this.cursor.y; y--)
            this.moveLine(y-1, y); // move line from y-1 to y

        for (var x=0; x<this.width; x++)
            this.setCharToDefaultAt(x, this.cursor.y);
    }

    for (var y=this.cursor.y; y<=this.margins.bottom; y++)
        this.postChange(y, 0, this.width-1);
};

TTVEmulator.prototype.ev_index = function(how, count)
{
    if (this.debugLevel>2) this.debug("INDEX="+how);

    switch (how)
    {
    case 'down':
        for (var i=0; i<count; i++)
        {
            if (this.cursor.y==this.margins.bottom) {
                this.scroll(1);
            } else {
                this.cursor.y++;
            }
        }
        this.postCursor();
        break;

    case 'up':
        for (var i=0; i<count; i++)
        {
            if (this.cursor.y==this.margins.top) {
                this.scroll(-1);
            } else {
                this.cursor.y--;
            }
        }
        this.postCursor();
        break;

    case 'nextLine':
        this.ev_index('down', count);
        this.cursor.x = 0;
        this.postCursor();
        break;

    case 'prevLine':
        this.ev_index('up', count);
        this.cursor.x = 0;
        this.postCursor();
        break;

    default:
        this.debug("Can't index with method "+how);
    }
}

TTVEmulator.prototype.ev_mode = function (key, value)
{
    if (this.debugLevel>2) this.debug("MODE="+key+" ["+value+"]");
    switch ( key )
    {
        // mode[key] wouldn't work for the closure compiler
    case 'insert':
        this.mode.insert = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'cursorKeyANSI':
        this.mode.cursorKeyANSI = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'keypad':
        this.mode.keypad = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'mouseTrackingUp':
        this.mode.mouseTrackingUp = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'mouseTrackingDown':
        this.mode.mouseTrackingDown = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'scroll':
        this.mode.scroll = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'autoWrap':
        this.scr.autoWrap = value;
        //this.postSpecial({ 'key': key, 'value': value });
        break;

    case 'cursor':
        this.cursor.visible = value;
        this.postCursor();
        break;

    case 'cursorBlink':
        this.cursor.blink = value;
        break;

    case 'width':
        this.debug("width="+value);
        break;
    case 'height':
        this.debug("height="+value);
        break;

    case 'currentScreen':
        if (value!=this.mode.currentScreen)
        {
            this.debug("Exchange screens");

            var newscr    = this.scralt;
            var newscralt = this.scr;

            this.scr    = newscr;
            this.scralt = newscralt;

            this.mode.currentScreen = value;

            for (var y=0; y<this.height; y++)
                this.postChange(y, 0, this.width-1);
        }
        break;

    case 'originMode':
        this.mode.originMode = value;
        this.ev_goto(1, 1);
        break;

    case 'reverseScreen':
        if (value!=this.scr.reverseScreen)
        {
            this.debug("Reverse screen");

            this.scr.reverseScreen = value;

            var fg = this.scr.c.fcolor;
            this.scr.c.fcolor = this.scr.c.bcolor;
            this.scr.c.bcolor = fg;

            var fc = this.cursor.fcolor;
            this.cursor.fcolor = this.cursor.bcolor;
            this.cursor.bcolor = fc;

            for (var y=0; y<this.height; y++)
                this.postChange(y, 0, this.width-1);
        }
        break;

    case 'borderColor':
        this.postSpecial({'border' : value});
        this.debug("Setting border to [col="+value[0]+"; width="+value[1]+"]");
        break;

    default:
        this.debug("Warning: can't handle mode change '"+key+"' to '"+value+"'");
    }
}

TTVEmulator.prototype.ev_eraseInLine = function(how)
{
    if (this.debugLevel>2) this.debug("ERASE_IN_LINE="+how);

    var beg;
    var end;

    switch (how)
    {
    case 'toEnd':
        beg = this.cursor.x;
        end = this.width;
        break;

    case 'toStart':
        beg = 0;
        end = this.cursor.x+1;
        break;

    case 'whole':
        beg = 0;
        end = this.width;
        break;

    default:
        this.debug("Can't eraseInLine with method '" + how + "'");
        return;
    }

    // doesn not effect cursor position
    for (var x=beg; x<end; x++)
        this.overwriteCharAt(' ', x, this.cursor.y);
        //this.setCharToDefaultAt(x, this.cursor.y);

    this.postChange(this.cursor.y, beg, end-1);
}

TTVEmulator.prototype.ev_eraseInDisplay = function (how)
{
    if (this.debugLevel>2) this.debug("ERASE_IN_DISPLAY="+how);

    var begy;
    var endy;

    switch (how)
    {
    case 'toEnd':
        this.ev_eraseInLine('toEnd');
        begy = this.cursor.y+1;
        endy = this.height;
        break;

    case 'toStart':
        this.ev_eraseInLine('toStart');
        begy = 0;
        endy = this.cursor.y;
        break;

    case 'whole':
        begy = 0;
        endy = this.height;
        break;

    default:
        this.debug("Can't eraseInDisplay with method '" + how + "'");
        return;
    }

    // doesn not effect cursor position
    for (var y=begy; y<endy; y++)
        for (var x=0; x<this.width; x++)
            //this.setCharToDefaultAt(x, y);
            this.overwriteCharAt(' ', x, y);

    for (var y=begy; y<endy; y++)
        this.postChange(y, 0, this.width-1);
}

TTVEmulator.prototype.ev_goto = function (toX, toY)
{
    if (this.debugLevel>2) this.debug("GOTO="+toX+","+toY);

    var x = toX-1;
    var y = toY-1;

    if (x<0)
        x = 0;

    if (x>this.width)
        x = this.width;

    if (y<0)
        y = 0;

    if (this.mode.originMode=='screen')
    {
        if (y>=this.height)
            y = this.height-1;
    }
    else // originMode margin
    { 
        y += this.margins.top;

        if (y>this.margins.bottom)
            y = this.margins.bottom;
    }

    this.cursor.x = x;
    if (toY>=0)
        this.cursor.y = y;

    this.postCursor();
};

/*
TTVEmulator.prototype.ev_report = function (type)
{
    switch (type)
    {
    case 'status':
    case 'printer':
    case 'cursorPosition':
    case 'deviceAttributes':
    case 'versionString':
        // TODO
        break;

    default:
        this.debug("Can't handle report type "+type);
    }
}
*/

TTVEmulator.prototype.ev_setCharset = function(which, target)
{
    switch (which)
    {
    case ')': which = 'g0'; break;
    case '(': which = 'g1'; break;
    case '*': which = 'g2'; break;
    case '+': which = 'g3'; break;
    }

    switch (target)
    {
    case 'A': target = 'uk';         break;
    case 'B': target = 'us';         break;
    // case '4' dutch
    // case 'C' finnish
    // case '5' finnish
    // case 'R' french
    // case 'Q' french canadian
    // case 'K' german
    // case 'Y' italian
    // case 'E' norwegian / danish
    // case '6' norwegian / danish
    // case 'Z' spanish
    // case 'H' swedish
    // case '7' swedish
    // case '=' swiss
    case '0': target = 'line';       break;
    case '1': target = 'rom';        break;
    case '2': target = 'romSpecial'; break;
    }

    this.charsets[which] = target;
}

TTVEmulator.prototype.ev_switchCharset = function(action, which)
{
    this.charsets.active = which;
}

TTVEmulator.prototype.removeCharAt = function(x, y)
{
    var idx = x + y*this.width;

    this.scr.c.text.splice(        idx, 1);
    this.scr.c.bold.splice(        idx, 1);
    this.scr.c.underline.splice(   idx, 1);
    this.scr.c.lowintensity.splice(idx, 1);
    this.scr.c.blink.splice(       idx, 1);
    this.scr.c.fcolor.splice(      idx, 1);
    this.scr.c.bcolor.splice(      idx, 1);
}

TTVEmulator.prototype.insertCharAt = function(ch, x, y)
{
    var idx = x + y*this.width;

    this.scr.c.text.splice(        idx, 0, ch);
    this.scr.c.bold.splice(        idx, 0, this.cursor.bold);
    this.scr.c.underline.splice(   idx, 0, this.cursor.underline);
    this.scr.c.lowintensity.splice(idx, 0, this.cursor.lowintensity);
    this.scr.c.blink.splice(       idx, 0, this.cursor.blink);
    this.scr.c.fcolor.splice(      idx, 0, this.cursor.fcolor);
    this.scr.c.bcolor.splice(      idx, 0, this.cursor.bcolor);
}

TTVEmulator.prototype.insertDefaultCharAt = function(x, y)
{
    var idx = x + y*this.width;

    this.scr.c.text.splice(        idx, 0, ' ');
    this.scr.c.bold.splice(        idx, 0, false);
    this.scr.c.underline.splice(   idx, 0, false);
    this.scr.c.lowintensity.splice(idx, 0, false);
    this.scr.c.blink.splice(       idx, 0, false);
    this.scr.c.fcolor.splice(      idx, 0, 7);
    this.scr.c.bcolor.splice(      idx, 0, 0);
}

TTVEmulator.prototype.overwriteCharAt = function(ch, x, y)
{
    var idx = x + y*this.width;

    this.scr.c.text.splice(        idx, 1, ch);
    this.scr.c.bold.splice(        idx, 1, this.cursor.bold);
    this.scr.c.underline.splice(   idx, 1, this.cursor.underline);
    this.scr.c.lowintensity.splice(idx, 1, this.cursor.lowintensity);
    this.scr.c.blink.splice(       idx, 1, this.cursor.blink);
    this.scr.c.fcolor.splice(      idx, 1, this.cursor.fcolor);
    this.scr.c.bcolor.splice(      idx, 1, this.cursor.bcolor);
}

TTVEmulator.prototype.setCharToDefaultAt = function(x, y)
{
    var idx = x + y*this.width;

    this.scr.c.text[idx]         = ' ';
    this.scr.c.bold[idx]         = false;
    this.scr.c.underline[idx]    = false;
    this.scr.c.lowintensity[idx] = false;
    this.scr.c.blink[idx]        = false;
    this.scr.c.fcolor[idx]       = 7;
    this.scr.c.bcolor[idx]       = 0;
}

TTVEmulator.prototype.copyChar = function(fromIdx, toIdx)
{
    this.scr.c.text.splice(        toIdx, 1, this.scr.c.text[fromIdx]);
    this.scr.c.bold.splice(        toIdx, 1, this.scr.c.bold[fromIdx]);
    this.scr.c.underline.splice(   toIdx, 1, this.scr.c.underline[fromIdx]);
    this.scr.c.lowintensity.splice(toIdx, 1, this.scr.c.lowintensity[fromIdx]);
    this.scr.c.blink.splice(       toIdx, 1, this.scr.c.blink[fromIdx]);
    this.scr.c.fcolor.splice(      toIdx, 1, this.scr.c.fcolor[fromIdx]);
    this.scr.c.bcolor.splice(      toIdx, 1, this.scr.c.bcolor[fromIdx]);
};

TTVEmulator.prototype.moveLine = function(from, to)
{
    for (var x=0; x<this.width; x++)
    {
        var fromIdx = x + from*this.width;
        var toIdx   = x + to  *this.width;

        this.copyChar(fromIdx, toIdx);
    }
}

TTVEmulator.prototype.scroll = function (lines)
{
    if (this.debugLevel>2) this.debug("SCROLL="+lines);

    if (lines==0 || isNaN(lines))
        return;

    // FIXME: The removal can be done in a single step
    if (lines>0)
    {
        for (var i=0; i<lines; i++)
        {
            for (var j=0; j<this.width; j++)
            {
                this.insertCharAt(' ', 0, this.margins.bottom+1);
                this.removeCharAt(0, this.margins.top);
            }
        }
    }
    else
        for (var i=lines; i>0; i--)
        {
            for (var j=0; j<this.width; j++)
            {
                this.removeCharAt(0, this.margins.bottom);
                this.insertCharAt(' ', 0, this.margins.top);
            }
        }

    for (var y=this.margins.top; y<=this.margins.bottom; y++)
        this.postChange(y, 0, this.width-1);
}

TTVEmulator.prototype.ev_unknown = function(type, v)
{
    this.debug("Warning: Event '"+type+"' not implemented: "+v);
}
TTVEmulator.prototype.ev_hardware = function(v)
{
    this.ev_unknown("hardware", v);
}
TTVEmulator.prototype.ev_led = function(v)
{
    this.ev_unknown("led", v);
}
TTVEmulator.prototype.ev_reset = function(v)
{
    // Reset all terminal setting to default (whatever 'all' means)
    // (maybe 'word wrap' and all h/l settings
    this.ev_unknown("reset", v);
}
TTVEmulator.prototype.ev_g2char = function(v)
{
    this.ev_unknown("g2char", v);
}
TTVEmulator.prototype.ev_g3char = function(v)
{
    this.ev_unknown("g3char", v);
}
TTVEmulator.prototype.ev_softReset = function(v)
{
    this.ev_unknown("softReset", v);
}
TTVEmulator.prototype.ev_selfTestRaw = function(v)
{
    this.ev_unknown("selfTestRaw", v);
}
TTVEmulator.prototype.ev_lineAttr = function(v)
{
    this.ev_unknown("lineAttr", v);
}
TTVEmulator.prototype.ev_tabStop = function(v)
{
    this.ev_unknown("tabStop", v);
}
