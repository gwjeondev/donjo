import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "회원가입" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
