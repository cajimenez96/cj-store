"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Keeps the title for screen readers only, for modals with a custom header. */
  hideTitle?: boolean;
  /** Pinned below the scrolling body, so it stays visible on any content height. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const surfaceClassName =
  "rounded-none border-[#e5e5e5] bg-white text-[#111111]";

/** Dialog on desktop, bottom Drawer on mobile. Both expose the same close control. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  footer,
  className,
  children,
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const desktopHeaderClassName = cn(hideTitle && "sr-only");
  const mobileHeaderClassName = cn(
    hideTitle
      ? "sr-only"
      : "shrink-0 border-b border-[#e5e5e5] px-5 py-4 pr-12 text-left",
  );

  const desktopBodyClassName =
    "flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden overscroll-contain [&>*]:shrink-0";
  const mobileBodyClassName =
    "flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden overscroll-contain p-5 pt-6 [&>*]:shrink-0";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            surfaceClassName,
            "flex max-h-[90vh] flex-col overflow-hidden",
            className,
          )}
        >
          <DialogHeader className={desktopHeaderClassName}>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className={desktopBodyClassName}>{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-[#e5e5e5] bg-white pt-4">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      disablePreventScroll={false}
    >
      <DrawerContent
        className={cn(
          surfaceClassName,
          className,
          "flex max-h-[90dvh] w-full flex-col overflow-hidden p-0 gap-0",
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar ventana"
          className="absolute top-3 right-3 z-20 rounded-full bg-[#f5f5f5] p-2 text-[#111111] transition-colors hover:bg-[#111111] hover:text-white cursor-pointer"
        >
          <XIcon className="size-4" />
        </button>
        <DrawerHeader className={mobileHeaderClassName}>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className={mobileBodyClassName}>{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[#e5e5e5] bg-white px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
