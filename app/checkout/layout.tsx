import Script from "next/script";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
      <Script src="https://checkout.razorpay.com/v1/razorpay.js" strategy="afterInteractive" />
      {children}
    </>
  );
}
