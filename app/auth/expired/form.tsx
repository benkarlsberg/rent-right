"use client";

import { useState } from "react";

export function ExpiredForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const response = await fetch("/api/v1/auth/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; sent?: boolean } | null;
      if (!response.ok) throw new Error(body?.error || "Could not send the link.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <p className="mt-6 text-xl font-semibold">Check your inbox</p>
        <p className="mt-2 text-mute">The link works for 30 minutes. It was sent to {email.trim()}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        placeholder="you@email.com"
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className="btn btn-primary mt-4 w-full" type="submit" disabled={busy || !email.trim()}>
        {busy ? "Sending the link…" : "Email me a sign-in link"}
      </button>
      {error ? <p className="note-clay mt-4" role="alert">{error}</p> : null}
    </form>
  );
}
