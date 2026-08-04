# webui — Chat UI (React + Fluent UI v9)

Interfaz de chat amigable para que un líder de operaciones de Azure pregunte en lenguaje
natural sobre **costos y operación** de Azure. Conversa con el backend .NET vía `/api/chat`
(streaming SSE) y usa el sign-in OAuth (`Conectar Azure`).

## Stack (decisión V2.0)
- **Vite + React + TypeScript + Fluent UI v9** — sistema de diseño de Microsoft (look Azure,
  accesible, profesional).
- Se sirve **mismo-origen** desde el backend: `vite build` emite a `../wwwroot`, que el
  `Dashboard` sirve con `UseStaticFiles` + `MapFallbackToFile`. Así cookies + el CSRF/Origin
  de `/api/chat` y el OAuth funcionan sin CORS.

## Funcionalidad
- Chat con burbujas usuario/asistente, streaming token-a-token, render Markdown (tablas de costo).
- Indicador de actividad de herramienta ("Consultando Cost Management…").
- Estado de conexión + botón **Conectar Azure** (OAuth delegado).
- Prompts sugeridos y aviso de **modo solo-lectura**.

## Desarrollo
```bash
cd agent/src/Dashboard/webui
npm install
npm run build          # → ../wwwroot (servido por el backend en http://localhost:5180/)
# o, con el backend corriendo en :5180:
npm run dev            # Vite dev server con proxy /api y /auth al backend
```
El backend debe correr con `COST_MCP_PATH`, `AzureOpenAI__*`, `FINOPS_READONLY=true` y la
config `Microsoft:*` (ver `docs/OAUTH-SETUP.md`). Validado e2e: la UI invoca el tool MCP de
costos y renderiza el gasto real del tenant (ver `docs/E2E-RESULTS.md`).

> `wwwroot/` (salida de build) está en `.gitignore`; se genera con `npm run build` o en CI (job **webui**).
