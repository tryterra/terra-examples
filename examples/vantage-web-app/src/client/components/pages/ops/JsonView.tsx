import { useMemo } from "react";
import { highlight } from "sugar-high";
import { CopyIcon } from "@phosphor-icons/react";
import { Button } from "../../shared/atoms/Button";
import { toastQueue } from "../../shared/atoms/Toast";

/** Read-only JSON viewer: pretty-print + sugar-high highlight + copy button. */
export function JsonView({ value }: { value: unknown }) {
  const pretty = useMemo(
    () =>
      typeof value === "string"
        ? tryPretty(value)
        : JSON.stringify(value, null, 2),
    [value],
  );
  const html = useMemo(() => highlight(pretty), [pretty]);
  return (
    <div className="relative">
      <Button
        variant="quiet"
        size="sm"
        className="absolute right-2 top-2 z-10"
        onPress={() => {
          void navigator.clipboard.writeText(pretty);
          toastQueue.add(
            { title: "Copied", variant: "default" },
            { timeout: 2000 },
          );
        }}
      >
        <CopyIcon size={14} /> Copy
      </Button>
      <pre className="max-h-[520px] overflow-auto rounded-lg border border-border bg-bg-grey p-3 text-xs">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

function tryPretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
