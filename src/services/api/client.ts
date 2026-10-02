import { ApiError, type ApiFailureBody, type ApiSuccess } from "@/types/api"

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = (
  configuredBaseUrl || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "")

const TOKEN_KEY = "sims.access-token"
let unauthorizedHandler: (() => void) | null = null

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function kindForStatus(status: number) {
  if (status === 401) return "unauthorized" as const
  if (status === 403) return "forbidden" as const
  if (status === 404) return "not-found" as const
  if (status === 409) return "conflict" as const
  if (status === 422) return "validation" as const
  if (status >= 500) return "server" as const
  return "unknown" as const
}

export function toQuery(params: Record<string, unknown> = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value))
    }
  })
  const value = query.toString()
  return value ? `?${value}` : ""
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiSuccess<T>> {
  const token = tokenStore.get()
  const headers = new Headers(options.headers)
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError("The backend is unreachable. Check that the API is running.", {
      kind: "network",
      retryable: true,
    })
  }

  if (response.status === 204) {
    return { success: true, message: "Completed successfully.", data: undefined as T }
  }

  let body: ApiSuccess<T> | ApiFailureBody
  try {
    body = (await response.json()) as ApiSuccess<T> | ApiFailureBody
  } catch {
    throw new ApiError("The server returned an unreadable response.", {
      status: response.status,
      kind: response.status >= 500 ? "server" : "unknown",
      retryable: response.status >= 500,
    })
  }

  if (!response.ok || body.success === false) {
    const failure = body as ApiFailureBody
    if (response.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(failure.message || "Request failed.", {
      status: response.status,
      kind: kindForStatus(response.status),
      fieldErrors: failure.errors ?? {},
      retryable: response.status >= 500,
    })
  }

  return body as ApiSuccess<T>
}
