import { describe, expect, it } from "vitest";
import { importConfirmTransactionOptions } from "@/lib/import-confirm";

describe("importConfirmTransactionOptions", () => {
  it("allows enough time for full CSV import writes", () => {
    expect(importConfirmTransactionOptions.timeout).toBeGreaterThanOrEqual(60_000);
    expect(importConfirmTransactionOptions.maxWait).toBeGreaterThanOrEqual(10_000);
  });
});
