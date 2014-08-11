// =====================================================================

function overlayTerminal(link)
{
    var args = link ? link.split('&') : location.search.substr(1).split('&');
    if (args.length==0)
        return;

    var options = { };
    for (var i=0; i<args.length; i++)
    {
        var pos = args[i].indexOf('=');
        if (pos<0)
            options[args[i]] = 1;
       if (pos>0)
            options[args[i].substring(0,pos)] = args[i].substring(pos+1);
    }

    if (!options['name'])      options['name']      = args[0];
    if (!options['title'])     options['title']     = args[0].length ? null : '';
    if (!options['autostart']) options['autostart'] = 1000;
    if (!options['warp'])      options['warp']      = 1;
    if (!options['scan'])      options['scan']      = false;
    if (!options['noskip'])    options['noskip']    = false;

    if (args[0].length)
    {
        if (!options['font'] && !options['fontsize'])
            options['fontsize'] = 13;

        if (!options['fontfamily'] && !options['font'])
        {
            options['font']     = 'fixed-8x13';
            options['boldfont'] = 'fixed-8x13B';
        }

        if (options['fontsize']==0)
            options['fontsize'] = null;
    }
    else
    {
        // This is my special case for the default stream
        if (!options['fontfamily'] && !options['font'])
        {
            options['font']       = 'c64';
            options['fontfamily'] = 'c64';
        }
    }

    options['controls'] = options['controls'] ? parseInt(options['controls'], 10) : args[0].length;

    new TTVOverlay(options);

    return false;
}

// ======================================================================

function startDemo()
{
    var opts = {
        'debug':     false,
        'scan':      false,
        'autostart': 1000,
        'warp':      1,
        'font':      'c64',
        'title':     '',
        'loop':      1000,
        'controls':  0,
        'onclose':   function() { opts.loop=0; }
    };

    var frame = document.getElementById("frame");

    var display = new TTVDisplay(opts);
    frame.appendChild(display);

    return false;
}

// This is a hack to avoid that the closure compiler will rename
// these functions
window['overlayTerminal'] = overlayTerminal;
window['startDemo']       = startDemo;
