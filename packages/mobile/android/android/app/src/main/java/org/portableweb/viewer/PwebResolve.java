package org.portableweb.viewer;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.List;

/**
 * Root-locked path resolution, ported from packages/core/src/resolve.ts.
 * Rejects rather than sanitizes-and-allows: absolute paths, `..` segments,
 * backslash separators, and percent-encoded traversal (single- and
 * double-encoded), matching RESOLUTION.md's framing.
 */
public final class PwebResolve {

    private PwebResolve() {}

    public static String normalizeEntryPath(String rawPath) {
        if (rawPath == null || rawPath.isEmpty()) return null;
        if (rawPath.indexOf('\0') >= 0) return null;

        // Bounded percent-decode loop, catching double-encoded traversal
        // like %252e%252e%252f. URLDecoder treats '+' as space (form
        // encoding) — neutralize that first so literal '+' in a path
        // survives, matching JS's decodeURIComponent semantics.
        String decoded = rawPath;
        for (int i = 0; i < 3; i++) {
            String next;
            try {
                next = URLDecoder.decode(decoded.replace("+", "%2B"), "UTF-8");
            } catch (IllegalArgumentException | UnsupportedEncodingException e) {
                return null;
            }
            if (next.equals(decoded)) break;
            decoded = next;
        }

        // CONTAINER.md §4.1 requires forward slashes — reject backslashes
        // outright rather than translate them.
        if (decoded.indexOf('\\') >= 0) return null;
        if (decoded.startsWith("/")) return null;
        if (decoded.matches("^[a-zA-Z]:.*")) return null;

        String[] segments = decoded.split("/", -1);
        List<String> normalized = new ArrayList<>();
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            if (segment.equals("..")) return null; // reject, do not collapse
            normalized.add(segment);
        }

        if (normalized.isEmpty()) return null;
        return String.join("/", normalized);
    }
}
