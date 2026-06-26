export const DEFAULT_AVATAR_URL = "/avatars/hamster.png";

export const AVATAR_OPTIONS = [
  { id: "hamster", label: "Hamster", src: "/avatars/hamster.png" },
  { id: "panda", label: "Panda", src: "/avatars/panda.png" },
  { id: "corgi", label: "Corgi", src: "/avatars/corgi.png" },
  { id: "dino", label: "Dino", src: "/avatars/dino.png" },
  { id: "penguin", label: "Penguin", src: "/avatars/penguin.png" },
  { id: "bunny", label: "Bunny", src: "/avatars/bunny.png" },
  { id: "cat", label: "Cat", src: "/avatars/cat.png" },
  { id: "shiba", label: "Shiba", src: "/avatars/shiba.png" },
] as const;

const AVATAR_URLS = new Set<string>(AVATAR_OPTIONS.map((avatar) => avatar.src));

export function normalizeAvatarUrl(value?: string | null) {
  if (!value) return DEFAULT_AVATAR_URL;
  return AVATAR_URLS.has(value) ? value : DEFAULT_AVATAR_URL;
}

export function pickRandomAvatarUrl() {
  const index = Math.floor(Math.random() * AVATAR_OPTIONS.length);
  return AVATAR_OPTIONS[index]?.src ?? DEFAULT_AVATAR_URL;
}
