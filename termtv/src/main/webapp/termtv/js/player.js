'use strict';

/**
 * @class TTVPlayer
 * @constructor
 * @public
 *
 * This class implements things like loading the stream, analyzing
 * the stream, crawling through the stream and callbacks for the control.
 *
 * The stream is displayed in the given canvas object.
 *
 * @param {Node} canvas
 *    A reference to a canvas element
 *
 * @param {Object} options
 *    An object with a list of options. Possible properties are
 *    <ul>
 *    <li> name: The name (or url) of the stream to be loaded
 *    <li> title: The title to be used in the title bar instead of the
 *         file name
 *    <li> font: The name or url (without extension) of the font to
 *         be loaded
 *    <li> boldfont: The name or url (without extension) of the bold font
 *         to be loaded
 *    <li> scan: if set, the player will display only 1 frame per second
 *         for a fast analysis of the stream
 *    <li> warp: a factor by which the playing is accelerated or decelerated
 *    <li> loop: restarts the stream after the defined number of
 *         milliseconds again after it finished (0: off)
 *    <li> autostart: when everything is ready, after that time, the
 *         stream will start automatically (0: no autostart)
 *    <li> onready: callback to be called when everthing is ready
 *    <li> debug: a function used to send debug messages (takes
 *         a String as argument)
 *    <li> callback: a callback providing special informations from the
 *         emulator, as the title
 *    <li> onupdate: called on each canvas update with the current
 *         position in the file and the fraction already displayed
 *    <li> oncompletion: called when the stream has been finished and will
 *         not be restarted
 *    <li> onbookmark: called when the bookmark has been set
 *    <li> onpause: called whenever the stream was paused
 *    <li> onplay: called whenever the stream starts playing
 *    <li> noskip: forces an update after each decoded chunk, otherwise
 *         only one update per 20ms (50Hz) will be displayed.
 *    <li> fontsize: if fontsize is given the cnavas-element text rendering
 *         engine is used for text rendering. This might not work on all
 *         browsers.
 *    <li> fontfamily: The font-family, if manual canvas-rendering is
 *         switched on with fontsize>0. Do not choose variable size fonts.
 *         Note that the code is waiting for the font to be loaded. So if
 *         the font cannot be loaded, it will wait forever.
 *    </ul>
 *
 */
function TTVPlayer(canvas, options)
{
    var This = this;

    // The closure compiler might have decided to rename the
    // properties, so we 'restore' them. If the code is not
    // compiles, this statements have no effect. If the code
    // is compiled, this is the innermost class the user should
    // be able to access. So outside of this class we access
    // the object properties always by index (clear name)
    // and inside and deeper we can access them by property.
    options.name         = options['name'];
    options.title        = options['title'];
    options.font         = options['font'];
    options.fontsize     = options['fontsize'];
    options.fontfamily   = options['fontfamily'];
    options.boldfont     = options['boldfont'];
    options.scan         = options['scan'];
    options.warp         = options['warp'];
    options.loop         = options['loop'];
    options.autostart    = options['autostart'];
    options.onready      = options['onready'];
    options.debug        = options['debug'];
    options.callback     = options['callback'];
    options.onupdate     = options['onupdate'];
    options.oncompletion = options['oncompletion'];
    options.onbookmark   = options['onbookmark'];
    options.onpause      = options['onpause'];
    options.onplay       = options['onplay'];
    options.noskip       = options['noskip'];

    This.debugStream = function(msg)
    {
        function pad(v) { return ('0'+v).slice(-2); }

        if (!This.options.debug)
            return;

        if (This.stream && This.stream[This.nextFrameIdx])
        {
            var dat = new Date((This.stream[This.nextFrameIdx].time - This.stream[0].time)*1000);
            options.debug(pad(dat.getUTCHours())+":"+
                          pad(dat.getUTCMinutes())+":"+
                          pad(dat.getUTCSeconds())+" "+msg);
        }
        else
            options.debug("--:--:-- "+msg);
    }

    This.debug = function(msg)
    {
        This.debugStream("player.js: "+msg);
    }

    // ==========================================================

    This.options = options;
    if (!This.options.warp)
        This.options.warp = 1;

    var name = options.name || 'index.rec';

    var xmlStream = new XMLHttpRequest();
    xmlStream.open('GET', name, true);
    xmlStream.setRequestHeader("Cache-Control", "no-cache");
    xmlStream.setRequestHeader("If-Match", "*");
    xmlStream.overrideMimeType("application/octet-stream; charset=x-user-defined");
    //xmlStream.overrideMimeType("text/plain; charset=x-user-defined");
    xmlStream.onload = function ()
    {
        // error occured during load
        if (xmlStream.status!=200)
        {
            alert("ERROR[0] - HTTP request '"+name+"': "+xmlStream.statusText+" ["+xmlStream.status+"]");
            if (options.onclose)
                options.onclose();
            return;
        }

        var stream = xmlStream.responseText;

        // To encrypt a stream do
        // openssl enc -aes-256-cbc -in infile -out outfile -pass pass:"YourPassphrase" -e -base64

        // This might be base64 encoded
        // If this is a plain file, most probably already one of the
        // first few bytes does not match the base64 encoding
        if (stream.search(/[^\x0a\x0dABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=]/)==-1)
        {
            // Remove carriage returns and line feeds from the stream
            var clean = stream.replace(/[\x0A\x0C]/g, "");

            // Parse as if this is a base64 encoded stream
            var words  = CryptoJS.enc.Base64.parse(clean);
            var latin1 = CryptoJS.enc.Latin1.stringify(words);

            // Check if it starts with "Salted__", then we really found an encoded stream
            if (words.words[0] == 0x53616c74 && words.words[1] == 0x65645f5f)
            {
                // Ask for the passphrase and decode
                var pw = prompt("Please enter a passphrase to decrypt the stream: ");
                if (pw)
                    stream = CryptoJS.AES.decrypt(clean, pw).toString(CryptoJS.enc.Latin1);
            }
        }

        try
        {
            // Convert the data into chunks. The advantage is that
            // we have all the decoding done already. The disadvantage
            // is that for a short moment we have the data twice in memory
            // [Note: we need to step to the end anyway to get the
            //  length of the stream. Example: TtyRecParse 260ms,
            //  direct stepping: 1ms for ~5MB, ~2500chunks]
            This.stream = new TTVDecoder(stream);
            This.totalLength = This.stream[This.stream.length-1].time - This.stream[0].time;

        }
        catch (e)
        {
            alert(e);
            if (This.options.onclose)
                This.options.onclose();
            return;
        }

        This.debug("GO");

        // The idea with this code was to create a single array
        // and an index table and crawl through it. Unfortunately,
        // with the current implementation using regexps for matching,
        // the regular exporessions would need to support the
        // y-modifier or one has to create substrings anyways.
        /*
        // Decode the stream, create a continous buffer for the
        // data create a look-up-table with index and time
        var myStream = { };
        myStream.index = [];
        myStream.time  = [];
        myStream.data = "";
 
        var n   = 0;
        var pos = 0;
        while (1)
        {
            var chunk = getChunk(stream, pos);
            if (!chunk)
                break;

            myStream.time[n]  = chunk.time;
            myStream.index[n] = myStream.data.length;
            myStream.data += chunk.data;
            n++;

            pos = chunk.pos;
        }
        myStream.length = n;


        myStream.totalLength = myStream.time[myStream.length-1] -  myStream.time[0];
        This.myStream = myStream;

        var maxx, maxy;

        // Scan the data stream for the size sequence
        var re2 = new RegExp("\x1b\\[[8];([0-9]+);([0-9]+)t", "g");
        while (!maxx && !maxy)
        {
            var rc = re2.exec(myStream.data);
            if (!rc)
                break;

            This.debug("Found[1]: "+rc[1]+"/"+rc[2]);

            maxx = parseInt(rc[2], 10);
            maxy = parseInt(rc[1], 10);
        }

        // Scan the data stream for goto sequence if no size sequence was found
        var re1 = new RegExp("\x1b\\[([0-9]+);([0-9]+)r", "g");
        while (1)
        {
            var rc = re1.exec(myStream.data);
            if (!rc)
                break;

            This.debug("Found[0]: "+rc[1]+"/"+rc[2]);

            var py = parseInt(rc[2], 10);
            if (!maxy || py>maxy)
            {
                This.debug("Found[0]: "+rc[1]+"/"+py);
                maxy = py;
            }
        }

        This.totalLength = myStream.totalLength;
        */

        /*
        // Step through the data and try to find the sequence for
        // the screen size, or try to get the size from goto
        // sequences
        var maxx;
        var maxy;


        var buffer = "";

        var now = new Date();

        var pos = 0;
        var last;
        while (1)
        {
            var chunk = getChunk(stream, pos);
            if (!chunk)
                break;

            buffer += chunk.data;
            pos = chunk.pos;
            last = chunk;

            while (!maxx && !maxy)
            {
                var rc = re2.exec(buffer);
                if (!rc)
                    break;

                This.debug("Found[1]: "+rc[1]+"/"+rc[2]);

                maxx = parseInt(rc[2], 10);
                maxy = parseInt(rc[1], 10);
            }

            if (maxx && maxy)
                break;

            while (1)
            {
                var rc = re1.exec(buffer);
                if (!rc)
                    break;

                This.debug("Found[0]: "+rc[1]+"/"+rc[2]);

                var py = parseInt(rc[2], 10);
                if (!maxy || py>maxy)
                {
                    This.debug("Found[0]: "+rc[1]+"/"+py);
                    maxy = py;
                }
                break;
            }

            buffer = buffer.substr(-12);
        }

        // Step on to the last chunk to get the total length of the stream
        while (1)
        {
            var chunk = getChunk(stream, pos);
            if (!chunk)
                break;

            pos = chunk.pos;
            last = chunk;
        }

        var first = getChunkHeader(stream, 0);
        This.stream.totalLength = last.time - first.time;
        */

        var maxx, maxy;

        var buffer = "";
        for (var i=0; i<This.stream.length; i++)
        {
            buffer += This.stream[i].data;

            var re2 = new RegExp("\x1b\\[[8];([0-9]+);([0-9]+)t", "g");
            while (1)
            {
                var rc = re2.exec(buffer);
                if (!rc)
                    break;

                This.debug("Found[1]: "+rc[1]+"/"+rc[2]);

                maxx = parseInt(rc[2], 10);
                maxy = parseInt(rc[1], 10);

                break;
            }

            if (!maxx && !maxy)
            {
                var re1 = new RegExp("\x1b\\[([0-9]+);([0-9]+)r", "g");
                while (1)
                {
                    var rc = re1.exec(buffer);
                    if (!rc)
                        break;

                    var py = parseInt(rc[2], 10);

                    if (!maxy || py>maxy)
                    {
                        This.debug("Found[0]: "+rc[1]+"/"+py);
                        maxy = py;
                    }
                }
            }

            buffer = buffer.substr(-12);
        }

        This.debug("OK ["+maxx+"x"+maxy+"]");

        var opts = clone(options);
        opts.onReady    = function() { This.onReadyCallback(); };
        opts.callback   = options.callback || function() { };
        opts.debug      = function(msg) { This.debugStream(msg); };
        opts.width      = maxx || 80;
        opts.height     = maxy || 24;
        opts.autoResize = true;

        This.viewer = new TTVCanvas(canvas, opts);
    };
    xmlStream.send(null);

    // =============================================================

    return this;
}

/**
 *
 * @private
 *
 * Called by the emulator when everything is loaded and ready
 * and the stream can be started. Calls 'onready'
 */
TTVPlayer.prototype.onReadyCallback = function()
{
    // The object returned by the constructor might not yet be
    // assigned to this.viewer although the callback has
    // already been called
    if (!this.viewer)
    {
        var This = this;
        setTimeout(function() { This.onReadyCallback(); }, 10);
        return;
    }

    // Take a snapshot of the initalState for easy rewind
    this.initialState = { bookmark: this.viewer.snapshot(), index: 0 };

    // call the onready-callback to signal that playing will start soon
    if (this.options.onready)
    {
        var dat = new Date(this.totalLength*1000);
        this.options.onready(dat);
    }

    // wait for a given number of milliseconds if autostart should start now
    if (this.options.autostart>0)
    {
        var This = this;
        setTimeout(function() { This.start(); }, parseInt(this.options.autostart, 10));
    }
}

/**
 *
 * Called when the stream is going to start playing
 * Signals the start by calling 'onplay'
 *
 * @private
 *
 * @param {Number} nextFrameIdx
 *     the index at which the stream should start playing
 *     (the contents must have been set properly before, see jumpBack)
 */
TTVPlayer.prototype.start = function(nextFrameIdx)
{
    var now = (new Date()).getTime()/1000;

    var idx = nextFrameIdx || 0;

    this.playing        = true;
    this.startTime      = now;
    this.firstFrameIdx  = idx;
    this.firstFrameTime = this.stream[idx].time;
    //this.totalLength    = this.stream[this.stream.length-1].time - this.stream[0].time;
    this.nextFrameIdx   = idx;
    this.timeout        = null;

    this.nextFrame();

    if (this.options.onplay)
        this.options.onplay();
}

/**
 *
 * Called continously until the stream haas finished or got
 * interrupted. Calls 'onupdate' and 'completion'
 *
 * @private
 */
TTVPlayer.prototype.nextFrame = function()
{
    // Get current time
    var now = (new Date()).getTime()/1000;

    // Loop as long as no action has been signaled, the stream has not
    // yet finished and as long as we are out of sync
    while (!this.action && this.nextFrameIdx<this.stream.length &&
           ( this.stream[this.nextFrameIdx].time - this.firstFrameTime < (now - this.startTime)*this.options.warp || this.options.scan) )
    {
        //this.viewer.parseData(this.myStream.data, this.myStream.index[++this.nextFrameIdx]);

        this.viewer.parser.parse(this.stream[this.nextFrameIdx++].data);

        // force a screen update after each chunk if 'noskip' is set
        if (this.options.noskip)
            break;

        // in scan mode do an update only once a second
        if (this.options.scan && (new Date()).getTime()/1000-now>1)
            break;
    }

    // The changes in the canvas and the page will be displayed only when the control
    // is given back by setTimeout anyway, so it can be outside of the main loop
    var force = (this.options.noskip && !this.options.scan) || this.action || this.nextFrameIdx==this.stream.length;

    now = (new Date()).getTime();
    if ((now-this.previousUpdate)>19 || force || !this.previousUpdate) // 50Hz
    {
        this.previousUpdate = now;
        this.viewer.updateCanvas();
    }

    // If an interrupting action has been requested, execute it
    if (this.action)
    {
        if (!this.action(true))
            return;
    }

    // If the stream is not yet finsished, go on playing
    if (this.nextFrameIdx<this.stream.length)
    {
        // Signal the position of the stream via 'onupdate'
        if (this.options.onupdate)
        {
            var pos = this.stream[this.nextFrameIdx].time - this.stream[0].time;
            var dat = new Date(pos*1000);
            this.options.onupdate(dat, pos/this.totalLength);
        }

        var This = this;
        setTimeout(function() { This.nextFrame(); }, 0);
        return;
    }

    // Stream is finished, should it automatically restart?
    if (this.options.loop)
    {
        var This = this;
        this.viewer.thaw(this.initialState);
        setTimeout(function() { This.start(0); }, this.options.loop);
        return;
    }

    // Signal completion
    this.timeout = null;
    this.playing = false;

    if (this.options.onupdate)
    {
        var dat = new Date(this.totalLength*1000);
        this.options.onupdate(dat, 1);
    }
    if (this.options.oncompletion)
        this.options.oncompletion();

    var dat = new Date(new Date().getTime() - this.startTime*1000);

    function pad(v) { return ('0'+v).slice(-2); }
    this.debug("Completed ["+pad(dat.getUTCHours())+":"+pad(dat.getUTCMinutes())+":"+pad(dat.getUTCSeconds())+"]");
}

/**
 *
 * User function to request play or pause (depending on the current state).
 * Calls 'onpause'.
 *
 * @public
 */
TTVPlayer.prototype.playpause = function()
{
    if (!this.playing)
    {
        if (this.nextFrameIdx==this.stream.length)
            this.rewind();
        else
            this.start(this.nextFrameIdx);

        return;
    }

    var This = this;
    this.action = function()
    {
        This.action=null;
        This.playing=false;
        if (this.options.onpause)
            this.options.onpause();
        return false;
    }

    return false;
}

/**
 *
 * User function to request setting the bookmark (only one is supported)
 * Calls 'obookmark'.
 *
 * @public
 */
TTVPlayer.prototype.setBookmark = function()
{
    var This = this;
    this.action = function(wasplaying)
    {
        This.action = null;
        This.bookmark = { bookmark: This.viewer.snapshot(), index: This.nextFrameIdx };
        if (this.options.onbookmark)
            this.options.onbookmark();
        return true;
    }

    if (!this.playing)
        this.action(false);


    return false;
}

/**
 *
 * Resumes a stream at the given bookmark position.
 *
 * @private
 *
 * @param {Object} data
 *    contains the properties bookmark with the bookmark data and
 *    index with the corresponding index.
 *
 */
TTVPlayer.prototype.resume = function(data)
{
    if (!data)
        return;

    var This = this;
    this.action = function(wasplaying)
    {
        This.action = null;
        This.viewer.thaw(data.bookmark);
        This.viewer.updateCanvas();
        if (wasplaying || data.index==0)
            setTimeout(function() { This.start(data.index); }, 1);
        return false;
    }

    if (!this.playing)
        this.action(false);
}

/**
 *
 * User function to jump back to a previously set bookmark position
 *
 * @public
 */
TTVPlayer.prototype.jump = function()
{
    this.resume(this.bookmark);
    return false;
}

/**
 *
 * User function to rewind to the beginning of the stream
 *
 * @public
 */
TTVPlayer.prototype.rewind = function()
{
    this.resume(this.initialState);
    return false;
}

/**
 *
 * User function to change the warpFactor
 *
 * @param {Number} val
 *    The warp factor, e.g. 2 means to play two times faster, 0.5
 *    two times slower
 *
 * @public
 */
TTVPlayer.prototype.setWarpFactor = function(val)
{
    this.options.warp = val;
    return false;
}

// This is a hack to avoid that the closure compiler will rename
// these functions
window['TTVPlayer'] = TTVPlayer;
TTVPlayer.prototype['rewind'] = TTVPlayer.prototype.rewind;
TTVPlayer.prototype['playpause'] = TTVPlayer.prototype.playpause;
TTVPlayer.prototype['setBookmark'] = TTVPlayer.prototype.setBookmark;
TTVPlayer.prototype['resume'] = TTVPlayer.prototype.resume;
TTVPlayer.prototype['jump'] = TTVPlayer.prototype.jump;
TTVPlayer.prototype['setWarpFactor'] = TTVPlayer.prototype.setWarpFactor;
