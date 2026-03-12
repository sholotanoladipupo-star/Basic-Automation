export const metadata = {
  title: "SRE Automation Tracker",
  description: "Card Payment SRE — Automation Initiatives",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
