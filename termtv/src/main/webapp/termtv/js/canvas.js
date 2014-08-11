'use strict';

TTVCanvas.prototype.getFontSize = function(ctx, font)
{
    var rc = [];

    ctx.font = font;
    rc[0] = ctx.measureText('WWWWI').width;

    ctx.font = "bold "+font;
    rc[1] = ctx.measureText('WWWWI').width;

    ctx.font = "lighter "+font;
    rc[2] = ctx.measureText('WWWWI').width;

    return rc;
}

TTVCanvas.prototype.waitForFonts = function()
{
    var s = this;

    if (s.fontsize)
    {
        var ctx = s.canvas.getContext('2d');

        var f1 = "300px sans";
        var f2 = "300px serif";
        var f3 = "300px "+s.fontFamily+", sans";
        var f4 = "300px "+s.fontFamily+", serif";

        var rc1 = s.getFontSize(ctx, f1);
        var rc2 = s.getFontSize(ctx, f2);
        var rc3 = s.getFontSize(ctx, f3);
        var rc4 = s.getFontSize(ctx, f4);

        var test0 = rc3[0]!=rc4[0] || rc3[0]==rc1[0] || rc4[0]==rc2[0];
        var test1 = rc3[1]!=rc4[1] || rc3[1]==rc1[1] || rc4[1]==rc2[1];
        var test2 = rc3[2]!=rc4[2] || rc3[2]==rc1[2] || rc4[2]==rc2[2];
        if (test0 || test1 || test2)
        {
            setTimeout(function() { s.waitForFonts(); }, 20);
            return;
        }

        s.normalFontName = "normal " +s.fontsize+"px "+s.fontFamily;
        s.boldFontName   = "bold "   +s.fontsize+"px "+s.fontFamily;
        s.lightFontName  = "lighter "+s.fontsize+"px "+s.fontFamily;

        ctx.font = s.normalFontName;
        var fw = ctx.measureText('W').width;

        ctx.font = s.boldFontName;
        var bw = ctx.measureText('W').width;

        ctx.font = s.lightFontName;
        var lw = ctx.measureText('W').width;

        var mx = Math.max(fw, bw, lw);

        s.normalFontOffset = parseInt((mx-fw)/2, 10);
        s.boldFontOffset   = parseInt((mx-bw)/2, 10);
        s.lightFontOffset  = parseInt((mx-lw)/2, 10);

        s.font = { };
        s.font.charHeight = s.fontsize;
        s.font.charWidth  = mx;

        s.debug("Using font-family '"+s.fontFamily+"' ["+mx+" x "+s.fontsize+"]");

        s.readyCheck();
        return;
    }

    // this callback may be called immediately, so we must make sure
    // everything is set up for it beforehand
    new TTVFont(s.fontName, function (f) {
        s.font = f;
        s.readyCheck();
    }, s.options.debug);

    if (s.boldFontName)
    {
        new TTVFont(s.boldFontName, function (f) {
            s.boldfont = f;
            s.readyCheck();
        }, s.options.debug);
    }

}

/**
 * @class TTVCanvas
 * @constructor
 * @public
 *
 * This objects handles the canvas update and interacts with the
 * emulator.
 *
 * @param {Node} canvas
 *    A canvas element
 *
 * @param {Object} options
 *    <ul>
 *    <li> font: the name or url of the font to be loaded (without extension)
 *    <li> boldfont: the name or url of the boldfont to be loaded (without extension)
 *    <li> autoResize: allow the canvas to be resized when the theoretical size is known
 *    <li> callback: a callback called in case of special events
 *    <li> onReady: a callback called when everything is readily setup
 *    <li> width: the width of the terminal in characters
 *    <li> height: the height of the terminal in characters
 *    <li> fontsize: if fontsize is given the cnavas-element text rendering
 *         engine is used for text rendering. This might not work on all
 *         browsers.
 *    <li> fontfamily: The font-family, if manual canvas-rendering is
 *         switched on with fontsize>0. Do not choose variable size fonts.
 *         Note that the code is waiting for the font to be loaded. So if
 *         the font cannot be loaded, it will wait forever.
 *    </ul>
 */
function TTVCanvas(canvas, options)
{
    //               -0-        -1-        -2-        -3-        -4-        -5-        -6-        -7-
    //              black       red       green     yellow      blue      magenta     cyan       white
    var stdRGB = ['#000000', '#b21818', '#18b218', '#b26818', '#1818b2', '#b218b2', '#18b2b2', '#b2b2b2'];
    var hiRGB  = ['#686868', '#ff5454', '#54ff54', '#ffff54', '#5454ff', '#ff54ff', '#54ffff', '#ffffff'];

    var s = this;

    if ( !(canvas instanceof HTMLCanvasElement) )
        throw new Error("First argument to TTVCanvas constructor must be an HTMLCanvasElement (was "+canvas+")");

    //s.stdColors  = clone(stdColors);
    //s.hiColors   = clone(hiColors);
    s.stdRGB     = clone(stdRGB);
    s.hiRGB      = clone(hiRGB);
    s.fontName   = 'qemu-vgafont';
    s.fontFamily = 'monospace';
    s.onReady    = [];
    s.canvas     = canvas;

    s.debug = function(txt)
    {
        options.debug ? options.debug("canvasview.js: "+txt) : alert("canvasview.js: "+txt);
    }

    s.options = options;

    if (options.fontsize)   s.fontsize     = options.fontsize;
    if (options.autoResize) s.autoResize   = options.autoResize;
    if (options.font)       s.fontName     = options.font;
    if (options.fontfamily) s.fontFamily   = options.fontfamily;
    if (options.boldfont)   s.boldFontName = options.boldfont;
    if (options.autoResize) s.autoResize   = options.autoResize;
    if (options.callback)   s.callback     = options.callback;
    if (options.onReady)    s.onReady.push(options.onReady);

    s.cursor = { };
    s.cursor.x = 0;
    s.cursor.y = 0;
    s.cursor.visible = true;

    s.emu = new TTVEmulator({
        debug: s.options.debug,
        debugLevel: s.options.debugLevel,
        width: s.options.width,
        height: s.options.height,
        change: function(y, minx, maxx)
            {
                s.makeSpanDirty(y, minx, maxx);
            },
        cursor: function(x, y, vis)
            {
                if (x >= s.emu.width)
                    x = s.emu.width - 1;

                // signal that the old and new position
                // must be redrawn with the next update
                s.makeSpanDirty(y, x, x);
                s.makeSpanDirty(s.cursor.y, s.cursor.x, s.cursor.x);
                //s.makeSpanDirty(s.cursor.cur.y, s.cursor.cur.x, s.cursor.cur.x);

                s.cursor.x = x;
                s.cursor.y = y;
                s.cursor.visible = vis;

            },
        special: function(obj)
            {
                if (!s.callback)
                    return;

                if (obj.title || obj.icon)
                    s.callback(obj);

                if (obj.border)
                {
                    var col = obj.border[0];

                    // Because of 'fontWidth' this must not be
                    // called before the fonts are ready!
                    if (col>=0 && col<8)
                    {
                        s.callback({ 'border': s.stdRGB[col], 'width': obj.border[1]*s.font.charWidth });
                        return;
                    }
                    if (col>=10 && col<18)
                    {
                        s.callback({ 'border': s.hiRGB[col%10], 'width': obj.border[1]*s.font.charWidth });
                        return;
                    }
                    s.callback({ 'border': null });
                }

                /*
                if (obj.bell)
                {
                }
                */
            }
    });

    s.parser = new TTVParser(s.emu, s.options.debug);

    s.dirtySpans = [];
    for (var y = 0; y < s.emu.height; y++)
        s.dirtySpans[y] = { min: 0, max: s.emu.width-1 };

    // Now wait until the fonts are ready
    setTimeout(function() { s.waitForFonts(); }, 1);

    return this;
};

/**
 * Callback which is called when the fonts are loaded. When
 * the fonts are ready, and a boldfont was set, the consistency
 * of their size is checked. If autoSize was set, the canvas is
 * resized automatically according to the font size. Then a
 * canvas update is forced and the ready-callbacks are invoked.
 *
 * @private
 *
 */
TTVCanvas.prototype.readyCheck = function ()
{
    if (!this.fontsize)
    {
        if (!this.font)
            return;

        if (this.boldFontName)
        {
            if (!this.boldfont)
                return;

            if (this.font.charWidth  != this.boldfont.charWidth ||
                this.font.charHeight != this.boldfont.charHeight)
            {
                this.debug("Normal font size ["+this.font.charWidth+"x"+this.font.charHeight+"] and "+
                           "bold font size ["+this.boldfont.charWidth+"x"+this.font.charHeight+"] mismatch");
                this.boldfont = undefined;
            }
        }
    }

    if (this.autoResize)
    {
        this.canvas.setAttribute('width',  this.emu.width  * this.font.charWidth);
        this.canvas.setAttribute('height', this.emu.height * this.font.charHeight);
    }

    this.updateCanvas();
    this.onReady.forEach(function (fn) { fn(); });
};


/**
 * @returns
 *     an object which is a current state snapshot or the
 *     emulator and the parser;
 */
TTVCanvas.prototype.snapshot = function()
{
    return {
        emulator: this.emu.freeze(),
        parser:   this.parser.getBuffer()
    };
};

/**
 * Takes a snapshop as set with snapshot() and configures
 * the emulator and parser accordingly
 *
 * @param {Object} obj
 *    The snapshot object as returned by snapshot()
 */
TTVCanvas.prototype.thaw = function(obj)
{
    this.emu.thaw(obj.emulator);
    this.parser.setBuffer(obj.parser);
};

/**
 * Used to signal a change of a given region which will cause it to be
 * updated with the next draw-update
 *
 * @param {Number} y
 *    The index of the row which contains the changes
 *
 * @param {Number} minx
 *    The starting index of the column
 *
 * @param {Number} maxx
 *    The index of the last column
 */
TTVCanvas.prototype.makeSpanDirty = function(y, minx, maxx)
{
    if (y>=this.emu.height || minx<0 || maxx>=this.emu.width)
        throw Error("makeSpanDirty "+y+" "+this.emu.height+" "+minx+ " "+maxx+ " "+this.emu.width);

    var s = this.dirtySpans[y];

    if (s.min>minx)
        s.min = minx;

    if (s.max<maxx)
        s.max = maxx;
}

/**
 * Copy the current state of the display into the canvas.
 */
TTVCanvas.prototype.updateCanvas = function ()
{
    var ctx = this.canvas.getContext('2d');
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 1;
    ctx.beginPath();

    var w = this.font.charWidth;
    var h = this.font.charHeight;

    var save, color, strokeColor

    if (!this.fontsize)
    {
        for (var y = 0; y < this.emu.height; y++)
        {
            var span = this.dirtySpans[y];
            for (var x = span.min; x <= span.max; x++)
            {
                var idx = y*this.emu.width+x;

                var fcolor = this.emu.scr.c.fcolor[idx]%10;
                var bcolor = this.emu.scr.c.bcolor[idx]%10;
                var bold   = this.emu.scr.c.bold[idx];
                var ch     = this.emu.scr.c.text[idx];

                // Display cursor (fixme: could be any cursor)
                //if (this.cursor.cur.x==x && this.cursor.cur.y==y && this.cursor.cur.visible)
                var fg, bg;
                var show = this.cursor.x==x && this.cursor.y==y && this.cursor.visible;
                if (!show)
                {
                    fg = (fcolor>9 || bold ? this.hiRGB : this.stdRGB)[fcolor];
                    bg = (bcolor>9 ? this.hiRGB : this.stdRGB)[bcolor];
                }
                else
                {
                    bg = (fcolor>9 || bold ? this.hiRGB : this.stdRGB)[fcolor];
                    fg = (bcolor>9 ? this.hiRGB : this.stdRGB)[bcolor];
                }
                /*
                 if (!fg)
                {
                    this.debug("FGcolor @ "+x+"/"+y+" ["+fcolor+"]");
                    fg = '#167ff0';
                }

                if (!bg)
                {
                    this.debug("BGcolor @ "+x+"/"+y+" ["+bcolor+"]");
                    bg = '#167ff0';
                }

                if (this.fontsize) //33s
                {
                    // font-style font-variant font-weight font-size/line-height font-family

                    // font-style:   normal, italic, oblique
                    // font-variant: normal, small-caps
                    // font-weight:  normal, bold, bolder, lighter (100-900)

                    ctx.fillStyle = bg;
                    ctx.fillRect(x*w, y*h, w, h);
                    if (ch.charCodeAt(0)!=32)
                    {
                        ctx.fillStyle = fg;

                        var font = bold ? this.boldFontName : this.fontName;
                        if (save!=font)
                            ctx.font = save = font;

                        ctx.fillText(ch, x*w, (y+1)*h);
                    }
                }
                else*/ // 27s
                {
                    if (bold && this.boldfont)
                        this.boldfont.drawChar(ctx, ch, x*w, y*h, fg, bg);
                    else
                        this.font.drawChar(ctx, ch, x*w, y*h, fg, bg);
                }

                // konsole
                // \033]50;CursorShape=0\007   block
                // \033]50;CursorShape=1\007   vertical line on the left
                // \033]50;CursorShape=2\007   underline

                // note: this is not super efficient
                if (this.emu.scr.c.underline[idx])// || (show && !this.emu.scr.c.blink[idx])
                {
                    if (fg != strokeColor)
                    {
                        ctx.stroke();
                        ctx.strokeStyle = strokeColor = fg;
                        ctx.beginPath();
                    }

                    ctx.moveTo(x*w,     (y+1)*h-1);
                    ctx.lineTo((x+1)*w, (y+1)*h-1);
                }
            }
            span.min = this.emu.width-1;
            span.max = 0;
        }
    }
    else // 30s
    {
        // This is trying to minimize the frequence of color and font changes
        for (var y = 0; y < this.emu.height; y++)
        {
            var span = this.dirtySpans[y];
            for (var x = span.min; x <= span.max; x++)
            {
                var idx  = y*this.emu.width+x;
                var show = this.cursor.x==x && this.cursor.y==y && this.cursor.visible;

                // Display cursor (fixme: could be any cursor)
                var bg;
                if (!show)
                {
                    var bcolor = this.emu.scr.c.bcolor[idx]%10;
                    bg = (bcolor>9 ? this.hiRGB : this.stdRGB)[bcolor];
                }
                else
                {
                    var fcolor = this.emu.scr.c.fcolor[idx]%10;
                    bg = (fcolor>9 || this.emu.scr.c.bold[idx] ? this.hiRGB : this.stdRGB)[fcolor];
                }

                if (color!=bg)
                    ctx.fillStyle = color = bg;
                ctx.fillRect(x*w, y*h, w, h);
            }
            for (var x = span.min; x <= span.max; x++)
            {
                var idx = y*this.emu.width+x;

                var bold = this.emu.scr.c.bold[idx];
                var ch   = this.emu.scr.c.text[idx];
                var show = this.cursor.x==x && this.cursor.y==y && this.cursor.visible;

                var fg;
                if (!show)
                {
                    var fcolor = this.emu.scr.c.fcolor[idx]%10;
                    fg = (fcolor>9 || bold ? this.hiRGB : this.stdRGB)[fcolor];
                }
                else
                {
                    var bcolor = this.emu.scr.c.bcolor[idx]%10;
                    fg = (bcolor>9 ? this.hiRGB : this.stdRGB)[bcolor];
                }


                if (ch.charCodeAt(0)!=32)
                {
                    if (color!=fg)
                        ctx.fillStyle = color = fg;

                    var font = this.normalFontName;
                    var offset = this.normalFontOffset;
                    if (bold)
                    {
                        font = this.boldFontName;
                        offset = this.boldFontOffset;
                    }
                    if (this.emu.scr.c.lowintensity[idx])
                    {
                        font = this.lightFontName;
                        offset = this.lightFontOffset;
                    }

                    if (save!=font)
                        ctx.font = save = font;

                    ctx.fillText(ch, x*w+offset, (y+1)*h);
                    ctx.stroke();
                }

                if (this.emu.scr.c.underline[idx])// || (show && !this.emu.scr.c.blink[idx])
                {
                    if (fg != strokeColor)
                    {
                        ctx.stroke();
                        ctx.strokeStyle = strokeColor = fg;
                        ctx.beginPath();
                    }

                    ctx.moveTo(x*w,     (y+1)*h-1);
                    ctx.lineTo((x+1)*w, (y+1)*h-1);
                }
            }
            span.min = this.emu.width-1;
            span.max = 0;
        }
    }

    ctx.stroke();
}
