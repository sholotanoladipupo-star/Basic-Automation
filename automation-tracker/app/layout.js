import Nav from "@/components/Nav";

export const metadata = {
  title: "SRE Ops — Card Payment",
  description: "Card Payment SRE — Automation Initiatives & Manual Tasks",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
