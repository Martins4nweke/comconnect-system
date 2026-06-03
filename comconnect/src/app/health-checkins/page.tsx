"use client";

import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";

export default function Page() {
  return <LargeTableClient config={tableConfigs.observations} />;
}

