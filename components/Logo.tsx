import Image from "next/image";

export function Logo() {
  return (
    <Image
      src="/navbar-logo.png"
      alt="Gacha Pop"
      width={1129}
      height={1122}
      priority
      className="h-[46px] w-auto sm:h-[64px] lg:h-[76px]"
    />
  );
}
