export type Rarity = "Common" | "Rare" | "Super Rare";
export type ProductType = "sale" | "random";
export type ProductBadge = "popular" | "new" | "ending";

export type ProductDropItem = {
  id: string;
  name: string;
  image: string;
  quantity: number;
};

export type GachaItem = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  remaining: number;
  category: string;
  type?: ProductType;
  description?: string;
  dropItems?: ProductDropItem[];
  status?: "open" | "closed";
  badge?: "NEW" | "HOT" | "LIMITED";
  badges?: ProductBadge[];
  pinned?: boolean;
  discountDisabled?: boolean;
  theme: "pink" | "blue" | "purple" | "green";
  mascot: string;
  coverImage?: string;
  images?: string[];
  popular?: boolean;
  isNew?: boolean;
  limited?: boolean;
};

export type Prize = {
  name: string;
  rarity: Rarity;
  color: string;
};

export const gachas: GachaItem[] = [
  {
    id: "onemutan-chainsaw-man",
    name: "Onemutan Chainsaw Man",
    subtitle: "Collection",
    price: 59,
    remaining: 45,
    category: "gachapon",
    badge: "HOT",
    theme: "blue",
    mascot: "Chainsaw Man",
    coverImage: "/gacha-onemutan-chainsaw-man.png",
    popular: true,
  },
  {
    id: "onemutan-jujutsu-kaisen",
    name: "Onemutan Jujutsu Kaisen",
    subtitle: "Collection",
    price: 69,
    remaining: 38,
    category: "gachapon",
    theme: "purple",
    mascot: "Jujutsu Kaisen",
    coverImage: "/gacha-onemutan-jujutsu-kaisen.jpg",
    popular: true,
  },
  {
    id: "onemutan-vigilante-my-hero-academia",
    name: "Onemutan Vigilante -My Hero Academia",
    subtitle: "Collection",
    price: 99,
    remaining: 15,
    category: "gachapon",
    badge: "LIMITED",
    theme: "green",
    mascot: "My Hero Academia",
    coverImage: "/gacha-onemutan-vigilante-my-hero-academia.jpg",
    limited: true,
  },
];

export const prizes: Prize[] = [
  { name: "พวงกุญแจจิ๋ว", rarity: "Common", color: "from-sky-300 to-cyan-200" },
  { name: "สติกเกอร์คอลเลกชัน", rarity: "Common", color: "from-pink-200 to-violet-200" },
  { name: "ฟิกเกอร์ตัวพิเศษ", rarity: "Rare", color: "from-fuchsia-400 to-pink-300" },
  { name: "ฟิกเกอร์โฮโลแกรม", rarity: "Super Rare", color: "from-amber-300 to-pink-400" },
];
