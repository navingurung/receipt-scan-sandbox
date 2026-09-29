import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Receipt Scan Sandbox | SAMURAI TAX",
  description: "Receipt scanning sandbox for SAMURAI TAX",
};

// viewport-fit=cover: ノッチ・ホームバー領域まで描画し、safe-area で余白を確保する
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#164d86",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
     <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
