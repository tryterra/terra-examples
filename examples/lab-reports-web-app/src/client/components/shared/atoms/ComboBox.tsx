/** Searchable dropdown — the ComboBox twin of Select.tsx, same styling. */
import { CaretDownIcon } from "@phosphor-icons/react";
import React from "react";
import {
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Button,
  Input,
  ListBox,
  type ListBoxItemProps,
  type ValidationResult,
} from "react-aria-components";
import { Description, FieldError, Label } from "./Field";
import { DropdownItem } from "./ListBox";
import { Popover } from "./Popover";
import { composeTailwindRenderProps } from "./utils";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children"> {
  label?: string;
  description?: string;
  placeholder?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
}

export function ComboBox<T extends object>({
  label,
  description,
  placeholder,
  errorMessage,
  children,
  items,
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox
      // Keep the full list visible when opened via the caret; typing filters.
      menuTrigger="focus"
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "group relative flex flex-col gap-2 font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      <div className="flex h-12 w-full min-w-[180px] items-center gap-2 rounded-lg border border-border bg-white pr-3 pl-4 transition group-data-[open]:border-emphasis-secondary hover:border-emphasis-secondary">
        <Input
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-main-black outline-none placeholder:text-subtle-text"
        />
        <Button className="flex cursor-pointer items-center">
          <CaretDownIcon
            aria-hidden
            className="h-5 w-5 text-subtle-text forced-colors:text-[ButtonText]"
          />
        </Button>
      </div>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover className="min-w-(--trigger-width)">
        <ListBox
          items={items}
          className="outline-hidden box-border max-h-[inherit] overflow-auto p-1 [clip-path:inset(0_0_0_0_round_.75rem)]"
        >
          {children}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}

export function ComboBoxItem(props: ListBoxItemProps) {
  return <DropdownItem {...props} />;
}
