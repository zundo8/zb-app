import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth/rbac";
import { shopifyGraphqlFetch, fetchProductById } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSuperAdmin();
    const orderId = params.id;

    const body = await req.json();
    const { oldShopifyLineItemId, newVariantId, quantity = 1 } = body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.shopifyOrderId) {
      // Order exists only locally (not yet pushed to Shopify)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          shopifySyncStatus: "synced",
          shopifySyncError: null
        }
      });
      return NextResponse.json({
        success: true,
        message: "Order is local-only; updated locally and ready for future Shopify sync."
      });
    }

    // Shopify GID format
    const shopifyOrderGid = order.shopifyOrderId.startsWith("gid://")
      ? order.shopifyOrderId
      : `gid://shopify/Order/${order.shopifyOrderId.replace("#", "")}`;

    let cleanVariantId = String(newVariantId || "");
    const isNumericGid = /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(cleanVariantId);

    if (!isNumericGid) {
      const rawDigits = cleanVariantId.replace(/\D/g, "");
      if (rawDigits.length >= 8) {
        cleanVariantId = `gid://shopify/ProductVariant/${rawDigits}`;
      } else {
        // Resolve numeric variant GID from Shopify product
        try {
          const firstItem = order.items[0];
          const dbProduct = firstItem?.productId
            ? await prisma.product.findFirst({
                where: {
                  OR: [
                    { id: firstItem.productId },
                    { shopifyProductId: firstItem.productId }
                  ]
                }
              })
            : null;

          const shopifyProdId = dbProduct?.shopifyProductId || firstItem?.productId;
          if (shopifyProdId) {
            const cleanSpId = String(shopifyProdId).replace(/^gid:\/\/shopify\/Product\//, '');
            const sp = await fetchProductById(cleanSpId);
            if (sp && sp.variants && sp.variants.length > 0) {
              const sizeQuery = cleanVariantId.split("-").pop() || cleanVariantId;
              const matchingVar = sp.variants.find((v: any) =>
                String(v.id) === cleanVariantId ||
                String(v.title).toUpperCase() === sizeQuery.toUpperCase() ||
                String(v.option1).toUpperCase() === sizeQuery.toUpperCase() ||
                String(v.sku).toUpperCase() === cleanVariantId.toUpperCase()
              );
              if (matchingVar) {
                cleanVariantId = `gid://shopify/ProductVariant/${matchingVar.id}`;
              } else if (sp.variants.length > 0) {
                cleanVariantId = `gid://shopify/ProductVariant/${sp.variants[0].id}`;
              }
            }
          }
        } catch (resolveErr) {
          console.warn("[Shopify Variant Resolution] Could not resolve numeric variant ID:", resolveErr);
        }
      }
    }

    try {
      // 1. orderEditBegin
      const beginRes: any = await shopifyGraphqlFetch(`
        mutation orderEditBegin($id: ID!) {
          orderEditBegin(id: $id) {
            calculatedOrder {
              id
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, { id: shopifyOrderGid });

      const userErrors = beginRes?.orderEditBegin?.userErrors || [];
      if (userErrors.length > 0) {
        throw new Error(userErrors.map((e: any) => e.message).join(", "));
      }

      const calculatedOrder = beginRes?.orderEditBegin?.calculatedOrder;
      if (!calculatedOrder?.id) {
        throw new Error("Failed to begin order edit on Shopify");
      }

      const calculatedOrderId = calculatedOrder.id;

      // Find calculated line item to remove/update
      const calcLineItemEdges = calculatedOrder.lineItems?.edges || [];
      let calcLineItemId = oldShopifyLineItemId;
      
      const matchingEdge = calcLineItemEdges.find((edge: any) => {
        const node = edge.node;
        return node.id === oldShopifyLineItemId || node.id.includes(oldShopifyLineItemId);
      });

      if (matchingEdge) {
        calcLineItemId = matchingEdge.node.id;
      } else if (calcLineItemEdges.length > 0) {
        // Fallback to first line item if single item order
        calcLineItemId = calcLineItemEdges[0].node.id;
      }

      // 2. orderEditSetQuantity (set to 0 to remove old item)
      if (calcLineItemId) {
        const setQtyRes: any = await shopifyGraphqlFetch(`
          mutation orderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!) {
            orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) {
              calculatedOrder {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `, { id: calculatedOrderId, lineItemId: calcLineItemId, quantity: 0 });

        const setQtyErrors = setQtyRes?.orderEditSetQuantity?.userErrors || [];
        if (setQtyErrors.length > 0) {
          console.warn("[Shopify OrderEdit] setQuantity error (non-fatal):", setQtyErrors);
        }
      }

      // 3. orderEditAddVariant (add new variant)
      if (cleanVariantId) {
        const addVariantRes: any = await shopifyGraphqlFetch(`
          mutation orderEditAddVariant($id: ID!, $variantId: ID!, $quantity: Int!) {
            orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity) {
              calculatedOrder {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `, { id: calculatedOrderId, variantId: cleanVariantId, quantity: Number(quantity) || 1 });

        const addErrors = addVariantRes?.orderEditAddVariant?.userErrors || [];
        if (addErrors.length > 0) {
          throw new Error(`Add variant failed: ${addErrors.map((e: any) => e.message).join(", ")}`);
        }
      }

      // 4. orderEditCommit
      const commitRes: any = await shopifyGraphqlFetch(`
        mutation orderEditCommit($id: ID!, $notifyCustomer: Boolean, $staffNote: String) {
          orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
            order {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        id: calculatedOrderId,
        notifyCustomer: false,
        staffNote: `Line item variant corrected by Super Admin (${session?.user?.email || "Super Admin"})`
      });

      const commitErrors = commitRes?.orderEditCommit?.userErrors || [];
      if (commitErrors.length > 0) {
        throw new Error(`Commit edit failed: ${commitErrors.map((e: any) => e.message).join(", ")}`);
      }

      // Mark order SYNCED in local DB
      await prisma.order.update({
        where: { id: orderId },
        data: {
          shopifySyncStatus: "synced",
          shopifySyncError: null
        }
      });

      return NextResponse.json({
        success: true,
        message: "Shopify order line item successfully updated and committed."
      });
    } catch (shopifyErr: any) {
      console.error("[Shopify OrderEdit Error]:", shopifyErr.message);

      // On failure: mark SYNC FAILED with exact error message (DO NOT silently mask)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          shopifySyncStatus: "failed",
          shopifySyncError: `Shopify sync error: ${shopifyErr.message}`
        }
      });

      return NextResponse.json({
        success: false,
        error: `Shopify Sync Failed: ${shopifyErr.message}. Local DB state saved.`
      }, { status: 500 });
    }
  } catch (error: any) {
    return handleAuthError(error);
  }
}
