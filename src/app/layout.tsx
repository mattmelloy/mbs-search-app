import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from 'next/link'; // Import Link for navigation
import "./globals.css"; // Ensure Tailwind CSS is imported

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MBS Data Search",
  description: "Search Australian Medicare Benefits Schedule (MBS) data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-100 text-gray-900`}>
        <header className="bg-white shadow-sm">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
            <Link href="/" className="text-xl font-semibold text-indigo-600 hover:text-indigo-700">
              MBS Search
            </Link>
            <div className="space-x-4">
              <Link href="/" className="text-gray-700 hover:text-indigo-600">
                Item Search
              </Link>
              <Link href="/specialist-fee-estimate" className="text-gray-700 hover:text-indigo-600">
                Fee Estimator
              </Link>
            </div>
          </nav>
        </header>
        <main className="container mx-auto p-4 mt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
