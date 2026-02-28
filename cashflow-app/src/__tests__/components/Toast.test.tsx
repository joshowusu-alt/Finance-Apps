/**
 * Toast / ToastContainer component tests
 *
 * Toast.tsx holds module-level mutable state (the `toasts` array and
 * `listeners` list).  Tests use fake timers so auto-dismiss timeouts can be
 * controlled deterministically, and clean up every toast in afterEach.
 *
 * framer-motion is mocked globally via setup.ts.
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import ToastContainer, { showToast, dismissToast, toast } from "@/components/Toast";

// ─── Timer helpers ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Flush all pending auto-dismiss timeouts so the module-level toasts array is
  // empty before the next test starts.
  act(() => {
    vi.runAllTimers();
  });
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ToastContainer", () => {
  it("renders the notification region with correct aria attributes", () => {
    render(<ToastContainer />);
    const region = screen.getByRole("region", { name: /notifications/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("shows no alerts on initial render", () => {
    render(<ToastContainer />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("displays a toast with the correct message after showToast", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Hello world", "info");
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("success toast carries the bg-success-soft CSS class", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Saved!", "success");
    });
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-success-soft");
  });

  it("error toast carries the bg-error-soft CSS class", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Something failed", "error");
    });
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-error-soft");
  });

  it("warning toast carries the bg-warning-soft CSS class", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Watch out", "warning");
    });
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-warning-soft");
  });

  it("removes the toast when the dismiss button is clicked", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Dismiss me", "info");
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-removes the toast after its duration elapses", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Short-lived", "success", 2000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2001);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders multiple toasts simultaneously", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("First", "info");
      showToast("Second", "success");
    });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("dismissToast removes a specific toast by id", () => {
    render(<ToastContainer />);
    let id1: string;
    let id2: string;
    act(() => {
      id1 = showToast("Keep me", "info");
      id2 = showToast("Remove me", "error");
    });
    act(() => {
      dismissToast(id2!);
    });
    expect(screen.queryByText("Remove me")).not.toBeInTheDocument();
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    // Clean up remaining toast
    act(() => {
      dismissToast(id1!);
    });
  });
});

// ─── toast convenience helpers ────────────────────────────────────────────────

describe("toast convenience helpers", () => {
  it("toast.success shows a success toast", () => {
    render(<ToastContainer />);
    act(() => {
      toast.success("Great job!");
    });
    expect(screen.getByText("Great job!")).toBeInTheDocument();
    expect(screen.getByRole("alert").className).toContain("bg-success-soft");
  });

  it("toast.error shows an error toast", () => {
    render(<ToastContainer />);
    act(() => {
      toast.error("Oops!");
    });
    expect(screen.getByRole("alert").className).toContain("bg-error-soft");
  });

  it("toast.warning shows a warning toast", () => {
    render(<ToastContainer />);
    act(() => {
      toast.warning("Be careful");
    });
    expect(screen.getByRole("alert").className).toContain("bg-warning-soft");
  });

  it("toast.info shows an info toast", () => {
    render(<ToastContainer />);
    act(() => {
      toast.info("FYI");
    });
    expect(screen.getByRole("alert").className).toContain("bg-info-soft");
  });
});
