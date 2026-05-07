/** Format a Date as a time string for the pipeline run view header. */
export function formatRunTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false })
}
