'use strict';

/**
 * @class TTVOverlay
 * @constructor
 * @public
 *
 * This objects create a span which overlays the whole viewport. It fades
 * in and displays a TTVPlayer at the center of the viewport.
 *
 * The given options are passed through to the created TTVDisplay object.
 * The 'onclose' property is overwritten.
 *
 * @param {Object} options
 *    An object with options passed to the created TTVDisplay object.
 */
function TTVOverlay(options)
{
    var screen = document.createElement("span");
    screen.setAttribute("style", "position:fixed;top:0px;left:0px;width:100%;height:100%;opacity:0;background-color:black;"); // right:500px;bottom:500px;

    var body = document.getElementsByTagName("body")[0];
    body.appendChild(screen);

    var t = document.createElement("table");
    t.setAttribute("style", "position:fixed;top:0px;left:0px;width:100%;height:100%");
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.align = "center";

    options['onclose'] = function() { body.removeChild(t); body.removeChild(screen); },

    body.appendChild(t);
    t.appendChild(tr);
    tr.appendChild(td);

    function fadeIn()
    {
        screen.style.opacity = parseFloat(screen.style.opacity) + 0.03;
        if (screen.style.opacity>0.79)
        {
            var disp = new TTVDisplay(options);
            td.appendChild(disp);
            return;
        }

        setTimeout(fadeIn, 1);
    }

    fadeIn();
}

// This is a hack to avoid that the closure compiler will rename
// these functions
window['TTVOverlay'] = TTVOverlay;
