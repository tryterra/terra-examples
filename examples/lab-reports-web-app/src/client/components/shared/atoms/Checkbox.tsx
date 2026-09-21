import { CheckIcon, MinusIcon } from "@phosphor-icons/react";
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import { focusRing } from "./utils";

/* -------------------------------- Default variant -------------------------------- */

const checkboxStyles = tv({
  base: "flex gap-2 items-center group font-sans text-sm transition relative [-webkit-tap-highlight-color:transparent]",
  variants: {
    isDisabled: {
      false: "text-main-black",
      true: "text-disabled-grey forced-colors:text-[GrayText]",
    },
  },
});

/* --------------------------------- Card variant --------------------------------- */

const cardStyles = tv({
  extend: focusRing,
  base: "group flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-sans text-base transition [-webkit-tap-highlight-color:transparent]",
  variants: {
    isSelected: {
      false: "border-border bg-white hover:bg-hover-grey",
      true: "border-emphasis-secondary bg-emphasis-bg hover:bg-emphasis-bg-hover pressed:bg-emphasis-bg-pressed",
    },
  },
});

/* ------------------------------- Shared indicator ------------------------------- */

const boxStyles = tv({
  extend: focusRing,
  base: "w-4.5 h-4.5 box-border shrink-0 rounded-sm flex items-center justify-center border transition",
  variants: {
    isSelected: {
      false:
        "bg-white border-(--color) [--color:var(--color-border)] group-pressed:[--color:var(--color-emphasis-secondary)]",
      true: "bg-(--color) border-(--color) [--color:var(--color-emphasis)] group-pressed:[--color:var(--color-emphasis)] forced-colors:[--color:Highlight]!",
    },
    isInvalid: {
      true: "[--color:var(--color-failure)] forced-colors:[--color:Mark]! group-pressed:[--color:var(--color-failure)]",
    },
    isDisabled: {
      true: "[--color:var(--color-border)] forced-colors:[--color:GrayText]!",
    },
  },
});

const iconStyles =
  "w-3.5 h-3.5 text-white group-disabled:text-disabled-grey forced-colors:text-[HighlightText] pointer-events-none";

function CheckboxIndicator({
  isSelected,
  isIndeterminate,
}: {
  isSelected: boolean;
  isIndeterminate: boolean;
}) {
  return isIndeterminate ? (
    <MinusIcon aria-hidden weight="bold" className={iconStyles} />
  ) : isSelected ? (
    <CheckIcon aria-hidden weight="bold" className={iconStyles} />
  ) : null;
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                */
/* -------------------------------------------------------------------------- */

export interface CheckboxProps extends AriaCheckboxProps {
  variant?: "default" | "card";
}

export function Checkbox({ variant = "default", ...props }: CheckboxProps) {
  const isCard = variant === "card";

  return (
    <AriaCheckbox
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        (isCard ? cardStyles : checkboxStyles)({ ...renderProps, className }),
      )}
    >
      {composeRenderProps(
        props.children,
        (children, { isSelected, isIndeterminate, ...renderProps }) => {
          const boxProps = isCard
            ? { isSelected: isSelected || isIndeterminate }
            : { isSelected: isSelected || isIndeterminate, ...renderProps };
          const indicator = (
            <div className={boxStyles(boxProps)}>
              <CheckboxIndicator
                isSelected={isSelected}
                isIndeterminate={isIndeterminate}
              />
            </div>
          );

          return isCard ? (
            <>
              {children}
              {indicator}
            </>
          ) : (
            <>
              {indicator}
              {children}
            </>
          );
        },
      )}
    </AriaCheckbox>
  );
}
