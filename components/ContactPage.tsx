import { ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const contactLinks = [
  {
    title: "ติดต่อผ่าน Facebook",
    description: "ทักข้อความเพจเพื่อสอบถามข้อมูล",
    display: "@GachaPopOffcial",
    href: "https://www.facebook.com/GachaPopOffcial/",
    icon: "f",
    tone: "facebook",
  },
  {
    title: "ติดต่อผ่าน Discord",
    description: "เข้าร่วมเซิร์ฟเวอร์เพื่อพูดคุยและรับข่าวสาร",
    display: "discord.gg/VpnTyzcWBf",
    href: "https://discord.gg/VpnTyzcWBf",
    icon: "D",
    tone: "discord",
  },
] as const;

export function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="contact-page">
        <div className="contact-float contact-float-a" />
        <div className="contact-float contact-float-b" />
        <div className="contact-float contact-float-c" />
        <Sparkles className="contact-sparkle contact-sparkle-a" size={32} />
        <Sparkles className="contact-sparkle contact-sparkle-b" size={26} />
        <Sparkles className="contact-sparkle contact-sparkle-c" size={22} />

        <section className="contact-hero" aria-labelledby="contact-title">
          <div className="contact-kicker">
            <Sparkles size={22} />
            <h1 id="contact-title">ช่องทางการติดต่อ</h1>
            <Sparkles size={22} />
          </div>
          <p className="contact-subtitle">Contact</p>
          <p className="contact-description">
            สามารถติดต่อสอบถามข้อมูล หรือแจ้งปัญหาการใช้งานได้ผ่านช่องทางด้านล่างนี้
          </p>
        </section>

        <section className="contact-card-list" aria-label="ช่องทางติดต่อ Gacha Pop">
          {contactLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="contact-link-card"
            >
              <span className={`contact-channel-icon contact-channel-${item.tone}`} aria-hidden="true">
                {item.icon}
              </span>
              <span className="contact-link-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <em>{item.display}</em>
              </span>
              <ChevronRight className="contact-link-arrow" size={34} aria-hidden="true" />
            </a>
          ))}
        </section>

        <div className="contact-bottom-wave" aria-hidden="true" />
        <MessageCircle className="contact-helper-icon" size={28} aria-hidden="true" />
      </main>
    </>
  );
}
