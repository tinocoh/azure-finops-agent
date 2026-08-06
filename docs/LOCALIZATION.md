# Localization notes

The public sample uses English for README content, documentation, and default UI strings so it can
be reviewed and published consistently.

## Currency

Azure Cost Management returns actual spend in the billing currency of the target subscription.
Retail price APIs may return list prices in USD. The application should preserve the source
currency and avoid applying implicit conversions unless explicitly configured by the user.

## Future localization

If localized UI strings are added later:

- Keep the default locale in English.
- Store translations in a dedicated localization file or i18n resource.
- Avoid mixing languages inside documentation pages.
- Keep screenshots and sample prompts aligned with the default English experience.
