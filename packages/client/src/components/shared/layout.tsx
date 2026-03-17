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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-bold">DCC Coach</h1>
        <nav className="flex gap-2">
          {onNavigateToDashboard !== undefined && (
            <button
              type="button"
              className="rounded px-3 py-1 text-sm font-medium text-primary hover:bg-accent"
              onClick={onNavigateToDashboard}
            >
              Dashboard
            </button>
          )}
          {onNavigateToSetup !== undefined && (
            <button
              type="button"
              className="rounded px-3 py-1 text-sm hover:bg-accent"
              onClick={onNavigateToSetup}
            >
              Setup
            </button>
          )}
          {onNavigateToSessions !== undefined && (
            <button
              type="button"
              className="rounded px-3 py-1 text-sm hover:bg-accent"
              onClick={onNavigateToSessions}
            >
              Sessions
            </button>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
