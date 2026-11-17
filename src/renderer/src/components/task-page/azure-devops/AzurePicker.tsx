import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
export function AzurePicker({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (id: string) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-8 w-48">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            {entry.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
