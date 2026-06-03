export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">{children}</div>
    </main>
  );
}
