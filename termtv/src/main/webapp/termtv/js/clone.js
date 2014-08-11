'use strict';

/**
 * @public
 *
 * This clones all objects and arrays of the given element recursively.
 * Functions are not cloned. This is sometimes necessary to fork
 * the usage of information, beause otherwise javascript only passes
 * references.
 *
 * @param {Object} src
 *    Source object to be cloned
 *
 * @returns {Object}
 *    The clone of the src object
 */
function clone(src)
{
    if (typeof(src) != 'object' || src===null)
        return src;

    var copy = typeof(src.length)!='undefined' ? new Array(src.length) : new Object();
    for (var key in src)
        copy[key] = typeof(src[key])=='object' ? clone(src[key]) : src[key];
    return copy;
}
