import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("localized API errors", () => {
  it("returns English message by default", () => {
    expect(getErrorMessage("UNAUTHORIZED")).toContain("signed in");
  });

  it("returns Arabic message", () => {
    expect(getErrorMessage("FORBIDDEN", "ar")).toContain("صلاحية");
  });

  it("returns Kurdish message", () => {
    expect(getErrorMessage("CSRF_INVALID", "ku")).toContain("ئاسایش");
  });
});
