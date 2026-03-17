import { createApp } from "./app";
import { createContext } from "./trpc/context";

const PORT = 3456;

const app = createApp({ createContext });

Bun.serve({ port: PORT, fetch: app.fetch });

console.log(`DCC Coach server started at http://localhost:${PORT}`);
