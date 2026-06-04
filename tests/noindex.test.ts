import { describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { metadata } from "@/app/layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

describe("no-index protections", () => {
  it("marks every route as noindex through response headers", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toContainEqual({
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    });
  });

  it("marks pages as noindex in metadata", () => {
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});
