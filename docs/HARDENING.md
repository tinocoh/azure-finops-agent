# Hardening audit-safe (regulated pilot) — modo read-only

Issue #5. Endurece el agente para un entorno fiscal regulado: **el agente no puede
mutar el tenant**.

## Política de métodos (centralizada en `HttpHelper.ResolveMethod`)
Toda tool de paso (Azure ARM, Microsoft Graph, Log Analytics) enruta por aquí.

| Método | Read-only ON (default) | `FINOPS_READONLY=false` |
|---|---|---|
| GET | ✅ permitido | ✅ |
| POST | ✅ permitido (ver nota) | ✅ |
| PUT | ⛔ 403 bloqueado | ✅ |
| PATCH | ⛔ 403 bloqueado | ✅ |
| DELETE | ⛔ 403 bloqueado | ⛔ siempre bloqueado |

> **Por qué POST sigue permitido:** varios endpoints de **lectura** de Azure requieren
> POST (Resource Graph `/resources`, Cost Management `/query` y `/forecast`). El rol
> **Reader** del usuario deniega cualquier POST de escritura en la plataforma, así que
> POST + Reader = solo lectura efectiva. Esto es defensa en profundidad **sobre** RBAC.

## Configuración
- `FINOPS_READONLY` (default no definido = **read-only ON**). Poner `false` solo en
  entornos donde se autoricen escrituras del agente. Se lee por llamada (sin reinicio).

## Comportamiento cuando se bloquea
El gate devuelve `HTTP 403 Forbidden` con instrucción de emitir un script vía
`GenerateScript` para que el usuario lo revise y ejecute — el agente nunca escribe por sí mismo.

## Verificación
`agent/tests/Dashboard.Tests` (xUnit) cubre la política y corre en CI (`dotnet test`):
lecturas permitidas, PUT/PATCH bloqueados en read-only, DELETE siempre bloqueado,
y PUT/PATCH permitidos solo con `FINOPS_READONLY=false`.

## Auditoría inmutable (issue #6)
Cada decisión del gate de métodos se registra en un **audit trail hash-encadenado y a
prueba de manipulación** (`Observability/AuditLog.cs`): cada entrada enlaza con la anterior
vía `SHA-256(prevHash + payload)`, de modo que **modificar, borrar o reordenar** cualquier
registro invalida toda la cadena posterior y lo detecta `AuditLog.Verify`.

- Registra: timestamp, actor, acción (`{dominio}:{método}`), decisión (`allowed` /
  `blocked_readonly` / `blocked_delete`).
- Retención off-box: si `AUDIT_LOG_PATH` está definido, replica cada entrada como JSON line
  append-only (para retención fuera de la caja exigida en entornos regulados).
- Verificado por `agent/tests/Dashboard.Tests/AuditLogTests.cs` (mutación, borrado y
  reordenamiento detectados; sink de archivo).

> Pendiente (#6): flujo de aprobación humana en UI para acciones sensibles. Hoy, en modo
> read-only, las escrituras ya están bloqueadas, así que el agente nunca muta sin que el
> usuario ejecute el script generado.

## Pendiente (resto del workstream hardening)
- #6 Auditoría inmutable de cada tool-call + flujo de aprobación humana.
- #7 Despliegue privado (VNet, Private Endpoints, Key Vault, data masking del LLM).
- Postura RBAC operacional: asignar **Cost Management Reader / Reader** a la identidad del piloto.
