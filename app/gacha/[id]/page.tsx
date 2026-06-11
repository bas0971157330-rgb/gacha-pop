import { GachaDetailPage } from "@/components/GachaDetailPage";
import { Navbar } from "@/components/Navbar";
import { gachas } from "@/data/gacha";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GachaDetailRoute({ params }: PageProps) {
  const { id } = await params;
  const gacha = gachas.find((item) => item.id === id);

  return (
    <>
      <Navbar />
      <GachaDetailPage gachaId={id} initialGacha={gacha} />
    </>
  );
}
