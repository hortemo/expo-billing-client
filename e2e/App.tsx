import React, { useCallback, useMemo, useState } from "react";
import { Button, SafeAreaView, ScrollView, Text, View } from "react-native";

import BillingClient, { ProductType } from "@hortemo/expo-billing-client";

type TestState = "idle" | "running" | "done" | "error";

interface Status {
  state: TestState;
  error: string | null;
}

const INITIAL_STATUS: Status = { state: "idle", error: null };

function assertObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected value to be an object");
  }
  return value as Record<string, unknown>;
}

function assertBillingResultShape(result: unknown) {
  const { responseCode, debugMessage } = assertObject(result);

  if (!Number.isInteger(responseCode)) {
    throw new Error("BillingResult responseCode must be an integer");
  }

  if (typeof debugMessage !== "string") {
    throw new Error("BillingResult debugMessage must be a string");
  }
}

function assertPurchasesShape(purchases: unknown) {
  if (!Array.isArray(purchases)) {
    throw new Error("Expected purchases to be an array");
  }

  purchases.forEach((purchase) => {
    const { orderId, products, purchaseToken, isAcknowledged } =
      assertObject(purchase);

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

async function runIntegrationTest(): Promise<string | null> {
  const disconnectedEvents: Array<unknown> = [];
  const purchasesEvents: Array<unknown> = [];

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
      return "isReady should return boolean";
    }

    const connectionResult = await BillingClient.startConnection();
    assertBillingResultShape(connectionResult);

    const inapp = await BillingClient.queryPurchases({
      productType: ProductType.INAPP,
    });
    const { billingResult: inAppBillingResult, purchases: inAppPurchases } =
      assertObject(inapp);
    assertBillingResultShape(inAppBillingResult);
    assertPurchasesShape(inAppPurchases);

    const subs = await BillingClient.queryPurchases({
      productType: ProductType.SUBS,
    });
    const { billingResult: subBillingResult, purchases: subPurchases } =
      assertObject(subs);
    assertBillingResultShape(subBillingResult);
    assertPurchasesShape(subPurchases);

    // TODO: Simulate events

    purchasesEvents.forEach((event) => {
      const { billingResult, purchases } = assertObject(event);
      assertBillingResultShape(billingResult);
      assertPurchasesShape(purchases);
    });

    disconnectedEvents.forEach((event) => {
      assertObject(event);
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
