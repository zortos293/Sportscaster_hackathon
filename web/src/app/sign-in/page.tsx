import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordAuthForm } from "@/components/PasswordAuthForm";
import { isConvexAuthEnabled } from "@/lib/env";

const logoSrc =
  "https://assets.ui.sh/marks/1.svg?text=Sportscaster&color=emerald-600&textColor=neutral-950&font=inter";

export default function SignInPage() {
  if (!isConvexAuthEnabled()) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="px-6 py-6 lg:px-8">
        <Link href="/" aria-label="Homepage">
          <img src={logoSrc} alt="Sportscaster" className="h-6 w-auto" />
        </Link>
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <PasswordAuthForm
          flow="signIn"
          title="Welcome back"
          description="Sign in to manage your Sportscaster sessions and listen to live AI commentary."
          alternateHref="/sign-up"
          alternateLabel="Need an account?"
        />
      </main>
    </div>
  );
}
