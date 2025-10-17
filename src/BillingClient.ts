import { NativeModule, requireNativeModule } from "expo-modules-core";

export enum RecurrenceMode {
  INFINITE_RECURRING = 1,
  FINITE_RECURRING = 2,
  NON_RECURRING = 3,
}

export interface ProductDetails {
  productId: string;
  oneTimePurchaseOfferDetails?: {
    formattedPrice: string;
    priceAmountMicros: number;
    priceCurrencyCode: string;
  };
  subscriptionOfferDetails?: {
    basePlanId: string;
    offerId: string | null;
    offerToken: string;
    pricingPhases: {
      billingCycleCount: number;
      billingPeriod: string;
      formattedPrice: string;
      priceAmountMicros: number;
      priceCurrencyCode: string;
      recurrenceMode: RecurrenceMode;
    }[];
  }[];
}

export interface Purchase {
  orderId: string;
  products: string[];
  purchaseToken: string;
  isAcknowledged: boolean;
}

export enum BillingResponseCode {
  OK = 0,
  USER_CANCELED = 1,
  SERVICE_UNAVAILABLE = 2,
  BILLING_UNAVAILABLE = 3,
  ITEM_UNAVAILABLE = 4,
  DEVELOPER_ERROR = 5,
  ERROR = 6,
  ITEM_ALREADY_OWNED = 7,
  ITEM_NOT_OWNED = 8,
  FEATURE_NOT_SUPPORTED = -2,
  NETWORK_ERROR = 12,
  SERVICE_DISCONNECTED = -1,
  SERVICE_TIMEOUT = -3,
}

export interface BillingResult {
  responseCode: BillingResponseCode;
  debugMessage: string;
}

export enum ProductType {
  INAPP = "inapp",
  SUBS = "subs",
}

export interface QueryProductDetailsItem {
  productId: string;
  productType: ProductType;
}

export interface LaunchBillingFlowItem {
  productId: string;
  productType: ProductType;
  offerToken?: string;
}

export type BillingClientModuleEvents = {
  purchasesUpdated(event: {
    billingResult: BillingResult;
    purchases: Purchase[];
  }): void;
  billingServiceDisconnected(event: {}): void;
};

declare class BillingClientModule extends NativeModule<BillingClientModuleEvents> {
  isReady(): Promise<boolean>;
  startConnection(): Promise<BillingResult>;
  queryProductDetails(params: {
    products: QueryProductDetailsItem[];
  }): Promise<{
    billingResult: BillingResult;
    productDetailsList: ProductDetails[];
  }>;
  launchBillingFlow(params: {
    products: LaunchBillingFlowItem[];
  }): Promise<BillingResult>;
  acknowledgePurchase(params: {
    purchaseToken: string;
  }): Promise<BillingResult>;
  queryPurchases(params: { productType: ProductType }): Promise<{
    billingResult: BillingResult;
    purchases: Purchase[];
  }>;
}

const BillingClient = requireNativeModule<BillingClientModule>("BillingClient");

export default BillingClient;
