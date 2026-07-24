import type { Ref } from "react";
import {
  TextField as RACTextField,
  type TextFieldProps as RACTextFieldProps,
  TextArea,
  type ValidationResult,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import {
  Description,
  FieldError,
  Input,
  Label,
  fieldBorderStyles,
} from "./Field";
import { composeTailwindRenderProps, focusRing } from "./utils";

const inputStyles = tv({
  extend: focusRing,
  base: "font-sans text-base text-main-black box-border bg-white transition placeholder:text-subtle-text",
  variants: {
    variant: {
      default: "border-1 rounded-lg min-h-12 py-0 px-4",
      plain: "border-none bg-transparent p-0 outline-none",
    },
    isFocused: fieldBorderStyles.variants.isFocusWithin,
    isInvalid: fieldBorderStyles.variants.isInvalid,
    isDisabled: fieldBorderStyles.variants.isDisabled,
  },
  defaultVariants: { variant: "default" },
});

const textAreaStyles = tv({
  extend: focusRing,
  base: "font-sans text-base text-main-black box-border bg-white transition placeholder:text-subtle-text",
  variants: {
    variant: {
      default: "border-1 rounded-lg py-3 px-4 resize-y",
      plain: "border-none bg-transparent p-0 resize-none outline-none",
    },
    isFocused: fieldBorderStyles.variants.isFocusWithin,
    isInvalid: fieldBorderStyles.variants.isInvalid,
    isDisabled: fieldBorderStyles.variants.isDisabled,
  },
  defaultVariants: { variant: "default" },
});

export interface TextFieldProps extends RACTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  rows?: number;
  variant?: "default" | "plain";
  textAreaRef?: Ref<HTMLTextAreaElement>;
  textAreaClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  rows,
  variant = "default",
  textAreaRef,
  textAreaClassName,
  onKeyDown,
  ...props
}: TextFieldProps) {
  return (
    <RACTextField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-2 font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      {rows ? (
        <TextArea
          ref={textAreaRef}
          className={`${textAreaStyles({ variant })} ${textAreaClassName ?? ""}`}
          placeholder={placeholder}
          rows={rows}
          onKeyDown={onKeyDown}
        />
      ) : (
        <Input className={inputStyles({ variant })} placeholder={placeholder} />
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </RACTextField>
  );
}
