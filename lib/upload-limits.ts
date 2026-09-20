/**
 * Single source of truth for file-upload size limits.
 *
 * Two layers must agree or large uploads break in confusing ways:
 *
 *   1. `app/api/files/[...path]/route.ts` rejects oversized multipart bodies.
 *   2. Next.js clones the request body whenever a proxy/middleware exists and
 *      truncates it at `experimental.proxyClientMaxBodySize` *before* the route
 *      handler can read it. Its framework default is only 10 MB, which turns a
 *      large upload into an unparsable multipart body ("Failed to parse body as
 *      FormData."). `next.config.ts` derives that value from
 *      `MAX_UPLOAD_REQUEST_BYTES` here so the two layers stay aligned.
 *
 * Configure with environment variables (read when the server process starts):
 *   - `PI_WEB_MAX_UPLOAD_MB`      total size per request, in MB (default 100)
 *   - `PI_WEB_MAX_UPLOAD_FILE_MB` size per file, in MB (default 25)
 *
 * Setting only `PI_WEB_MAX_UPLOAD_MB` also raises the per-file limit to the same
 * value, so a single knob is enough to upload one large file.
 */

const BYTES_PER_MB = 1024 * 1024;

export const DEFAULT_MAX_UPLOAD_TOTAL_MB = 100;
export const DEFAULT_MAX_UPLOAD_FILE_MB = 25;

export interface UploadLimitEnv {
  PI_WEB_MAX_UPLOAD_MB?: string;
  PI_WEB_MAX_UPLOAD_FILE_MB?: string;
}

export interface UploadLimits {
  /** Largest single file accepted. */
  maxFileBytes: number;
  /** Largest combined size of all files in one request. */
  maxTotalBytes: number;
  /** Wire cap: total plus room for multipart boundaries/headers. */
  maxRequestBytes: number;
}

function parseMb(raw: string | undefined, fallbackMb: number, name: string): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallbackMb;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    console.warn(
      `[pi-web] ignoring invalid ${name}="${raw}"; using the default of ${fallbackMb} MB`,
    );
    return fallbackMb;
  }
  return value;
}

export function formatUploadSize(bytes: number): string {
  const mb = bytes / BYTES_PER_MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export function resolveUploadLimits(
  env: UploadLimitEnv = process.env as UploadLimitEnv,
): UploadLimits {
  const totalRaw = env.PI_WEB_MAX_UPLOAD_MB?.trim();
  const totalMb = parseMb(totalRaw, DEFAULT_MAX_UPLOAD_TOTAL_MB, "PI_WEB_MAX_UPLOAD_MB");
  const totalIsValid = Boolean(totalRaw) && Number.isFinite(Number(totalRaw)) && Number(totalRaw) > 0;
  // A single knob should be enough: when only the total is set, let one file use
  // the whole budget instead of silently keeping the 25 MB per-file default.
  const fileFallbackMb = totalIsValid ? totalMb : DEFAULT_MAX_UPLOAD_FILE_MB;
  const fileMb = Math.min(
    parseMb(env.PI_WEB_MAX_UPLOAD_FILE_MB, fileFallbackMb, "PI_WEB_MAX_UPLOAD_FILE_MB"),
    totalMb,
  );

  const maxTotalBytes = Math.round(totalMb * BYTES_PER_MB);
  return {
    maxFileBytes: Math.round(fileMb * BYTES_PER_MB),
    maxTotalBytes,
    maxRequestBytes: maxTotalBytes + BYTES_PER_MB,
  };
}

const limits = resolveUploadLimits();

export const MAX_UPLOAD_FILE_BYTES = limits.maxFileBytes;
export const MAX_UPLOAD_TOTAL_BYTES = limits.maxTotalBytes;
export const MAX_UPLOAD_REQUEST_BYTES = limits.maxRequestBytes;
