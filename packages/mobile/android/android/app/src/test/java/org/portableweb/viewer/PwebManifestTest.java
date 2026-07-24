package org.portableweb.viewer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PwebManifestTest {

    private static final String VALID_MANIFEST = "{"
        + "\"spec_version\":\"0.1\","
        + "\"id\":\"org.example.hello\","
        + "\"version\":\"1.0.0\","
        + "\"title\":\"Hello PortableWeb\","
        + "\"entry\":\"index.html\""
        + "}";

    @Test
    public void acceptsMinimalValidManifest() {
        PwebManifest.Result result = PwebManifest.validate(VALID_MANIFEST);
        assertTrue(result.valid);
        assertEquals("org.example.hello", result.manifest.get("id").getAsString());
    }

    @Test
    public void rejectsInvalidJson() {
        PwebManifest.Result result = PwebManifest.validate("{ not json");
        assertFalse(result.valid);
        assertTrue(result.errors.size() > 0);
    }

    @Test
    public void rejectsMalformedId() {
        String manifest = VALID_MANIFEST.replace("\"org.example.hello\"", "\"Not An ID!!\"");
        PwebManifest.Result result = PwebManifest.validate(manifest);
        assertFalse(result.valid);
    }

    @Test
    public void rejectsMissingRequiredFields() {
        PwebManifest.Result result = PwebManifest.validate("{\"title\":\"No id or entry\"}");
        assertFalse(result.valid);
        assertTrue(result.errors.size() >= 3);
    }

    @Test
    public void rejectsAbsoluteEntryPath() {
        String manifest = VALID_MANIFEST.replace("\"index.html\"", "\"/index.html\"");
        assertFalse(PwebManifest.validate(manifest).valid);
    }

    @Test
    public void rejectsNonHtmlEntry() {
        String manifest = VALID_MANIFEST.replace("\"index.html\"", "\"index.js\"");
        assertFalse(PwebManifest.validate(manifest).valid);
    }

    @Test
    public void toleratesUnknownTopLevelAndPermissionKeys() {
        String manifest = VALID_MANIFEST.substring(0, VALID_MANIFEST.length() - 1)
            + ",\"some_future_field\":\"ignored\""
            + ",\"permissions\":{\"totally_made_up_permission\":true}"
            + "}";
        PwebManifest.Result result = PwebManifest.validate(manifest);
        assertTrue(result.valid);
    }
}
