"use client";

import { useState } from "react";

type ExpiredCopy = {
  email: string;
  placeholder: string;
  send: string;
  sending: string;
  sentTitle: string;
  sentBody: string;
};

export function ExpiredForm({ text }: { text: ExpiredCopy }) {
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
        <p className="mt-6 text-xl font-semibold text-[#14343C]">{text.sentTitle}</p>
        <p className="mt-2 text-[15px] leading-6 text-[#3D5A62]">{text.sentBody} {email.trim()}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 text-left">
      <label htmlFor="email" className="text-sm font-semibold text-[#14343C]">{text.email}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        placeholder={text.placeholder}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 min-h-12 rounded-xl"
        style={{ borderColor: "#6B8086", borderRadius: 12, minHeight: 48 }}
      />
      <button className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0B5C6E] px-4 text-base font-bold text-white disabled:opacity-55" type="submit" disabled={busy || !email.trim()}>
        {busy ? text.sending : text.send}
      </button>
      {error ? <p className="note-clay mt-4" role="alert">{error}</p> : null}
    </form>
  );
}
