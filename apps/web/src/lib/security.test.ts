import { describe, expect, it } from "vitest";
import { sniffMimeType, timingSafeMatch } from "./security";

describe("Content Sniffing (Magic Bytes)", () => {
  it("detects application/pdf correctly", () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x31, 0x2e, 0x34]); // %PDF1.4
    expect(sniffMimeType(pdfBuffer)).toBe("application/pdf");
  });

  it("detects image/png correctly", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffMimeType(pngBuffer)).toBe("image/png");
  });

  it("detects image/jpeg correctly", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(sniffMimeType(jpegBuffer)).toBe("image/jpeg");
  });

  it("detects image/webp correctly", () => {
    // WebP signature: RIFF at 0-3, and WEBP at 8-11
    const webpBuffer = Buffer.alloc(12);
    webpBuffer.write("RIFF", 0, "ascii");
    webpBuffer.write("WEBP", 8, "ascii");
    expect(sniffMimeType(webpBuffer)).toBe("image/webp");
  });

  it("returns null for unknown/unsupported signatures", () => {
    const emptyBuffer = Buffer.from([]);
    const shortBuffer = Buffer.from([0x12, 0x34]);
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable
    const partialWebpBuffer = Buffer.alloc(11);
    partialWebpBuffer.write("RIFF", 0, "ascii");

    expect(sniffMimeType(emptyBuffer)).toBeNull();
    expect(sniffMimeType(shortBuffer)).toBeNull();
    expect(sniffMimeType(exeBuffer)).toBeNull();
    expect(sniffMimeType(partialWebpBuffer)).toBeNull();
  });
});

describe("Timing-Safe Secret Matcher", () => {
  it("matches equal secrets", () => {
    expect(timingSafeMatch("secret-key", "secret-key")).toBe(true);
    expect(timingSafeMatch("", "")).toBe(true);
  });

  it("fails on mismatched secrets", () => {
    expect(timingSafeMatch("secret-key", "wrong-key")).toBe(false);
    expect(timingSafeMatch("secret-key", "secret-key-extra")).toBe(false);
    expect(timingSafeMatch("secret", "")).toBe(false);
  });
});
