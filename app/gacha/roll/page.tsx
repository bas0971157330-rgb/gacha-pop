import { Suspense } from "react";
import { GachaRollPage } from "@/components/GachaRollPage";

export default function GachaRollRoute() {
  return (
    <Suspense fallback={null}>
      <GachaRollPage />
    </Suspense>
  );
}
