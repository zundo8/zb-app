import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { AuthOptions } from "next-auth";
import { searchCustomerByPhone, fetchOrdersByCustomerId } from "@/lib/shopify-admin";
import bcrypt from "bcryptjs";

// Shopify Storefront API customer access token
async function shopifyCustomerLogin(email: string, password: string) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  
  if (!storeDomain || !storefrontToken) {
    throw new Error("Shopify configuration missing");
  }

  const query = `
    mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        customerUserErrors {
          code
          field
          message
        }
      }
    }
  `;

  const res = await fetch(`https://${storeDomain}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({
      query,
      variables: { input: { email, password } },
    }),
  });

  const data = await res.json();
  const result = data?.data?.customerAccessTokenCreate;

  if (result?.customerUserErrors?.length > 0) {
    throw new Error(result.customerUserErrors[0].message);
  }

  if (!result?.customerAccessToken?.accessToken) {
    throw new Error("Invalid credentials");
  }

  // Fetch customer details using the access token
  const customerQuery = `
    query {
      customer(customerAccessToken: "${result.customerAccessToken.accessToken}") {
        id
        firstName
        lastName
        email
        phone
      }
    }
  `;

  const customerRes = await fetch(`https://${storeDomain}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({ query: customerQuery }),
  });

  const customerData = await customerRes.json();
  return customerData?.data?.customer;
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || "",
    }),
    CredentialsProvider({
      id: "otp",
      name: "OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        try {
          const providedOtp = String(credentials?.otp || "").trim();
          const providedPhone = String(credentials?.phone || "").trim();

          if (providedOtp !== "123456") {
            console.warn(`[AUTH] Invalid OTP attempt: Received "${providedOtp}" for phone: ${providedPhone}`);
            throw new Error("Invalid OTP");
          }

          const phoneDigits = providedPhone.replace(/\D/g, "");

          const normalizedPhone = phoneDigits.slice(-10);
          const fullPhone = `+${phoneDigits}`;

          console.log(`[AUTH] --- ATTEMPT --- phone: ${fullPhone}, normalized: ${normalizedPhone}, otp: ${providedOtp}`);

          // Try to find local customer
          let customer = await prisma.customer.findFirst({
            where: { 
              OR: [
                { phone: fullPhone },
                { phone: phoneDigits },
                { phone: { contains: normalizedPhone } },
                { shopifyId: { contains: normalizedPhone } }
              ]
            }
          });
          
          console.log(`[AUTH] Local customer found: ${customer ? 'YES (ID: ' + customer.id + ')' : 'NO'}`);

          // ALWAYS search in Shopify
          console.log(`[AUTH] Searching Shopify for ${fullPhone}...`);
          let shopifyCustomer = null;
          try {
            shopifyCustomer = await searchCustomerByPhone(fullPhone);
            if (!shopifyCustomer) {
              shopifyCustomer = await searchCustomerByPhone(phoneDigits);
            }
            if (!shopifyCustomer) {
              shopifyCustomer = await searchCustomerByPhone(normalizedPhone);
            }
            console.log(`[AUTH] Shopify Customer found: ${shopifyCustomer ? 'YES (ID: ' + shopifyCustomer.id + ')' : 'NO'}`);
          } catch (e: any) {
            console.error("[AUTH] Shopify search unexpected error:", e.message);
          }

          let shop = await prisma.shop.findFirst();
          if (!shop) {
            console.log("[AUTH] No shop found, creating default shop...");
            shop = await prisma.shop.create({
              data: {
                domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
                accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
              }
            });
          }

          // Safety fallback to prevent .id crash if DB is still returning null (mock state)
          const shopId = (shop as any)?.id || 'default_shop_id';

          if (shopifyCustomer) {
            console.log(`[AUTH] Syncing data for Shopify Customer: ${shopifyCustomer.id}`);
            customer = await prisma.customer.upsert({
              where: { shopifyId: String(shopifyCustomer.id) },
              create: {
                shopifyId: String(shopifyCustomer.id),
                shopId: shopId,
                email: shopifyCustomer.email,
                name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || shopifyCustomer.email?.split("@")[0] || "User",
                phone: shopifyCustomer.phone || fullPhone,
                ordersCount: shopifyCustomer.orders_count || 0,
                totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
              },
              update: {
                email: shopifyCustomer.email || undefined,
                name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || customer?.name || undefined,
                phone: shopifyCustomer.phone || undefined,
                ordersCount: shopifyCustomer.orders_count,
                totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
              }
            });

            // Sync orders synchronously for this login
            try {
              const shopifyOrders = await fetchOrdersByCustomerId(String(shopifyCustomer.id));
              console.log(`[AUTH] Found ${shopifyOrders.length} Shopify orders. Upserting...`);
              for (const o of shopifyOrders) {
                await prisma.order.upsert({
                  where: { shopifyOrderId: String(o.id) },
                  create: {
                    shopId: shopId,
                    shopifyOrderId: String(o.id),
                    customerId: customer.id,
                    status: 'active',
                    totalPrice: parseFloat(o.total_price || '0'),
                    currency: o.currency || 'INR',
                    paymentStatus: o.financial_status || 'pending',
                    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                    createdAt: new Date(o.created_at),
                  },
                  update: {
                    status: 'active',
                    totalPrice: parseFloat(o.total_price || '0'),
                    paymentStatus: o.financial_status || 'pending',
                    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                  }
                });
              }
            } catch (orderSyncError) {
              console.error("[AUTH] Order sync error:", orderSyncError);
            }
          } else if (!customer) {
            console.log(`[AUTH] No Shopify record and no local record. Creating guest for ${fullPhone}.`);
            customer = await prisma.customer.create({
              data: {
                  phone: fullPhone,
                  shopId: shopId,
                shopifyId: `otp_${Date.now()}`,
                name: "New User",
              },
            });
          } else {
            console.log(`[AUTH] No Shopify record found, but local customer already exists: ${customer.id}`);
          }

          if (!customer) return null;

          return {
            id: customer.id,
            name: customer.name ?? "User",
            email: customer.email ?? undefined,
            phone: customer.phone,
            image: (customer as any).image ?? undefined,
          };
        } catch (error: any) {
          console.error("[AUTH] OTP authorize error:", error);
          throw error;
        }
      },
    }),
    CredentialsProvider({
      id: "shopify-customer",
      name: "Shopify Account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const shopifyCustomer = await shopifyCustomerLogin(
            credentials.email,
            credentials.password
          );

          if (!shopifyCustomer) {
            throw new Error("Invalid email or password");
          }

          let customer = await prisma.customer.findFirst({
            where: { email: shopifyCustomer.email },
          });

          if (!customer) {
            let shop = await prisma.shop.findFirst();
            if (!shop) {
              console.log("[AUTH] No shop found in shopify-customer, creating default...");
              shop = await prisma.shop.create({
                data: {
                  domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
                  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
                }
              });
            }
            const shopId = (shop as any)?.id || 'default_shop_id';

            customer = await prisma.customer.create({
              data: {
                email: shopifyCustomer.email,
                name: `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim() || "Shopify User",
                  phone: shopifyCustomer.phone || null,
                  shopId: shopId,
                shopifyId: shopifyCustomer.id,
              },
            });
          }

          return {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            image: (customer as any).image,
          };
        } catch (error: any) {
          console.error("[AUTH] Shopify authorize error:", error);
          throw new Error(error.message || "Login failed");
        }
      },
    }),
    CredentialsProvider({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const email = credentials.email.toLowerCase().trim();
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.isActive) return null;

          // Check if locked
          if (user.lockUntil && user.lockUntil > new Date()) {
            throw new Error(`Account locked until ${user.lockUntil.toLocaleTimeString()}`);
          }

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

          if (!isValid) {
            const newAttempts = user.failedLoginAttempts + 1;
            let lockUntil = user.lockUntil;
            if (newAttempts >= 5) {
              lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newAttempts,
                lockUntil: lockUntil,
              },
            });
            return null;
          }

          // Reset on success
          if (user.failedLoginAttempts > 0 || user.lockUntil) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockUntil: null,
              },
            });
          }

          const permissions = await prisma.permission.findMany({
            where: { userId: user.id }
          });

          return {
            id: user.id,
            name: user.name || "Admin",
            email: user.email,
            role: user.role,
            permissions: permissions.map(p => ({
              module: p.module,
              canView: p.canView,
              canEdit: p.canEdit,
              canDelete: p.canDelete,
            }))
          };
        } catch (error: any) {
          console.error("[AUTH] Admin authorize error:", error);
          throw new Error(error.message || "Invalid credentials");
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "apple") {
        const email = user.email;
        if (!email) return false;

        let customer = await prisma.customer.findFirst({
          where: { email },
        });

        if (!customer) {
          let shop = await prisma.shop.findFirst();
          if (!shop) {
            shop = await prisma.shop.create({
              data: {
                domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
                accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
              }
            });
          }

          await prisma.customer.create({
            data: {
              email,
              name: user.name || "Apple User",
              shopId: shop.id,
              shopifyId: `${account.provider}_${Date.now()}`,
              image: user.image,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "CUSTOMER";
        token.permissions = (user as any).permissions;
        token.loginTime = Math.floor(Date.now() / 1000);
        token.needsPasswordChange = (user as any).needsPasswordChange;
      }

      // Absolute 8-hour limit for admins
      if (token.role === "ADMIN" || token.role === "SUPER_ADMIN") {
        const eightHoursInSeconds = 8 * 60 * 60;
        const currentTime = Math.floor(Date.now() / 1000);
        if (token.loginTime && (currentTime - (token.loginTime as number)) > eightHoursInSeconds) {
          return null as any; // Invalidates the token
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
        (session.user as any).needsPasswordChange = token.needsPasswordChange;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes idle timeout
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
