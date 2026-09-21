import {
  ToggleButton as RACToggleButton,
  type ToggleButtonProps,
} from "react-aria-components";
import { composeRenderProps } from "react-aria-components";
import { tv } from "tailwind-variants";
import { focusRing } from "./utils";

const styles = tv({
  extend: focusRing,
  base: "inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-medium transition cursor-pointer [-webkit-tap-highlight-color:transparent]",
  variants: {
    isSelected: {
      false: "text-secondary-text hover:text-main-black",
      true: "bg-emphasis-bg border border-emphasis-secondary text-emphasis",
    },
    isDisabled: {
      true: "text-disabled-grey cursor-not-allowed",
    },
  },
});

export function ToggleButton(props: ToggleButtonProps) {
  return (
    <RACToggleButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className }),
      )}
    />
  );
}
