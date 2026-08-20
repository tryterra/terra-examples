import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  Button,
  type GridListItemProps,
  type GridListProps,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import { composeTailwindRenderProps, focusRing } from "./utils";

export function GridList<T extends object>({
  children,
  ...props
}: GridListProps<T>) {
  return (
    <AriaGridList
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col font-sans -mx-2",
      )}
    >
      {children}
    </AriaGridList>
  );
}

const itemStyles = tv({
  extend: focusRing,
  base: "relative flex items-center gap-4 cursor-pointer select-none px-2 py-4 rounded-xl text-base text-main-black -outline-offset-2 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-border last:after:hidden",
  variants: {
    isHovered: {
      true: "bg-black/2",
    },
    isPressed: {
      true: "bg-black/4",
    },
    isDisabled: {
      true: "opacity-60 forced-colors:text-[GrayText]",
    },
  },
});

export function GridListItem({ children, ...props }: GridListItemProps) {
  const textValue = typeof children === "string" ? children : props.textValue;
  return (
    <AriaGridListItem textValue={textValue} {...props} className={itemStyles}>
      {composeRenderProps(children, (children, { allowsDragging }) => (
        <>
          {allowsDragging && <Button slot="drag">≡</Button>}
          {children}
        </>
      ))}
    </AriaGridListItem>
  );
}
