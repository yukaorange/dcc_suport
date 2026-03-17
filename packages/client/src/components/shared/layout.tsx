import type { ReactNode } from "react";

type LayoutProps = {
  readonly children: ReactNode;
  readonly onNavigateToSessions?: () => void;
  readonly onNavigateToSetup?: () => void;
  readonly onNavigateToDashboard?: () => void;
};

export function Layout({
  children,
  onNavigateToSessions,
  onNavigateToSetup,
  onNavigateToDashboard,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-3 shadow-sm">
        <h1 className="text-lg font-bold tracking-tight">DCC Coach</h1>
        <nav className="flex gap-1">
          {onNavigateToDashboard !== undefined && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
              onClick={onNavigateToDashboard}
            >
              Dashboard
            </button>
          )}
          {onNavigateToSetup !== undefined && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={onNavigateToSetup}
            >
              Setup
            </button>
          )}
          {onNavigateToSessions !== undefined && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={onNavigateToSessions}
            >
              Sessions
            </button>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
