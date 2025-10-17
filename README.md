# @hortemo/expo-billing-client

Thin Android wrapper around the Google Play BillingClient for Expo / React Native apps.

## Installation

```sh
npm install @hortemo/expo-billing-client
```

## Usage

```ts
import {
  BillingResponseCode,
  ProductType,
  startConnection,
  queryProductDetails,
  launchBillingFlow,
  acknowledgePurchase,
  queryPurchases,
  addPurchasesUpdatedListener,
} from "@hortemo/expo-billing-client";

const connectionResult = await startConnection();
if (connectionResult.responseCode !== BillingResponseCode.OK) {
  throw new Error(connectionResult.debugMessage);
}

const { productDetailsList } = await queryProductDetails({
  products: [
    { productId: "coins_100", productType: ProductType.INAPP },
    { productId: "pro_subscription", productType: ProductType.SUBS },
  ],
});

const subscription = productDetailsList.find(
  (product) => product.productId === "pro_subscription",
);

if (!subscription?.subscriptionOfferDetails?.length) {
  throw new Error("Subscription offer not available");
}

const subscriptionOffer = subscription.subscriptionOfferDetails[0];

const purchases = await new Promise((resolve, reject) => {
  const subscription = addPurchasesUpdatedListener((event) => {
    subscription.remove();
    if (event.billingResult.responseCode === BillingResponseCode.OK) {
      resolve(event.purchases);
    } else {
      reject(new Error(event.billingResult.debugMessage));
    }
  });

  launchBillingFlow({
    products: [
      {
        productId: subscription.productId,
        productType: ProductType.SUBS,
        offerToken: subscriptionOffer.offerToken,
      },
    ],
  }).catch(reject);
});

await acknowledgePurchase({
  purchaseToken: purchases[0].purchaseToken,
});
```
