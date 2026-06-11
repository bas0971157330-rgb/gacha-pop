import { AuthPage } from "@/components/AuthPage";
import { Navbar } from "@/components/Navbar";

export default function LoginRoute() {
  return (
    <>
      <Navbar />
      <AuthPage mode="login" />
    </>
  );
}
