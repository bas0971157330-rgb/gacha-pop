import { AuthPage } from "@/components/AuthPage";
import { Navbar } from "@/components/Navbar";

export default function ForgotPasswordRoute() {
  return (
    <>
      <Navbar />
      <AuthPage mode="forgot" />
    </>
  );
}
