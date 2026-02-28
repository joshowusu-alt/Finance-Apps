/**
 * EmptyState component tests
 *
 * framer-motion is mocked globally in setup.ts so every motion.* element
 * renders as a plain HTML element.  No external data dependencies.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import EmptyState, {
  NoResultsEmptyState,
  ErrorEmptyState,
} from "@/components/EmptyState";

describe("EmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title and description", () => {
    render(<EmptyState title="Nothing here" description="Add something first" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add something first")).toBeInTheDocument();
  });

  it("renders the default 📭 icon when no icon prop is supplied", () => {
    render(<EmptyState title="T" description="D" />);
    expect(screen.getByText("📭")).toBeInTheDocument();
  });

  it("renders a custom icon", () => {
    render(<EmptyState title="T" description="D" icon="🎉" />);
    expect(screen.getByText("🎉")).toBeInTheDocument();
    expect(screen.queryByText("📭")).not.toBeInTheDocument();
  });

  it("renders a JSX illustration when provided", () => {
    render(
      <EmptyState
        title="T"
        description="D"
        illustration={<svg data-testid="custom-svg" />}
      />
    );
    expect(screen.getByTestId("custom-svg")).toBeInTheDocument();
    expect(screen.queryByText("📭")).not.toBeInTheDocument();
  });

  it("renders no buttons when no action props are supplied", () => {
    render(<EmptyState title="T" description="D" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders the primary action button and calls its onClick", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="T"
        description="D"
        action={{ label: "Add item", onClick: handleClick }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("renders both action buttons when secondaryAction is provided", () => {
    render(
      <EmptyState
        title="T"
        description="D"
        action={{ label: "Primary", onClick: vi.fn() }}
        secondaryAction={{ label: "Secondary", onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole("button", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /secondary/i })).toBeInTheDocument();
  });

  it("calls the secondaryAction onClick when its button is clicked", () => {
    const handler = vi.fn();
    render(
      <EmptyState
        title="T"
        description="D"
        action={{ label: "Go", onClick: vi.fn() }}
        secondaryAction={{ label: "Reset", onClick: handler }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call the primary onClick when secondary is clicked", () => {
    const primary = vi.fn();
    render(
      <EmptyState
        title="T"
        description="D"
        action={{ label: "Go", onClick: primary }}
        secondaryAction={{ label: "Cancel", onClick: vi.fn() }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(primary).not.toHaveBeenCalled();
  });

  // ── Composed variants ────────────────────────────────────────────────────────

  it("NoResultsEmptyState renders the correct title", () => {
    render(<NoResultsEmptyState />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it("NoResultsEmptyState shows no button when onReset is not supplied", () => {
    render(<NoResultsEmptyState />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("NoResultsEmptyState renders Clear Filters button and calls onReset", () => {
    const handleReset = vi.fn();
    render(<NoResultsEmptyState onReset={handleReset} />);
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(handleReset).toHaveBeenCalledOnce();
  });

  it("ErrorEmptyState renders the correct title", () => {
    render(<ErrorEmptyState />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("ErrorEmptyState renders Try Again button and calls onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorEmptyState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
