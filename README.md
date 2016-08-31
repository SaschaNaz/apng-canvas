APNG Exporter
==============

Exports dependent/independent PNG frames from APNGs. Sample page [here](//saschanaz.github.io/apng-exporter);

### API

Simple use: 

```ts
APNGExporter.get(pngFile);
```

Detail:

```ts
declare namespace APNGExporter.CRC32 {
    /**
     *
     * @param {Uint8Array} bytes
     * @param {int} start
     * @param {int} length
     * @return {int}
     */
    function generate(bytes: Uint8Array, start: number, length: number): number;
}
declare namespace APNGExporter {
    interface DependentFrame {
        width: number;
        height: number;
        left: number;
        top: number;
        dataParts: Uint8Array[];
        blob: Blob;
        delay: number;
        disposeOp: number;
        blendOp: number;
    }
    interface DependentExportResult {
        width: number;
        height: number;
        loopCount: number;
        duration: number;
        frames: DependentFrame[];
    }
    /**
     * @param {ArrayBuffer} buffer
     * @return {Promise}
     */
    function getDependent(input: ArrayBuffer | Blob): Promise<DependentExportResult>;
    interface IndependentFrame {
        blob: Blob;
        delay: number;
    }
    interface IndependentExportResult {
        width: number;
        height: number;
        loopCount: number;
        duration: number;
        frames: IndependentFrame[];
    }
    function get(input: ArrayBuffer | Blob): Promise<IndependentExportResult>;
}
```