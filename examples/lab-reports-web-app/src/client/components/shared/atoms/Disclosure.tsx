import React, { useContext } from "react";
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  DisclosureStateContext,
  Heading,
  type DisclosurePanelProps as AriaDisclosurePanelProps,
  type DisclosureProps as AriaDisclosureProps,
} from "react-aria-components";
import { composeRenderProps } from "react-aria-components";
import { Button } from "./Button";
import { tv } from "tailwind-variants";
import { CaretRightIcon } from "@phosphor-icons/react";
import { composeTailwindRenderProps } from "./utils";

const disclosure = tv({
  base: "group rounded-lg text-main-black",
});

const chevron = tv({
  base: "size-5 text-subtle-text transition-transform duration-200 ease-in-out",
  variants: {
    isExpanded: {
      true: "rotate-90",
    },
    isDisabled: {
      true: "text-disabled-grey",
    },
  },
});

export interface DisclosureProps extends AriaDisclosureProps {
  children: React.ReactNode;
}

export function Disclosure({ children, ...props }: DisclosureProps) {
  return (
    <AriaDisclosure
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        disclosure({ ...renderProps, className }),
      )}
    >
      {children}
    </AriaDisclosure>
  );
}

export interface DisclosureHeaderProps {
  children: React.ReactNode;
}

export function DisclosureHeader({ children }: DisclosureHeaderProps) {
  const { isExpanded } = useContext(DisclosureStateContext)!;
  return (
    <Heading className="-ml-2">
      <Button
        slot="trigger"
        variant="quiet"
        className="px-2 w-full justify-start font-medium text-subtle-text"
      >
        {({ isDisabled }) => (
          <>
            <CaretRightIcon
              aria-hidden
              className={chevron({ isExpanded, isDisabled })}
            />
            <span>{children}</span>
          </>
        )}
      </Button>
    </Heading>
  );
}

export interface DisclosurePanelProps extends AriaDisclosurePanelProps {
  children: React.ReactNode;
}

export function DisclosurePanel({ children, ...props }: DisclosurePanelProps) {
  return (
    <AriaDisclosurePanel
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "h-(--disclosure-panel-height) overflow-clip motion-safe:transition-[height]",
      )}
    >
      <div className="px-4 py-2">{children}</div>
    </AriaDisclosurePanel>
  );
}
