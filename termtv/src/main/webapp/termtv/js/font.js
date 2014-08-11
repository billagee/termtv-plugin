'use strict';

// TODO: look into using drawRect for backgrounds, to only need a colorMap for every foreground color
var TTVFontData = { };
TTVFontData.missingCode   = "?".charCodeAt(0);
TTVFontData.fonts         = { };
TTVFontData.fonts_loading = { };
TTVFontData.base          = "./fonts/";


/**
 * @constructor
 */
function TTVFont(name, cb, dbg)
{
    var vt = this;

    if (TTVFontData.fonts[name])
    {
        cb(TTVFontData.fonts[name], null);
        return;
    }

    if (TTVFontData.fonts_loading[name])
    {
        TTVFontData.fonts_loading[name].callbacks.push(cb);
        return;
    }

    vt.debug = function(txt)
    {
        dbg("font.js: "+txt);
    }

    // ===============================================================

    var f = TTVFontData.fonts_loading[name] =
    {
        image: new Image(),
        callbacks: [cb]
    };

    // Called when the image was successfully loaded
    f.image.onload = function ()
    {
        f.imageComplete = true;
        if (f.loadedTxt)
            fontReady(name);
    };

    var url = TTVFontData.base+name;

    // Called when loading the image failed.
    f.image.onerror = function()
    {
        alert("ERROR[1] - Loading image '"+url+".png' failed.");

        // inform callbacks
        f.callbacks.forEach(function(cb){ cb(null, "Couldn't load stats file"); });

        // remove entry from list
        delete TTVFontData.fonts_loading[name];
    };

    f.image.src = url+'.png';

    // ===============================================================

    var r = new XMLHttpRequest();
    r.open('GET', url+'.txt', true);
    r.onload = function ()
    {
        // error occured during load
        if (r.status!=200)
        {
            alert("ERROR[0] - HTTP request '"+url+".txt': "+r.statusText+" ["+r.status+"]");

            // inform callbacks
            f.callbacks.forEach(function(cb){ cb(null, "Couldn't load stats file"); });

            // remove entry from list
            delete TTVFontData.fonts_loading[name];
            return;
        }

        f.loadedTxt = r.responseText;
        if ( f.imageComplete /*f.image.complete*/ )
            fontReady(name);
    };
    r.send(null);

    // ===============================================================

    var fontReady = function (name)
    {
        var fl = TTVFontData.fonts_loading[name];
        var font = new Font(name, fl.image, fl.loadedTxt);
        TTVFontData.fonts[name] = font;
        delete TTVFontData.fonts_loading[name];

        vt.debug(name+" ["+font.charWidth+"x"+font.charHeight+"] loaded.");

        fl.callbacks.forEach(function(cb) { cb(font, null); });
    };

    /**
     * @constructor
     */
    var Font = function (name, image, stats)
    {
        TTVFontData.fonts[name] = this;

        this.image = image;

        var chars = this.chars = { };
        this.colorMaps = { };

        var x = 0;
        var y = 0;
        var count = 0;
        var charsPerRow = 0;
        var last_cp = 0;

        function proc(v)
        {
            if ( !v.length )
                return;

            if ( /^\d+$/.exec(v) )
            {
                chars[v] = [x++, y];
                last_cp = parseInt(v, 10);
                count++;
                return;
            }

            if ( /^y$/.exec(v) )
            {
                if ( x > charsPerRow )
                    charsPerRow = x;
                x = 0;
                y++;
                return;
            }

            var res = /^r(\d+)$/.exec(v);
            if ( res )
            {
                var ct = parseInt(res[1], 10);
                for (var v2 = last_cp+1; v2 <= last_cp+ct; v2++)
                    chars[v2] = [x++, y];

                count   += ct;
                last_cp += ct;
                return;
            }

            vt.debug("Stats file is corrupt, line=\""+v+"\"");
        }

        stats.split("\n").forEach(proc);

        if ( x > charsPerRow )
            charsPerRow = x;

        this.charCount = count;

        this.charHeight = this.image.naturalHeight / (y+1);
        this.charWidth  = this.image.naturalWidth / charsPerRow;

        if (this.charWidth != Math.floor(this.charWidth))
            vt.debug("font loading of "+name+" failed: image width is not a multiple of the character count (image width = " + this.image.naturalWidth + ", character count = " + this.charCount + ")");
    };

    Font.prototype.drawChar = function (ctx, ch, x, y, fg, bg)
    {
        var idx = this.chars[ch.charCodeAt(0)];
        if (idx === undefined)
        {
            idx = this.chars[0];
            if (idx === undefined)
            {
                idx = this.chars[0x3f]; // question mark
                if (idx === undefined)
                {
                    vt.debug("Can't draw '"+ch+"', it is not mapped and neither is the missing character");
                    return;
                }
            }
        }

        var mapstr = fg.substr(1)+bg.substr(1)+idx[1];

        if (!this.colorMaps[mapstr])
            this.colorMaps[mapstr] = this.getFontColorMap(fg, bg, idx[1]);

        // ctx.drawImage(source, src_x, src_y, src_w, src_h, dest_x, dest_y, dest_w, dest_h);
        ctx.drawImage(this.colorMaps[mapstr], idx[0]*this.charWidth, 0, this.charWidth, this.charHeight, x, y, this.charWidth, this.charHeight);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Private

    Font.prototype.getFontColorMap = function(fg, bg, chunk)
    {
        var w = this.image.naturalWidth;
        var h = this.charHeight;

        var yoff = chunk * this.charHeight;

        var cv = document.createElement('canvas');
        cv.width  = w;
        cv.height = h;

        var ctx = cv.getContext('2d');

        // ctx.drawImage(source, src_x, src_y, src_w, src_h, dest_x, dest_y, dest_w, dest_h);
        ctx.drawImage(this.image, 0, yoff, w, h, 0, 0, w, h);

        var input  = ctx.getImageData(0, 0, w, h);
        var output = ctx.createImageData(w, h);

        var N = w*h*4;
        for (var i=0; i<N; i+=4)
        {
            var col = input.data[i] > 127 ? bg : fg;

            output.data[i  ] = parseInt(col.substring(1, 3), 16);
            output.data[i+1] = parseInt(col.substring(3, 5), 16);
            output.data[i+2] = parseInt(col.substring(5, 7), 16);
            output.data[i+3] = 255;
        }

        ctx.putImageData(output, 0, 0);

        return cv;
    }
};


/*
var TTVFont = (function()
{
  //  var missingCode = "?".charCodeAt(0);

    ////////////////////////////////////////////////////////////////////////////////
    // Font loader

   // var fonts = { };
    //var fonts_loading = { };

    //var base = "./fonts/";
    //var setBase = function (baseurl) {
    //    base = baseurl;
    //};

    //var debug = function(txt)
    //{
    //    alert("font.js: "+txt);
    //}

    var load = function(name, cb, dbg)
    {
        if ( fonts[name] )
        {
            cb(fonts[name], null);
            return;
        }

        if ( fonts_loading[name] )
        {
            fonts_loading[name].callbacks.push(cb);
            return;
        }

        debug = function(txt)
        {
            dbg("font.js: "+txt);
        }

        var f = fonts_loading[name] = {
                image: new Image(),
                callbacks: [cb]
            };

        // ===============================================================

        // Called when the image was successfully loaded
        f.image.onload = function ()
        {
            f.imageComplete = true;
            if ( f.loadedTxt )
                fontReady(name);
        };

        // Called when loading the image failed.
        f.image.onerror= function ()
        {
            alert("ERROR[1] - Loading image '"+base+name+".png' failed.");

            // inform callbacks
            f.callbacks.forEach(function(cb){ cb(null, "Couldn't load stats file"); });

            // remove entry from list
            delete fonts_loading[name];
        };

        f.image.src = base + name + '.png';

        // ===============================================================

        var r = new XMLHttpRequest();
        r.open('GET', base + name + '.txt', true);
        r.onload = function ()
        {
            // error occured during load
            if (r.status!=200)
            {
                alert("ERROR[0] - HTTP request '"+base+name+".txt': "+r.statusText+" ["+r.status+"]");

                // inform callbacks
                f.callbacks.forEach(function(cb){ cb(null, "Couldn't load stats file"); });

                // remove entry from list
                delete fonts_loading[name];
                return;
            }

            f.loadedTxt = r.responseText;
            if ( f.imageComplete ) // f.image.complete
                fontReady(name);
        };
        r.send(null);

        // ===============================================================
    };

    var fontReady = function (name)
    {
        var fl = fonts_loading[name];
        fonts[name] = new Font(name, fl.image, fl.loadedTxt);
        delete fonts_loading[name];

        fl.callbacks.forEach(function(cb) { cb(fonts[name], null); });
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Font drawer

    var Font = function (name, image, stats)
    {
        fonts[name] = this;

        this.image = image;

        var chars = this.chars = { };
        this.colorMaps = { };

        var x = 0;
        var y = 0;
        var count = 0;
        var charsPerRow = 0;
        var last_cp = 0;

        function proc(v)
        {
            if ( !v.length )
                return;

            if ( /^\d+$/.exec(v) )
            {
                chars[v] = [x++, y];
                last_cp = parseInt(v, 10);
                count++;
                return;
            }

            if ( /^y$/.exec(v) )
            {
                if ( x > charsPerRow )
                    charsPerRow = x;
                x = 0;
                y++;
                return;
            }

            var res = /^r(\d+)$/.exec(v);
            if ( res )
            {
                var ct = parseInt(res[1], 10);
                for (var v2 = last_cp+1; v2 <= last_cp+ct; v2++)
                    chars[v2] = [x++, y];

                count   += ct;
                last_cp += ct;
                return;
            }

            debug("Stats file is corrupt, line=\""+v+"\"");
        }

        stats.split("\n").forEach(proc);

        if ( x > charsPerRow )
            charsPerRow = x;

        this.charCount = count;

        this.charHeight = this.image.naturalHeight / (y+1);
        this.charWidth  = this.image.naturalWidth / charsPerRow;

        if ( this.charWidth != Math.floor(this.charWidth) )
            debug("font loading of \""+name+"\" failed: image width is not a multiple of the character count (image width = " + this.image.naturalWidth + ", character count = " + this.charCount + ")");
    };

    Font.prototype.drawChar = function (ctx, ch, x, y, fg, bg)
    {
        var codepoint = ch.charCodeAt(0);

        var idx;
        if ( typeof(this.chars[codepoint]) != 'undefined' )
        {
            idx = this.chars[codepoint];
        }

        if ( typeof idx == 'undefined' )
        {
            if ( typeof(this.chars[missingCode]) == 'undefined' )
            {
                debug("Can't draw \""+ch+"\", it is not mapped and neither is the missing character");
                return;
            }

            idx = this.chars[missingCode];
        }

        // ctx.drawImage(source, src_x, src_y, src_w, src_h, dest_x, dest_y, dest_w, dest_h);
        var cm = this.getFontColorMap(fg, bg, idx[1]);
        ctx.drawImage(cm, idx[0]*this.charWidth, 0, this.charWidth, this.charHeight, x, y, this.charWidth, this.charHeight);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Private

    Font.prototype.getFontColorMap = function(fg, bg, chunk)
    {
        // create a look up table
        var mapstr = fg + "/" + bg + "/" + chunk;
        if ( this.colorMaps[mapstr] )
            return this.colorMaps[mapstr];

        var w = this.image.naturalWidth;
        var h = this.charHeight;

        var yoff = chunk * this.charHeight;

        var cv = document.createElement('canvas');
        cv.width  = w;
        cv.height = h;

        var ctx = cv.getContext('2d');

        // ctx.drawImage(source, src_x, src_y, src_w, src_h, dest_x, dest_y, dest_w, dest_h);
        ctx.drawImage(this.image, 0, yoff, w, h, 0, 0, w, h);

        var input  = ctx.getImageData(0, 0, w, h);
        var output = ctx.createImageData(w, h);

        var N = w*h*4;
        for (var i=0; i<N; i+=4)
        {
            var col = input.data[i] > 127 ? bg : fg;

            output.data[i  ] = col[0];
            output.data[i+1] = col[1];
            output.data[i+2] = col[2];
            output.data[i+3] = 255;
        }

        ctx.putImageData(output, 0, 0);

        this.colorMaps[mapstr] = cv;

        return cv;
    }

    return {
        load: load,
        setBase: setBase,
        Font: Font
    };
})();*/

