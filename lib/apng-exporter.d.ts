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
    interface IndependentFrame<T> {
        data: T;
        delay: number;
    }
    interface IndependentExportResult<T> {
        width: number;
        height: number;
        loopCount: number;
        duration: number;
        frames: IndependentFrame<T>[];
    }
    function get(input: ArrayBuffer | Blob, resultType?: "blob"): Promise<IndependentExportResult<Blob>>;
    function get(input: ArrayBuffer | Blob, resultType: "imagedata"): Promise<IndependentExportResult<ImageData>>;
    function get(input: ArrayBuffer | Blob, resultType?: "imagedata" | "blob"): Promise<IndependentExportResult<ImageData | Blob>>;
}
