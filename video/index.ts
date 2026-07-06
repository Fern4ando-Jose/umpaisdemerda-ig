// ─── Ponto de entrada do Remotion ─────────────────────────────────────────────
// Registra o catálogo de composições para o bundler/renderer encontrar.

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
