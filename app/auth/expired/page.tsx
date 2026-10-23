import { headers } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ExpiredForm } from "./form";

const copy = {
  en: {
    heading: "Log in or sign up",
    expired: "This link has expired, enter your email to get a new one",
    other: "Enter your email to get a new one",
    tagline: "Keep your rental records and talk to your landlord, all in one place.",
    email: "Email address",
    placeholder: "you@email.com",
    send: "Email me a sign-in link",
    sending: "Sending the link…",
    sentTitle: "Check your inbox",
    sentBody: "The link works for 30 minutes. It was sent to",
    haveCode: "I have a sign-in code",
    or: "OR",
    google: "Continue with Google",
    legalBefore: "By continuing, you agree to our",
    terms: "Terms of use",
    legalMid: "and",
    privacy: "Privacy policy",
    disclaimer: "General information, not legal advice. Rent Right is not a law firm.",
  },
  es: {
    heading: "Inicie sesión o regístrese",
    expired: "Este enlace venció. Escriba su correo para recibir uno nuevo.",
    other: "Escriba su correo para recibir uno nuevo.",
    tagline: "Guarde sus registros de renta y hable con su propietario, todo en un solo lugar.",
    email: "Correo electrónico",
    placeholder: "usted@correo.com",
    send: "Enviarme un enlace para entrar",
    sending: "Enviando el enlace…",
    sentTitle: "Revise su bandeja",
    sentBody: "El enlace funciona por 30 minutos. Se envió a",
    haveCode: "Tengo un código de acceso",
    or: "O",
    google: "Continuar con Google",
    legalBefore: "Al continuar, acepta nuestros",
    terms: "Términos de uso",
    legalMid: "y la",
    privacy: "Política de privacidad",
    disclaimer: "Información general, no es asesoramiento legal. Rent Right no es un bufete.",
  },
} as const;

export default async function ExpiredLinkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const language = (await headers()).get("accept-language") || "";
  const text = /^es\b/i.test(language) ? copy.es : copy.en;
  const detail = params.error?.slice(0, 300) || "";
  const friendly = !detail || /invalid or expired/i.test(detail);
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-[#E6F0EE] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl bg-white px-7 pb-7 pt-8 text-center shadow-[0_10px_30px_rgba(20,52,60,0.12)]">
          <div className="flex justify-center">
            <Logo height={56} />
          </div>
          <h1 className="mt-5 text-[22px] font-bold leading-7 text-[#14343C]">{text.heading}</h1>
          <p className="mt-2 text-[15px] leading-6 text-[#3D5A62]">{friendly ? text.expired : text.other}</p>
          <p className="mt-2 text-[15px] leading-6 text-[#3D5A62]">{text.tagline}</p>
          {friendly ? null : <p className="note-clay mt-4 text-left" role="alert">{detail}</p>}
          <ExpiredForm text={text} />
          <Link href="/?code=1" className="mt-3 inline-flex min-h-[44px] items-center justify-center text-[15px] font-semibold" style={{ color: "#0B5C6E" }}>
            {text.haveCode}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#C5D4D6]" />
            <span className="text-xs font-bold tracking-wide text-[#3D5A62]">{text.or}</span>
            <span className="h-px flex-1 bg-[#C5D4D6]" />
          </div>
          <Link href="/auth/google" className="mt-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#747775] bg-white px-4 text-base font-semibold" style={{ color: "#1F1F1F" }}>
            <GoogleMark />
            {text.google}
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-[18px] text-[#3D5A62]">
          {text.legalBefore}{" "}
          <Link className="font-semibold underline" style={{ color: "#0B5C6E" }} href="/terms">{text.terms}</Link>
          {" "}{text.legalMid}{" "}
          <Link className="font-semibold underline" style={{ color: "#0B5C6E" }} href="/privacy">{text.privacy}</Link>.
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-center text-xs leading-[18px] text-[#3D5A62]">{text.disclaimer}</p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
