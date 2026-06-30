import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { AuthOptions } from "next-auth";
import { searchCustomerByPhone, fetchOrdersByCustomerId } from "@/lib/shopify-admin";
import bcrypt from "bcryptjs";
import { SmsService } from "@/lib/services/sms.service";

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

function getCustomerImageProxy(customerId: string, imageStr: string | null): string | null {
  if (!imageStr) return null;
  if (imageStr.startsWith("data:") || imageStr.length > 2048) {
    return `/api/customers/avatar?id=${customerId}`;
  }
  return imageStr;
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
        name: { label: "Name", type: "text" },
        userAgent: { label: "UserAgent", type: "text" },
      },
      async authorize(credentials) {
        try {
          const providedOtp = String(credentials?.otp || "").trim();
          const providedPhone = String(credentials?.phone || "").trim();
          const providedName = String(credentials?.name || "").trim();
          const providedUserAgent = String(credentials?.userAgent || "Web Browser").trim();

          // Validate OTP format
          if (!/^\d{6}$/.test(providedOtp)) {
            return null;
          }

          const phoneDigits = providedPhone.replace(/\D/g, "");
          const normalizedPhone = phoneDigits.slice(-10);
          const fullPhone = `+${phoneDigits}`;

          let isVerified = false;

          // Special case: Demo User Bypass
          if (normalizedPhone === "9999999999" && providedOtp === "123456") {
            isVerified = true;
          }

          // 1. Try local DB check first (instantaneous, timezone desync-safe)
          if (!isVerified) {
            const verification = await prisma.verificationCode.findFirst({
              where: {
                OR: [
                  { phone: providedPhone },
                  { phone: fullPhone },
                  { phone: { contains: normalizedPhone } }
                ],
                code: providedOtp
              },
              orderBy: { createdAt: 'desc' }
            });

            if (verification) {
              const now = new Date();
              // Check if code has expired
              if (now < new Date(verification.expiresAt)) {
                isVerified = true;
                // Set expiresAt to 15 seconds in the future to allow duplicate concurrent requests
                // but prevent reuse after that.
                await prisma.verificationCode.update({
                  where: { id: verification.id },
                  data: { expiresAt: new Date(Date.now() + 15 * 1000) }
                }).catch(console.error);
              }
            }
          }

          // 2. Fallback to Twilio Verify check if not verified by local DB
          if (!isVerified) {
            try {
              const verifyCheck = await SmsService.checkVerification(fullPhone, providedOtp);
              if (verifyCheck === true) {
                isVerified = true;
                // Cache the verified code locally so that duplicate signIn calls
                // (mobile auto-submit + manual tap race) hit the DB fast-path
                // instead of calling Twilio again (Twilio codes are single-use).
                await prisma.verificationCode.create({
                  data: {
                    phone: fullPhone,
                    code: providedOtp,
                    expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 min TTL
                  }
                }).catch(e => console.log("[AUTH] Cache verified OTP:", e.message));
              }
            } catch (err: any) {
              console.log("[AUTH] Twilio Verify check failed/skipped:", err.message);
            }
          }

          if (!isVerified) {
            console.warn(`[AUTH] Invalid OTP attempt for phone: ${fullPhone}`);
            
            // Log failed verification attempt (non-blocking)
            prisma.appLogin.create({
              data: {
                phone: fullPhone,
                status: "OTP_INVALID",
                userAgent: providedUserAgent
              }
            }).catch(console.error);

            return null;
          }

          console.log(`[AUTH] OTP verified for ${fullPhone}`);

          // ── FAST PATH: Look up local customer first ──
          // Prioritize customers with a canonical shopifyId (not starting with otp_ or mobile_)
          let customers = await prisma.customer.findMany({
            where: {
              OR: [
                { phone: fullPhone },
                { phone: phoneDigits },
                { phone: { contains: normalizedPhone } },
              ]
            }
          });

          let customer = customers.find(c => c.shopifyId && !c.shopifyId.startsWith("otp_") && !c.shopifyId.startsWith("mobile_"))
            || customers[0]
            || null;

          let shop = await prisma.shop.findFirst();
          if (!shop) {
            shop = await prisma.shop.create({
              data: {
                domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
                accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
              }
            });
          }
          const shopId = (shop as any)?.id || 'default_shop_id';

          if (customer) {
            // ── EXISTING USER: Return immediately, sync Shopify in background ──
            console.log(`[AUTH] Fast-path: existing customer ${customer.id}`);

            // Update name if provided and missing
            if (providedName && (!customer.name || customer.name === "New User" || customer.name === "User")) {
              customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { name: providedName },
              });
            }

            // Log success (non-blocking)
            prisma.appLogin.create({
              data: { phone: fullPhone, status: "LOGGED_IN", userAgent: providedUserAgent }
            }).catch(console.error);

            // ── BACKGROUND: Shopify sync (non-blocking, fire-and-forget) ──
            const bgCustomerId = customer.id;
            const bgCustomerPhone = customer.phone;
            const bgCustomerName = customer.name;
            (async () => {
              try {
                // Parallel Shopify search across phone formats
                const results = await Promise.all([
                  searchCustomerByPhone(fullPhone).catch(() => null),
                  searchCustomerByPhone(phoneDigits).catch(() => null),
                  searchCustomerByPhone(normalizedPhone).catch(() => null),
                ]);
                const shopifyCustomer = results.find(r => r !== null) || null;

                if (!shopifyCustomer) {
                  console.log(`[AUTH-BG] No Shopify customer found for ${fullPhone}`);
                  return;
                }

                console.log(`[AUTH-BG] Syncing Shopify customer ${shopifyCustomer.id} for local ${bgCustomerId}`);

                // Update local customer with Shopify data
                try {
                  await prisma.customer.update({
                    where: { id: bgCustomerId },
                    data: {
                      shopifyId: String(shopifyCustomer.id),
                      email: shopifyCustomer.email || undefined,
                      name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
                      phone: shopifyCustomer.phone || undefined,
                      ordersCount: shopifyCustomer.orders_count || 0,
                      totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
                    }
                  });
                } catch (e: any) {
                  // Handle unique constraint violation on shopifyId defensively
                  if (e.code === 'P2002' && (e.meta?.target?.includes('shopifyId') || JSON.stringify(e).includes('shopifyId'))) {
                    console.warn(`[AUTH-BG] Unique constraint on shopifyId for customer ${bgCustomerId}. Retrying sync without shopifyId...`);
                    await prisma.customer.update({
                      where: { id: bgCustomerId },
                      data: {
                        email: shopifyCustomer.email || undefined,
                        name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
                        phone: shopifyCustomer.phone || undefined,
                        ordersCount: shopifyCustomer.orders_count || 0,
                        totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
                      }
                    }).catch(err => console.error("[AUTH-BG] Retry sync failed:", err.message));
                  } else {
                    console.error("[AUTH-BG] Customer update error:", e.message || e);
                  }
                }

                // Import addresses
                if (shopifyCustomer.addresses && Array.isArray(shopifyCustomer.addresses)) {
                  for (const addr of shopifyCustomer.addresses) {
                    const a = addr as any;
                    const exists = await prisma.address.findFirst({
                      where: { customerId: bgCustomerId, address1: a.address1, city: a.city, zip: a.zip }
                    });
                    if (!exists) {
                      await prisma.address.create({
                        data: {
                          customerId: bgCustomerId,
                          name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || bgCustomerName || "User",
                          phone: a.phone || bgCustomerPhone || fullPhone,
                          address1: a.address1, address2: a.address2 || "",
                          city: a.city, state: a.province || "", zip: a.zip,
                          country: a.country || "India", isDefault: a.default || false
                        }
                      }).catch(console.error);
                    }
                  }
                }

                // Import orders
                try {
                  const shopifyOrders = await fetchOrdersByCustomerId(String(shopifyCustomer.id));
                  
                  // Fetch local products to build images and cuid lookup maps
                  const localProducts = await prisma.product.findMany({
                    select: { id: true, shopifyProductId: true, featuredImage: true }
                  });
                  const productImageMap = new Map<string, string>();
                  const productCuidMap = new Map<string, string>();
                  for (const lp of localProducts) {
                    if (lp.featuredImage) productImageMap.set(lp.shopifyProductId, lp.featuredImage);
                    productCuidMap.set(lp.shopifyProductId, lp.id);
                  }

                  for (const o of shopifyOrders) {
                    const dbOrder = await prisma.order.upsert({
                      where: { shopifyOrderId: String(o.id) },
                      create: {
                        shopId: shopId, shopifyOrderId: String(o.id), customerId: bgCustomerId,
                        status: 'active', totalPrice: parseFloat(o.total_price || '0'),
                        currency: o.currency || 'INR', paymentStatus: o.financial_status || 'pending',
                        fulfillmentStatus: o.fulfillment_status || 'unfulfilled', createdAt: new Date(o.created_at),
                      },
                      update: {
                        status: 'active', totalPrice: parseFloat(o.total_price || '0'),
                        paymentStatus: o.financial_status || 'pending',
                        fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                      }
                    });

                    // Sync Order Items
                    if (o.line_items && Array.isArray(o.line_items)) {
                      const shopifyItemIds = o.line_items.map((item: any) => String(item.id));
                      await prisma.orderItem.deleteMany({
                        where: {
                          orderId: dbOrder.id,
                          shopifyLineItemId: { notIn: shopifyItemIds }
                        }
                      }).catch(console.error);

                      for (const item of o.line_items) {
                        const shopifyProductId = item.product_id ? String(item.product_id) : null;
                        const dbProductId = shopifyProductId ? productCuidMap.get(shopifyProductId) : null;
                        const itemImage = shopifyProductId ? productImageMap.get(shopifyProductId) : null;

                        await prisma.orderItem.upsert({
                          where: { shopifyLineItemId: String(item.id) },
                          create: {
                            orderId: dbOrder.id,
                            shopifyLineItemId: String(item.id),
                            productId: dbProductId,
                            title: item.title,
                            quantity: item.quantity,
                            price: parseFloat(item.price || '0'),
                            sku: item.sku || null,
                            image: itemImage || null,
                          },
                          update: {
                            quantity: item.quantity,
                            price: parseFloat(item.price || '0'),
                            sku: item.sku || null,
                            image: itemImage || null,
                          }
                        }).catch(e => console.error("[AUTH-BG] Order item upsert error:", e.message));
                      }
                    }
                  }
                  console.log(`[AUTH-BG] Synced ${shopifyOrders.length} orders for customer ${bgCustomerId}`);
                } catch (orderErr) {
                  console.error("[AUTH-BG] Order sync error:", orderErr);
                }
              } catch (bgError: any) {
                console.error("[AUTH-BG] Background sync error:", bgError.message);
              }
            })();

            return {
              id: customer.id,
              name: customer.name ?? "User",
              email: customer.email ?? null,
              phone: customer.phone,
              image: getCustomerImageProxy(customer.id, (customer as any).image ?? null),
            };
          }

          // ── NEW USER PATH: No local customer found ──
          console.log(`[AUTH] New user path for ${fullPhone}`);

          // Search Shopify in parallel (all formats at once)
          let shopifyCustomer = null;
          try {
            const results = await Promise.all([
              searchCustomerByPhone(fullPhone).catch(() => null),
              searchCustomerByPhone(phoneDigits).catch(() => null),
              searchCustomerByPhone(normalizedPhone).catch(() => null),
            ]);
            shopifyCustomer = results.find(r => r !== null) || null;
            console.log(`[AUTH] Shopify Customer found: ${shopifyCustomer ? 'YES (ID: ' + shopifyCustomer.id + ')' : 'NO'}`);
          } catch (e: any) {
            console.error("[AUTH] Shopify search error:", e.message);
          }

          if (shopifyCustomer) {
            // Create/upsert local customer from Shopify data
            try {
              customer = await prisma.customer.upsert({
                where: { shopifyId: String(shopifyCustomer.id) },
                create: {
                  shopifyId: String(shopifyCustomer.id),
                  shopId: shopId,
                  email: shopifyCustomer.email,
                  name: providedName || `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || "User",
                  phone: shopifyCustomer.phone || fullPhone,
                  ordersCount: shopifyCustomer.orders_count || 0,
                  totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
                },
                update: {
                  email: shopifyCustomer.email || undefined,
                  name: providedName || `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
                  phone: shopifyCustomer.phone || undefined,
                  ordersCount: shopifyCustomer.orders_count,
                  totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
                }
              });

              // Background: sync addresses and orders
              const bgCustId = customer.id;
              const bgCustPhone = customer.phone;
              const bgCustName = customer.name;
              const bgShopifyCust = shopifyCustomer;
              (async () => {
                try {
                  // Import addresses
                  if (bgShopifyCust.addresses && Array.isArray(bgShopifyCust.addresses)) {
                    for (const addr of bgShopifyCust.addresses) {
                      const a = addr as any;
                      const exists = await prisma.address.findFirst({
                        where: { customerId: bgCustId, address1: a.address1, city: a.city, zip: a.zip }
                      });
                      if (!exists) {
                        await prisma.address.create({
                          data: {
                            customerId: bgCustId,
                            name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || bgCustName || "User",
                            phone: a.phone || bgCustPhone || fullPhone,
                            address1: a.address1, address2: a.address2 || "",
                            city: a.city, state: a.province || "", zip: a.zip,
                            country: a.country || "India", isDefault: a.default || false
                          }
                        }).catch(console.error);
                      }
                    }
                  }
                  // Import orders
                  const shopifyOrders = await fetchOrdersByCustomerId(String(bgShopifyCust.id));
                  
                  // Fetch local products to build images and cuid lookup maps
                  const localProducts = await prisma.product.findMany({
                    select: { id: true, shopifyProductId: true, featuredImage: true }
                  });
                  const productImageMap = new Map<string, string>();
                  const productCuidMap = new Map<string, string>();
                  for (const lp of localProducts) {
                    if (lp.featuredImage) productImageMap.set(lp.shopifyProductId, lp.featuredImage);
                    productCuidMap.set(lp.shopifyProductId, lp.id);
                  }

                  for (const o of shopifyOrders) {
                    const dbOrder = await prisma.order.upsert({
                      where: { shopifyOrderId: String(o.id) },
                      create: {
                        shopId: shopId, shopifyOrderId: String(o.id), customerId: bgCustId,
                        status: 'active', totalPrice: parseFloat(o.total_price || '0'),
                        currency: o.currency || 'INR', paymentStatus: o.financial_status || 'pending',
                        fulfillmentStatus: o.fulfillment_status || 'unfulfilled', createdAt: new Date(o.created_at),
                      },
                      update: {
                        status: 'active', totalPrice: parseFloat(o.total_price || '0'),
                        paymentStatus: o.financial_status || 'pending',
                        fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                      }
                    });

                    // Sync Order Items
                    if (o.line_items && Array.isArray(o.line_items)) {
                      const shopifyItemIds = o.line_items.map((item: any) => String(item.id));
                      await prisma.orderItem.deleteMany({
                        where: {
                          orderId: dbOrder.id,
                          shopifyLineItemId: { notIn: shopifyItemIds }
                        }
                      }).catch(console.error);

                      for (const item of o.line_items) {
                        const shopifyProductId = item.product_id ? String(item.product_id) : null;
                        const dbProductId = shopifyProductId ? productCuidMap.get(shopifyProductId) : null;
                        const itemImage = shopifyProductId ? productImageMap.get(shopifyProductId) : null;

                        await prisma.orderItem.upsert({
                          where: { shopifyLineItemId: String(item.id) },
                          create: {
                            orderId: dbOrder.id,
                            shopifyLineItemId: String(item.id),
                            productId: dbProductId,
                            title: item.title,
                            quantity: item.quantity,
                            price: parseFloat(item.price || '0'),
                            sku: item.sku || null,
                            image: itemImage || null,
                          },
                          update: {
                            quantity: item.quantity,
                            price: parseFloat(item.price || '0'),
                            sku: item.sku || null,
                            image: itemImage || null,
                          }
                        }).catch(e => console.error("[AUTH-BG] Order item upsert error:", e.message));
                      }
                    }
                  }
                  console.log(`[AUTH-BG] New user: synced ${shopifyOrders.length} orders for ${bgCustId}`);
                } catch (bgErr) {
                  console.error("[AUTH-BG] New user sync error:", bgErr);
                }
              })();
            } catch (syncError: any) {
              console.error("[AUTH] Shopify upsert error:", syncError.message);
            }
          }

          // Fallback: create a guest customer if nothing matched
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                phone: fullPhone,
                shopId: shopId,
                shopifyId: `otp_${Date.now()}`,
                name: providedName || "New User",
              },
            });
          }

          // Log success (non-blocking)
          prisma.appLogin.create({
            data: {
              phone: fullPhone,
              status: "ACCOUNT_CREATED",
              userAgent: providedUserAgent
            }
          }).catch(console.error);

          return {
            id: customer.id,
            name: customer.name ?? "User",
            email: customer.email ?? null,
            phone: customer.phone,
            image: getCustomerImageProxy(customer.id, (customer as any).image ?? null),
          };
        } catch (error: any) {
          console.error("[AUTH] OTP authorize error:", error);
          return null;
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
            name: customer.name ?? "User",
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            image: getCustomerImageProxy(customer.id, (customer as any).image ?? null),
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
          let user = await prisma.user.findUnique({
            where: { email },
          });

          // ── AUTO-SEED: Create the super-admin User if it doesn't exist yet ──
          // This ensures the admin account is always available after a fresh
          // deployment or database migration without requiring a manual seed step.
          if (!user && email === (process.env.SUPER_ADMIN_EMAIL || 'admin@zicabella.com').toLowerCase().trim()) {
            const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
            if (superAdminPassword) {
              console.log('[AUTH] Auto-seeding super-admin User record for', email);
              const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
              try {
                user = await prisma.user.create({
                  data: {
                    email,
                    passwordHash: hashedPassword,
                    name: 'Super Admin',
                    role: 'SUPER_ADMIN',
                    isActive: true,
                  },
                });
                console.log('[AUTH] Super-admin User created:', user.id);
              } catch (seedErr: any) {
                // Handle race condition: another request may have created it
                if (seedErr.code === 'P2002') {
                  user = await prisma.user.findUnique({ where: { email } });
                } else {
                  console.error('[AUTH] Failed to auto-seed admin:', seedErr.message);
                }
              }
            }
          }

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
              pages: p.pages,
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
    async jwt({ token, user, account }) {
      if (user) {
        // Default role
        let role = "CUSTOMER";
        let permissions = null;
        let phone = (user as any).phone ?? null;
        let id = user.id;
        let image = (user as any).image ?? null;
        let email = (user as any).email ?? null;

        // If OAuth login, match and get local DB customer details
        if (account && (account.provider === "google" || account.provider === "apple") && email) {
          const customer = await prisma.customer.findFirst({
            where: { email }
          });
          if (customer) {
            id = customer.id;
            phone = customer.phone || null;
            image = customer.image || null;
          }
        } else if ((user as any).role) {
          // If admin/staff login, preserve role and permissions
          role = (user as any).role;
          permissions = (user as any).permissions ?? null;
        }

        token.id = id;
        token.role = role;
        token.permissions = permissions;
        token.loginTime = Math.floor(Date.now() / 1000);
        token.needsPasswordChange = (user as any).needsPasswordChange ?? null;
        token.phone = phone;
        token.email = email;
        
        // Proxy and normalize image / picture to prevent large base64 strings in the token
        const proxiedImage = getCustomerImageProxy(id, image);
        token.image = proxiedImage;
        token.picture = proxiedImage;
      }

      // Safeguard: sanitize token properties on every execution (e.g. session/active checks)
      const customerId = token.id || token.sub;
      if (customerId) {
        for (const key of ['picture', 'image']) {
          const val = token[key];
          if (typeof val === 'string' && (val.startsWith('data:') || val.length > 2048)) {
            token[key] = `/api/customers/avatar?id=${customerId}`;
          }
        }
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
        (session.user as any).id = token.id ?? null;
        (session.user as any).role = token.role ?? "CUSTOMER";
        (session.user as any).permissions = token.permissions ?? null;
        (session.user as any).needsPasswordChange = token.needsPasswordChange ?? null;
        (session.user as any).phone = token.phone ?? null;
        (session.user as any).email = token.email || session.user.email || null;
        (session.user as any).image = token.image || session.user.image || null;
        
        // Populate session.customer object to match frontend usage
        (session as any).customer = {
          id: token.id ?? null,
          phone: token.phone ?? null,
          email: token.email || session.user.email || null,
          name: session.user.name ?? "User",
          image: token.image || session.user.image || null
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 28800, // 8 hours absolute limit
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
