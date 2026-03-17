type AppContext = Record<string, never>;

export type { AppContext };

export function createContext(): AppContext {
  return {};
}
