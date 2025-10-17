import React, { useCallback, useMemo, useState } from "react";
import { Button, SafeAreaView, ScrollView, Text, View } from "react-native";

import BillingClient, { ProductType } from "@hortemo/expo-billing-client";

type TestState = "idle" | "running" | "done" | "error";

interface Status {
  state: TestState;
  error: string | null;
}

const INITIAL_STATUS: Status = { state: "idle", error: null };

function assertIsRecord(
  value: unknown
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected value to be an object");
  }
}

function assertBillingResultShape(result: unknown): void {
  assertIsRecord(result);
  const { responseCode, debugMessage } = result;

  if (!Number.isInteger(responseCode)) {
    throw new Error("BillingResult responseCode must be an integer");
  }
  if (typeof debugMessage !== "string") {
    throw new Error("BillingResult debugMessage must be a string");
  }
}

function assertPurchasesShape(purchases: unknown): void {
  if (!Array.isArray(purchases)) {
    throw new Error("Expected purchases to be an array");
  }

  purchases.forEach((purchase) => {
    assertIsRecord(purchase);
    const { orderId, products, purchaseToken, isAcknowledged } = purchase;

    if (
      typeof orderId !== "string" &&
      orderId !== null &&
      orderId !== undefined
    ) {
      throw new Error("purchase.orderId must be a string when present");
    }
    if (!Array.isArray(products)) {
      throw new Error("purchase.products must be an array");
    }
    if (typeof purchaseToken !== "string") {
      throw new Error("purchase.purchaseToken must be a string");
    }
    if (typeof isAcknowledged !== "boolean") {
      throw new Error("purchase.isAcknowledged must be a boolean");
    }
  });
}

function assertProductDetailsShape(productDetails: unknown): void {
  assertIsRecord(productDetails);
  const { productId, oneTimePurchaseOfferDetails, subscriptionOfferDetails } =
    productDetails;

  if (typeof productId !== "string") {
    throw new Error("productDetails.productId must be a string");
  }

  if (
    oneTimePurchaseOfferDetails !== null &&
    oneTimePurchaseOfferDetails !== undefined
  ) {
    assertIsRecord(oneTimePurchaseOfferDetails);
    const { formattedPrice, priceAmountMicros, priceCurrencyCode } =
      oneTimePurchaseOfferDetails;

    if (typeof formattedPrice !== "string") {
      throw new Error(
        "oneTimePurchaseOfferDetails.formattedPrice must be a string"
      );
    }
    if (typeof priceAmountMicros !== "number") {
      throw new Error(
        "oneTimePurchaseOfferDetails.priceAmountMicros must be a number"
      );
    }
    if (typeof priceCurrencyCode !== "string") {
      throw new Error(
        "oneTimePurchaseOfferDetails.priceCurrencyCode must be a string"
      );
    }
  }

  if (
    subscriptionOfferDetails !== null &&
    subscriptionOfferDetails !== undefined
  ) {
    if (!Array.isArray(subscriptionOfferDetails)) {
      throw new Error("subscriptionOfferDetails must be an array");
    }
    subscriptionOfferDetails.forEach((offer) => {
      assertIsRecord(offer);
      const { offerToken, pricingPhases } = offer;

      if (typeof offerToken !== "string") {
        throw new Error("subscriptionOfferDetails.offerToken must be a string");
      }

      if (pricingPhases !== null && pricingPhases !== undefined) {
        if (!Array.isArray(pricingPhases)) {
          throw new Error("pricingPhases must be an array");
        }

        pricingPhases.forEach((phase) => {
          assertIsRecord(phase);
          const {
            billingCycleCount,
            billingPeriod,
            formattedPrice,
            priceAmountMicros,
            priceCurrencyCode,
            recurrenceMode,
          } = phase;

          if (typeof billingCycleCount !== "number") {
            throw new Error("pricingPhase.billingCycleCount must be a number");
          }
          if (typeof billingPeriod !== "string") {
            throw new Error("pricingPhase.billingPeriod must be a string");
          }
          if (typeof formattedPrice !== "string") {
            throw new Error("pricingPhase.formattedPrice must be a string");
          }
          if (typeof priceAmountMicros !== "number") {
            throw new Error("pricingPhase.priceAmountMicros must be a number");
          }
          if (typeof priceCurrencyCode !== "string") {
            throw new Error("pricingPhase.priceCurrencyCode must be a string");
          }
          if (typeof recurrenceMode !== "number") {
            throw new Error("pricingPhase.recurrenceMode must be a number");
          }
        });
      }
    });
  }
}

function assertProductDetailsResultShape(result: unknown): void {
  assertIsRecord(result);
  assertBillingResultShape(result.billingResult);

  const { productDetailsList } = result;
  if (!Array.isArray(productDetailsList)) {
    throw new Error("productDetailsList must be an array");
  }
  productDetailsList.forEach(assertProductDetailsShape);
}

async function runIntegrationTest(): Promise<string | null> {
  const disconnectedEvents: Array<Record<string, never>> = [];
  const purchasesEvents: Array<{
    billingResult: unknown;
    purchases: unknown;
  }> = [];

  const serviceSubscription = BillingClient.addListener(
    "billingServiceDisconnected",
    (event) => {
      disconnectedEvents.push(event);
    }
  );
  const purchasesSubscription = BillingClient.addListener(
    "purchasesUpdated",
    (event) => {
      purchasesEvents.push(event);
    }
  );

  try {
    const ready = await BillingClient.isReady();
    if (typeof ready !== "boolean") {
      throw new Error("isReady should return boolean");
    }

    const connectionResult = await BillingClient.startConnection();
    assertBillingResultShape(connectionResult);

    const inapp = await BillingClient.queryPurchases({
      productType: ProductType.INAPP,
    });
    assertBillingResultShape(inapp.billingResult);
    assertPurchasesShape(inapp.purchases);

    const subs = await BillingClient.queryPurchases({
      productType: ProductType.SUBS,
    });
    assertBillingResultShape(subs.billingResult);
    assertPurchasesShape(subs.purchases);

    const inappDetails = await BillingClient.queryProductDetails({
      products: [{ productId: "test_product", productType: ProductType.INAPP }],
    });
    assertProductDetailsResultShape(inappDetails);

    const subsDetails = await BillingClient.queryProductDetails({
      products: [{ productId: "test_sub", productType: ProductType.SUBS }],
    });
    assertProductDetailsResultShape(subsDetails);

    const launchResult = await BillingClient.launchBillingFlow({
      products: [
        {
          productId: "test_product",
          productType: ProductType.INAPP,
        },
      ],
    });
    assertBillingResultShape(launchResult);

    const acknowledgeResult = await BillingClient.acknowledgePurchase({
      purchaseToken: "test_token",
    });
    assertBillingResultShape(acknowledgeResult);

    purchasesEvents.forEach((event) => {
      assertBillingResultShape(event.billingResult);
      assertPurchasesShape(event.purchases);
    });

    disconnectedEvents.forEach((event) => {
      assertIsRecord(event);
      if (Object.keys(event).length > 0) {
        throw new Error(
          "billingServiceDisconnected event payload should be empty"
        );
      }
    });

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    serviceSubscription.remove();
    purchasesSubscription.remove();
  }
}

export default function App() {
  const [status, setStatus] = useState<Status>(INITIAL_STATUS);

  const handleRun = useCallback(async () => {
    setStatus({ state: "running", error: null });
    const error = await runIntegrationTest();
    if (error) {
      setStatus({ state: "error", error });
    } else {
      setStatus({ state: "done", error: null });
    }
  }, []);

  const statusText = useMemo(() => {
    switch (status.state) {
      case "idle":
        return "idle";
      case "running":
        return "running";
      case "done":
        return "done";
      case "error":
        return `error: ${status.error ?? "Unknown error"}`;
    }
  }, [status]);

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: "#fff" }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "600" }}>
            Expo Billing Client
          </Text>
          <Text
            accessibilityLabel="testStatus-integration"
            testID="testStatus-integration"
          >
            {statusText}
          </Text>
          <Button
            accessibilityLabel="testButton-integration"
            testID="testButton-integration"
            title="Run integration test"
            onPress={handleRun}
            disabled={status.state === "running"}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
