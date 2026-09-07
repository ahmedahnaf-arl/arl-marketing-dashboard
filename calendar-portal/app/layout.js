import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "AKIJ Growth Calendar — Marketing, BD & Growth Portal",
  description:
    "Live calendar portal to input campaign plans and view the analytics dashboard for AKIJ Resource Marketing, Business Development & Growth (FY 2026-27).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
