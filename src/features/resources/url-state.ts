import * as React from "react"
import { useLocation, useSearchParams } from "react-router-dom"

export function positiveInteger(
  value: string | null,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (!value || !/^\d+$/.test(value)) return fallback
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0
    ? Math.min(number, maximum)
    : fallback
}

// Only input events schedule URL writes. Navigation never writes an old draft back.
export function useStudentSearch() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = React.useState<{
    key: string
    value: string | null
  }>({ key: location.key, value: null })
  if (draft.key !== location.key) setDraft({ key: location.key, value: null })
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  React.useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [location.key]
  )
  const value =
    draft.key === location.key && draft.value !== null
      ? draft.value
      : (params.get("search") ?? "")
  function change(value: string) {
    setDraft({ key: location.key, value })
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () =>
        setParams((current) => {
          const next = new URLSearchParams(current)
          if (value) next.set("search", value)
          else next.delete("search")
          next.set("page", "1")
          return next
        }),
      350
    )
  }
  return [value, change] as const
}
