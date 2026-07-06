import type { Metadata } from "next";
import "./globals.css";
import { Inter, Fraunces } from "next/font/google";

// Root layout MÍNIMO. Este deploy é só o BACKEND da automação de Instagram
// @umpaisdemerda (rotas /api/*: geração de copy, /api/og, insights, publicação).
// NÃO é um site de marca — por isso: sem componentes de site, marca neutra e
// noindex (nada aqui deve ser indexado). O clone trazia o site do Dr. Libertad;
// removido em 2026-07-05 (decisão do dono: "só a automação").

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Um País de Merda — automação",
  description: "Backend da automação de Instagram @umpaisdemerda.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${fraunces.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-ink text-offwhite antialiased">{children}</body>
    </html>
  );
}
