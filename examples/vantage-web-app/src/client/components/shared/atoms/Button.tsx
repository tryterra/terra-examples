import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import SpinnerIcon from "@/client/assets/spinner.svg?react";
import { focusRing } from "./utils";

export interface ButtonProps extends RACButtonProps {
  /** @default 'primary' */
  variant?: "primary" | "secondary" | "destructive" | "quiet" | "inline";
  /** @default 'lg' */
  size?: "sm" | "md" | "lg";
}

const buttonStyles = tv({
  extend: focusRing,
  base: "relative inline-flex items-center justify-center gap-2 border border-transparent dark:border-white/10 box-border px-3.5 py-0 [&:has(>svg:only-child)]:px-0 [&:has(>svg:only-child)]:aspect-square [&:has(>svg:only-child)]:w-auto font-sans text-base text-center transition rounded-lg cursor-pointer [-webkit-tap-highlight-color:transparent]",
  variants: {
    variant: {
      primary:
        "bg-emphasis text-white rounded-full font-semibold enabled:hover:bg-emphasis-hover pressed:bg-emphasis-pressed",
      secondary:
        "bg-emphasis-bg text-emphasis rounded-full font-semibold enabled:hover:bg-emphasis-bg-hover pressed:bg-emphasis-bg-pressed",
      destructive:
        "bg-failure text-white rounded-full font-semibold enabled:hover:brightness-95 pressed:brightness-90",
      quiet:
        "border-0 bg-transparent text-main-black font-semibold hover:bg-hover-grey pressed:bg-pressed-grey rounded-lg disabled:text-subtle-text",
      inline:
        "border-0 bg-transparent h-auto px-0 py-0 rounded-none underline font-semibold text-main-black decoration-main-black/60 hover:text-main-black-hover hover:decoration-main-black-hover pressed:text-main-black-pressed pressed:decoration-main-black-pressed disabled:text-subtle-text disabled:no-underline",
    },
    size: {
      sm: "h-8 text-sm px-3",
      md: "h-10 text-sm",
      lg: "h-12 px-5",
    },
    isDisabled: {
      true: "border-transparent bg-disabled-grey text-white cursor-not-allowed",
    },
    isPending: {
      true: "text-transparent",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "lg",
  },
  compoundVariants: [
    {
      variant: "quiet",
      isDisabled: true,
      class: "bg-transparent dark:bg-transparent",
    },
    {
      variant: "secondary",
      isDisabled: true,
      class: "bg-transparent border-disabled-grey text-disabled-grey",
    },
  ],
});

export function Button(props: ButtonProps) {
  return (
    <RACButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        buttonStyles({
          ...renderProps,
          variant: props.variant,
          size: props.size,
          className,
        }),
      )}
    >
      {composeRenderProps(props.children, (children, { isPending }) => (
        <>
          {children}
          {isPending && (
            <span
              aria-hidden
              className={`flex absolute inset-0 justify-center items-center ${
                props.variant === "secondary"
                  ? "text-emphasis"
                  : props.variant === "quiet"
                    ? "text-main-black"
                    : "text-white"
              }`}
            >
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            </span>
          )}
        </>
      ))}
    </RACButton>
  );
}
