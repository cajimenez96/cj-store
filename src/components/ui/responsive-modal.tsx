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
  DrawerClose,
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
  const headerClassName = cn(hideTitle && "sr-only");

  // With a footer, the body becomes its own scroll region so the footer never scrolls away.
  const layoutClassName = (viewportUnit: "vh" | "dvh") =>
    footer
      ? `flex max-h-[90${viewportUnit}] flex-col overflow-hidden`
      : `max-h-[90${viewportUnit}] overflow-y-auto`;
  const bodyClassName = footer
    ? "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto"
    : "";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(surfaceClassName, layoutClassName("vh"), className)}
        >
          <DialogHeader className={headerClassName}>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className={bodyClassName}>{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-[#e5e5e5] pt-4">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(surfaceClassName, layoutClassName("dvh"), className)}
      >
        <DrawerClose
          aria-label="Cerrar ventana"
          className="absolute top-3 right-3 z-10 rounded-full bg-[#f5f5f5] p-2 text-[#111111] hover:bg-[#111111] hover:text-white"
        >
          <XIcon className="size-4" />
        </DrawerClose>
        <DrawerHeader className={headerClassName}>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className={cn(bodyClassName)}>{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[#e5e5e5] bg-white px-4 py-3">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
