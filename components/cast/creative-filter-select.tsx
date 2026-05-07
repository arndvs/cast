import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CreativeFilterSelectProps {
  label: string
  value: string
  onChange: (next: string) => void
  options: readonly string[]
}

export function CreativeFilterSelect({ label, value, onChange, options }: CreativeFilterSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-fg-3">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="min-w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
