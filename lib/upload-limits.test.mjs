import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MAX_UPLOAD_FILE_MB,
  DEFAULT_MAX_UPLOAD_TOTAL_MB,
  formatUploadSize,
  resolveUploadLimits,
} from "./upload-limits.ts";

const MB = 1024 * 1024;

test("defaults apply when no upload limit env is set", () => {
  const limits = resolveUploadLimits({});
  assert.equal(limits.maxTotalBytes, DEFAULT_MAX_UPLOAD_TOTAL_MB * MB);
  assert.equal(limits.maxFileBytes, DEFAULT_MAX_UPLOAD_FILE_MB * MB);
  assert.equal(limits.maxRequestBytes, limits.maxTotalBytes + MB);
});

test("explicit total and per-file limits are honored", () => {
  const limits = resolveUploadLimits({
    PI_WEB_MAX_UPLOAD_MB: "500",
    PI_WEB_MAX_UPLOAD_FILE_MB: "200",
  });
  assert.equal(limits.maxTotalBytes, 500 * MB);
  assert.equal(limits.maxFileBytes, 200 * MB);
  assert.equal(limits.maxRequestBytes, 501 * MB);
});

test("a single total knob raises the per-file limit to match", () => {
  const limits = resolveUploadLimits({ PI_WEB_MAX_UPLOAD_MB: "500" });
  assert.equal(limits.maxFileBytes, 500 * MB);
});

test("a per-file limit above the total is clamped to the total", () => {
  const limits = resolveUploadLimits({
    PI_WEB_MAX_UPLOAD_MB: "10",
    PI_WEB_MAX_UPLOAD_FILE_MB: "50",
  });
  assert.equal(limits.maxFileBytes, 10 * MB);
});

test("invalid values fall back to defaults", () => {
  for (const value of ["0", "-5", "abc", "  "]) {
    const limits = resolveUploadLimits({ PI_WEB_MAX_UPLOAD_MB: value });
    assert.equal(
      limits.maxTotalBytes,
      DEFAULT_MAX_UPLOAD_TOTAL_MB * MB,
      `total for ${JSON.stringify(value)}`,
    );
    assert.equal(
      limits.maxFileBytes,
      DEFAULT_MAX_UPLOAD_FILE_MB * MB,
      `file for ${JSON.stringify(value)}`,
    );
  }
});

test("formatUploadSize renders whole and fractional megabytes", () => {
  assert.equal(formatUploadSize(100 * MB), "100 MB");
  assert.equal(formatUploadSize(1.5 * MB), "1.5 MB");
});
