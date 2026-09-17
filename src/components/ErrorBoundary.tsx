import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

// Last line of defense against a white screen: if anything in the React tree
// throws during render, show a styled fallback with a reload action instead
// of leaving the user on a blank page.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    console.error("Uncaught render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0b0e16] p-6 text-center font-mono text-[#edf4ff]">
          <p className="text-xs font-bold tracking-[0.25em] text-[#f14f69]">SIGNAL LOST</p>
          <h1 className="text-xl font-bold tracking-wide">SOMETHING BROKE THE SIMULATION</h1>
          <p className="max-w-md text-xs leading-relaxed text-[#8499b1]">
            The game hit an unexpected error. Reload the page to reboot the run — your checkpoint
            is not saved, but the floor will happily kill you again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-[#85e5d7] px-4 py-2 text-xs font-bold tracking-[0.2em] text-[#85e5d7] transition hover:bg-[#85e5d7] hover:text-[#0b0e16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85e5d7]"
          >
            RELOAD
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
