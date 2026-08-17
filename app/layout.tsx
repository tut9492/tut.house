import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "Official website of Tut (@Tuteth_), a digital artist. Explore original digital and physical art, the collections, and the collector leaderboard. An art portfolio — not a store; it never asks for passwords or payment details.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tut.house"),
  title: {
    default: "Tut — Digital Artist | tut.house",
    template: "%s | tut.house",
  },
  description: SITE_DESCRIPTION,
  applicationName: "tut.house",
  authors: [{ name: "Tut", url: "https://x.com/Tuteth_" }],
  creator: "Tut",
  publisher: "Tut",
  keywords: ["Tut", "digital artist", "art portfolio", "NFT art", "art collector", "tut.house", "Tuteth_"],
  alternates: { canonical: "https://www.tut.house/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://www.tut.house/",
    siteName: "tut.house",
    title: "Tut — Digital Artist",
    description: SITE_DESCRIPTION,
    images: [{ url: "/assets/images/tutWebsiteWallpaper.png", alt: "Tut — digital artist" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Tuteth_",
    creator: "@Tuteth_",
    title: "Tut — Digital Artist",
    description: SITE_DESCRIPTION,
    images: ["/assets/images/tutWebsiteWallpaper.png"],
  },
};

// Structured data so crawlers (and the Safe Browsing reviewer) can see this is a real artist's
// portfolio with a verifiable identity — a strong legitimacy signal against a false "deceptive" flag.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://www.tut.house/#tut",
      name: "Tut",
      alternateName: "@Tuteth_",
      url: "https://www.tut.house/",
      jobTitle: "Digital Artist",
      sameAs: ["https://x.com/Tuteth_"],
    },
    {
      "@type": "WebSite",
      "@id": "https://www.tut.house/#website",
      url: "https://www.tut.house/",
      name: "tut.house",
      description: SITE_DESCRIPTION,
      publisher: { "@id": "https://www.tut.house/#tut" },
    },
  ],
};

// Visually hidden, but present for assistive tech and crawlers — same content for everyone (not cloaking).
const srOnly: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <h1 style={srOnly}>Tut — Digital Artist · official art portfolio &amp; collector hub</h1>
        <noscript>
          <h2>Tut — Digital Artist</h2>
          <p>
            This is the official website of Tut (@Tuteth_), a digital artist. It showcases Tut&apos;s
            original digital and physical art, the collections, and a leaderboard of collectors. It is
            an art portfolio — it does not sell software, collect passwords, or ask for payment details.
          </p>
          <p>
            Find Tut on X at <a href="https://x.com/Tuteth_">@Tuteth_</a>. Security contact:{" "}
            <a href="https://www.tut.house/.well-known/security.txt">security.txt</a>.
          </p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
