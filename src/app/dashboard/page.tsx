import { LogoutButton } from "./logout-button";

export default function DashboardPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <LogoutButton />
      </div>
    </main>
  );
}
