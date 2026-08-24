import { CaretDownIcon } from "@phosphor-icons/react";
import React from "react";
import {
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Button,
  type ListBoxItemProps,
  SelectValue,
  type ValidationResult,
  ListBox,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import { Description, FieldError, Label } from "./Field";
import {
  DropdownItem,
  DropdownSection,
  type DropdownSectionProps,
} from "./ListBox";
import { Popover } from "./Popover";
import { composeTailwindRenderProps, focusRing } from "./utils";

const styles = tv({
  extend: focusRing,
  base: "flex items-center text-start gap-4 w-full font-sans border border-border cursor-pointer rounded-lg pl-4 pr-3 h-12 min-w-[180px] transition bg-white [-webkit-tap-highlight-color:transparent]",
  variants: {
    isDisabled: {
      false:
        "text-main-black hover:border-emphasis-secondary group-invalid:outline group-invalid:outline-failure forced-colors:group-invalid:outline-[Mark]",
      true: "border-border/50 text-subtle-text/50 forced-colors:text-[GrayText]",
    },
  },
});

export interface SelectProps<
  T extends object,
  M extends "single" | "multiple",
> extends Omit<AriaSelectProps<T, M>, "children"> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
}

export function Select<
  T extends object,
  M extends "single" | "multiple" = "single",
>({
  label,
  description,
  errorMessage,
  children,
  items,
  ...props
}: SelectProps<T, M>) {
  return (
    <AriaSelect
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "group flex flex-col gap-2 relative font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      <Button className={styles}>
        <SelectValue className="flex-1 text-base placeholder-shown:text-subtle-text">
          {({ selectedText, defaultChildren }) =>
            selectedText || defaultChildren
          }
        </SelectValue>
        <CaretDownIcon
          aria-hidden
          className="w-5 h-5 text-subtle-text forced-colors:text-[ButtonText] group-disabled:text-subtle-text/50 forced-colors:group-disabled:text-[GrayText]"
        />
      </Button>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover className="min-w-(--trigger-width)">
        <ListBox
          items={items}
          className="outline-hidden box-border p-1 max-h-[inherit] overflow-auto [clip-path:inset(0_0_0_0_round_.75rem)]"
        >
          {children}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

export function SelectItem(props: ListBoxItemProps) {
  return <DropdownItem {...props} />;
}

export function SelectSection<T extends object>(
  props: DropdownSectionProps<T>,
) {
  return <DropdownSection {...props} />;
}
