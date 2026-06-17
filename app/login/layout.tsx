export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#000', minHeight: '100dvh' }}>
      {children}
    </div>
  );
}
