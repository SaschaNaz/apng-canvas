"use strict";

namespace APNGExporter.CRC32 {
    "use strict";

    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }

    /**
     *
     * @param {Uint8Array} bytes
     * @param {int} start
     * @param {int} length
     * @return {int}
     */
    export function generate(bytes: Uint8Array, start: number, length: number) {
        start = start || 0;
        length = length || (bytes.length - start);
        var crc = -1;
        for (var i = start, l = start + length; i < l; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
        }
        return crc ^ (-1);
    }
}

namespace APNGExporter {
    // "\x89PNG\x0d\x0a\x1a\x0a"
    const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    /**
     * @param {ArrayBuffer} buffer
     * @return {Promise}
     */
    module.exports = function (buffer) {
        var bytes = new Uint8Array(buffer);
        return new Promise(function (resolve, reject) {

            for (var i = 0; i < PNG_SIGNATURE_BYTES.length; i++) {
                if (PNG_SIGNATURE_BYTES[i] != bytes[i]) {
                    reject("Not a PNG file (invalid file signature)");
                    return;
                }
            }

            // fast animation test
            var isAnimated = false;
            parseChunks(bytes, function (type) {
                if (type == "acTL") {
                    isAnimated = true;
                    return false;
                }
                return true;
            });
            if (!isAnimated) {
                reject("Not an animated PNG");
                return;
            }

            var
                preDataParts = [],
                postDataParts = [],
                headerDataBytes = null,
                frame = null,
                anim = new Animation();

            parseChunks(bytes, function (type, bytes, off, length) {
                switch (type) {
                    case "IHDR":
                        headerDataBytes = bytes.subarray(off + 8, off + 8 + length);
                        anim.width = readDWord(bytes, off + 8);
                        anim.height = readDWord(bytes, off + 12);
                        break;
                    case "acTL":
                        anim.numPlays = readDWord(bytes, off + 8 + 4);
                        break;
                    case "fcTL":
                        if (frame) anim.frames.push(frame);
                        frame = {};
                        frame.width = readDWord(bytes, off + 8 + 4);
                        frame.height = readDWord(bytes, off + 8 + 8);
                        frame.left = readDWord(bytes, off + 8 + 12);
                        frame.top = readDWord(bytes, off + 8 + 16);
                        var delayN = readWord(bytes, off + 8 + 20);
                        var delayD = readWord(bytes, off + 8 + 22);
                        if (delayD == 0) delayD = 100;
                        frame.delay = 1000 * delayN / delayD;
                        // see http://mxr.mozilla.org/mozilla/source/gfx/src/shared/gfxImageFrame.cpp#343
                        if (frame.delay <= 10) frame.delay = 100;
                        anim.playTime += frame.delay;
                        frame.disposeOp = readByte(bytes, off + 8 + 24);
                        frame.blendOp = readByte(bytes, off + 8 + 25);
                        frame.dataParts = [];
                        break;
                    case "fdAT":
                        if (frame) frame.dataParts.push(bytes.subarray(off + 8 + 4, off + 8 + length));
                        break;
                    case "IDAT":
                        if (frame) frame.dataParts.push(bytes.subarray(off + 8, off + 8 + length));
                        break;
                    case "IEND":
                        postDataParts.push(subBuffer(bytes, off, 12 + length));
                        break;
                    default:
                        preDataParts.push(subBuffer(bytes, off, 12 + length));
                }
            });

            if (frame) anim.frames.push(frame);

            if (anim.frames.length == 0) {
                reject("Not an animated PNG");
                return;
            }

            // creating images
            var createdImages = 0;
            var preBlob = new Blob(preDataParts), postBlob = new Blob(postDataParts);
            for (var f = 0; f < anim.frames.length; f++) {
                frame = anim.frames[f];

                var bb = [];
                bb.push(PNG_SIGNATURE_BYTES);
                headerDataBytes.set(makeDWordArray(frame.width), 0);
                headerDataBytes.set(makeDWordArray(frame.height), 4);
                bb.push(makeChunkBytes("IHDR", headerDataBytes));
                bb.push(preBlob);
                for (var j = 0; j < frame.dataParts.length; j++) {
                    bb.push(makeChunkBytes("IDAT", frame.dataParts[j]));
                }
                bb.push(postBlob);
                var url = URL.createObjectURL(new Blob(bb, { "type": "image/png" }));
                delete frame.dataParts;
                bb = null;

                /**
                 * Using "createElement" instead of "new Image" because of bug in Chrome 27
                 * https://code.google.com/p/chromium/issues/detail?id=238071
                 * http://stackoverflow.com/questions/16377375/using-canvas-drawimage-in-chrome-extension-content-script/16378270
                 */
                frame.img = document.createElement('img');
                frame.img.onload = function () {
                    URL.revokeObjectURL(this.src);
                    createdImages++;
                    if (createdImages == anim.frames.length) {
                        resolve(anim);
                    }
                };
                frame.img.onerror = function () {
                    reject("Image creation error");
                };
                frame.img.src = url;
            }
        });
    };

    /**
     * @param {Uint8Array} bytes
     * @param {function(string, Uint8Array, int, int)} callback
     */
    function parseChunks(bytes: Uint8Array, callback: (type: string, bytes: Uint8Array, offset: number, length: number) => boolean) {
        var off = 8;
        do {
            var length = readDWord(bytes, off);
            var type = readString(bytes, off + 4, 4);
            var res = callback(type, bytes, off, length);
            off += 12 + length;
        } while (res !== false && type != "IEND" && off < bytes.length);
    };

    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readDWord(bytes: Uint8Array, offset: number) {
        var x = 0;
        // Force the most-significant byte to unsigned.
        x += ((bytes[0 + offset] << 24) >>> 0);
        for (var i = 1; i < 4; i++) x += ((bytes[i + offset] << ((3 - i) * 8)));
        return x;
    };

    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readWord(bytes: Uint8Array, offset: number) {
        var x = 0;
        for (var i = 0; i < 2; i++) x += (bytes[i + offset] << ((1 - i) * 8));
        return x;
    };

    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readByte(bytes: Uint8Array, offset: number) {
        return bytes[offset];
    };

    /**
     * @param {Uint8Array} bytes
     * @param {int} start
     * @param {int} length
     * @return {Uint8Array}
     */
    function subBuffer(bytes: Uint8Array, start: number, length: number) {
        var a = new Uint8Array(length);
        a.set(bytes.subarray(start, start + length));
        return a;
    };

    function readString(bytes: Uint8Array, offset: number, length: number) {
        var chars = Array.prototype.slice.call(bytes.subarray(offset, offset + length));
        return String.fromCharCode.apply(String, chars);
    };

    function makeDWordArray(x: number) {
        return [(x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff];
    };
    function makeStringArray(x: string) {
        var res: number[] = [];
        for (var i = 0; i < x.length; i++) res.push(x.charCodeAt(i));
        return res;
    };
    /**
     * @param {string} type
     * @param {Uint8Array} dataBytes
     * @return {Uint8Array}
     */
    function makeChunkBytes(type: string, dataBytes: Uint8Array) {
        var crcLen = type.length + dataBytes.length;
        var bytes = new Uint8Array(new ArrayBuffer(crcLen + 8));
        bytes.set(makeDWordArray(dataBytes.length), 0);
        bytes.set(makeStringArray(type), 4);
        bytes.set(dataBytes, 8);
        var crc = CRC32.generate(bytes, 4, crcLen);
        bytes.set(makeDWordArray(crc), crcLen + 4);
        return bytes;
    };
}