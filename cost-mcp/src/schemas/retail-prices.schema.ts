import { z } from 'zod';

export const PriceItemSchema = z.object({
  currencyCode: z.string(),
  tierMinimumUnits: z.number(),
  retailPrice: z.number(),
  unitPrice: z.number(),
  armRegionName: z.string(),
  location: z.string(),
  effectiveStartDate: z.string(),
  meterId: z.string(),
  meterName: z.string(),
  productId: z.string(),
  skuId: z.string(),
  productName: z.string(),
  skuName: z.string(),
  serviceName: z.string(),
  serviceId: z.string(),
  serviceFamily: z.string(),
  unitOfMeasure: z.string(),
  type: z.string(),
  isPrimaryMeterRegion: z.boolean(),
  armSkuName: z.string(),
});

export type PriceItem = z.infer<typeof PriceItemSchema>;

export const RetailPricesResponseSchema = z.object({
  BillingCurrency: z.string(),
  CustomerEntityId: z.string(),
  CustomerEntityType: z.string(),
  Items: z.array(PriceItemSchema),
  NextPageLink: z.string().nullable().optional(),
  Count: z.number(),
});
