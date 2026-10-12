import * as React from "react"
import { ApiError } from "@/types/api"

export function useServerErrors(error: unknown) {
  const formRef = React.useRef<HTMLFormElement>(null)
  React.useEffect(() => {
    if (error instanceof ApiError)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
        ?.focus()
  }, [error])
  return { formRef, errors: error instanceof ApiError ? error.fieldErrors : {} }
}
