/**
 * Upload size ceiling shared between the client-side dropzone validation
 * and the server-side `/api/upload` handler. Keeping both in sync avoids
 * the UX pitfall of client-accepted files being rejected server-side.
 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
export const UPLOAD_MAX_DISPLAY = `${UPLOAD_MAX_BYTES / (1024 * 1024)} MB`
