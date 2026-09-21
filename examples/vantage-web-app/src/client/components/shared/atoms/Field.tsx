import {
  FieldError as RACFieldError,
  type FieldErrorProps,
  Group,
  type GroupProps,
  Input as RACInput,
  type InputProps,
  Label as RACLabel,
  type LabelProps,
  Text,
  type TextProps,
  composeRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";
import { tv } from "tailwind-variants";
import { composeTailwindRenderProps, focusRing } from "./utils";

export function Label(props: LabelProps) {
  return (
    <RACLabel
      {...props}
      className={twMerge(
        "font-sans text-base text-secondary-text font-medium cursor-default w-fit",
        props.className,
      )}
    />
  );
}

export function Description(props: TextProps) {
  return (
    <Text
      {...props}
      slot="description"
      className={twMerge("text-sm text-neutral-600", props.className)}
    />
  );
}

export function FieldError(props: FieldErrorProps) {
  return (
    <RACFieldError
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "text-sm text-failure forced-colors:text-[Mark]",
      )}
    />
  );
}

export const fieldBorderStyles = tv({
  base: "transition",
  variants: {
    isFocusWithin: {
      false:
        "border-border hover:border-emphasis-secondary forced-colors:border-[ButtonBorder]",
      true: "border-emphasis forced-colors:border-[Highlight]",
    },
    isInvalid: {
      true: "border-failure forced-colors:border-[Mark]",
    },
    isDisabled: {
      true: "border-border/50 forced-colors:border-[GrayText]",
    },
  },
});

export const fieldGroupStyles = tv({
  extend: focusRing,
  base: "group flex items-center h-12 box-border bg-white forced-colors:bg-[Field] border rounded-lg overflow-hidden transition",
  variants: fieldBorderStyles.variants,
});

export function FieldGroup(props: GroupProps) {
  return (
    <Group
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldGroupStyles({ ...renderProps, className }),
      )}
    />
  );
}

export function Input(props: InputProps) {
  return (
    <RACInput
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "px-4 py-0 min-h-12 flex-1 min-w-0 border-0 outline-0 bg-white font-sans text-base text-main-black placeholder:text-subtle-text disabled:text-subtle-text/50 disabled:placeholder:text-subtle-text/50 [-webkit-tap-highlight-color:transparent]",
      )}
    />
  );
}
