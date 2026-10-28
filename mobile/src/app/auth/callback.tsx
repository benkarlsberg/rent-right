import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useURL } from "expo-linking";
import { exchangeGoogleCallback } from "@/google-auth";
import { useSession } from "@/session";
import { ErrorLine, H1, Page } from "@/ui";

/** Cold start from rentright://auth/callback. The in-app browser usually finishes first. */
export default function GoogleCallback() {
  const url = useURL();
  const { signIn } = useSession();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url || !url.includes("auth/callback")) return;
    let cancel = false;
    void exchangeGoogleCallback(url)
      .then(async (session) => {
        if (cancel) return;
        await signIn(session);
        router.replace("/");
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Could not sign in with Google.");
      });
    return () => {
      cancel = true;
    };
  }, [signIn, url]);

  return (
    <Page>
      <H1>Signing you in</H1>
      <ErrorLine message={error} />
    </Page>
  );
}
