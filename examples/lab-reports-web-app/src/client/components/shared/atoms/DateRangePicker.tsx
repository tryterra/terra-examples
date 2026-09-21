/**
 * Calendar date-range picker — react-aria DateRangePicker styled to match
 * the Select/ComboBox atoms (field pill + popover calendar).
 */
import { CalendarIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import {
  DateRangePicker as AriaDateRangePicker,
  type DateRangePickerProps as AriaDateRangePickerProps,
  type DateValue,
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateSegment,
  Dialog,
  Group,
  Heading,
  RangeCalendar,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import { Label } from "./Field";
import { Popover } from "./Popover";
import { composeTailwindRenderProps } from "./utils";

const cellStyles = tv({
  base: "flex size-9 cursor-pointer items-center justify-center rounded-lg text-sm text-main-black outside-month:text-subtle-text/50 outside-month:pointer-events-none",
  variants: {
    isHovered: { true: "bg-hover-grey" },
    isSelected: {
      true: "rounded-none bg-emphasis-bg text-emphasis first:rounded-l-lg last:rounded-r-lg",
    },
    isSelectionStart: { true: "rounded-l-lg bg-emphasis text-white" },
    isSelectionEnd: { true: "rounded-r-lg bg-emphasis text-white" },
    isDisabled: { true: "cursor-default text-subtle-text/40" },
  },
});

export interface DateRangePickerProps<T extends DateValue>
  extends AriaDateRangePickerProps<T> {
  label?: string;
}

export function DateRangePicker<T extends DateValue>({
  label,
  ...props
}: DateRangePickerProps<T>) {
  return (
    <AriaDateRangePicker
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "group flex flex-col gap-2 font-sans",
      )}
    >
      {label && <Label>{label}</Label>}
      <Group className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white pr-2 pl-3 transition group-data-[open]:border-emphasis-secondary hover:border-emphasis-secondary">
        <DateInput slot="start" className="flex text-sm text-main-black">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-px tabular-nums outline-none placeholder-shown:text-subtle-text focus:bg-emphasis focus:text-white"
            />
          )}
        </DateInput>
        <span aria-hidden className="text-subtle-text">
          –
        </span>
        <DateInput slot="end" className="flex text-sm text-main-black">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-px tabular-nums outline-none placeholder-shown:text-subtle-text focus:bg-emphasis focus:text-white"
            />
          )}
        </DateInput>
        <Button className="ml-1 flex cursor-pointer items-center rounded-md p-1 text-subtle-text hover:bg-hover-grey">
          <CalendarIcon size={18} />
        </Button>
      </Group>
      <Popover>
        <Dialog className="p-4 outline-none">
          <RangeCalendar>
            <header className="mb-3 flex items-center justify-between">
              <Button
                slot="previous"
                className="flex cursor-pointer items-center rounded-md p-1.5 text-secondary-text hover:bg-hover-grey"
              >
                <CaretLeftIcon size={16} />
              </Button>
              <Heading className="text-sm font-semibold text-main-black" />
              <Button
                slot="next"
                className="flex cursor-pointer items-center rounded-md p-1.5 text-secondary-text hover:bg-hover-grey"
              >
                <CaretRightIcon size={16} />
              </Button>
            </header>
            <CalendarGrid className="border-separate border-spacing-y-0.5">
              {(date) => <CalendarCell date={date} className={cellStyles} />}
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}
