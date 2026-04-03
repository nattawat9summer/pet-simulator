export const metadata = {
  title: 'PET Simulator',
  description: 'PET Blow Heat Simulator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
