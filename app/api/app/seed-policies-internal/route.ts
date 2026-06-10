import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const policies = [
  {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    content: `
# PRIVACY POLICY

Last updated: December 22, 2025

Zica Bella operates this store and website, including all related information, content, features, tools, products and services, in order to provide you, the customer, with a curated shopping experience (the "Services"). Zica Bella is powered by Shopify, which enables us to provide the Services to you. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit, use, or make a purchase or other transaction using the Services or otherwise communicate with us. 

## Personal Information We Collect or Process
When we use the term "personal information," we are referring to information that identifies or can reasonably be linked to you or another person. We may collect or process the following categories of personal information:
- **Contact details**: name, address, billing address, shipping address, phone number, and email address.
- **Financial information**: payment card information, transaction details.
- **Account information**: username, password, security questions, preferences.
- **Transaction information**: items viewed, cart additions, purchases, returns, exchanges.
- **Communications**: content of messages sent to us.
- **Device & Usage**: IP address, browser type, navigation patterns on our Services.

## How We Use Your Personal Information
- **Provide Services**: Processing orders, managing accounts, and facilitating returns.
- **Marketing**: Sending promotional communications and personalized advertisements.
- **Security**: Preventing fraud and ensuring a safe shopping environment.
- **Legal Compliance**: Meeting tax, regulatory, and legal obligations.

## How We Disclose Personal Information
We may share your information with:
- **Shopify**: Our platform provider.
- **Service Providers**: Delivery partners (Blue Dart, Delhivery), payment gateways (Razorpay).
- **Professional Advisors**: Accountants, lawyers, and auditors.

## Your Rights
Depending on your location, you may have rights to access, correct, delete, or port your personal information. Contact us to exercise these rights.

## Contact Information
If you have any questions about our privacy practices, please contact us at **support@zicabella.com** or visit us at Bhutani Alphathum Sector 90, 2207, Tower B, Noida, UP, 201304, IN.
    `.trim()
  },
  {
    handle: 'terms-of-service',
    title: 'Terms of Service',
    content: `
# TERMS OF SERVICE

Last updated: November 22, 2025

By using the Zica Bella website and mobile app, you agree to these Terms of Service. Please read them carefully.

## 1. Introduction
Zica Bella provides access to premium Indian streetwear. These terms apply to all visitors, users, and customers.

## 2. Online Store Terms
- You must be at least the age of majority in your jurisdiction.
- You may not use our products for any illegal or unauthorized purpose.
- You must not transmit any worms or viruses or any code of a destructive nature.

## 3. Products & Services
- We reserve the right to limit the sales of our products or Services to any person, geographic region or jurisdiction.
- We have made every effort to display as accurately as possible the colors and images of our products.
- Prices for our products are subject to change without notice.

## 4. Accuracy of Billing & Account Information
You agree to provide current, complete and accurate purchase and account information for all purchases made at our store. You agree to promptly update your account and other information, including your email address and credit card numbers and expiration dates.

## 5. Third-Party Links
Certain content, products and services available via our Service may include materials from third-parties. We are not responsible for examining or evaluating the content or accuracy and we do not warrant and will not have any liability or responsibility for any third-party materials.

## 6. Governing Law
These Terms of Service and any separate agreements whereby we provide you Services shall be governed by and construed in accordance with the laws of India.

## 7. Contact
Questions about the Terms of Service should be sent to us at **support@zicabella.com**.
    `.trim()
  },
  {
    handle: 'refund-policy',
    title: 'Refund Policy (Returns & Exchanges)',
    content: `
# REFUND POLICY (RETURNS & EXCHANGES)

Last updated: November 22, 2025

At Zica Bella, we want you to be completely satisfied with your purchase. If you are not happy with your order, we are here to help.

## Returns & Exchanges
- **Window**: Returns and exchanges are accepted within **7 days** from the date of delivery.
- **Process**: Submit a request via our app or website. approved requests will trigger a pickup within 24-48 hours.
- **Condition**: Items must be unworn, unwashed, unaltered, and with all original tags intact.
- **Timeline**: Exchanges take approximately 7–10 working days after successful quality inspection at our warehouse.

## Refunds
- **Monetary Refunds**: We generally do not issue monetary refunds to original payment methods.
- **Credit Notes**: Approved returns are refunded in the form of a **Credit Note / Gift Card** for future use.
- **Inspection**: All returns are subject to a quality check before a credit note is issued.

## Cancellations
- **COD Orders**: Can be cancelled before dispatch.
- **Prepaid Orders**: Cannot be cancelled once placed.

## Damaged or Defective Items
If you receive a damaged or defective item, please contact us immediately at **support@zicabella.com** with photos of the issue.

## Contact Support
- **Phone**: +91 9220385011
- **Email**: support@zicabella.com
- **Hours**: Monday – Saturday, 11:00 AM to 7:00 PM (IST)
    `.trim()
  },
  {
    handle: 'shipping-policy',
    title: 'Shipping Policy',
    content: `
# SHIPPING POLICY

Last updated: November 22, 2025

Zica Bella delivers high-end streetwear across India. Here is how we handle shipping.

## Shipping Costs
- **Free Shipping**: Available on all orders above **₹999**.
- **Standard Shipping**: ₹99 fee for orders below ₹999.
- **Express Shipping**: Available in select regions for approximately ₹199.

## Delivery Timelines
- **Metros**: 2–4 business days.
- **Tier-2 Cities**: 3–5 business days.
- **Rest of India**: 5–10 business days.
*Note: Timelines are estimates and can vary based on courier performance.*

## Order Tracking
Once your order is dispatched, you will receive a tracking link via email and SMS. You can also track your order directly in the "Orders" section of the Zica Bella app.

## Delivery Partners
We partner with leading logistics companies including Blue Dart, DTDC, Delhivery, and Ecom Express to ensure your drip reaches you safely.

## Support
For shipping-related queries, reach us at:
- **Call**: +91 6002768463
- **Email**: support@zicabella.com
    `.trim()
  },
  {
    handle: 'contact-information',
    title: 'Contact Information',
    content: `
# CONTACT INFORMATION

For any assistance or queries, please get in touch with our Client Advisors.

#### Trade Name:
**ZICA BELLA PRIVATE LIMITED**

#### Customer Support:
- **Email**: support@zicabella.com
- **Phone**: +91 9220385011 / +91 6002768463

#### Registered Office:
Zica Bella Pvt. Ltd.
2207, Tower B, Bhutani Alphathum
Sector 90, Noida – 201305
Uttar Pradesh, India

#### Business Hours:
- **Monday to Sunday**: 11:00 AM – 7:30 PM (IST)

#### Social Channels:
- **Instagram**: @zica.bella
- **YouTube**: Zica Bella Official
    `.trim()
  },
  {
    handle: 'about-us',
    title: 'About Us',
    content: `
# ABOUT ZICA BELLA

### DRIP IT TILL YOU FLIP IT.
Modern Indian Streetwear. Designed for Expression.

Zica Bella is a modern Indian streetwear brand built for a generation that values individuality, comfort, and confident self-expression. Rooted in contemporary street culture and shaped by global fashion sensibilities, Zica Bella creates clothing that feels intentional, elevated, and wearable every single day.

## Our Philosophy
We design for people who don’t just wear clothes, but use fashion as a language. From oversized t-shirts and relaxed denims to hoodies, jackets, and everyday streetwear essentials, every Zica Bella piece is crafted to balance style, comfort, and attitude.

## A Streetwear Brand Designed for the New India
India’s fashion landscape is evolving. Today’s generation—especially those between 16 and 30—wants more than fast fashion. They want clothing that reflects who they are, fits their lifestyle, and feels premium without being inaccessible.

## What Makes Us Different
- **Oversized Fits Done Right**: Proportions that look intentional and structured.
- **Premium Fabrics**: Heavyweight cottons and durable textures designed for long wear.
- **Indian Context**: Clothing designed for Indian weather and body types.

## Our Vision
To become one of India’s most trusted and recognisable streetwear brands known for quality, fit, and authenticity while staying true to the culture that inspires us.

**Wear bold. Wear comfortable. Wear Zica Bella.**
    `.trim()
  }
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key !== process.env.ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Final High-Quality Seeding of policies via API...');
    for (const policy of policies) {
      await prisma.policy.upsert({
        where: { handle: policy.handle },
        update: policy,
        create: policy,
      });
    }

    return NextResponse.json({ success: true, message: 'All policies updated with high-quality content' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
