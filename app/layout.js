export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <title>Melpud - Operational & Consignment Management System</title>
      </head>
      <body className="bg-zinc-50 text-zinc-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
