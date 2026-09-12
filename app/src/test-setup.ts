import { vi } from 'vitest';

// lottie-web touches a canvas at import time, which jsdom does not provide.
// App tests are about pages and controls, not Lottie rendering.
vi.mock('@remotion/lottie', () => ({
  Lottie: () => null,
}));
