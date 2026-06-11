import { AuthPage } from "@/components/AuthPage";
import { Navbar } from "@/components/Navbar";

export default function RegisterRoute() {
  return (
    <>
      <Navbar />
      <AuthPage mode="register" />
    </>
  );
}
