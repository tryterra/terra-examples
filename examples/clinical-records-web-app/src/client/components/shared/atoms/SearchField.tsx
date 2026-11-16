import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import {
  SearchField as AriaSearchField,
  type SearchFieldProps as AriaSearchFieldProps,
  Button,
} from "react-aria-components";
import { Description, FieldError, FieldGroup, Input, Label } from "./Field";
import { composeTailwindRenderProps } from "./utils";

export interface SearchFieldProps extends AriaSearchFieldProps {
  label?: string;
  description?: string;
  placeholder?: string;
}

export function SearchField({
  label,
  description,
  placeholder,
  ...props
}: SearchFieldProps) {
  return (
    <AriaSearchField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "group flex flex-col gap-2 font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      <FieldGroup>
        <MagnifyingGlassIcon
          aria-hidden
          className="ml-3 h-5 w-5 text-subtle-text group-disabled:text-subtle-text/50"
        />
        <Input
          placeholder={placeholder}
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        <Button className="mr-2 flex h-6 w-6 items-center justify-center rounded border-0 bg-transparent pressed:bg-bg-grey text-subtle-text group-empty:invisible">
          <XIcon aria-hidden className="h-4 w-4" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError />
    </AriaSearchField>
  );
}
