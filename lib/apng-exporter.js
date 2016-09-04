var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
"use strict";
var APNGExporter;
(function (APNGExporter) {
    var CRC32;
    (function (CRC32) {
        "use strict";
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++)
                c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c;
        }
        /**
         *
         * @param {Uint8Array} bytes
         * @param {int} start
         * @param {int} length
         * @return {int}
         */
        function generate(bytes, start, length) {
            start = start || 0;
            length = length || (bytes.length - start);
            let crc = -1;
            for (let i = start, l = start + length; i < l; i++) {
                crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
            }
            return crc ^ (-1);
        }
        CRC32.generate = generate;
    })(CRC32 = APNGExporter.CRC32 || (APNGExporter.CRC32 = {}));
})(APNGExporter || (APNGExporter = {}));
var APNGExporter;
(function (APNGExporter) {
    class FrameDrawer {
        constructor(width, height) {
            this._canvas = document.createElement("canvas");
            this._context = this._canvas.getContext("2d");
            this._canvas.width = width;
            this._canvas.height = height;
        }
        draw(frame, resultType) {
            return __awaiter(this, void 0, void 0, function* () {
                const context = this._context;
                if (this._previousFrame) {
                    const previous = this._previousFrame;
                    if (previous.disposeOp == 1) {
                        context.clearRect(previous.left, previous.top, previous.width, previous.height);
                    }
                    else if (previous.disposeOp == 2 && this._previousRevertData) {
                        context.putImageData(this._previousRevertData, previous.left, previous.top);
                    }
                }
                this._previousFrame = frame;
                this._previousRevertData = null;
                if (this._previousFrame.disposeOp == 2) {
                    this._previousRevertData = context.getImageData(frame.left, frame.top, frame.width, frame.height);
                }
                if (frame.blendOp == 0) {
                    context.clearRect(frame.left, frame.top, frame.width, frame.height);
                }
                context.drawImage(yield this._toImageElement(frame.blob), frame.left, frame.top);
                if (resultType === "imagedata") {
                    return context.getImageData(0, 0, this._canvas.width, this._canvas.height);
                }
                return this._toBlob(this._canvas);
            });
        }
        _toBlob(canvas) {
            return __awaiter(this, void 0, void 0, function* () {
                if (canvas.toBlob) {
                    return new Promise((resolve, reject) => {
                        canvas.toBlob((blob) => resolve(blob));
                    });
                }
                else if (canvas.msToBlob) {
                    return canvas.msToBlob();
                }
            });
        }
        _toImageElement(blob) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = err => reject(err);
                image.src = URL.createObjectURL(blob, { oneTimeOnly: true });
            });
        }
    }
    // "\x89PNG\x0d\x0a\x1a\x0a"
    const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    /**
     * @param {ArrayBuffer} buffer
     * @return {Promise}
     */
    function getDependent(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = input instanceof Blob ? yield toArrayBuffer(input) : input;
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < PNG_SIGNATURE_BYTES.length; i++) {
                if (PNG_SIGNATURE_BYTES[i] != bytes[i]) {
                    throw new Error("Not a PNG file (invalid file signature)");
                }
            }
            // fast animation test
            let isAnimated = false;
            parseChunks(bytes, type => {
                if (type == "acTL") {
                    isAnimated = true;
                    return false;
                }
                return true;
            });
            if (!isAnimated) {
                throw new Error("Not an animated PNG");
            }
            const preDataParts = [];
            const postDataParts = [];
            let headerDataBytes = null;
            let width;
            let height;
            let loopCount;
            let duration = 0;
            let frame = null;
            const frames = [];
            parseChunks(bytes, (type, bytes, off, length) => {
                switch (type) {
                    case "IHDR":
                        headerDataBytes = bytes.subarray(off + 8, off + 8 + length);
                        width = readDWord(bytes, off + 8);
                        height = readDWord(bytes, off + 12);
                        break;
                    case "acTL":
                        loopCount = readDWord(bytes, off + 8 + 4);
                        break;
                    case "fcTL":
                        if (frame)
                            frames.push(frame);
                        frame = {};
                        frame.width = readDWord(bytes, off + 8 + 4);
                        frame.height = readDWord(bytes, off + 8 + 8);
                        frame.left = readDWord(bytes, off + 8 + 12);
                        frame.top = readDWord(bytes, off + 8 + 16);
                        const delayN = readWord(bytes, off + 8 + 20);
                        let delayD = readWord(bytes, off + 8 + 22);
                        if (delayD == 0)
                            delayD = 100;
                        frame.delay = 1000 * delayN / delayD;
                        // see http://mxr.mozilla.org/mozilla/source/gfx/src/shared/gfxImageFrame.cpp#343
                        if (frame.delay <= 10)
                            frame.delay = 100;
                        duration += frame.delay;
                        frame.disposeOp = readByte(bytes, off + 8 + 24);
                        frame.blendOp = readByte(bytes, off + 8 + 25);
                        frame.dataParts = [];
                        break;
                    case "fdAT":
                        if (frame)
                            frame.dataParts.push(bytes.subarray(off + 8 + 4, off + 8 + length));
                        break;
                    case "IDAT":
                        if (frame)
                            frame.dataParts.push(bytes.subarray(off + 8, off + 8 + length));
                        break;
                    case "IEND":
                        postDataParts.push(subBuffer(bytes, off, 12 + length));
                        break;
                    default:
                        preDataParts.push(subBuffer(bytes, off, 12 + length));
                }
            });
            if (frame)
                frames.push(frame);
            if (frames.length == 0) {
                throw new Error("Not an animated PNG");
            }
            // creating images
            const preBlob = new Blob(preDataParts);
            const postBlob = new Blob(postDataParts);
            for (let frame of frames) {
                const bb = [];
                bb.push(PNG_SIGNATURE_BYTES);
                headerDataBytes.set(makeDWordArray(frame.width), 0);
                headerDataBytes.set(makeDWordArray(frame.height), 4);
                bb.push(makeChunkBytes("IHDR", headerDataBytes));
                bb.push(preBlob);
                for (let part of frame.dataParts) {
                    bb.push(makeChunkBytes("IDAT", part));
                }
                bb.push(postBlob);
                frame.blob = new Blob(bb, { "type": "image/png" });
                delete frame.dataParts;
            }
            return { width, height, loopCount, duration, frames };
        });
    }
    APNGExporter.getDependent = getDependent;
    ;
    function toArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = err => reject(err);
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(blob);
        });
    }
    function get(input, resultType) {
        return __awaiter(this, void 0, void 0, function* () {
            const dependent = yield getDependent(input);
            const drawer = new FrameDrawer(dependent.width, dependent.height);
            const frames = [];
            for (const frame of dependent.frames) {
                frames.push({
                    data: yield drawer.draw(frame, resultType),
                    delay: frame.delay
                });
            }
            return {
                width: dependent.width,
                height: dependent.height,
                loopCount: dependent.loopCount,
                duration: dependent.duration,
                frames
            };
        });
    }
    APNGExporter.get = get;
    /**
     * @param {Uint8Array} bytes
     * @param {function(string, Uint8Array, int, int)} callback
     */
    function parseChunks(bytes, callback) {
        let off = 8;
        let type;
        let res;
        do {
            const length = readDWord(bytes, off);
            type = readString(bytes, off + 4, 4);
            res = callback(type, bytes, off, length);
            off += 12 + length;
        } while (res !== false && type != "IEND" && off < bytes.length);
    }
    ;
    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readDWord(bytes, offset) {
        let x = 0;
        // Force the most-significant byte to unsigned.
        x += ((bytes[0 + offset] << 24) >>> 0);
        for (let i = 1; i < 4; i++)
            x += ((bytes[i + offset] << ((3 - i) * 8)));
        return x;
    }
    ;
    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readWord(bytes, offset) {
        let x = 0;
        for (let i = 0; i < 2; i++)
            x += (bytes[i + offset] << ((1 - i) * 8));
        return x;
    }
    ;
    /**
     * @param {Uint8Array} bytes
     * @param {int} off
     * @return {int}
     */
    function readByte(bytes, offset) {
        return bytes[offset];
    }
    ;
    /**
     * @param {Uint8Array} bytes
     * @param {int} start
     * @param {int} length
     * @return {Uint8Array}
     */
    function subBuffer(bytes, start, length) {
        const a = new Uint8Array(length);
        a.set(bytes.subarray(start, start + length));
        return a;
    }
    ;
    function readString(bytes, offset, length) {
        const chars = Array.prototype.slice.call(bytes.subarray(offset, offset + length));
        return String.fromCharCode.apply(String, chars);
    }
    ;
    function makeDWordArray(x) {
        return [(x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff];
    }
    ;
    function makeStringArray(x) {
        const res = [];
        for (let i = 0; i < x.length; i++)
            res.push(x.charCodeAt(i));
        return res;
    }
    ;
    /**
     * @param {string} type
     * @param {Uint8Array} dataBytes
     * @return {Uint8Array}
     */
    function makeChunkBytes(type, dataBytes) {
        const crcLen = type.length + dataBytes.length;
        const bytes = new Uint8Array(new ArrayBuffer(crcLen + 8));
        bytes.set(makeDWordArray(dataBytes.length), 0);
        bytes.set(makeStringArray(type), 4);
        bytes.set(dataBytes, 8);
        const crc = APNGExporter.CRC32.generate(bytes, 4, crcLen);
        bytes.set(makeDWordArray(crc), crcLen + 4);
        return bytes;
    }
    ;
})(APNGExporter || (APNGExporter = {}));
//# sourceMappingURL=apng-exporter.js.map