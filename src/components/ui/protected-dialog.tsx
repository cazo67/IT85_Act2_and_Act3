/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"

type Protection = { dirty: boolean; pending: boolean }
const ProtectionContext = React.createContext<
  ((state: Protection) => void) | null
>(null)

export function useFormProtection(dirty: boolean, pending: boolean) {
  const register = React.useContext(ProtectionContext)
  React.useLayoutEffect(() => {
    if (!register) return
    register({ dirty, pending })
    return () => {
      register({ dirty: false, pending: false })
    }
  }, [dirty, pending, register])
}

function NavigationGuard({
  enabled,
  pending,
  onDiscard,
}: {
  enabled: boolean
  pending: boolean
  onDiscard: () => void
}) {
  const blocker = useBlocker(enabled)
  React.useEffect(() => {
    if (blocker.state === "blocked" && pending) blocker.reset()
  }, [blocker, pending])
  return (
    <Dialog
      open={blocker.state === "blocked" && !pending}
      onOpenChange={(next) => {
        if (!next && blocker.state === "blocked") blocker.reset()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogDescription>
          Your edits will be lost if you leave this form.
        </DialogDescription>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            autoFocus
            variant="outline"
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset()
            }}
          >
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (blocker.state !== "blocked") return
              onDiscard()
              blocker.proceed()
            }}
          >
            Discard and leave
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ProtectedDialog({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const [protection, setProtection] = React.useState<Protection>({
    dirty: false,
    pending: false,
  })
  const register = React.useCallback(
    (state: Protection) =>
      setProtection((current) =>
        current.dirty === state.dirty && current.pending === state.pending
          ? current
          : state
      ),
    []
  )
  // Production uses a data router; standalone primitive tests may have no router.
  const dataRouter = React.useContext(UNSAFE_DataRouterContext)
  React.useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => {
      if (protection.dirty || protection.pending) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open, protection.dirty, protection.pending])
  return (
    <ProtectionContext.Provider value={register}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next || protection.pending) return
          if (
            !protection.dirty ||
            window.confirm("Discard unsaved changes? Your edits will be lost.")
          )
            onClose()
        }}
      >
        {children}
      </Dialog>
      {dataRouter && open ? (
        <NavigationGuard
          enabled={open && (protection.dirty || protection.pending)}
          pending={protection.pending}
          onDiscard={onClose}
        />
      ) : null}
    </ProtectionContext.Provider>
  )
}
