import { test } from "node:test";
import assert from "node:assert/strict";
import * as vm from "node:vm";
import { buildLocalStorageShimSource } from "../src/local-storage-shim";

// Local stand-in for the DOM's Storage type — tsconfig.base.json only
// includes the ES2022 lib (no "DOM"), since packages/core and friends must
// stay usable outside a browser-like environment.
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

interface Sandbox {
  window: { __pwebStorageBridge: unknown; localStorage?: unknown };
}

function runShim(initialData: Record<string, string> = {}) {
  const writes: Array<{ key: string; value: string | null }> = [];
  let clearCalls = 0;

  const sandbox: Sandbox = {
    window: {
      __pwebStorageBridge: {
        initialData,
        write: (key: string, value: string | null) => writes.push({ key, value }),
        clear: () => {
          clearCalls++;
        },
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(buildLocalStorageShimSource(), sandbox);

  return {
    localStorage: sandbox.window.localStorage as StorageLike,
    writes,
    clearCalls: () => clearCalls,
  };
}

test("hydrates from bridge.initialData", () => {
  const { localStorage } = runShim({ theme: "dark" });
  assert.equal(localStorage.getItem("theme"), "dark");
  assert.equal(localStorage.length, 1);
});

test("getItem returns null for missing keys", () => {
  const { localStorage } = runShim();
  assert.equal(localStorage.getItem("missing"), null);
});

test("setItem stores the value and flushes a write to the bridge", () => {
  const { localStorage, writes } = runShim();
  localStorage.setItem("a", "1");
  assert.equal(localStorage.getItem("a"), "1");
  assert.deepEqual(writes, [{ key: "a", value: "1" }]);
});

test("setItem coerces non-string values, matching real localStorage", () => {
  const { localStorage } = runShim();
  // @ts-expect-error — exercising real Storage coercion semantics
  localStorage.setItem("n", 42);
  assert.equal(localStorage.getItem("n"), "42");
});

test("removeItem deletes the key and flushes a null write", () => {
  const { localStorage, writes } = runShim({ a: "1" });
  localStorage.removeItem("a");
  assert.equal(localStorage.getItem("a"), null);
  assert.deepEqual(writes, [{ key: "a", value: null }]);
});

test("removeItem on a non-existent key is a no-op (no bridge write)", () => {
  const { localStorage, writes } = runShim();
  localStorage.removeItem("nope");
  assert.deepEqual(writes, []);
});

test("clear empties storage and calls bridge.clear", () => {
  const { localStorage, clearCalls } = runShim({ a: "1", b: "2" });
  localStorage.clear();
  assert.equal(localStorage.length, 0);
  assert.equal(clearCalls(), 1);
});

test("key(index) matches Storage semantics", () => {
  const { localStorage } = runShim({ a: "1" });
  assert.equal(localStorage.key(0), "a");
  assert.equal(localStorage.key(1), null);
});

test("window.localStorage is not reassignable after injection", () => {
  const initialData = {};
  const sandbox: Sandbox = {
    window: {
      __pwebStorageBridge: { initialData, write: () => {}, clear: () => {} },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(buildLocalStorageShimSource(), sandbox);

  const descriptor = Object.getOwnPropertyDescriptor(sandbox.window, "localStorage");
  assert.equal(descriptor?.configurable, false);
  assert.equal(descriptor?.writable, false);
});
