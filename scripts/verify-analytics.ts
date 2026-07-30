import fs from 'fs';
import path from 'path';

function runAudit() {
  console.log('🚀 Starting Analytics & Google Tags Codebase & Architecture Audit Verification...\n');

  const rootDir = process.cwd();
  const layoutPath = path.join(rootDir, 'app/layout.tsx');
  const analyticsPath = path.join(rootDir, 'components/seo/Analytics.tsx');
  const gtagPath = path.join(rootDir, 'lib/gtag.ts');
  const metaEventsPath = path.join(rootDir, 'hooks/useMetaEvents.ts');
  const trackerPath = path.join(rootDir, 'components/MetaPixelRouteTracker.tsx');

  const layoutCode = fs.readFileSync(layoutPath, 'utf8');
  const analyticsCode = fs.readFileSync(analyticsPath, 'utf8');
  const gtagCode = fs.readFileSync(gtagPath, 'utf8');
  const metaEventsCode = fs.readFileSync(metaEventsPath, 'utf8');
  const trackerCode = fs.readFileSync(trackerPath, 'utf8');

  // Test 1: Storefront Canonical GTM ID configured in layout.tsx
  const hasStorefrontGtmId = layoutCode.includes('GTM-WKTQJ5LF');
  console.log(`1️⃣ Canonical Storefront GTM Container (GTM-WKTQJ5LF) in layout.tsx: ${hasStorefrontGtmId ? '✅ CONFIRMED' : '❌ MISSING'}`);

  // Test 2: Admin GTM Container ID isolated
  const hasAdminGtmIsolation = layoutCode.includes('GTM-TDGKF386') && layoutCode.includes('isAppOrAdmin');
  console.log(`2️⃣ Admin GTM Container (GTM-TDGKF386) Isolated to Admin Context: ${hasAdminGtmIsolation ? '✅ CONFIRMED' : '❌ MISSING'}`);

  // Test 3: Domain & Route Guards present in layout.tsx
  const hasDomainRouteGuards = layoutCode.includes('app.zicabella.com') && layoutCode.includes('/dashboard') && layoutCode.includes('/admin');
  console.log(`3️⃣ Admin & Storefront Domain Separation Guard in layout.tsx: ${hasDomainRouteGuards ? '✅ CONFIRMED' : '❌ MISSING'}`);

  // Test 4: Redundant direct gtag.js script loading removed from Analytics.tsx
  const directGtagRemoved = !analyticsCode.includes('googletagmanager.com/gtag/js');
  console.log(`4️⃣ Duplicate direct gtag.js Script Tag Removed from Analytics.tsx: ${directGtagRemoved ? '✅ CONFIRMED' : '❌ STILL PRESENT'}`);

  // Test 5: DataLayer initialization in Analytics.tsx & gtag.ts
  const hasDataLayerInit = analyticsCode.includes('dataLayer') && gtagCode.includes('dataLayer');
  console.log(`5️⃣ Window dataLayer & gtag Helper Safe Initialization: ${hasDataLayerInit ? '✅ CONFIRMED' : '❌ MISSING'}`);

  // Test 6: Spec-compliant GA4 event payloads in useMetaEvents.ts
  const hasViewItemSpec = metaEventsCode.includes("'view_item'") && metaEventsCode.includes('item_name: contentName');
  const hasAddToCartSpec = metaEventsCode.includes("'add_to_cart'") && metaEventsCode.includes('item_name: contentName');
  const hasBeginCheckoutSpec = metaEventsCode.includes("'begin_checkout'") && metaEventsCode.includes('item_name: item.title');
  const hasAddPaymentInfoSpec = metaEventsCode.includes("'add_payment_info'") && metaEventsCode.includes('items: finalContents');
  const hasPurchaseSpec = metaEventsCode.includes("'purchase'") && metaEventsCode.includes('transaction_id: orderId') && metaEventsCode.includes('item_name: item.title');

  const allEventsSpecCompliant = hasViewItemSpec && hasAddToCartSpec && hasBeginCheckoutSpec && hasAddPaymentInfoSpec && hasPurchaseSpec;
  console.log(`6️⃣ Spec-Compliant GA4 Ecommerce Event Payloads (view_item, add_to_cart, begin_checkout, add_payment_info, purchase): ${allEventsSpecCompliant ? '✅ CONFIRMED' : '❌ INCOMPLETE'}`);

  console.log('\n📊 AUDIT VERIFICATION RESULTS SUMMARY:');
  const results = [
    { Requirement: 'Canonical Storefront GTM (GTM-WKTQJ5LF)', Status: hasStorefrontGtmId ? 'PASS' : 'FAIL' },
    { Requirement: 'Admin Container (GTM-TDGKF386) Isolation', Status: hasAdminGtmIsolation ? 'PASS' : 'FAIL' },
    { Requirement: 'Domain & Route Separation Guard', Status: hasDomainRouteGuards ? 'PASS' : 'FAIL' },
    { Requirement: 'Eliminate Direct gtag.js Double-Tagging', Status: directGtagRemoved ? 'PASS' : 'FAIL' },
    { Requirement: 'Safe dataLayer & gtag Initialization', Status: hasDataLayerInit ? 'PASS' : 'FAIL' },
    { Requirement: 'GA4 Spec-Compliant Ecommerce Payloads', Status: allEventsSpecCompliant ? 'PASS' : 'FAIL' },
  ];
  console.table(results);

  const allPassed = results.every(r => r.Status === 'PASS');
  if (allPassed) {
    console.log('\n🎉 ALL ANALYTICS VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('\n❌ SOME VERIFICATION CHECKS FAILED.');
    process.exit(1);
  }
}

runAudit();
