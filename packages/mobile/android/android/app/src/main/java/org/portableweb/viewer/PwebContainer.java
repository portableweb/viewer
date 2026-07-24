package org.portableweb.viewer;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * Container-level checks not already covered by java.util.zip.ZipFile —
 * which handles full central-directory parsing and DEFLATE decompression
 * natively, so unlike @portableweb/core (which has no ZIP library to rely
 * on) this doesn't reimplement that part. Only the PortableWeb-specific
 * "mimetype is the first entry, stored, no extra fields, exact content"
 * rule (CONTAINER.md §4.2) needs raw byte access, since ZipFile's entry
 * enumeration order isn't a reliable stand-in for physical file position.
 *
 * Ported from packages/core/src/container.ts's fastIdentify() and
 * validateMimetypeEntry() — verified against the same fixture shapes as
 * that file's tests (see PwebContainerTest.java).
 */
public final class PwebContainer {

    public static final String MIMETYPE_CONTENT = "application/vnd.portableweb+zip";

    private PwebContainer() {}

    public static final class ContainerCheckResult {
        public final boolean ok;
        public final String code;
        public final String message;

        private ContainerCheckResult(boolean ok, String code, String message) {
            this.ok = ok;
            this.code = code;
            this.message = message;
        }

        static ContainerCheckResult ok() {
            return new ContainerCheckResult(true, null, null);
        }

        static ContainerCheckResult fail(String code, String message) {
            return new ContainerCheckResult(false, code, message);
        }
    }

    private static final class LocalHeader {
        final String name;
        final int compressionMethod;
        final int compressedSize;
        final int extraLength;
        final int dataStart;

        LocalHeader(String name, int compressionMethod, int compressedSize, int extraLength, int dataStart) {
            this.name = name;
            this.compressionMethod = compressionMethod;
            this.compressedSize = compressedSize;
            this.extraLength = extraLength;
            this.dataStart = dataStart;
        }
    }

    private static LocalHeader readLocalFileHeader(byte[] bytes, int offset) {
        if (offset + 30 > bytes.length) {
            throw new IllegalArgumentException("Local file header runs past end of buffer");
        }
        ByteBuffer buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        if (buf.getInt(offset) != 0x04034b50) {
            throw new IllegalArgumentException("Missing local file header signature");
        }
        int compressionMethod = buf.getShort(offset + 8) & 0xFFFF;
        int compressedSize = buf.getInt(offset + 18);
        int nameLength = buf.getShort(offset + 26) & 0xFFFF;
        int extraLength = buf.getShort(offset + 28) & 0xFFFF;
        int nameStart = offset + 30;
        if (nameStart + nameLength > bytes.length) {
            throw new IllegalArgumentException("Local file header name runs past end of buffer");
        }
        String name = new String(bytes, nameStart, nameLength, StandardCharsets.UTF_8);
        int dataStart = nameStart + nameLength + extraLength;
        return new LocalHeader(name, compressionMethod, compressedSize, extraLength, dataStart);
    }

    /** Fast-ID — reads only the first local file header (~80 bytes). */
    public static boolean fastIdentify(byte[] bytes) {
        try {
            LocalHeader header = readLocalFileHeader(bytes, 0);
            if (!"mimetype".equals(header.name)) return false;
            if (header.compressionMethod != 0) return false;
            if (header.extraLength != 0) return false;
            if (header.dataStart + header.compressedSize > bytes.length) return false;
            String content = new String(bytes, header.dataStart, header.compressedSize, StandardCharsets.UTF_8);
            return MIMETYPE_CONTENT.equals(content);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Full validation distinguishing failure reasons, mirroring
     * container.ts's validateMimetypeEntry — hasMimetypeEntryAnywhere
     * lets the caller distinguish "missing entirely" from "present but
     * not first" (pass `zipFile.getEntry("mimetype") != null`).
     */
    public static ContainerCheckResult validateMimetypeEntry(byte[] bytes, boolean hasMimetypeEntryAnywhere) {
        if (!hasMimetypeEntryAnywhere) {
            return ContainerCheckResult.fail("MIMETYPE_MISSING", "No \"mimetype\" entry found in archive");
        }
        LocalHeader header;
        try {
            header = readLocalFileHeader(bytes, 0);
        } catch (Exception e) {
            return ContainerCheckResult.fail("NOT_A_ZIP", "Missing local file header signature at offset 0");
        }
        if (!"mimetype".equals(header.name)) {
            return ContainerCheckResult.fail("MIMETYPE_NOT_FIRST", "\"mimetype\" must be the first entry in the archive");
        }
        if (header.compressionMethod != 0) {
            return ContainerCheckResult.fail("MIMETYPE_COMPRESSED", "\"mimetype\" entry must be stored (uncompressed)");
        }
        if (header.extraLength != 0) {
            return ContainerCheckResult.fail("MIMETYPE_HAS_EXTRA_FIELD", "\"mimetype\" entry must have no extra fields");
        }
        String content = new String(bytes, header.dataStart, header.compressedSize, StandardCharsets.UTF_8);
        if (!MIMETYPE_CONTENT.equals(content)) {
            return ContainerCheckResult.fail("MIMETYPE_CONTENT_MISMATCH", "\"mimetype\" content does not match \"" + MIMETYPE_CONTENT + "\"");
        }
        return ContainerCheckResult.ok();
    }
}
