export type ImportPrimaryActionMode = "preview" | "confirm";

export type ImportPrimaryActionState = {
  disabled: boolean;
  mode: ImportPrimaryActionMode;
  label: string;
  hint: string | null;
  title: string;
};

export function getImportPrimaryActionState({
  busy,
  content,
  hasPreview,
}: {
  busy: boolean;
  content: string;
  hasPreview: boolean;
}): ImportPrimaryActionState {
  const hasContent = content.trim().length > 0;
  const mode: ImportPrimaryActionMode = hasPreview ? "confirm" : "preview";

  if (busy) {
    return {
      disabled: true,
      mode,
      label: "Working...",
      hint: null,
      title: "Import action is running",
    };
  }

  if (!hasContent) {
    return {
      disabled: true,
      mode: "preview",
      label: "Preview first",
      hint: "Paste or upload names before importing.",
      title: "Paste or upload names before importing",
    };
  }

  if (!hasPreview) {
    return {
      disabled: false,
      mode: "preview",
      label: "Preview first",
      hint: "Generate a preview first so duplicates and invalid names are visible before import.",
      title: "Generate a preview before importing",
    };
  }

  return {
    disabled: false,
    mode: "confirm",
    label: "Confirm",
    hint: null,
    title: "Import valid preview rows",
  };
}
