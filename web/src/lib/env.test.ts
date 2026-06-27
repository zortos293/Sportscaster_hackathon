import { afterEach, describe, expect, it } from "vitest";
import { isAdminEnabled } from "./env";

describe("isAdminEnabled", () => {
  const originalAdminEnabled = process.env.ADMIN_ENABLED;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAdminEnabled === undefined) {
      delete process.env.ADMIN_ENABLED;
    } else {
      process.env.ADMIN_ENABLED = originalAdminEnabled;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("is enabled in development by default", () => {
    delete process.env.ADMIN_ENABLED;
    process.env.NODE_ENV = "development";
    expect(isAdminEnabled()).toBe(true);
  });

  it("is disabled in production by default", () => {
    delete process.env.ADMIN_ENABLED;
    process.env.NODE_ENV = "production";
    expect(isAdminEnabled()).toBe(false);
  });

  it("respects ADMIN_ENABLED=true in production", () => {
    process.env.ADMIN_ENABLED = "true";
    process.env.NODE_ENV = "production";
    expect(isAdminEnabled()).toBe(true);
  });

  it("respects ADMIN_ENABLED=false in development", () => {
    process.env.ADMIN_ENABLED = "false";
    process.env.NODE_ENV = "development";
    expect(isAdminEnabled()).toBe(false);
  });
});
