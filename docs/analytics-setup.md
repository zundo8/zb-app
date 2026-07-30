# Zica Bella Webstore - Analytics & Tagging Architecture

This document defines the canonical Google Analytics 4 (GA4), Google Tag Manager (GTM), and Google Ads tracking configuration for the Zica Bella storefront (`zicabella.com` & `www.zicabella.com`).

---

## 1. System Architecture & Domain Rules

### Canonical Tagging Path
All storefront analytics and conversion tracking are consolidated under a **single storefront Google Tag Manager container**:

- **Canonical GTM Container ID**: `GTM-WKTQJ5LF`
- **GA4 Measurement ID**: `G-DHCXV3YQNG`
- **Google Tag (gtag) ID**: `GT-55KL3ZGD`
- **Reporting Currency**: `INR` (Indian Rupee)

```
[Customer Browser (zicabella.com / www.zicabella.com)]
          │
          │ (Single GTM Script: GTM-WKTQJ5LF)
          ▼
   [dataLayer (window.dataLayer)]
          │
          ├──> GA4 Configuration & Event Tags (G-DHCXV3YQNG)
          └──> Google Ads Conversion Linker & Purchase Conversion Tags
```

### Domain Routing Rules
| Domain / Subdomain | Context | Tagging Action | Associated GTM Container |
| :--- | :--- | :--- | :--- |
| `zicabella.com` | Primary Storefront | Loads storefront GTM container | `GTM-WKTQJ5LF` |
| `www.zicabella.com` | Secondary Storefront | Loads storefront GTM container | `GTM-WKTQJ5LF` |
| `app.zicabella.com` | Admin / Dashboard | Admin container only (Storefront tags excluded) | `GTM-TDGKF386` |

### Retired / Unused Containers
- **`GTM-T8KH43H7`**: Previously attached to `www.zicabella.com` with unpublished pending changes and quality warnings. **Retired** in favor of `GTM-WKTQJ5LF` to ensure identical tag behavior across www and non-www domains.

---

## 2. Event Specification & DataLayer Schema

All events pushed to `window.dataLayer` follow standard GA4 Ecommerce specifications:

### 2.1 Page View (`page_view`)
Triggered on initial page load and SPA route changes.
```json
{
  "event": "page_view",
  "page_path": "/products/desperados-veil-denim",
  "page_location": "https://zicabella.com/products/desperados-veil-denim",
  "page_title": "Desperados Veil Denim Hoodie - Zica Bella"
}
```

### 2.2 Product Detail View (`view_item`)
Triggered when a customer views a product details page.
```json
{
  "event": "view_item",
  "currency": "INR",
  "value": 12899,
  "items": [
    {
      "item_id": "prod_12345",
      "item_name": "Desperados Veil Denim Hoodie",
      "price": 12899,
      "item_category": "Streetwear Hoodies",
      "quantity": 1
    }
  ]
}
```

### 2.3 Add to Cart (`add_to_cart`)
Triggered when an item is added to the cart.
```json
{
  "event": "add_to_cart",
  "currency": "INR",
  "value": 12899,
  "items": [
    {
      "item_id": "prod_12345",
      "item_name": "Desperados Veil Denim Hoodie",
      "price": 12899,
      "item_category": "Streetwear Hoodies",
      "quantity": 1
    }
  ]
}
```

### 2.4 Begin Checkout (`begin_checkout`)
Triggered when initiating checkout.
```json
{
  "event": "begin_checkout",
  "currency": "INR",
  "value": 12899,
  "items": [
    {
      "item_id": "prod_12345",
      "item_name": "Desperados Veil Denim Hoodie",
      "price": 12899,
      "quantity": 1
    }
  ]
}
```

### 2.5 Add Payment Info (`add_payment_info`)
Triggered when payment details/method are provided.
```json
{
  "event": "add_payment_info",
  "currency": "INR",
  "value": 12899,
  "items": [
    {
      "item_id": "prod_12345",
      "price": 12899,
      "quantity": 1
    }
  ]
}
```

### 2.6 Purchase (`purchase`)
Triggered on order completion on the thank-you / order status page (`/orders/[id]/confirmation`).
```json
{
  "event": "purchase",
  "transaction_id": "zb_ord_98765",
  "value": 12899,
  "currency": "INR",
  "items": [
    {
      "item_id": "prod_12345",
      "item_name": "Desperados Veil Denim Hoodie",
      "price": 12899,
      "item_category": "Streetwear Hoodies",
      "quantity": 1
    }
  ]
}
```

---

## 3. GTM & Analytics Admin Console Setup Steps

### GTM Container (`GTM-WKTQJ5LF`) Configuration
1. **Google Tag (GA4 Config)**:
   - Tag Type: **Google Tag**
   - Tag ID: `G-DHCXV3YQNG` (or `GT-55KL3ZGD`)
   - Trigger: **Initialization - All Pages**

2. **GA4 Ecommerce Event Tags**:
   - Create GA4 Event tags for `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, and `purchase`.
   - Set Event Name to `{{Event}}` (or map explicitly).
   - Enable "Send Ecommerce data" (Data Layer source).
   - Trigger: Custom Event matching `view_item|add_to_cart|begin_checkout|add_payment_info|purchase`.

3. **Google Ads Conversion Linker**:
   - Tag Type: **Conversion Linker**
   - Trigger: **All Pages**

4. **Google Ads Purchase Conversion Tag**:
   - Tag Type: **Google Ads User-provided Data / Conversion Tracking**
   - Conversion ID & Conversion Label (from Google Ads account)
   - Value: `{{dlv - value}}`, Currency: `{{dlv - currency}}`, Transaction ID: `{{dlv - transaction_id}}`
   - Trigger: Custom Event `purchase`

5. **Publish Container**:
   - Click **Submit** → Enter Version Name (e.g. `v1.0 - GA4 & Ads Storefront Tagging`) → Click **Publish**.

---

## 4. Audit & Fix Summary

1. **Eliminated Dual `gtag.js` Injection**:
   - Removed direct `gtag.js` script loading from `Analytics.tsx` to prevent redundant network requests to `google-analytics.com/g/collect`.
2. **Domain & Route Guards**:
   - Prevented storefront GTM from running on `app.zicabella.com` and admin routes (`/dashboard`, `/admin`).
3. **Spec-Compliant Payloads**:
   - Updated `useMetaEvents.ts` and `gtag.ts` to push complete GA4 item objects with `item_name`, `price`, `value`, `currency='INR'`, and `transaction_id`.
