package org.portableweb.viewer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Small ZIP fixture builder for these tests only — not a general-purpose tool. */
final class TestZipBuilder {

    static final class Entry {
        final String name;
        final String content;
        final int method;

        Entry(String name, String content, int method) {
            this.name = name;
            this.content = content;
            this.method = method;
        }

        Entry(String name, String content) {
            this(name, content, ZipEntry.STORED);
        }
    }

    private TestZipBuilder() {}

    static byte[] build(Entry... entries) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (Entry e : entries) {
                byte[] bytes = e.content.getBytes(StandardCharsets.UTF_8);
                ZipEntry zipEntry = new ZipEntry(e.name);
                zipEntry.setMethod(e.method);
                if (e.method == ZipEntry.STORED) {
                    CRC32 crc = new CRC32();
                    crc.update(bytes);
                    zipEntry.setSize(bytes.length);
                    zipEntry.setCompressedSize(bytes.length);
                    zipEntry.setCrc(crc.getValue());
                }
                zos.putNextEntry(zipEntry);
                zos.write(bytes);
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }
}
