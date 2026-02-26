import React from "react";
import { Link } from "react-router-dom";

import OfficeSimulation from "@/components/office-simulation";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OfficeDataProvider } from "@/providers/office-data-provider";

export function OfficePage(): React.JSX.Element {
  return (
    <main className="w-[100dvw] h-[100dvh] relative">
      <OfficeDataProvider>
        <SidebarProvider defaultOpen={false}>
          <SidebarInset className="h-[100dvh]">
            <OfficeSimulation />
          </SidebarInset>
        </SidebarProvider>
      </OfficeDataProvider>
    </main>
  );
}
