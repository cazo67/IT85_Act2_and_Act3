import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
} from "./primitives"
import { ProtectedDialog, useFormProtection } from "./protected-dialog"
import { ReferenceSelect } from "@/features/resources/reference-select"

afterEach(cleanup)

function Draft({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  useFormProtection(dirty, pending)
  return (
    <DialogContent>
      <DialogTitle>Editor</DialogTitle>
      <DialogDescription>Make changes.</DialogDescription>
      <DialogClose>Cancel</DialogClose>
    </DialogContent>
  )
}

describe("accessible field feedback", () => {
  it("associates errors without removing existing help and clears error state", () => {
    const { rerender } = render(
      <Field label="Name" error="Enter a name">
        <Input id="name" aria-describedby="help" />
      </Field>
    )
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "aria-describedby",
      "help name-error"
    )
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(screen.getByRole("alert")).toHaveAttribute("id", "name-error")
    rerender(
      <Field label="Name">
        <Input id="name" aria-describedby="help" />
      </Field>
    )
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "aria-describedby",
      "help"
    )
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid")
  })
  it("forwards reference errors to the select rather than its search field", () => {
    render(
      <Field label="Student" error="Choose a student">
        <ReferenceSelect label="Student" options={[]} />
      </Field>
    )
    const control = screen.getByRole("combobox")
    expect(control).toHaveAttribute("aria-invalid", "true")
    expect(
      document.getElementById(control.getAttribute("aria-describedby")!)
    ).toHaveTextContent("Choose a student")
    expect(screen.getByLabelText("Search student options")).not.toHaveAttribute(
      "aria-invalid"
    )
  })
})

describe("protected editor exit", () => {
  function mountRouter(dirty: boolean, pending: boolean) {
    function Editor() {
      const [open, setOpen] = React.useState(true)
      return (
        <>
          <p>Editor route</p>
          <ProtectedDialog open={open} onClose={() => setOpen(false)}>
            <Draft dirty={dirty} pending={pending} />
          </ProtectedDialog>
        </>
      )
    }
    const router = createMemoryRouter(
      [
        { path: "/previous", element: <p>Previous route</p> },
        { path: "/editor", element: <Editor /> },
      ],
      { initialEntries: ["/previous", "/editor"], initialIndex: 1 }
    )
    render(<RouterProvider router={router} />)
    return router
  }
  it("retains a dirty form on cancelled Back, and explicitly discards before leaving", async () => {
    const router = mountRouter(true, false)
    await act(async () => {
      await router.navigate(-1)
    })
    const prompt = await screen.findByRole("dialog", {
      name: "Discard unsaved changes?",
    })
    fireEvent.click(
      within(prompt).getByRole("button", { name: "Keep editing" })
    )
    expect(router.state.location.pathname).toBe("/editor")
    expect(screen.getByRole("dialog", { name: "Editor" })).toBeVisible()
    await act(async () => {
      await router.navigate(-1)
    })
    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }))
    expect(await screen.findByText("Previous route")).toBeVisible()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("blocks navigation during a pending save without offering discard", async () => {
    const router = mountRouter(true, true)
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() =>
      expect(
        [...router.state.blockers.values()].every(
          (blocker) => blocker.state === "unblocked"
        )
      ).toBe(true)
    )
    expect(router.state.location.pathname).toBe("/editor")
    expect(screen.getByRole("dialog", { name: "Editor" })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Discard and leave" })
    ).not.toBeInTheDocument()
  })
  it("allows clean forms to navigate without a discard prompt", async () => {
    const router = mountRouter(false, false)
    await act(async () => {
      await router.navigate(-1)
    })
    expect(await screen.findByText("Previous route")).toBeVisible()
  })
  it("guards same-route query changes and closes the discarded form on proceed", async () => {
    const router = mountRouter(true, false)
    await act(async () => {
      await router.navigate("/editor?search=new")
    })
    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" })
    ).toBeVisible()
    expect(router.state.location.search).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }))
    await waitFor(() =>
      expect(router.state.location.search).toBe("?search=new")
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("requires explicit discard and preserves the dialog when declined", () => {
    const close = vi.fn()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(
      <ProtectedDialog open onClose={close}>
        <Draft dirty pending={false} />
      </ProtectedDialog>
    )
    fireEvent.click(screen.getByText("Cancel"))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Discard unsaved changes")
    )
    expect(close).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByText("Cancel"))
    expect(close).toHaveBeenCalledOnce()
  })
  it("blocks closing and browser unload while saving", () => {
    const close = vi.fn()
    const confirm = vi.spyOn(window, "confirm")
    render(
      <ProtectedDialog open onClose={close}>
        <Draft dirty pending />
      </ProtectedDialog>
    )
    fireEvent.click(screen.getByText("Cancel"))
    expect(close).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
  it("closes a clean form without a discard prompt", () => {
    const close = vi.fn()
    const confirm = vi.spyOn(window, "confirm")
    render(
      <ProtectedDialog open onClose={close}>
        <Draft dirty={false} pending={false} />
      </ProtectedDialog>
    )
    fireEvent.click(screen.getByText("Cancel"))
    expect(close).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })
})
