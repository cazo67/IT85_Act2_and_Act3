export type PageMeta = {
  page: number
  per_page: number
  total: number
  last_page: number
}

export type ApiSuccess<T> = {
  success: true
  message: string
  data: T
  meta?: PageMeta
}

export type ApiFailureBody = {
  success: false
  message: string
  errors: Record<string, string[]> | null
}

export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "server"
  | "network"
  | "unknown"

export class ApiError extends Error {
  status: number | null
  kind: ApiErrorKind
  fieldErrors: Record<string, string[]>
  retryable: boolean

  constructor(
    message: string,
    options: {
      status?: number | null
      kind?: ApiErrorKind
      fieldErrors?: Record<string, string[]>
      retryable?: boolean
    } = {}
  ) {
    super(message)
    this.name = "ApiError"
    this.status = options.status ?? null
    this.kind = options.kind ?? "unknown"
    this.fieldErrors = options.fieldErrors ?? {}
    this.retryable = options.retryable ?? false
  }
}

export type PageQuery = {
  page?: number
  per_page?: number
}
