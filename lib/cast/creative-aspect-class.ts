import type { AspectRatio } from "@/lib/cast/schemas"

/** Maps an AspectRatio to the Tailwind aspect-ratio class used by the creative tile. */
export function aspectClassForRatio(ratio: AspectRatio): string {
  if (ratio === "1x1") return "aspect-square"
  if (ratio === "9x16") return "aspect-[9/16]"
  return "aspect-video"
}
