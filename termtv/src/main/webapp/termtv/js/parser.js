'use strict';

// todo: vt102 printing (vt102 user guide, chapter 5, "printing")
/**
 * @constructor
 */
function TTVParser(term_cb, dbg)
{
    var parser = this;

    parser.debug = function(txt)
    {
        dbg ? dbg("parse.js: "+txt) : alert("parse.js: "+txt);
    }
    parser.emu = term_cb;
    parser.buffer = '';

    return parser;
};

TTVParser.prototype.parse = function(str)
{
    /*
     // This version would work very nicely if browswers would
     // already support the y-modifier
    if (!this.pos)
        this.pos = 0;

    while (this.pos<pos)
    {
        for (var i=0; i<this.handlables.length; i++)
        {
            // Check regex
            this.handlables[i][0].lastIndex = this.pos;
            var match = this.handlables[i][0].exec(str);
            if (match && match[0].length>0)
            {
                // Call corresponding (callback-)function to process the match
                this.handlables[i][1].call(this, match);

                // Remove match from buffer
                //this.buffer = this.buffer.substr(match[0].length);

                //alert("i="+this.handlables[i][0].lastIndex+" "+match[0].length);

                this.pos += match[0].length;//this.handlables[i][0].lastIndex;
                break;
            }
        }
    }
    */

    this.buffer += str;
    while (this.handleBuffer()) { };
};

TTVParser.prototype.getBuffer = function()
{
    return this.buffer;
}

TTVParser.prototype.setBuffer = function(obj)
{
    this.buffer = obj;
}

TTVParser.prototype.handleBuffer = function()
{
    for (var i=0; i<this.handlables.length; i++)
    {
        // Check regex
        var match = this.handlables[i][0].exec(this.buffer);
        if (!match || match[0].length==0)
            continue;

        // FIXME: It is most probably much more efficient to
        // check for the first character and in case of an escape
        // sequence only compare the remaining string.

        // Call corresponding (callback-)function to process the match
        this.handlables[i][1].call(this, match);

        // Remove match from buffer
        this.buffer = this.buffer.substr(match[0].length);

        return true;
    }

    // If we have not yet found the right escape sequence and
    // the first character is an escape character, remove it.
    // Otherwise we get stuck. We could do that as last check
    // in the loop over the handlabels, but maybe a sequence
    // ot split into to chunks.
    if (this.buffer.length>50 && this.buffer[0]=='\x1b')
    {
        this.debug("Unknown escape sequence: "+
                   this.buffer[1].charCodeAt(0).toString(16)+" "+
                   this.buffer[2].charCodeAt(0).toString(16)+" "+
                   this.buffer[3].charCodeAt(0).toString(16)+" "+
                   this.buffer[4].charCodeAt(0).toString(16)+" "+
                   this.buffer[5].charCodeAt(0).toString(16)+" "+
                   this.buffer[6].charCodeAt(0).toString(16)+" "+
                   this.buffer[7].charCodeAt(0).toString(16)+" "+
                   this.buffer[8].charCodeAt(0).toString(16)+" "+
                   this.buffer[9].charCodeAt(0).toString(16)+" ["+this.buffer+"]");
        this.emu.ev_normalString('\0');

        this.buffer = this.buffer.substr(1);
    }

    return false;
}

// Should be ordered by frequency of occurance
TTVParser.prototype.handlables =
[
    ////////////////////////////////////////////////////////////////////////////////
    // UTF-8
    // 1 byte: 0xxxxxxx                                    // standard ascii
    // 2 byte: 110xxxxx 10xxxxxx                           // c0-c1
    // 3 byte: 1110xxxx 10xxxxxx 10xxxxxx                  // f5-ff
    // 4 byte: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx

    // ascii // Everything except escape, special chars and 1xxxx xxxx
    // was: [/^[^\x1b\007\010\011\012\013\014\015\016\017\x80-\xFF]?/,
    [/^[\x20-\x7F]+/, function (m) {
        this.emu.ev_normalString(m[0]);
    }],
    //[/^([\x80-\xC1]|[\xF5-\xFF])/, function (m) {
    //    this.debug("Malformed unicode[1]: "+m[0].charCodeAt(0).toString(16));
    //    this.cb('normalString', '\0');
    //}],

    // was: [/^[\xC2\xDF][\x80-\xBF]/
    [/^[\xC2-\xDF][\x80-\xBF]/, function (m) {
        var p1 = m[0].charCodeAt(0) & 0x1f; // 0001 1111
        var p2 = m[0].charCodeAt(1) & 0x3f; // 0011 1111
        var code = (p1<<6) | p2;
        this.emu.ev_normalString(String.fromCharCode(code));
    }],
    //[/^[\xC2-\xDF][\x00-\xFF]/, function (m) {
    //    this.debug("Malformed unicode[2]: "+m[0].charCodeAt(0).toString(16)+" "+m[0].charCodeAt(1).toString(16));
    //    this.cb('normalString', '\0');
    //}],


    ////////////////////////////////////////////////////////////////////////////////
    // attributes (colors)
    [/^\x1b\[([0-9;]*)m/, function (m) {
        this.emu.ev_setAttribute(m[1].split(';'));
    }],
    ////////////////////////////////////////////////////////////////////////////////


    // was: [/^(\xE0[\xA0-\xBF]|[\xE1-\xEC][\x80-\xBF]|\xED[\x80-\x9F]|[\xEE-\xEF][\x80-\xBF])[\x80-\xBF]/
    [/^[\xE0-\xEF][\x80-\xBF][\x80-\xBF]/, function (m) {
        var p1 = m[0].charCodeAt(0) & 0x0f; // 0000 1111
        var p2 = m[0].charCodeAt(1) & 0x3f; // 1000 0000
        var p3 = m[0].charCodeAt(2) & 0x3f; // 1000 0000
        var code = (p1<<12) | (p2<<6) | p3;
        this.emu.ev_normalString(String.fromCharCode(code));
    }],
    //[/^[\xE0-\xEF][\x00-\xFF][\x00-\xFF]/, function (m) {
    //    this.debug("Malformed unicode[3]: "+m[0].charCodeAt(0).toString(16)+" "+m[0].charCodeAt(1).toString(16)+" "+m[0].charCodeAt(2).toString(16));
    //    this.cb('normalString', '\0');
    //}],

    // was: [/^(\xF0[\x90-\xBF]|[\xF1-\xF3][\x80-\xBF]|\xF4[\x80-\x8F])[\x80-\xBF][\x80-\xBF]/
    [/^[\xF0-\xF4][\x80-\xBF][\x80-\xBF][\x80-\xBF]/, function (m) {
        var p1 = m[0].charCodeAt(0) & 0x07; // 0000 0111
        var p2 = m[0].charCodeAt(1) & 0x3f; // 0011 1111
        var p3 = m[0].charCodeAt(2) & 0x3f; // 0011 1111
        var p4 = m[0].charCodeAt(3) & 0x3f; // 0011 1111
        var code = (p1<<18) | (p2<<12) | (p3<<6) | p4;
        this.emu.ev_normalString(String.fromCharCode(code));
    }],
    //[/^[\xF0-\xF4][\x00-\xFF][\x00-\xFF][\x00-\xFF]/, function (m) {
    //    this.debug("Malformed unicode[4]: "+m[0].charCodeAt(0).toString(16)+" "+m[0].charCodeAt(1).toString(16)+" "+m[0].charCodeAt(3).toString(16)+" "+m[0].charCodeAt(4).toString(16));
    //    this.cb('normalString', '\0');
    //}],

    // This is how my shell processed unknown characters... if no proper unicode character
    // is detected, the characters are interpreted one-by-one
    [/^([\x80-\xFF])/, function (m) {
        // The best thing we can do is to assume that this is
        // 8bit ascii
        this.emu.ev_normalString(m[0]);
        // this.debug("Invalid code: "+m[0].charCodeAt(0).toString(16)+" ["+m[0]+"]");
        // this.cb('normalString', '\0');
    }],

    ////////////////////////////////////////////////////////////////////////////////
    // control characters
    [/^\x07/, function (m) {
        this.emu.ev_specialChar('bell');
    }],
    [/^\x08/, function (m) {
        this.emu.ev_specialChar('backspace');
    }],
    [/^\x09/, function (m) {
        this.emu.ev_specialChar('horizontalTab');
    }],
    [/^\x0a/, function (m) {
        this.emu.ev_specialChar('lineFeed');
    }],
    [/^\x0b/, function (m) {
        this.emu.ev_specialChar('verticalTab');
    }],
    [/^\x0c/, function (m) {
        this.emu.ev_specialChar('formFeed');
    }],
    [/^\x0d/, function (m) {
        this.emu.ev_specialChar('carriageReturn');
    }],
    [/^\x0e/, function (m) {
        this.emu.ev_switchCharset('g1');
    }],
    [/^\x0f/, function (m) {
        this.emu.ev_switchCharset('g0');
    }],

    [/^\x1bF/, function (m) { // vt52: enter graphics mode
        //this.emu.ev_switchCharset('g0', 'line');
    }],
    [/^\x1bG/, function (m) { // vt52: exit graphics mode
        //this.emu.ev_switchCharset('g0', 'us');
    }],


    ////////////////////////////////////////////////////////////////////////////////
    // very often used: home and goto

    [/^\x1b\[[Hf]/, function (m) {
        this.emu.ev_goto( 1, 1 );
    }],
    [/^\x1b\[([0-9]*)G/, function (m) {
        this.emu.ev_goto(parseInt(m[1] || '1', 10), -1);  // y=-1 (keep line)
    }],

    // cursor set position
    [/^\x1b\[([0-9]*);([0-9]*)[Hf]/, function (m) {
        this.emu.ev_goto(parseInt(m[2] || '1', 10), parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)d/, function (m) {
        this.emu.ev_goto(1, parseInt(m[1] || '1', 10));

    }],

    ////////////////////////////////////////////////////////////////////////////////
    // obsolete control characters

    [/^[\x00-\x06]/, function() { } ],
    [/^[\x10-\x1a]/, function() { } ],
    [/^[\x1c-\x1f]/, function() { } ],
/*
    [/^\000/, function (m) {
        this.cb('specialChar', 'null');
    }],
    [/^\001/, function (m) {
        this.cb('specialChar', 'startOfHeading');
    }],
    [/^\002/, function (m) {
        this.cb('specialChar', 'startOfText');
    }],
    [/^\003/, function (m) {
        this.cb('specialChar', 'endOfText');
    }],
    [/^\004/, function (m) {
        this.cb('specialChar', 'endOfTransmission');
    }],
    [/^\005/, function (m) {
        this.cb('specialChar', 'enquiry');
    }],
    [/^\006/, function (m) {
        this.cb('specialChar', 'acknoledge');
    }],

    [/^\020/, function (m) {
        this.cb('specialChar', 'dataLinkEscape');
    }],
    [/^\021/, function (m) {
        this.cb('specialChar', 'deviceControl1');
    }],
    [/^\022/, function (m) {
        this.cb('specialChar', 'deviceControl2');
    }],
    [/^\023/, function (m) {
        this.cb('specialChar', 'deviceControl3');
    }],
    [/^\024/, function (m) {
        this.cb('specialChar', 'deviceControl4');
    }],
    [/^\025/, function (m) {
        this.cb('specialChar', 'negativeAcknowledge');
    }],
    [/^\026/, function (m) {
        this.cb('specialChar', 'synchronousIdle');
    }],
    [/^\027/, function (m) {
        this.cb('specialChar', 'endOfTransmissionBlok');
    }],
    [/^\030/, function (m) {
        this.cb('specialChar', 'cancel');
    }],
    [/^\031/, function (m) {
        this.cb('specialChar', 'endOfMedium');
    }],
    [/^\032/, function (m) {
        this.cb('specialChar', 'substitute');
    }],
    [/^\034/, function (m) {
        this.cb('specialChar', 'fileSeparator');
    }],
    [/^\035/, function (m) {
        this.cb('specialChar', 'groupSeparator');
    }],
    [/^\036/, function (m) {
        this.cb('specialChar', 'recordSeparator');
    }],
    [/^\037/, function (m) {
        this.cb('specialChar', 'unitSeparator');
    }],
    */

    ////////////////////////////////////////////////////////////////////////////////

    // erase in line
    [/^\x1b\[0?K/, function (m) {
        this.emu.ev_eraseInLine('toEnd');
    }],
    [/^\x1b\[1K/, function (m) {
        this.emu.ev_eraseInLine('toStart');
    }],
    [/^\x1b\[2K/, function (m) {
        this.emu.ev_eraseInLine('whole');
    }],
    [/^\x1bK/, function (m) { // vt52
        this.emu.ev_eraseInLine('toEnd');
    }],

    // erase in display 
    [/^\x1b\[0?J/, function (m) {
        this.emu.ev_eraseInDisplay('toEnd');
    }],
    [/^\x1b\[1J/, function (m) {
        this.emu.ev_eraseInDisplay('toStart');
    }],
    [/^\x1b\[2J/, function (m) {
        this.emu.ev_eraseInDisplay('whole');
    }],
    [/^\x1bJ/, function (m) { // vt52
        this.emu.ev_eraseInDisplay('toEnd');
    }],

    // insertion and deletion
    [/^\x1b\[([0-9]*)P/, function (m) {
        this.emu.ev_deleteChars(parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)X/, function (m) {
        this.emu.ev_deleteChars(parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)L/, function (m) {
        this.emu.ev_insertLines(parseInt(m[1] ||'1', 10));
    }],
    [/^\x1b\[([0-9]*)M/, function (m) {
        this.emu.ev_deleteLines(parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9])*@/, function (m) { // insert N characters
       this.emu.ev_insertChars(parseInt(m[1] || '1', 10));
       //this.emu.ev_mode('insertLimited', parseInt(m[1] || '1', 10));
    }],

    // margins
    [/^\x1b\[([0-9]+);([0-9]+)r/, function (m) {
        this.emu.ev_setMargins(parseInt(m[1], 10), parseInt(m[2], 10));
    }],
    [/^\x1b\[r/, function (m) {
        this.emu.ev_resetMargins();
    }],

    ////////////////////////////////////////////////////////////////////////////////
    // control sequences

    // 3: italic (rxvt)
    // 6: overline (eterm)
    // 9: strikeout (gnome, guake, nautilus, terminator, xfce4, vte)
    [/^\x1b\[\[([0-9;]*)m/, function (m) {
    }],


    // arrow keys
    [/^\x1b\[([0-9]*)A/, function (m) {
        this.emu.ev_arrow('up', parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)B/, function (m) {
        this.emu.ev_arrow('down', parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)C/, function (m) {
        this.emu.ev_arrow('right', parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)D/, function (m) {
        this.emu.ev_arrow('left', parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)E/, function (m) {
        this.emu.ev_index('nextLine', parseInt(m[1] || '1', 10));
    }],
    [/^\x1b\[([0-9]*)F/, function (m) {
        this.emu.ev_index('prevLine', parseInt(m[1] || '1', 10));
    }],

    [/^\x1bA([\x20-\x7F]?)/, function (m) {  // vt52
        this.emu.ev_arrow('up', m[1] ? m[1].charCodeAt(0)-32+1 : 1);
    }],
    [/^\x1bB([\x20-\x7F]?)/, function (m) {  // vt52
        this.emu.ev_arrow('down', m[1] ? m[1].charCodeAt(0)-32+1 : 1);
    }],
    [/^\x1bC([\x20-\x7F]?)/, function (m) {  // vt52
        this.emu.ev_arrow('right', m[1] ? m[1].charCodeAt(0)-32+1 : 1);
    }],
    [/^\x1bD/, function (m) {  // vt52
        this.emu.ev_arrow('left', 1);
    }],
    [/^\x1bY(..)/, function (m) { // vt52
        this.emu.ev_goto(m[1].charCodeAt(1)-32+1, m[1].charCodeAt(0)-32+1);
    }],

    // vt52: \x1bI reverse line feed
    // \x1bl  move to first line (keep x)

    // cursor to lower left corner (vt100)
    //[/^\x1bF/, function (m) {
    //}],

    // \x1b[{n}Z  cursor back tab
    // \x1b[{n}I  cursor horizontal tab
    // \x1b[{n}W  cursor tab stop control
    // \x1b[{n}Y  cursor vertical tab
    // \x1b[{n}P  delete character
    // \x1b#8     screen alignment display
    // \x1b[H     horizontal tab stop


    // index and friends
    [/^\x1bD/, function (m) {
        this.emu.ev_index('down', 1);
    }],
    [/^\x1bM/, function (m) {
        this.emu.ev_index('up', 1);
    }],
    [/^\x1bE/, function (m) {
        this.emu.ev_index('nextLine', 1);
    }],


    // \x1b[6] back index
    // \x1b[9] forward index

    // cursor save/restore
    // Saves in terminal memory the:
    //         cursor position
    //         graphic rendition
    //         character set shift state
    //         state of wrap flag
    //         state of origin mode
    //         state of selective erase
    [/^\x1b[7]/, function (m) {
        this.emu.ev_cursorStack('push', true);
    }],
    [/^\x1b[8]/, function (m) {
        this.emu.ev_cursorStack('pop', true);
    }],
    // cursor save/restore position only
    [/^\x1b\[s/, function (m) {
        this.emu.ev_cursorStack('push', false);
    }],
    [/^\x1b\[u/, function (m) {
        this.emu.ev_cursorStack('pop', false);
    }],

    // keypad
    [/^\x1b=/, function (m) {
        this.emu.ev_mode('keypad', 'cursor');
    }],
    [/^\x1b>/, function (m) {
        this.emu.ev_mode('keypad', 'numeric');
    }],

    // mode set/reset
    //[/^\x1b\[(\??)([^\x1b]*?)h/, function (m) {
    [/^\x1b\[(\??)([0-9;]+)h/, function (m) {
        var me = this;
        m[2].split(';').forEach(function (sub) {
                me.setMode(m[1] + sub);
            });
    }],
    //[/^\x1b\[(\??)([^\x1b]*?)l/, function (m) {
    [/^\x1b\[(\??)([0-9;]+)l/, function (m) {
        var me = this;
        m[2].split(';').forEach(function (sub) {
                me.resetMode(m[1] + sub);
            });
    }],

    // curser layout;  '\x1b[?17;0;0c' hide cursor
    [/^\x1b\[\?([0-9;]*)c/, function (m) {
        this.debug("cursor layout"+m[1]);
    }],

    // horizontal tab stops
    [/^\x1bH/, function (m) {
        //this.emu.ev_tabStop('add');    // set a tab stop at the current position
        this.emu.ev_goto( 1, 1);    // vt52: home
    }],
    [/^\x1b\[0?g/, function (m) {
        this.emu.ev_tabStop('remove'); // clear tabs at the current position
    }],
    [/^\x1b\[3g/, function (m) {
        this.emu.ev_tabStop('clear');  // clear all tab stops
    }],

    // line attributes
    [/^\x1b#3/, function (m) {
        this.emu.ev_lineAttr('dwdhTopHalf');
    }],
    [/^\x1b#4/, function (m) {
        this.emu.ev_lineAttr('dwdhBottomHalf');
    }],
    [/^\x1b#5/, function (m) {
        this.emu.ev_lineAttr('swsh');
    }],
    [/^\x1b#6/, function (m) {
        this.emu.ev_lineAttr('dwsh');
    }],

    // erase in area
    // \x1b\[0?K    toEnd
    // \x1b\[1K     toStart
    // \x1b\[2K     whole

    // erase in field
    // \x1b\[0?N    toEnd
    // \x1b\[1N     toStart
    // \x1b\[2N     whole

    // erase character
    // \x1b[{N}X

    // \x1b[{N}T scroll down
    // \x1b[{N}S scroll up


    // There is \x1b[?...J as well (erase "selective" in display)
    // There is \x1b[?...K as well (erase "selective" in line)

    // \x1bV Start of guarded area
    // \x1bW End of guarded area

    // \x1bl Lock memory above cursor
    // \x1bm Unlock memory above cursor

    // reset
    [/^\x1b\[!p/, function (m) {
        this.emu.ev_softReset();
    }],
    [/^\x1bc/, function (m) {
        this.emu.ev_reset();
    }],

    // resize terminal: \e[8;{height};{width}t
    [/^\x1b\[([0-9;]*)t/, function (m) {
    }],

    // xterm-style titles
    [/^\x1b\]2;([^\x1b\x07]*)\x07/, function (m) {
        this.emu.ev_setWindowTitle(m[1]);
    }],
    [/^\x1b\]1;([^\x1b\x07]*)\x07/, function (m) {
        this.emu.ev_setIconTitle(m[1]);
    }],
    [/^\x1b\]0;([^\x1b\x07]*)\x07/, function (m) {
        this.emu.ev_setWindowIconTitle(m[1]);
    }],

    // character set selection
    // United kingdom: (A, )A, *A, +A  [g0, g1, g2, g3]
    // USASCII:        (B, )B, *B, +B  [g0, g1, g2, g3]
    // graphics:       (0, )0, *0, +0  [g0, g1, g2, g3]
    // graphics:       (1, )1, *1, +1  [g0, g1, g2, g3]
    // graphics:       (2, )2, *2, +2  [g0, g1, g2, g3]
    [/^\x1b\$?([()*+-./])([ABCEHKQRYZ0124567=])/, function (m) {
        this.emu.ev_setCharset(m[1], m[2]);
    }],

    // temporary character set
    [/^\x1bN(a|[^a])/, function (m) {
        this.emu.ev_g2char(m[1]);
    }],
    [/^\x1bO(a|[^a])/, function (m) {
        this.emu.ev_g3char(m[1]);
    }],

    // reports (skipped, we are not emulating an interactive terminal)
    [/^\x1b([0-9;?]*)n/, function (m) {
        /*var me = this;
        m[1].split(';').forEach(function (r) {
                me.handleReportRequest(r);
            });*/
    }],
    [/^\x1b(\[0?c|Z)/, function (m) {
        //this.emu.ev_report('deviceAttributes');
    }],
    [/^\x1b\[>c/, function (m) {
        //this.emu.ev_report('versionString');
    }],

    // LEDs
    [/^\x1b\[([0-9;]*)q/, function (m) {
        var me = this;
        (m[1].length ? m[1] : '0').split(';').forEach(function (l) {
                me.handleLED(l);
            });
    }],

    // printing (we son't have to support that
    // Print current screen, 1: print current line,
    // 4: disable log, 5: enable log (echo to printer)
    [/^\x1b\[[145]?i/, function (m) {
    }],

    //
    [/^\x1b\[([0-9;]*)y/, function (m) {
        this.emu.ev_hardware('selfTestRaw', m[1]);
    }],
    [/^\x1b#8/, function (m) {
        this.emu.ev_hardware('screenAlignment');
    }],

    // xterm: select default character set (ISO8859-1)
    [/^\x1b%@/, function (m) {
        //enable utf8?
        //this.cb('mode', 'utf8');
    }],
    // xterm: select default character set (ISO2022)
    [/^\x1b%G/, function (m) {
        //enable utf8?
        //this.cb('mode', 'utf8');
    }],

    // screensaver control
    [/^\x1b\[9;([0-9]+)\]/, function (m) {
        //this.emu.ev_mode('borderColor', [ m[1], m[2] ]);
        // \x1b[9;X]  X in minutes (0 off)
    }],

    // My extension to control the 'border color'
    [/^\x1b\[([0-9]+)(;[0-9]+)?\xb0/, function (m) {
        this.emu.ev_mode('borderColor', [ m[1], m[2] ? m[2].substr(1) : null ]);
    }]
];

TTVParser.prototype.setMode = function (mode)
{
    switch (mode)
    {
        // cursor keys in applications mode
    case '?1':
        this.emu.ev_mode('cursorKeyANSI', false);
        break;

    case '?3':
        this.emu.ev_mode('width', 132);
        break;

    case '?4':
        this.emu.ev_mode('scroll', 'smooth');
        break;

    case '?5':
        this.emu.ev_mode('reverseScreen', true);
        break;

    case '?6':
        this.emu.ev_mode('originMode', 'margin');
        break;

    case '?7':
        this.emu.ev_mode('autoWrap', true);
        break;

    case '?8':
        this.emu.ev_mode('autoRepeat', true);
        break;

    case '?9':
        this.emu.ev_mode('mouseTrackingDown', true);
        break;

    case '?12':
        this.emu.ev_mode('cursorBlink', true);
        break;

    case '?25':
        this.emu.ev_mode('cursor', true);
        break;

        // xterm
        // case '?34':   // right to left mode
        // case '?42':   // hide/show scroll bar
        // case '?43':   // history on/off
        // case '?44':   // margin bell on/off
        // case '?45':   // reverse wrap around on/off
        // case '?48':   // reverse/normal status line
        // case '?49':   // page/normal scroll mode
        // case '?E':    // erase status line
        // case '?F':    // return from status line
        // case '?H':    // hide status line
        // case '?S':    // show status line
        // case '?{N}T': // goto column {N} of status line


    case '?47':
        this.emu.ev_mode('currentScreen', 0);
        break;

    case '?69':
        // Left right margin mode
        //this.cb('mode', 'currentScreen', 1);
        break;

    case '?1000':
        this.emu.ev_mode('mouseTrackingUp', true);
        break;

    case '?1034':
        this.emu.ev_mode('metaKey', true);
        break;

    case '?1047':
        this.emu.ev_mode('currentScreen', 0);
        break;

    case '?1048':
        this.emu.ev_cursorStack('push', true);
        break;

    case '?1049':
        this.emu.ev_cursorStack('push', true);
        this.emu.ev_mode('currentScreen', 0);
        this.emu.ev_eraseInLine('whole');
        break;

    case '2':
        this.emu.ev_mode('keyboardLocked', true);
        break;

    case '4':
        this.emu.ev_mode('insert', true);
        break;

    case '12':
        this.emu.ev_mode('localEcho', false);
        break;

    case '20':
        this.emu.ev_mode('newLineMode', 'crlf');
        break;

    default:
        this.debug('Unhandled set mode: "' + mode + '"');
    }
};

TTVParser.prototype.resetMode = function (mode)
{
    switch (mode)
    {
        // cursor keys in cursor positioning mode
    case '?1':
        this.emu.ev_mode('cursorKeyANSI', true);
        break;

    case '?2':
        this.emu.ev_mode('vt52', true);
        break;

    case '?3':
        this.emu.ev_mode('width', 80);
        break;

    case '?4':
        this.emu.ev_mode('scroll', 'jump');
        break;

    case '?5':
        this.emu.ev_mode('reverseScreen', false);
        break;

    case '?6':
        this.emu.ev_mode('originMode', 'screen');
        break;

    case '?7':
        this.emu.ev_mode('autoWrap', false);
        break;

    case '?8':
        this.emu.ev_mode('autoRepeat', false);
        break;

    case '?9':
        this.emu.ev_mode('mouseTrackingDown', false);
        break;

    case '?12':
        this.emu.ev_mode('cursorBlink', false);
        break;

    case '?25':
        this.emu.ev_mode('cursor', false);
        break;

    case '?47':
        this.emu.ev_mode('currentScreen', 1);
        break;

    case '?69':
        // Left right amrgin mode
        //this.cb('mode', 'currentScreen', 1);
        break;

    case '?1000':
        this.emu.ev_mode('mouseTrackingUp', false);
        break;

    case '?1034':
        this.emu.ev_mode('metaKey', false);
        break;

    case '?1047':
        this.emu.ev_eraseInLine('whole');
        this.emu.ev_mode('currentScreen', 1);
        break;

    case '?1048':
        this.emu.ev_cursorStack('pop', true);
        break;

    case '?1049':
        this.emu.ev_mode('currentScreen', 1);
        this.emu.ev_cursorStack('pop', true);
        break;

    case '2':
        this.emu.ev_mode('keyboardLocked', false);
        break;

    case '4':
        this.emu.ev_mode('insert', false);
        break;

    case '12':
        this.emu.ev_mode('localEcho', true);
        break;

    case '20':
        this.emu.ev_mode('newLineMode', 'cr');
        break;

    default:
        this.debug('Unhandled reset mode: "' + mode + '"');
    }
};

/*
TTVParser.prototype.handleReportRequest = function (req)
{
    switch (req)
    {
    case '5':
        this.emu.ev_report('status');
        break;

    case '?15':
        this.emu.ev_report('printer');
        break;

    case '6':
        this.emu.ev_report('cursorPosition');
        break;

    default:
        this.debug('Unhandled report request: "' + req + '"');
    }
};*/

TTVParser.prototype.handleLED = function (led)
{
    led = parseInt(led, 10);
    if ( led == 0 ) {
        this.emu.ev_led('off', 'all');
    } else {
        this.emu.ev_led('on', led);
    }
}
