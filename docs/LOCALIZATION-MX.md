# Localización México (regulated pilot) — issue #8

## Moneda

| Fuente | Moneda | Nota |
|---|---|---|
| **Cost Management** (gasto real del tenant) | **Nativa del billing (MXN for a regulated public-sector tenant)** | La API devuelve el gasto en la moneda de facturación de la cuenta; no requiere conversión. |
| **Retail Prices** (precios de lista) | **USD** (o moneda soportada) | La Azure Retail Prices API **no acepta MXN**. Ver lista soportada abajo. |

### Comportamiento (cost-mcp)
- `resolveCurrency()` resuelve: petición explícita → `AZURE_RETAIL_DEFAULT_CURRENCY` → `USD`.
- Monedas **no soportadas** por la API (p. ej. **MXN**) hacen **fallback a USD** — nunca se
  rompe una consulta de precios por configurar una moneda inválida.
- Soportadas: USD, AUD, BRL, CAD, CHF, CNY, DKK, EUR, GBP, INR, JPY, KRW, NOK, NZD, RUB, SEK, TWD.

```bash
# Mexican deployment: el gasto real ya viene en MXN desde Cost Management.
# Para precios de lista, una moneda soportada (o USD por defecto):
AZURE_RETAIL_DEFAULT_CURRENCY=USD
```

## Idioma
El agente responde en el idioma del usuario. for a regulated public-sector tenant, interactuar en español produce
respuestas en español sin cambios de código. (Pendiente opcional: fijar español por defecto
en el system prompt si se requiere forzarlo.)

## Pendiente
- Si se requiere mostrar precios de lista en MXN, añadir una capa de conversión FX
  (tipo de cambio del día) sobre los precios USD — fuera del alcance de este slice.
