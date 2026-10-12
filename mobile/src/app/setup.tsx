import { router } from "expo-router";
import { useState } from "react";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { Button, ErrorLine, Field, H1, Muted, Page } from "@/ui";

export default function Setup() {
  const { token, signIn } = useSession();
  const [street, setStreet] = useState("");
  const [unitNumber, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostal] = useState("");
  const [landlordName, setLandlord] = useState("");
  const [landlordEmail, setEmail] = useState("");
  const [rent, setRent] = useState("");
  const [error, setError] = useState("");

  async function save() {
    try {
      setError("");
      const session = await api<Me>("unit", {
        token,
        body: { street, unitNumber, city, landlordName, landlordEmail, rent, jurisdiction: "unsure", postalCode, region: "CA" },
      });
      await signIn(session);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Page>
      <H1>Your place</H1>
      <Muted>Anywhere in California.</Muted>
      <ErrorLine message={error} />
      <Field label="Street" value={street} onChange={setStreet} />
      <Field label="Unit" value={unitNumber} onChange={setUnit} />
      <Field label="City" value={city} onChange={setCity} placeholder="Oakland" />
      <Field label="ZIP" value={postalCode} onChange={setPostal} placeholder="94612" />
      <Field label="Landlord" value={landlordName} onChange={setLandlord} />
      <Field label="Landlord email" value={landlordEmail} onChange={setEmail} />
      <Field label="Monthly rent" value={rent} onChange={setRent} placeholder="2150" />
      <Button label="Save" onPress={save} />
    </Page>
  );
}
