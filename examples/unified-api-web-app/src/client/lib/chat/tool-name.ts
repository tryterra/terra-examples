import type { UIMessage } from "ai";

/** Extracts a display-friendly tool name from a tool UI part. */
export function getToolDisplayName(part: UIMessage["parts"][number]): string {
  if ("title" in part && typeof part.title === "string" && part.title) {
    return part.title;
  }

  if ("toolName" in part) return part.toolName as string;
  const type = (part as { type: string }).type;
  if (type.startsWith("tool-")) return type.slice(5);
  return "tool";
}
