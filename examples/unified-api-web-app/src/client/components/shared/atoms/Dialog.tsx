import {
  Dialog as RACDialog,
  type DialogProps,
  Heading as RACHeading,
  type HeadingProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

export function Dialog(props: DialogProps) {
  return (
    <RACDialog
      {...props}
      className={twMerge("p-6 outline-none", props.className)}
    />
  );
}

export function Heading(props: HeadingProps) {
  return (
    <RACHeading
      {...props}
      className={twMerge(
        "text-lg font-semibold text-main-black",
        props.className,
      )}
    />
  );
}
