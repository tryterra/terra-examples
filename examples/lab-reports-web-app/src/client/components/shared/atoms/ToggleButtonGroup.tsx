import {
  ToggleButtonGroup as RACToggleButtonGroup,
  type ToggleButtonGroupProps,
} from "react-aria-components";
import { composeRenderProps } from "react-aria-components";
import { tv } from "tailwind-variants";

const styles = tv({
  // bg-hover-grey, not bg-bg-grey: the page background IS bg-grey, so the
  // track needs a darker fill to read as a control on it.
  base: "flex gap-1 rounded-lg bg-hover-grey p-1",
  variants: {
    orientation: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
  },
});

export function ToggleButtonGroup(props: ToggleButtonGroupProps) {
  return (
    <RACToggleButtonGroup
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className }),
      )}
    />
  );
}
