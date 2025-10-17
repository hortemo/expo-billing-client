package com.hortemo.billingclient

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

class QueryProductDetailsOptions : Record {
  @Field var products: List<QueryProductItem>? = null
}

class QueryProductItem : Record {
  @Field var productId: String? = null
  @Field var productType: String? = null
}

class LaunchBillingFlowOptions : Record {
  @Field var products: List<LaunchBillingFlowProduct>? = null
}

class LaunchBillingFlowProduct : Record {
  @Field var productId: String? = null
  @Field var productType: String? = null
  @Field var offerToken: String? = null
}

class AcknowledgePurchaseOptions : Record {
  @Field var purchaseToken: String? = null
}

class QueryPurchasesOptions : Record {
  @Field var productType: String? = null
}

class BillingClientModule : Module(), com.android.billingclient.api.PurchasesUpdatedListener {
  private val billingClient: BillingClient by lazy {
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context is not available")
    BillingClient.newBuilder(context)
      .setListener(this)
      .enablePendingPurchases()
      .build()
  }

  override fun definition() = ModuleDefinition {
    Name("BillingClient")

    Events("billingServiceDisconnected", "purchasesUpdated")

    AsyncFunction("isReady") {
      billingClient.isReady
    }

    AsyncFunction("startConnection") Coroutine { ->
      suspendCancellableCoroutine { continuation: Continuation<Map<String, Any?>> ->
        billingClient.startConnection(object : BillingClientStateListener {
          override fun onBillingSetupFinished(result: BillingResult) {
            continuation.resume(result.toMap())
          }

          override fun onBillingServiceDisconnected() {
            sendEvent("billingServiceDisconnected", mapOf())
          }
        })
      }
    }

    AsyncFunction("queryProductDetails") Coroutine { options: QueryProductDetailsOptions ->
      val products = options.products ?: throw IllegalStateException("products is required")

      val queryParams = QueryProductDetailsParams.newBuilder().apply {
        setProductList(
          products.map { product ->
            QueryProductDetailsParams.Product.newBuilder().apply {
              product.productId?.let { setProductId(it) }
              product.productType?.let { setProductType(it) }
            }.build()
          }
        )
      }.build()

      suspendCancellableCoroutine { continuation: Continuation<Map<String, Any?>> ->
        billingClient.queryProductDetailsAsync(queryParams) { billingResult, productDetailsList ->
          continuation.resume(
            mapOf(
              "billingResult" to billingResult.toMap(),
              "productDetailsList" to productDetailsList.orEmpty().map { it.toMap() }
            )
          )
        }
      }
    }

    AsyncFunction("launchBillingFlow") Coroutine { options: LaunchBillingFlowOptions ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("Activity is null")

      val products = options.products ?: throw IllegalStateException("products is required")

      val queryParams = QueryProductDetailsParams.newBuilder()
        .setProductList(
          products.map { product ->
            QueryProductDetailsParams.Product.newBuilder().apply {
              product.productId?.let { setProductId(it) }
              product.productType?.let { setProductType(it) }
            }.build()
          }
        )
        .build()

      suspendCancellableCoroutine { continuation: Continuation<Map<String, Any?>> ->
        billingClient.queryProductDetailsAsync(queryParams) { queryResult, productDetailsList ->
          if (queryResult.responseCode == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
            val productDetailsById = productDetailsList.associateBy { it.productId }
            val billingFlowParams = BillingFlowParams.newBuilder()
              .setProductDetailsParamsList(
                products.map { product ->
                  BillingFlowParams.ProductDetailsParams.newBuilder().apply {
                    productDetailsById[product.productId]?.let { setProductDetails(it) }
                    product.offerToken?.let { setOfferToken(it) }
                  }.build()
                }
              )
              .build()
            val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
            continuation.resume(billingResult.toMap())
          } else {
            continuation.resume(queryResult.toMap())
          }
        }
      }
    }

    AsyncFunction("acknowledgePurchase") Coroutine { options: AcknowledgePurchaseOptions ->
      val acknowledgeParams = AcknowledgePurchaseParams.newBuilder().apply {
        options.purchaseToken?.let { setPurchaseToken(it) }
      }.build()

      suspendCancellableCoroutine { continuation: Continuation<Map<String, Any?>> ->
        billingClient.acknowledgePurchase(acknowledgeParams) { billingResult ->
          continuation.resume(billingResult.toMap())
        }
      }
    }

    AsyncFunction("queryPurchases") Coroutine { options: QueryPurchasesOptions ->
      val queryParams = QueryPurchasesParams.newBuilder().apply {
        options.productType?.let { setProductType(it) }
      }.build()

      suspendCancellableCoroutine { continuation: Continuation<Map<String, Any?>> ->
        billingClient.queryPurchasesAsync(queryParams) { billingResult, purchases ->
          continuation.resume(
            mapOf(
              "billingResult" to billingResult.toMap(),
              "purchases" to purchases.orEmpty().map { it.toMap() }
            )
          )
        }
      }
    }

    OnDestroy {
      if (billingClient.isReady) {
        billingClient.endConnection()
      }
    }
  }

  override fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?) {
    sendEvent(
      "purchasesUpdated",
      mapOf(
        "billingResult" to billingResult.toMap(),
        "purchases" to purchases.orEmpty().map { it.toMap() }
      )
    )
  }

  private fun BillingResult.toMap(): Map<String, Any?> = mapOf(
    "responseCode" to responseCode,
    "debugMessage" to debugMessage
  )

  private fun ProductDetails.toMap(): Map<String, Any?> {
    val map = mutableMapOf<String, Any?>("productId" to productId)
    oneTimePurchaseOfferDetails?.let { offer ->
      map["oneTimePurchaseOfferDetails"] = mapOf(
        "formattedPrice" to offer.formattedPrice,
        "priceAmountMicros" to offer.priceAmountMicros,
        "priceCurrencyCode" to offer.priceCurrencyCode
      )
    }
    subscriptionOfferDetails?.let { offers ->
      map["subscriptionOfferDetails"] = offers.map { offer ->
        mapOf(
          "basePlanId" to offer.basePlanId,
          "offerId" to offer.offerId,
          "offerToken" to offer.offerToken,
          "pricingPhases" to offer.pricingPhases.pricingPhaseList.map { phase ->
            mapOf(
              "billingCycleCount" to phase.billingCycleCount,
              "billingPeriod" to phase.billingPeriod,
              "formattedPrice" to phase.formattedPrice,
              "priceAmountMicros" to phase.priceAmountMicros,
              "priceCurrencyCode" to phase.priceCurrencyCode,
              "recurrenceMode" to phase.recurrenceMode
            )
          }
        )
      }
    }
    return map
  }

  private fun Purchase.toMap(): Map<String, Any?> = mapOf(
    "orderId" to orderId,
    "products" to products,
    "purchaseToken" to purchaseToken,
    "isAcknowledged" to isAcknowledged()
  )
}
