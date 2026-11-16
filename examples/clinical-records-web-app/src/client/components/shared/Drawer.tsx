/**
 * Right-hand sheet built on the same React Aria overlay as atoms/Modal, with
 * the same backdrop and border tokens - just docked to the edge and taller,
 * so long detail lists and raw JSON have room.
 */
import {
  ModalOverlay,
  type ModalOverlayProps,
  Modal as RACModal,
} from "react-aria-components";
import { tv } from "tailwind-variants";

const overlayStyles = tv({
  base: "fixed inset-0 isolate z-60 bg-bg-grey/20 backdrop-blur-xs",
  variants: {
    isEntering: { true: "animate-in fade-in duration-200 ease-out" },
    isExiting: { true: "animate-out fade-out duration-200 ease-in" },
  },
});

const drawerStyles = tv({
  base: "fixed inset-y-0 right-0 flex w-full max-w-[min(100vw,560px)] flex-col border-l border-border bg-white font-sans text-left text-main-black shadow-card outline-none",
  variants: {
    isEntering: {
      true: "animate-in slide-in-from-right duration-200 ease-out",
    },
    isExiting: { true: "animate-out slide-out-to-right duration-200 ease-in" },
  },
});

export function Drawer(props: ModalOverlayProps) {
  return (
    <ModalOverlay {...props} className={overlayStyles}>
      <RACModal {...props} className={drawerStyles} />
    </ModalOverlay>
  );
}
