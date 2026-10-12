import * as React from "react"
import { Input, Select } from "@/components/ui/primitives"

type Option = { id: number; label: string }

export function ReferenceSelect({ label, options, ...props }: React.ComponentProps<"select"> & { label: string; options: Option[] }) {
  const [search, setSearch] = React.useState("")
  const selected = String(props.value ?? "")
  const visible = options.filter((option) => String(option.id) === selected || option.label.toLowerCase().includes(search.trim().toLowerCase()))
  return <div className="grid gap-2">
    <Input aria-label={`Search ${label.toLowerCase()} options`} placeholder={`Search ${label.toLowerCase()} options`} value={search} onChange={(event) => setSearch(event.target.value)} disabled={props.disabled} />
    <Select {...props}>
      <option value="">Select {label.toLowerCase()}</option>
      {selected && !options.some((option) => String(option.id) === selected) ? <option value={selected}>Selected #{selected} (unavailable)</option> : null}
      {visible.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </Select>
    {options.length === 0 && !props.disabled ? <p className="text-xs text-muted-foreground">No {label.toLowerCase()} options available.</p> : visible.length === 0 && !props.disabled ? <p className="text-xs text-muted-foreground">No matching options.</p> : null}
  </div>
}
