import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// JSDOM does not implement ResizeObserver, but chart libs (e.g. Recharts)
// may rely on it. A no-op polyfill is sufficient for unit tests.
if (typeof globalThis.ResizeObserver === "undefined") {
	class ResizeObserver {
		observe() {
			// no-op
		}

		unobserve() {
			// no-op
		}

		disconnect() {
			// no-op
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(globalThis as any).ResizeObserver = ResizeObserver;
}

// Recharts' ResponsiveContainer reads layout size via getBoundingClientRect().
// In JSDOM, elements often report 0x0, which causes noisy warnings (and can
// prevent charts from rendering). Provide a sane default size for tests.
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function () {
	const rect = originalGetBoundingClientRect.call(this);
	if (rect.width > 0 || rect.height > 0) return rect;

	return {
		...rect,
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: 800,
		bottom: 400,
		width: 800,
		height: 400,
		toJSON() {
			return {};
		}
	} as DOMRect;
};

afterEach(() => {
	cleanup();
});
