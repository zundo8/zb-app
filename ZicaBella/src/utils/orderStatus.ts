/**
 * Maps internal/Shopify order and delivery statuses to clean, user-friendly labels.
 * If status is not in the recognized list, it defaults to "Processing".
 */
export function getOrderStatusLabel(status: string | null | undefined): string {
  if (!status) return "Processing";
  
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    // Order Placed
    case 'confirmed':
    case 'placed':
    case 'open':
      return 'Order Placed';

    // Processing
    case 'processing':
    case 'in_progress':
    case 'ready_for_production':
    case 'cutting':
    case 'stitching':
    case 'printing':
    case 'embroidery':
    case 'wash':
    case 'returned (internal)':
    case 'quality_check':
      return 'Processing';

    // Ready for Dispatch
    case 'ready_for_dispatch':
    case 'ready for dispatch':
      return 'Ready for Dispatch';

    // Shipped / Out for Delivery
    case 'shipped':
    case 'out_for_delivery':
    case 'fulfillment: in_transit':
      return 'Shipped / Out for Delivery';

    // Delivered
    case 'delivered':
    case 'fulfillment: delivered':
      return 'Delivered';

    // Return / Exchange Requested
    case 'return_requested':
    case 'exchange_requested':
    case 'return/exchange':
      return 'Return / Exchange Requested';

    // Cancelled
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';

    default:
      return 'Processing';
  }
}

/**
 * Gets the order's position in the user-facing progress journey.
 * Returns a number from 0 to 4 representing:
 * 0: Order Placed
 * 1: Processing
 * 2: Ready for Dispatch
 * 3: Shipped / Out for Delivery
 * 4: Delivered
 * Returns -1 for Cancelled or Return / Exchange states where the progress bar should be hidden.
 */
export function getOrderStatusProgressStep(status: string | null | undefined): number {
  const label = getOrderStatusLabel(status);
  
  if (label === 'Cancelled' || label === 'Return / Exchange Requested') {
    return -1;
  }
  
  switch (label) {
    case 'Order Placed':
      return 0;
    case 'Processing':
      return 1;
    case 'Ready for Dispatch':
      return 2;
    case 'Shipped / Out for Delivery':
      return 3;
    case 'Delivered':
      return 4;
    default:
      return 1; // Default to Processing
  }
}
