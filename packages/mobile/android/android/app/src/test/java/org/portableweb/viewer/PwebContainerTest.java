package org.portableweb.viewer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.zip.ZipEntry;
import org.junit.Test;

public class PwebContainerTest {

    private static final String MIMETYPE = PwebContainer.MIMETYPE_CONTENT;

    @Test
    public void fastIdentify_acceptsValidMimetypeFirstBundle() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("mimetype", MIMETYPE));
        assertTrue(PwebContainer.fastIdentify(zip));
    }

    @Test
    public void fastIdentify_rejectsMissingMimetype() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("manifest.json", "{}"));
        assertFalse(PwebContainer.fastIdentify(zip));
    }

    @Test
    public void fastIdentify_rejectsMimetypeNotFirst() throws Exception {
        byte[] zip = TestZipBuilder.build(
            new TestZipBuilder.Entry("manifest.json", "{}"),
            new TestZipBuilder.Entry("mimetype", MIMETYPE)
        );
        assertFalse(PwebContainer.fastIdentify(zip));
    }

    @Test
    public void fastIdentify_rejectsCompressedMimetype() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("mimetype", MIMETYPE, ZipEntry.DEFLATED));
        assertFalse(PwebContainer.fastIdentify(zip));
    }

    @Test
    public void validateMimetypeEntry_missing() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("manifest.json", "{}"));
        PwebContainer.ContainerCheckResult result = PwebContainer.validateMimetypeEntry(zip, false);
        assertFalse(result.ok);
        assertEquals("MIMETYPE_MISSING", result.code);
    }

    @Test
    public void validateMimetypeEntry_notFirst() throws Exception {
        byte[] zip = TestZipBuilder.build(
            new TestZipBuilder.Entry("manifest.json", "{}"),
            new TestZipBuilder.Entry("mimetype", MIMETYPE)
        );
        PwebContainer.ContainerCheckResult result = PwebContainer.validateMimetypeEntry(zip, true);
        assertFalse(result.ok);
        assertEquals("MIMETYPE_NOT_FIRST", result.code);
    }

    @Test
    public void validateMimetypeEntry_compressed() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("mimetype", MIMETYPE, ZipEntry.DEFLATED));
        PwebContainer.ContainerCheckResult result = PwebContainer.validateMimetypeEntry(zip, true);
        assertFalse(result.ok);
        assertEquals("MIMETYPE_COMPRESSED", result.code);
    }

    @Test
    public void validateMimetypeEntry_contentMismatch() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("mimetype", "not/the-right-type"));
        PwebContainer.ContainerCheckResult result = PwebContainer.validateMimetypeEntry(zip, true);
        assertFalse(result.ok);
        assertEquals("MIMETYPE_CONTENT_MISMATCH", result.code);
    }

    @Test
    public void validateMimetypeEntry_ok() throws Exception {
        byte[] zip = TestZipBuilder.build(new TestZipBuilder.Entry("mimetype", MIMETYPE));
        PwebContainer.ContainerCheckResult result = PwebContainer.validateMimetypeEntry(zip, true);
        assertTrue(result.ok);
    }
}
