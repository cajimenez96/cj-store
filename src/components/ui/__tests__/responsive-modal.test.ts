import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let mockIsDesktop = false;
let capturedRootProps: Record<string, unknown> = {};
let capturedContentProps: Record<string, unknown> = {};

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mockIsDesktop,
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ children, ...props }: { children: React.ReactNode }) => {
      capturedRootProps = props;
      return React.createElement("div", { "data-testid": "vaul-root" }, children);
    },
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "vaul-portal" }, children),
    Overlay: (props: Record<string, unknown>) =>
      React.createElement("div", { "data-testid": "vaul-overlay", ...props }),
    Content: ({ children, ...props }: { children: React.ReactNode }) => {
      capturedContentProps = props;
      return React.createElement("div", { "data-testid": "vaul-content", ...props }, children);
    },
    Close: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("button", { "data-testid": "vaul-close", ...props }, children),
    Title: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("h2", props, children),
    Description: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("p", props, children),
    Trigger: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("button", props, children),
  },
}));

import { ResponsiveModal } from "../responsive-modal";

describe("ResponsiveModal mobile drawer refinement", () => {
  beforeEach(() => {
    mockIsDesktop = false;
    capturedRootProps = {};
    capturedContentProps = {};
  });

  it("disables Vaul swipe/outside dismissal and touchmove scroll blocking on mobile", () => {
    const onOpenChange = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(ResponsiveModal, {
        open: true,
        onOpenChange,
        title: "Test Drawer",
        footer: React.createElement("button", { type: "button" }, "Save"),
        children: React.createElement("div", null, "Body content"),
      }),
    );

    expect(capturedRootProps.dismissible).toBe(false);
    expect(capturedRootProps.disablePreventScroll).toBe(false);
    expect((capturedContentProps.style as React.CSSProperties | undefined)?.touchAction).toBe("auto");

    const pointerOutsideEvent = { preventDefault: vi.fn() };
    (capturedContentProps.onPointerDownOutside as ((e: unknown) => void) | undefined)?.(
      pointerOutsideEvent,
    );
    expect(pointerOutsideEvent.preventDefault).toHaveBeenCalled();

    const interactOutsideEvent = { preventDefault: vi.fn() };
    (capturedContentProps.onInteractOutside as ((e: unknown) => void) | undefined)?.(
      interactOutsideEvent,
    );
    expect(interactOutsideEvent.preventDefault).toHaveBeenCalled();

    const escapeEvent = { preventDefault: vi.fn() };
    (capturedContentProps.onEscapeKeyDown as ((e: unknown) => void) | undefined)?.(
      escapeEvent,
    );
    expect(escapeEvent.preventDefault).toHaveBeenCalled();

    // Drag handle bar should not be rendered when swipe dismissal is disabled
    expect(html).not.toContain("w-[100px]");
  });

  it("uses static max-h-[90dvh], p-0 gap-0 outer shell, min-w-0 scrollable body, and pinned shrink-0 footer on mobile", () => {
    const html = renderToStaticMarkup(
      React.createElement(ResponsiveModal, {
        open: true,
        onOpenChange: vi.fn(),
        title: "Test Drawer",
        hideTitle: true,
        className: "sm:max-w-2xl p-6 sm:p-8 gap-6",
        footer: React.createElement("button", { type: "button" }, "Confirm Action"),
        children: React.createElement(
          "div",
          { className: "flex overflow-x-auto" },
          "Horizontal rail",
        ),
      }),
    );

    const contentClassName = String(capturedContentProps.className ?? "");
    expect(contentClassName).toContain("max-h-[90dvh]");
    expect(contentClassName).toContain("p-0");
    expect(contentClassName).toContain("gap-0");
    expect(contentClassName).not.toContain("p-6");

    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-hidden");
    expect(html).toContain("overscroll-contain");
    expect(html).toContain("Confirm Action");
  });

  it("preserves desktop Dialog rendering when viewport is >= 768px", () => {
    mockIsDesktop = true;
    const html = renderToStaticMarkup(
      React.createElement(ResponsiveModal, {
        open: true,
        onOpenChange: vi.fn(),
        title: "Desktop Dialog",
        footer: React.createElement("button", { type: "button" }, "Desktop Footer"),
        children: React.createElement("div", null, "Desktop Body"),
      }),
    );

    expect(capturedRootProps.dismissible).toBeUndefined();
    expect(html).not.toContain('data-testid="vaul-root"');
  });
});
