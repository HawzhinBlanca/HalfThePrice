import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isFeatureEnabled, isFeatureEnabledAsync } from "./features";
import { prisma } from "@htp/database";

vi.mock("@htp/database", () => ({
  prisma: {
    featureFlag: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Feature flags checker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isFeatureEnabled (Sync Env-only)", () => {
    it("returns true by default when env var is not set", () => {
      expect(isFeatureEnabled("CHAT")).toBe(true);
    });

    it("returns false if DISABLE_FEATURE is set to true", () => {
      vi.stubEnv("DISABLE_CHAT", "true");
      expect(isFeatureEnabled("CHAT")).toBe(false);
    });

    it("returns true if DISABLE_FEATURE is set to something else", () => {
      vi.stubEnv("DISABLE_CHAT", "false");
      expect(isFeatureEnabled("CHAT")).toBe(true);
    });
  });

  describe("isFeatureEnabledAsync (Async DB-backed)", () => {
    it("returns false immediately if DISABLE_FEATURE is set to true in env", async () => {
      vi.stubEnv("DISABLE_CHAT", "true");
      const result = await isFeatureEnabledAsync("CHAT");
      expect(result).toBe(false);
      expect(prisma.featureFlag.findUnique).not.toHaveBeenCalled();
    });

    it("queries database if env is enabled, and returns database state (true)", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue({
        key: "CHAT",
        enabled: true,
        updatedAt: new Date(),
      });

      const result = await isFeatureEnabledAsync("CHAT");
      expect(result).toBe(true);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: "CHAT" },
      });
    });

    it("queries database if env is enabled, and returns database state (false)", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue({
        key: "CHAT",
        enabled: false,
        updatedAt: new Date(),
      });

      const result = await isFeatureEnabledAsync("CHAT");
      expect(result).toBe(false);
    });

    it("returns true if database record is missing", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValue(null);

      const result = await isFeatureEnabledAsync("CHAT");
      expect(result).toBe(true);
    });

    it("falls back to true if database call fails", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockRejectedValue(new Error("DB error"));

      const result = await isFeatureEnabledAsync("CHAT");
      expect(result).toBe(true);
    });
  });
});
