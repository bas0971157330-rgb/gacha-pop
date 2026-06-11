import { Suspense } from "react";
import { GachaMenuPage } from "@/components/GachaMenuPage";

export default function GachaPage() {
  return (
    <Suspense fallback={null}>
      <GachaMenuPage />
    </Suspense>
  );
}
