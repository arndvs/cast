/**
 * Cast — typed errors.
 *
 * Brand-loader throws these; route handlers map them to 400 responses with
 * structured `{ errors: [{ path, message }] }` bodies (per flow-diagrams §4.2).
 */

export class BrandNotFoundError extends Error {
  constructor(public readonly slug: string) {
    super(`unknown brand: ${slug}`)
    this.name = "BrandNotFoundError"
  }
}

export class BrandIncompleteError extends Error {
  constructor(
    public readonly slug: string,
    public readonly missing: string,
  ) {
    super(`brand "${slug}" is missing required file: ${missing}`)
    this.name = "BrandIncompleteError"
  }
}

export class BrandInvalidError extends Error {
  constructor(
    public readonly slug: string,
    public readonly file: string,
    public readonly issues: { path: (string | number)[]; message: string }[],
  ) {
    super(`brand "${slug}" file ${file} failed validation`)
    this.name = "BrandInvalidError"
  }
}
