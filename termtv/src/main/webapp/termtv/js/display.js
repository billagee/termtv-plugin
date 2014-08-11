'use strict';

/**
 * @class TTVDisplay
 * @constructor
 * @public
 *
 * Creates a div Node which contains a TTVPlayer and returns this.
 * Options are partially passed through to the TTVPlayer object.
 * Overwites the options 'onclose', 'onready', 'onupdate',
 * 'oncompletion', 'onbookmark', 'onpause', 'onplay' and 'callback'.
 *
 * @param {Object} options
 *    <ul>
 *    <li> title: if the title is not undefined or an empty string
 *         it is used as the title bar title. Otherwise the filename
 *         of the url is used excluding the extions .rec and .tty
 *    <li> controls: if defined, controls are displayed in a status bar
 *    <li> debug: the debug property is converted to the debugLevel
 *         property and an own debug handler is setup
 *    </ul>
 *
 * @returns {Node}
 *    A div-element container all the html nodes is returned.
 *
 */
function TTVDisplay(options)
{
    var name;
    if (options['title'] || options['title']==="")
        name = options['title'];
    else
    {
        name = options['name'].split('/').reverse()[0];
        var ext  = name.substr(-4, 4);
        if (ext==".rec" || ext==".tty")
            name = name.substr(0, name.length-4);
    }

    var div = document.createElement("div");
    div.setAttribute("class", "tty");
    div.setAttribute("style", "display:none;");

    var table = document.createElement("table");
    table.setAttribute("class", "tty");
    table.id = "table";

    // ------------- first row ---------------

    var tr1   = document.createElement("tr");

    var td11  = document.createElement("td");
    var td12  = document.createElement("td");
    var td13  = document.createElement("td");

    var img11 = document.createElement("img");
    var img13 = document.createElement("img");

    var txt12 = document.createTextNode(name);

    tr1.setAttribute("class", "tty");
    tr1.id = "row1";

    td11.setAttribute("class", "tty");
    td12.setAttribute("class", "tty");
    td13.setAttribute("class", "tty");
    td11.id = "cell11";
    td12.id = "cell12";
    td13.id = "cell13";

    img11.setAttribute("class", "tty")
    img11.id = "img11";

    img13.setAttribute("class", "tty");
    img13.id = "img13";

    if (options['onclose'])
        img13.onclick = options['onclose'];

    td11.appendChild(img11);
    td12.appendChild(txt12);
    td13.appendChild(img13);

    tr1.appendChild(td11);
    tr1.appendChild(td12);
    tr1.appendChild(td13);

    table.appendChild(tr1);

    // ------------- second row ---------------

    var tr2 = document.createElement("tr");

    tr2.setAttribute("class", "tty");
    tr2.id = "row2";

    var td21 = document.createElement("td");

    td21.setAttribute("class", "tty");
    td21.id = "cell21";

    var canvas = document.createElement("canvas");
    canvas.setAttribute("class", "tty");
    canvas.id = "canvas";

    td21.setAttribute("colspan", "3");

    canvas.width  = 1;
    canvas.height = 1;

    td21.appendChild(canvas);
    tr2.appendChild(td21);

    table.appendChild(tr2);

    // ------------- third row ---------------

    var tr3 = document.createElement("tr");

    tr3.setAttribute("class", "tty");
    tr3.id = "row3";

    var td31 = document.createElement("td");
    var td32 = document.createElement("td");
    var td33 = document.createElement("td");

    td31.setAttribute("class", "tty");
    td32.setAttribute("class", "tty");
    td33.setAttribute("class", "tty");
    td31.id = "cell31";
    td32.id = "cell32";
    td33.id = "cell33";

    var txt31 = document.createTextNode("TermTV");

    var input321  = document.createElement("span");
    var input322a = document.createElement("span");
    var input322b = document.createElement("span");
    var input326  = document.createElement("span");
    var input327a = document.createElement("span");
    var input327b = document.createElement("span");
    var input33   = document.createElement("span");

    var span323 = document.createElement("span");
    var span325 = document.createElement("span");

    var progress324 = document.createElement("progress");

    var txt323 = document.createTextNode("00:00:00");
    var txt325 = document.createTextNode("00:00:00");

    input322b.setAttribute("style", "display:none;");
    input327b.setAttribute("style", "display:none;");

    input321.setAttribute("class", "tty")
    input322a.setAttribute("class", "tty")
    input322b.setAttribute("class", "tty")
    input326.setAttribute("class", "tty")
    input327a.setAttribute("class", "tty")
    input327b.setAttribute("class", "tty")
    input33.setAttribute( "class", "tty")
    input321.id  = "input321";
    input322a.id = "input322a";
    input322b.id = "input322b";
    input326.id  = "input326";
    input327a.id = "input327a";
    input327b.id = "input327b";
    input33.id   = "input33";

    input33.onclick = function() {
        var img = canvas.toDataURL("image/png");
        img = img.replace("image/png", "image/octet-stream");
        document.location.href = img;
        return false;
    }

    span323.setAttribute("class", "tty");
    span325.setAttribute("class", "tty");
    span323.id = "span323";
    span325.id = "span325";

    progress324.max   = 1;
    progress324.value = 0;

    span323.appendChild(txt323);
    span325.appendChild(txt325);

    td31.appendChild(txt31);

    td32.appendChild(input321);
    td32.appendChild(input322a);
    td32.appendChild(input322b);
    td32.appendChild(span323);
    td32.appendChild(progress324);
    td32.appendChild(span325);
    td32.appendChild(input326);
    td32.appendChild(input327a);
    td32.appendChild(input327b);

    td33.appendChild(input33);

    tr3.appendChild(td31);
    tr3.appendChild(td32);
    tr3.appendChild(td33);

    if (options['controls'])
        table.appendChild(tr3);

    // ------------- fourth row ---------------

    var tr4  = document.createElement("tr");
    var td4  = document.createElement("td");
    var div4 = document.createElement("div");

    td4.setAttribute("style", "max-width:1px;");

    td4.setAttribute("colspan", "3");

    div4.setAttribute("class", "tty");
    div4.id = "div4";
    div4.onscroll = function()
    {
        div4.userControl = div4.scrollHeight - div4.scrollTop!=div4.clientHeight;
    }

    td4.appendChild(div4);

    tr4.appendChild(td4);

    if (options['debug'])
        table.appendChild(tr4);

    // -----------------------------------------

    div.appendChild(table);

    // ============================================

    if (options['debug'])
    {
        var lvl = parseInt(options['debug'], 10);
        options['debugLevel'] = options['debug'];
        options['debug'] = function(msg) {
            if (!msg)
                return;

            if (lvl==1 && msg.substr(9, 3)=="emu") // emulate.js:
                return;

            if (msg.substr(9, 3)=="par") // parse.js
            {
                var sp = document.createElement("div");
                sp.setAttribute("style", "color:green");
                sp.appendChild(document.createTextNode(msg));
                div4.appendChild(sp);
            }
            else
            {
                div4.appendChild(document.createTextNode(msg));
                div4.appendChild(document.createElement("br"));
            }

            if (!div4.userControl)
                div4.scrollTop = div4.scrollHeight;
        }
    }
    else
        options['debug'] = function() { }


    function pad(v) { return ('0'+v).slice(-2); }

    options['onready'] = function(dat) {
        txt325.nodeValue = pad(dat.getUTCHours())+":"+pad(dat.getUTCMinutes())+":"+pad(dat.getUTCSeconds());
        div.style.display = 'inherit';
    }

    options['callback'] = function(arg)
    {
        if (arg.title)
        {
            var title = name;
            if (title.length)
                title += ": ";
            if (arg.title)
                title += arg.title;
            //if (arg.icon)
            //    title += "["+arg.icon+"]";

            txt12.nodeValue = title;
        }

        if (arg.border)
        {
            var w = (arg.width||0)+"px ";
            td21.oldStyle = td21.getAttribute("style");
            td21.setAttribute("style", "padding:"+w+w+w+w+"; background-color:"+arg.border+";");
        }
        if (arg.border==null)
        {
            if (td21.oldStyle)
                td21.setAttribute("style", td21.oldStyle);
        }
    }

    options['onupdate'] = function(dat, frac) {
        txt323.nodeValue = pad(dat.getUTCHours())+":"+pad(dat.getUTCMinutes())+":"+pad(dat.getUTCSeconds());
        progress324.value = frac;
    }

    options['oncompletion'] = function() {
        input322b.setAttribute("style", "display:none;");
        input322a.setAttribute("style", "display:inline;");
        txt323.nodeValue = "--:--:--";
    }

    options['onbookmark'] = function() {
        input327a.setAttribute("style", "display:none;");
        input327b.setAttribute("style", "display:inline;");
    }

    options['onpause'] = function() {
        input322b.setAttribute("style", "display:none;");
        input322a.setAttribute("style", "display:inline;");
    }
    options['onplay'] = function() {
        input322a.setAttribute("style", "display:none;");
        input322b.setAttribute("style", "display:inline;");
    }

    div.player = new TTVPlayer(canvas, options);

    input321.onclick  = function() { div.player.rewind(); }
    input322a.onclick = function() { div.player.playpause(); }
    input322b.onclick = function() { div.player.playpause(); }
    input326.onclick  = function() { div.player.setBookmark(); }
    input327a.onclick = function() { div.player.jump(); }
    input327b.onclick = function() { div.player.jump(); }

    return div;
}

// This is a hack to avoid that the closure compiler will rename
// these functions
window['TTVDisplay'] = TTVDisplay;
