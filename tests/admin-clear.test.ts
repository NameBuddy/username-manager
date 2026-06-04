import { describe, expect, it, vi } from "vitest";
import { clearApplicationData, clearDatabaseDeleteOrder } from "@/lib/admin-clear";

describe("clearApplicationData", () => {
  it("deletes application data in dependency-safe order without deleting users", async () => {
    const calls: string[] = [];
    const tx = Object.fromEntries(
      clearDatabaseDeleteOrder.map((model, index) => [
        model,
        {
          deleteMany: vi.fn(async () => {
            calls.push(model);
            return { count: index + 1 };
          }),
        },
      ]),
    );
    const db = {
      $transaction: vi.fn(async (operation, options) => {
        expect(options).toEqual({ maxWait: 10000, timeout: 60000 });
        return operation(tx);
      }),
    };

    const counts = await clearApplicationData(db);

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 60000 });
    expect(calls).toEqual(clearDatabaseDeleteOrder);
    expect(Object.keys(counts)).not.toContain("users");
    expect(counts.candidateEvents).toBe(1);
    expect(counts.categories).toBe(clearDatabaseDeleteOrder.length);
  });
});
