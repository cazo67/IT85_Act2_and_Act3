import type { Locator } from "@playwright/test"

// Rendered sRGB measurements including ancestor surface alpha. This deliberately
// samples named default-state controls; it is not an exhaustive contrast scanner.
export async function textContrast(locator: Locator, placeholder = false) {
  return locator.evaluate((element, placeholder) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    function rgba(css: string) {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = css
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data].map((value, index) =>
        index === 3 ? value / 255 : value
      )
    }
    function over(foreground: number[], background: number[]) {
      return [0, 1, 2]
        .map(
          (index) =>
            foreground[index] * foreground[3] +
            background[index] * (1 - foreground[3])
        )
        .concat(1)
    }
    const ancestors: Element[] = []
    for (
      let current: Element | null = element;
      current;
      current = current.parentElement
    )
      ancestors.unshift(current)
    let background = [255, 255, 255, 1]
    for (const ancestor of ancestors)
      background = over(
        rgba(getComputedStyle(ancestor).backgroundColor),
        background
      )
    const style = getComputedStyle(
      element,
      placeholder ? "::placeholder" : null
    )
    const foreground = over(rgba(style.color), background)
    function luminance(rgb: number[]) {
      return rgb
        .slice(0, 3)
        .map((value) => value / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        )
        .reduce(
          (total, value, index) =>
            total + value * [0.2126, 0.7152, 0.0722][index],
          0
        )
    }
    const light = Math.max(luminance(foreground), luminance(background))
    const dark = Math.min(luminance(foreground), luminance(background))
    return {
      ratio: (light + 0.05) / (dark + 0.05),
      foreground: foreground.slice(0, 3),
      background: background.slice(0, 3),
    }
  }, placeholder)
}
