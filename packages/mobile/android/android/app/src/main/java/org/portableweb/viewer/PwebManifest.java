package org.portableweb.viewer;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSyntaxException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Manifest validation ported from packages/core/src/manifest.ts, checked
 * against the real spec/spec/MANIFEST.md §3 (not the "module" framing
 * from reconstructed session notes, which the actual manifest schema
 * doesn't use). Uses Gson rather than org.json — org.json is stubbed to
 * throw in local JVM unit tests unless Robolectric is configured, which
 * this project doesn't have; Gson is a plain Java library and works
 * identically in both `testDebugUnitTest` and real app code.
 */
public final class PwebManifest {

    private static final Pattern ID_PATTERN = Pattern.compile("^[a-z0-9]+(\\.[a-z0-9-]+)+$");
    private static final Pattern SPEC_VERSION_PATTERN = Pattern.compile("^\\d+\\.\\d+$");
    private static final Pattern SEMVER_PATTERN = Pattern.compile(
        "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$"
    );

    private PwebManifest() {}

    public static final class Result {
        public final boolean valid;
        public final List<String> errors;
        public final JsonObject manifest; // null if invalid

        private Result(boolean valid, List<String> errors, JsonObject manifest) {
            this.valid = valid;
            this.errors = errors;
            this.manifest = manifest;
        }
    }

    public static Result validate(String jsonText) {
        JsonElement parsed;
        try {
            parsed = JsonParser.parseString(jsonText);
        } catch (JsonSyntaxException e) {
            return new Result(false, Collections.singletonList("Manifest is not valid JSON: " + e.getMessage()), null);
        }
        if (parsed == null || !parsed.isJsonObject()) {
            return new Result(false, Collections.singletonList("Manifest top-level value must be a JSON object"), null);
        }

        JsonObject manifest = parsed.getAsJsonObject();
        List<String> errors = new ArrayList<>();

        String specVersion = getString(manifest, "spec_version");
        if (specVersion == null || !SPEC_VERSION_PATTERN.matcher(specVersion).matches()) {
            errors.add("\"spec_version\" is required and must match \"MAJOR.MINOR\" (e.g. \"0.1\")");
        }

        String id = getString(manifest, "id");
        if (id == null || !ID_PATTERN.matcher(id).matches()) {
            errors.add("\"id\" is required and must be reverse-domain form (lowercase, alphanumeric, dots, hyphens)");
        }

        String version = getString(manifest, "version");
        if (version == null || !SEMVER_PATTERN.matcher(version).matches()) {
            errors.add("\"version\" is required and must be a valid Semantic Version (e.g. \"1.0.0\")");
        }

        String title = getString(manifest, "title");
        if (title == null || title.isEmpty() || title.length() > 200) {
            errors.add("\"title\" is required and must be 1–200 characters");
        }

        String entry = getString(manifest, "entry");
        String entryLower = entry == null ? null : entry.toLowerCase(Locale.ROOT);
        if (entry == null || entry.isEmpty() || entry.startsWith("/")
            || !(entryLower.endsWith(".html") || entryLower.endsWith(".htm"))) {
            errors.add("\"entry\" is required, must not start with \"/\", and must end in \".html\" or \".htm\"");
        }

        if (manifest.has("permissions") && !manifest.get("permissions").isJsonObject()) {
            errors.add("\"permissions\", if present, must be an object");
        }

        if (!errors.isEmpty()) {
            return new Result(false, errors, null);
        }
        return new Result(true, Collections.<String>emptyList(), manifest);
    }

    private static String getString(JsonObject obj, String key) {
        if (!obj.has(key) || obj.get(key).isJsonNull()) return null;
        JsonElement el = obj.get(key);
        if (!el.isJsonPrimitive()) return null;
        JsonPrimitive prim = el.getAsJsonPrimitive();
        return prim.isString() ? prim.getAsString() : null;
    }
}
