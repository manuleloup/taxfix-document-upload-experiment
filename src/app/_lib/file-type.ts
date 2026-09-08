// What an uploaded file actually is, decided by its own leading bytes.
//
// The MIME type on a multipart part is whatever the client says it is —
// `curl -F "file=@anything.bin;type=application/pdf"` sets it freely — and the
// filename extension is no better. Neither is trusted here. A file is accepted
// only if its content matches one of the signatures below, and the *sniffed*
// type is what travels onward to the store and the model, never the declared
// one.
//
// HEIC is deliberately absent. iPhones shoot it by default, so it is a real
// upload, but the model can't read it and accepting it would mean bundling an
// image-conversion library — separate work, not a signature.

export type AcceptedMediaType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

export const ACCEPTED_MEDIA_TYPES: AcceptedMediaType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** For the file input's `accept` — a picker convenience, never a control. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MEDIA_TYPES.join(",");

export function isAcceptedMediaType(value: unknown): value is AcceptedMediaType {
  return typeof value === "string" && (ACCEPTED_MEDIA_TYPES as string[]).includes(value);
}

function matches(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/** The file's real type, or null if it isn't one we accept. Reject on null:
 *  an unrecognised file should never reach the store or the model. */
export function sniffMediaType(bytes: Uint8Array): AcceptedMediaType | null {
  // "%PDF-"
  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  // JPEG SOI + marker
  if (matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG signature, including the CRLF/EOF trap bytes
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "GIF87a" / "GIF89a"
  if (
    matches(bytes, [0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  // RIFF container with a WEBP form type at byte 8
  if (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
