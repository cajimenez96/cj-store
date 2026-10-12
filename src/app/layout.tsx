import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header, Footer } from "@/components/layout";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { connectToDatabase } from "@/lib/db";
import Settings from "@/models/Settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let title = "The Point | Perfumes Importados & Fragancias Exclusivas";
  let description =
    "Catálogo exclusivo de perfumes importados y fragancias de autor en The Point. Comprá online con atención personalizada por WhatsApp y envíos a todo el país.";
  let keywords =
    "perfumes, fragancias, perfumes importados, the point, diseñador, decants, hombre, mujer, unisex";
  let storeName = "The Point";

  try {
    await connectToDatabase();
    const settings = await Settings.findOne({}).lean();
    if (settings) {
      if (settings.metaTitle) title = settings.metaTitle;
      if (settings.metaDescription) description = settings.metaDescription;
      if (settings.metaKeywords) keywords = settings.metaKeywords;
      if (settings.storeName) storeName = settings.storeName;
    }
  } catch (error) {
    console.error("Error cargando metadatos dinámicos de Settings:", error);
  }

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      siteName: storeName,
      locale: "es_AR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#111111]">
        <Toaster />
        <SettingsProvider>
          <CartProvider>
            <Suspense fallback={<div className="h-16 bg-white border-b border-[#e5e5e5]" />}>
              <Header />
            </Suspense>
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
