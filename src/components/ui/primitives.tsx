import * as React from "react"
import { Dialog as DialogPrimitive, Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props} />
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50", className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20", className)} {...props} />
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return <select className={cn("h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20", className)} {...props}>{children}</select>
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-sm font-medium", className)} {...props} />
}

export function Badge({ className, tone = "default", ...props }: React.ComponentProps<"span"> & { tone?: "default" | "success" | "danger" | "muted" }) {
  const tones = { default: "bg-primary/10 text-primary", success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", danger: "bg-destructive/10 text-destructive", muted: "bg-muted text-muted-foreground" }
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)} {...props} />
}

export function Alert({ className, tone = "default", ...props }: React.ComponentProps<"div"> & { tone?: "default" | "danger" }) {
  return <div role="alert" className={cn("rounded-lg border bg-muted/40 p-4 text-sm", tone === "danger" && "border-destructive/30 bg-destructive/5 text-destructive", className)} {...props} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-muted", className)} />
}

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
      <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl outline-none", className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-xl font-semibold", className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[720px] border-collapse text-sm", className)} {...props} />
}

export function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  const generatedId = React.useId()
  const child = React.isValidElement<{ id?: string }>(children) ? React.cloneElement(children, { id: children.props.id ?? generatedId }) : children
  const controlId = React.isValidElement<{ id?: string }>(child) ? child.props.id : generatedId
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={controlId}>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {child}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
