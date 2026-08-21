import { createLink } from "@tanstack/react-router";
import {
  Link as RACLink,
  type LinkProps as RACLinkProps,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import { focusRing } from "./utils";

interface StyledLinkProps extends RACLinkProps {
  variant?: "primary" | "secondary" | "button" | "button-quiet" | "sidebar";
}

const styles = tv({
  extend: focusRing,
  base: "transition [-webkit-tap-highlight-color:transparent]",
  variants: {
    variant: {
      primary:
        "underline rounded-xs font-semibold text-main-black decoration-main-black/60 hover:text-main-black-hover hover:decoration-main-black-hover pressed:text-main-black-pressed pressed:decoration-main-black-pressed disabled:no-underline disabled:cursor-default forced-colors:disabled:text-[GrayText]",
      secondary:
        "underline rounded-xs text-neutral-700 dark:text-neutral-300 decoration-neutral-700/50 hover:decoration-neutral-700 dark:decoration-neutral-300/70 dark:hover:decoration-neutral-300 disabled:no-underline disabled:cursor-default forced-colors:disabled:text-[GrayText]",
      button:
        "no-underline inline-flex items-center justify-center gap-2 h-12 box-border px-6 py-0 font-sans text-base font-semibold text-center rounded-full cursor-pointer bg-emphasis text-white hover:bg-emphasis-hover pressed:bg-emphasis-pressed",
      "button-quiet":
        "no-underline inline-flex items-center gap-2 h-7 px-2 rounded-lg text-sm font-medium text-main-black hover:bg-hover-grey pressed:bg-pressed-grey cursor-pointer transition",
      sidebar:
        "no-underline flex items-center justify-center size-10 rounded-md transition cursor-pointer hover:bg-emphasis-bg pressed:bg-emphasis-bg-pressed text-secondary-text",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

function StyledLink(props: StyledLinkProps) {
  return (
    <RACLink
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className, variant: props.variant }),
      )}
    />
  );
}

export const Link = createLink(StyledLink);

// For external hrefs (createLink demands a registered `to`); same styling.
export const ExternalLink = StyledLink;
