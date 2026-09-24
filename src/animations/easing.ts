export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
export const easeOutBack = (x: number, s = 1.9) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2
export const easeOutElastic = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
