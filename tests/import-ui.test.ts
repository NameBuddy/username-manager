import { describe, expect, it } from "vitest";
import { getImportPrimaryActionState } from "@/lib/import-ui";

describe("getImportPrimaryActionState", () => {
  it("allows the primary action to run preview when content exists but no preview has been generated", () => {
    expect(getImportPrimaryActionState({ busy: false, content: "Shark\nWolf", hasPreview: false })).toMatchObject({
      disabled: false,
      mode: "preview",
      label: "Preview first",
    });
  });

  it("switches the primary action to confirmation after preview is available", () => {
    expect(getImportPrimaryActionState({ busy: false, content: "Shark\nWolf", hasPreview: true })).toMatchObject({
      disabled: false,
      mode: "confirm",
      label: "Confirm",
    });
  });
});
