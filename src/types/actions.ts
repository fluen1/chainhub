export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }
