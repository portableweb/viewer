package org.portableweb.viewer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class PwebResolveTest {

    @Test
    public void normalizesCleanRelativePath() {
        assertEquals("index.html", PwebResolve.normalizeEntryPath("index.html"));
        assertEquals("assets/icon.svg", PwebResolve.normalizeEntryPath("./assets/icon.svg"));
    }

    @Test
    public void rejectsDotDotTraversal() {
        assertNull(PwebResolve.normalizeEntryPath("../../etc/hosts"));
        assertNull(PwebResolve.normalizeEntryPath("assets/../../secret"));
    }

    @Test
    public void rejectsAbsolutePaths() {
        assertNull(PwebResolve.normalizeEntryPath("/etc/hosts"));
        assertNull(PwebResolve.normalizeEntryPath("C:\\Windows\\System32"));
    }

    @Test
    public void rejectsBackslashSeparators() {
        assertNull(PwebResolve.normalizeEntryPath("assets\\..\\..\\secret"));
    }

    @Test
    public void rejectsSingleAndDoublePercentEncodedTraversal() {
        assertNull(PwebResolve.normalizeEntryPath("%2e%2e%2fsecret"));
        assertNull(PwebResolve.normalizeEntryPath("%252e%252e%252fsecret"));
    }

    @Test
    public void preservesLiteralPlusCharacters() {
        // URLDecoder normally treats '+' as space (form-encoding); this
        // must not happen here, matching JS decodeURIComponent semantics.
        assertEquals("a+b.html", PwebResolve.normalizeEntryPath("a+b.html"));
    }
}
