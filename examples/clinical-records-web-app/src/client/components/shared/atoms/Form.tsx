import {
  type FormProps as RACFormProps,
  Form as RACForm,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

export interface FormProps extends RACFormProps {
  onChange?: React.FormEventHandler<HTMLFormElement>;
}

export function Form({ onChange, ...props }: FormProps) {
  return (
    <RACForm
      {...props}
      className={twMerge("flex flex-col gap-6", props.className)}
      {...(onChange ? { onChange } : {})}
    />
  );
}
