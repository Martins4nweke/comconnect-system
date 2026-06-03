import "./globals.css";

export const metadata = {
  title: "ComConnect",
  description: "Multichannel health communication and participant engagement platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}