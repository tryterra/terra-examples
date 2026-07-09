import type { CSSProperties } from "react";
import {
  UNSTABLE_ToastRegion as ToastRegion,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastContent as ToastContent,
  type ToastProps,
  Button,
  Text,
} from "react-aria-components/Toast";
import { tv } from "tailwind-variants";
import { flushSync } from "react-dom";

interface MyToastContent {
  title: string;
  description?: string;
  variant?: "default" | "error" | "success";
}

export const toastQueue = new ToastQueue<MyToastContent>({
  wrapUpdate(fn) {
    if ("startViewTransition" in document) {
      document.startViewTransition(() => {
        flushSync(fn);
      });
    } else {
      fn();
    }
  },
});

const toastStyles = tv({
  base: "flex w-[230px] items-center gap-4 rounded-lg px-4 py-3 font-sans outline-none forced-colors:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 [view-transition-class:toast]",
  variants: {
    variant: {
      default: "bg-blue-600",
      error: "bg-red-600",
      success: "bg-green-600",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function GlobalToastRegion() {
  return (
    <ToastRegion
      queue={toastQueue}
      className="fixed bottom-4 right-4 flex flex-col-reverse gap-2 rounded-lg outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
    >
      {({ toast }) => (
        <MyToast toast={toast}>
          <ToastContent className="flex min-w-0 flex-1 flex-col">
            <Text slot="title" className="text-sm font-semibold text-white">
              {toast.content.title}
            </Text>
            {toast.content.description && (
              <Text slot="description" className="text-xs text-white">
                {toast.content.description}
              </Text>
            )}
          </ToastContent>
          <Button
            slot="close"
            aria-label="Close"
            className="flex h-8 w-8 flex-none appearance-none items-center justify-center rounded-sm border-none bg-transparent p-0 text-white outline-none hover:bg-white/10 pressed:bg-white/15 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 [-webkit-tap-highlight-color:transparent]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </MyToast>
      )}
    </ToastRegion>
  );
}

function MyToast(props: ToastProps<MyToastContent>) {
  return (
    <Toast
      {...props}
      style={{ viewTransitionName: props.toast.key } as CSSProperties}
      className={toastStyles({ variant: props.toast.content.variant })}
    />
  );
}
