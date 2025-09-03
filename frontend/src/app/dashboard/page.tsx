// src/app/dashboard/page.tsx
"use client";

import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";

console.log("Is Layout undefined?", Layout); // ✅ This should log a function, not undefined

export default function DashboardPage() {
  return (
    <Layout>
      <div className="flex flex-col gap-6 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Example summary cards */}
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">Today’s Reservations</p>
              <p className="text-2xl font-bold text-primary">14</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">Tables Occupied</p>
              <p className="text-2xl font-bold text-primary">6 / 20</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">Upcoming Schedule</p>
              <p className="text-2xl font-bold text-primary">3</p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder for more components */}
        <div className="mt-10">
          <p className="text-muted-foreground text-sm">
            More dashboard widgets coming soon...
          </p>
        </div>
      </div>
    </Layout>
  );
}
