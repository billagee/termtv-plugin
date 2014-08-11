'use strict';

/**
 * @class TTVDecoder
 * @constructor
 *
 * Splits the stream written by ttyrec or termrec into chunks and
 * interpreted the control data. Checks its validity.
 *
 * @returns {Array}
 *   An array with each entry (chunk) having the following
 *   properties is returned: time {Number}, len {Number} and data {String}.
 *
 * @throws An error is thrown when a length of a chunk is less than 0
 *   or when a chunks header points well below the end of the data.
 */
function TTVDecoder(contents)
{
    var out = [];

    var pos = 0;
    while (pos<contents.length)
    {
        var sec  = this.r_uint32le(contents, pos);
        var usec = this.r_uint32le(contents, pos+4);
        var len  = this.r_uint32le(contents, pos+8);

        if (len<0)
            throw new Error("The stream seems to be broken [chunk size < 0]");

        if (len==0 && pos+12+len>contents.length)
            break;

        if (pos+12+len>contents.length)
            throw new Error("The stream seems to be broken ["+len+";"+(pos+12+len)+">"+contents.length+"]");

        var data = contents.substr(pos+12, len);

        pos += len+12;

        out.push({ time: sec + usec/1000000, len: len, data: this.fixHighCharCodes(data) });
    }

    return out;
};

/**
 * Convert each four bytes into the correct byte order.
 *
 * @param {String} data
 *    The string from which the bytes are extracted
 *
 * @param {number} offset
 *    The index from which on the four bytes are evaluated
 *
 * @returns {number}
 *
 * @private
 */
TTVDecoder.prototype.r_uint32le = function(data, offset)
{
    var hh = (data.charCodeAt(offset+3) & 0xff) << 24;
    var hl = (data.charCodeAt(offset+2) & 0xff) << 16;
    var lh = (data.charCodeAt(offset+1) & 0xff) <<  8;
    var ll = (data.charCodeAt(offset)   & 0xff);

    return hh | hl | lh | ll;
}

/**
 * Remove the upper byte from some char codes.
 *
 * @param {String} data
 *    The data stream for which the upper bytes should be removed
 *
 * @returns {string}
 *
 * @private
 */
TTVDecoder.prototype.fixHighCharCodes = function(data)
{
    var ch = "";
    for (var i = 0; i < data.length; i++)
        ch += String.fromCharCode( data.charCodeAt(i) & 0xff );
    return ch;
}
/*
function uint32le(stream, pos)
{
    var hh = (stream.charCodeAt(pos+3) & 0xff) << 24;
    var hl = (stream.charCodeAt(pos+2) & 0xff) << 16;
    var lh = (stream.charCodeAt(pos+1) & 0xff) <<  8;
    var ll = (stream.charCodeAt(pos)   & 0xff);

    return hh | hl | lh | ll;
}

function extract(data, pos, len)
{
    var str = "";
    for (var i=pos; i<pos+len; i++)
        str += String.fromCharCode(data.charCodeAt(i)&0xff);
    return str;
}

function getChunk(stream, pos)
{
    if (pos==stream.length)
        return;

    if (pos===undefined)
        pos = 0;

    var sec  = uint32le(stream, pos);
    var usec = uint32le(stream, pos+4);
    var len  = uint32le(stream, pos+8);

    if (len<0)
        throw new Error("The stream seems to be broken [pos="+pos+"; len="+len+"]");

    if (len==0 && pos+12>stream.length)
        return;

    if (pos+12+len>stream.length)
        throw new Error("The stream seems to be broken [pos="+pos+"; len="+len+"; LEN="+stream.length+"]");

    var ret = { };
    ret.time = sec+usec/1000000;
    ret.pos  = pos+12+len;
    ret.data = extract(stream, pos+12, len);
    return ret;
};


function getChunkHeader(stream, pos)
{
    if (pos==stream.length)
        return;

    if (pos===undefined)
        pos = 0;

    var sec  = uint32le(stream, pos);
    var usec = uint32le(stream, pos+4);
    var len  = uint32le(stream, pos+8);

    if (len<0)
        throw new Error("The stream seems to be broken [pos="+pos+"; len="+len+"]");

    if (len==0 && pos+12>stream.length)
        return;

    if (pos+12+len>stream.length)
        throw new Error("The stream seems to be broken [pos="+pos+"; len="+len+"; LEN="+stream.length+"]");

    var ret = { };
    ret.time = sec+usec/1000000;
    ret.pos  = pos+12+len;
    return ret;
};

*/
