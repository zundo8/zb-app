/**
 * Type definitions for react-native-customui (Razorpay Custom UI SDK)
 * Provides direct payment method control without Razorpay's native checkout sheet.
 */
declare module 'react-native-customui' {
  export interface UPIApp {
    app_name: string;
    app_icon: string; // base64 encoded PNG
    package_name: string;
  }

  export interface PaymentResult {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayCustomUI {
    /**
     * Opens the payment flow directly — no Razorpay checkout sheet.
     * The options.method field determines which payment method is used.
     */
    open(options: Record<string, any>): Promise<PaymentResult>;

    /**
     * Returns a list of UPI apps installed on the user's device.
     * Only works on real devices (not emulators/simulators).
     */
    getAppsWhichSupportUPI(callback: (apps: UPIApp[]) => void): void;
  }

  const Razorpay: RazorpayCustomUI;
  export default Razorpay;
}
