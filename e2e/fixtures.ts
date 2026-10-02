import { test as base, expect } from "@playwright/test"

export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const consoleErrors: string[] = []
      const failedRequests: string[] = []

      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })
      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText ?? "unknown error"}`)
      })

      await use()

      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach("browser-diagnostics", {
          body: JSON.stringify({ consoleErrors, failedRequests }, null, 2),
          contentType: "application/json",
        })
      }
    },
    { auto: true },
  ],
})

export { expect }
