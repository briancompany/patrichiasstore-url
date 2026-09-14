import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application startup failed", error, info);
  }

  private reloadWithoutCachedWorker = () => {
    const recoveryUrl = new URL(window.location.href);
    recoveryUrl.searchParams.set("sw", "off");
    window.location.replace(recoveryUrl.toString());
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md text-center space-y-5" aria-live="assertive">
          <h1 className="text-2xl font-bold">Patrichia's Store</h1>
          <p className="text-muted-foreground">
            The store could not finish loading. Refresh safely to restore it.
          </p>
          <button
            type="button"
            onClick={this.reloadWithoutCachedWorker}
            className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold"
          >
            Refresh store
          </button>
        </section>
      </main>
    );
  }
}