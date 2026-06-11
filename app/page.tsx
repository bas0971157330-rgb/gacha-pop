import { Hero } from "@/components/Hero";
import { HomePromoPopup } from "@/components/HomePromoPopup";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <HomePromoPopup />
      <Hero />
    </>
  );
}
