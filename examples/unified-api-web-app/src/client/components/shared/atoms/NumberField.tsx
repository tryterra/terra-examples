import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Button,
  type ButtonProps,
  type ValidationResult,
} from "react-aria-components";
import {
  Description,
  FieldError,
  FieldGroup,
  Input,
  Label,
  fieldBorderStyles,
} from "./Field";
import { composeTailwindRenderProps } from "./utils";

export interface NumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
}

export function NumberField({
  label,
  description,
  errorMessage,
  placeholder,
  ...props
}: NumberFieldProps) {
  return (
    <AriaNumberField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "group flex flex-col gap-2 font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      <FieldGroup>
        {(renderProps) => (
          <>
            <Input className="w-20" placeholder={placeholder} />
            <div
              className={fieldBorderStyles({
                ...renderProps,
                class: "flex flex-col border-s h-full",
              })}
            >
              <StepperButton slot="increment">
                <CaretUpIcon aria-hidden weight="bold" className="w-4 h-4" />
              </StepperButton>
              <div
                className={fieldBorderStyles({
                  ...renderProps,
                  class: "border-b",
                })}
              />
              <StepperButton slot="decrement">
                <CaretDownIcon aria-hidden weight="bold" className="w-4 h-4" />
              </StepperButton>
            </div>
          </>
        )}
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaNumberField>
  );
}

function StepperButton(props: ButtonProps) {
  return (
    <Button
      {...props}
      className="flex items-center justify-center border-0 py-0 px-0.5 flex-1 box-border cursor-default text-subtle-text bg-transparent pressed:bg-bg-grey group-disabled:text-subtle-text/50 forced-colors:group-disabled:text-[GrayText] [-webkit-tap-highlight-color:transparent]"
    />
  );
}
