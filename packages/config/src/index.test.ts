import { describe, expect, it } from "vitest";

import { loadServerConfig } from "./index.js";

const REQUIRED_ENVIRONMENT = {
  MONGODB_URI: "mongodb://localhost/askpdf",
  REDIS_URL: "redis://localhost:6379",
  REDIS_KEY_PREFIX: "askpdf:test",
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_BUCKET: "askpdf-test",
  STORAGE_ACCESS_KEY_ID: "local-access",
  STORAGE_SECRET_ACCESS_KEY: "local-secret-value",
  ACCESS_TOKEN_SECRET: "a".repeat(32),
  REFRESH_TOKEN_PEPPER: "b".repeat(32),
  CSRF_SECRET: "c".repeat(32),
} as const;

describe("AI configuration", () => {
  it("allows the local fallback in development", () => {
    const configuration = loadServerConfig({
      ...REQUIRED_ENVIRONMENT,
      NODE_ENV: "development",
      GEMINI_API_KEY: "",
      AI_LOCAL_FALLBACK: "true",
    });

    expect(configuration.AI_LOCAL_FALLBACK).toBe(true);
  });

  it("uses a platform-provided PORT when API_PORT is absent", () => {
    const configuration = loadServerConfig({
      ...REQUIRED_ENVIRONMENT,
      PORT: "8080",
    });

    expect(configuration.API_PORT).toBe(8080);
  });

  it("prefers API_PORT over a platform-provided PORT", () => {
    const configuration = loadServerConfig({
      ...REQUIRED_ENVIRONMENT,
      API_PORT: "4001",
      PORT: "8080",
    });

    expect(configuration.API_PORT).toBe(4001);
  });

  it("treats an empty worker URL as disabled", () => {
    const configuration = loadServerConfig({
      ...REQUIRED_ENVIRONMENT,
      WORKER_PUBLIC_URL: "",
    });

    expect(configuration.WORKER_PUBLIC_URL).toBeUndefined();
  });

  it("requires Gemini credentials in production", () => {
    expect(() =>
      loadServerConfig({
        ...REQUIRED_ENVIRONMENT,
        NODE_ENV: "production",
        GEMINI_API_KEY: "",
      }),
    ).toThrow("GEMINI_API_KEY is required in production");
  });
});
