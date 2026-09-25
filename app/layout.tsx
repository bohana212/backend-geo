export const metadata = {
  title: "Geotama Backend API",
  description: "Telegram backend API"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body style={{fontFamily:"system-ui",padding:32}}>{children}</body></html>;
}