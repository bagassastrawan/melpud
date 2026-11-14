import './globals.css';

export const metadata = {
  title: 'Melpud - Operational & Consignment Management System',
  description: 'Consignment & Operations Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-zinc-50 text-zinc-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
