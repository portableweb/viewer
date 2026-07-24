import Compression
import Foundation

/// Raw DEFLATE decompression for ZIP entries using compression method 8 —
/// the native bridge @portableweb/core's setInflateImplementation() seam
/// needs on a JavaScriptCore host (iOS has no zlib module).
///
/// Verified against Node's zlib.deflateRawSync/inflateRawSync output
/// (round-tripped a known compressed byte sequence via a standalone Swift
/// script — see packages/mobile/ios/README.md). Despite the enum case
/// name, COMPRESSION_ZLIB decodes raw DEFLATE (RFC 1951), not
/// zlib-wrapped (RFC 1950) data — which is exactly ZIP's compression
/// method 8, no header to strip.
///
/// Not yet wired to a JSContext — that requires bundling @portableweb/core
/// for JSC first (README.md step 1). This function itself is verified;
/// its JSExport/JSContext integration is not.
enum PwebInflate {
    /// Returns nil if decompression fails or the output doesn't fit in
    /// maxOutputSize. Callers should pass the entry's known uncompressedSize
    /// (from the ZIP central directory) as maxOutputSize.
    static func inflateRaw(_ input: [UInt8], maxOutputSize: Int) -> [UInt8]? {
        guard maxOutputSize > 0 else { return nil }
        var output = [UInt8](repeating: 0, count: maxOutputSize)

        let decodedSize = output.withUnsafeMutableBytes { dst -> Int in
            input.withUnsafeBytes { src -> Int in
                compression_decode_buffer(
                    dst.bindMemory(to: UInt8.self).baseAddress!, maxOutputSize,
                    src.bindMemory(to: UInt8.self).baseAddress!, input.count,
                    nil, COMPRESSION_ZLIB
                )
            }
        }

        guard decodedSize > 0 else { return nil }
        return Array(output.prefix(decodedSize))
    }
}
