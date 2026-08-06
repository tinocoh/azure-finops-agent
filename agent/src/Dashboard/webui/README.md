# Dashboard web UI

Vue 3 single-page app for the Azure FinOps Agent dashboard.

The production build writes static assets to `../wwwroot`, where the .NET `Dashboard` app serves them with `UseStaticFiles` and `MapFallbackToFile`.

```powershell
npm ci
npm run build
```

The .NET project also runs these commands automatically during `dotnet build` and `dotnet publish`, so clean clones and deployment pipelines generate `wwwroot` without a separate manual step.
