import { Dialog, Heading, ModalOverlay, Modal } from "react-aria-components";
import type { ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
  cubicBezier,
} from "motion/react";

const MotionModal = motion.create(Modal);
const MotionModalOverlay = motion.create(ModalOverlay);

const inertiaTransition = {
  type: "inertia" as const,
  bounceStiffness: 300,
  bounceDamping: 40,
  timeConstant: 300,
};

const staticTransition = {
  duration: 0.5,
  ease: cubicBezier(0.32, 0.72, 0, 1),
};

const SHEET_MARGIN = 34;

interface SheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ isOpen, onOpenChange, title, children }: SheetProps) {
  const h =
    typeof window !== "undefined" ? window.innerHeight - SHEET_MARGIN : 0;
  const y = useMotionValue(h);

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalOverlay
          isOpen
          onOpenChange={onOpenChange}
          className="fixed inset-0 z-20 bg-bg-grey/20 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={staticTransition}
        >
          <MotionModal
            className="absolute bottom-0 w-full rounded-t-2xl bg-white border-t border-border shadow-card text-main-black will-change-transform"
            initial={{ y: h }}
            animate={{ y: 0 }}
            exit={{ y: h }}
            transition={staticTransition}
            style={{
              y,
              top: SHEET_MARGIN,
              paddingBottom:
                typeof window !== "undefined" ? window.screen.height : 0,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            onDragEnd={(_e, { offset, velocity }) => {
              if (offset.y > window.innerHeight * 0.75 || velocity.y > 10) {
                onOpenChange(false);
              } else {
                animate(y, 0, { ...inertiaTransition, min: 0, max: 0 });
              }
            }}
          >
            <div className="mx-auto w-12 mt-2 h-1.5 rounded-full bg-border" />
            <Dialog className="flex flex-col gap-4 px-4 pb-4 outline-none">
              <Heading
                slot="title"
                className="text-main-black text-3xl font-semibold mb-4 mt-8"
              >
                {title}
              </Heading>
              {children}
            </Dialog>
          </MotionModal>
        </MotionModalOverlay>
      )}
    </AnimatePresence>
  );
}
