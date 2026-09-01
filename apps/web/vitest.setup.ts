import '@testing-library/jest-dom/vitest';

// Radix UI (Select) uses Pointer Capture APIs that jsdom does not
// implement — the canonical stubs from the Radix testing docs.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
