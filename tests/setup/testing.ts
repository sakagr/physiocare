import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Runs for every test file (setupFiles is global). React Testing Library is
// only loaded and its cleanup only run in the jsdom lane, where a document
// exists; Node/server tests skip it entirely.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});

/*
 * Mantine relies on browser APIs jsdom does not implement. Without these
 * shims any component using a media query, a resize observer, or a scroll
 * area throws on render. Guarded so the Node lane is untouched.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  window.HTMLElement.prototype.scrollIntoView = () => {};
}
