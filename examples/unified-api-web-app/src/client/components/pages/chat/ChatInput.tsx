import { useRef, useState, type KeyboardEvent } from "react";
import {
  PlusIcon,
  BookOpenTextIcon,
  ArrowRightIcon,
  StopIcon,
  XIcon,
} from "@phosphor-icons/react";
import { TooltipTrigger } from "react-aria-components";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { Button } from "@/client/components/shared/atoms/Button";
import { TextField } from "@/client/components/shared/atoms/TextField";
import {
  Menu,
  MenuItem,
  MenuTrigger,
} from "@/client/components/shared/atoms/Menu";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { toastQueue } from "@/client/components/shared/atoms/Toast";
import { PROMPT_LIBRARY } from "@/client/lib/chat/prompts";

/**
 * Chat requests travel over the agent WebSocket, which Cloudflare caps at
 * 1MiB per frame. Attachments are inlined as base64 (+33%) alongside the
 * full message history, so cap the combined raw size well below that.
 */
const MAX_ATTACHMENT_TOTAL_BYTES = 500 * 1024;

export function ChatInput({
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: {
  onSubmit: (text: string, files?: FileList) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (
        (input.trim() || selectedFiles.length > 0) &&
        !disabled &&
        !isStreaming
      )
        handleSubmit();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 160;
    const next = Math.min(el.scrollHeight, maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";

    let total = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (total + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
        rejected.push(file.name);
      } else {
        accepted.push(file);
        total += file.size;
      }
    }

    if (rejected.length > 0) {
      toastQueue.add(
        {
          title: "Attachment too large",
          description: `${rejected.join(", ")} exceeds the ${Math.round(MAX_ATTACHMENT_TOTAL_BYTES / 1024)}KB attachment limit.`,
          variant: "error",
        },
        { timeout: 5000 },
      );
    }
    if (accepted.length > 0) {
      setSelectedFiles((prev) => [...prev, ...accepted]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const dt = new DataTransfer();
    for (const f of selectedFiles) dt.items.add(f);
    onSubmit(input, dt.files.length > 0 ? dt.files : undefined);
    setInput("");
    setSelectedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="flex flex-col gap-8 rounded-2xl border border-border bg-white p-4">
      {selectedFiles.length > 0 && (
        <div className="-mb-4 flex flex-wrap gap-2">
          {selectedFiles.map((file, i) => (
            <Badge
              key={`${file.name}-${i}`}
              variant="neutral"
              className="gap-1.5 rounded-lg border-transparent bg-hover-grey px-2.5 py-1 font-normal text-secondary-text"
            >
              {file.name}
              <Button
                variant="quiet"
                onPress={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
                className="h-auto p-0 text-subtle-text hover:bg-transparent hover:text-main-black"
              >
                <XIcon size={14} />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <TextField
        value={input}
        onChange={(v) => {
          setInput(v);
          handleInput();
        }}
        isDisabled={disabled}
        aria-label="Chat message"
        variant="plain"
        rows={1}
        placeholder="Ask about your health"
        textAreaRef={textareaRef}
        textAreaClassName="max-h-40 disabled:opacity-50"
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TooltipTrigger delay={0} closeDelay={0}>
            <Button
              variant="quiet"
              size="sm"
              onPress={() => fileInputRef.current?.click()}
              aria-label="Attach file"
            >
              <PlusIcon size={20} className="text-subtle-text" />
            </Button>
            <Tooltip>Attach file</Tooltip>
          </TooltipTrigger>
          <MenuTrigger placement="top">
            <TooltipTrigger delay={0} closeDelay={0}>
              <Button variant="quiet" size="sm" aria-label="Prompt library">
                <BookOpenTextIcon size={20} className="text-subtle-text" />
              </Button>
              <Tooltip>Prompt library</Tooltip>
            </TooltipTrigger>
            <Menu>
              {PROMPT_LIBRARY.map((item) => (
                <MenuItem
                  key={item.label}
                  onAction={() => setInput(item.prompt)}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </MenuTrigger>
        </div>
        {isStreaming && onStop ? (
          <Button
            variant="secondary"
            className="rounded-lg"
            size="sm"
            onPress={onStop}
            aria-label="Stop generating"
          >
            <StopIcon size={20} weight="fill" />
          </Button>
        ) : (
          <Button
            variant="primary"
            className="px-4!"
            size="md"
            isDisabled={
              (!input.trim() && selectedFiles.length === 0) || disabled
            }
            onPress={handleSubmit}
            aria-label="Send message"
          >
            <ArrowRightIcon size={20} weight="bold" />
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.csv,.txt"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
