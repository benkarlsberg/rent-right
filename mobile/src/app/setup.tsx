import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { setSkippedSetup } from "@/setup-later";
import { refreshBootstrap } from "@/tab-cache";
import { colors } from "@/theme";
import { Address, LabeledAddress } from "@/address";
import { Button, ErrorLine, Field, H1, Muted, Page } from "@/ui";

type Suggestion = { label: string; street: string; city: string; region: string; postalCode: string; unit?: string };
type Kept = { street: string; unit: string; city: string; region: string; postalCode: string };
type PlaceResult = {
  summary: string;
  inCalifornia: boolean;
  covered?: boolean;
  state?: string | null;
  suggestion: Suggestion | null;
  differs?: boolean;
  jurisdiction?: string;
  kept?: Kept;
};

const STEPS = 4;

function usZip(value: string): boolean {
  return /^\d{5}$/.test(value);
}

export default function Setup() {
  const { token, me, signIn } = useSession();
  const es = me?.user.locale === "es";
  const [step, setStep] = useState(0);
  const [street, setStreet] = useState("");
  const [unitNumber, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostal] = useState("");
  const [region, setRegion] = useState("CA");
  const [landlordName, setLandlord] = useState("");
  const [landlordEmail, setEmail] = useState("");
  const [moveInDate, setMoveIn] = useState("");
  const [rent, setRent] = useState("");
  const [summary, setSummary] = useState("");
  const [offer, setOffer] = useState<Suggestion | null>(null);
  const [kept, setKept] = useState<Kept | null>(null);
  const [jurisdiction, setJurisdiction] = useState("unsure");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function clearCheck() {
    setOffer(null);
    setKept(null);
    setJurisdiction("unsure");
  }
  function editStreet(value: string) {
    setStreet(value);
    clearCheck();
  }
  function editCity(value: string) {
    setCity(value);
    clearCheck();
  }
  function editPostal(value: string) {
    setPostal(value);
    clearCheck();
  }
  function editRegion(value: string) {
    setRegion(value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));
    clearCheck();
  }
  function editUnit(value: string) {
    setUnit(value);
    clearCheck();
  }

  function applyKept() {
    if (kept) {
      setStreet(kept.street);
      setUnit(kept.unit);
      setCity(kept.city);
      setPostal(kept.postalCode);
    }
    setOffer(null);
    setStep(1);
  }

  function applySuggestion() {
    if (!offer) return;
    setStreet(offer.street);
    setCity(offer.city);
    setPostal(offer.postalCode);
    if (offer.unit) setUnit(offer.unit);
    setOffer(null);
    setStep(1);
  }

  async function later() {
    const zip = postalCode.trim();
    const addressReady = Boolean(street.trim() && city.trim() && usZip(zip));
    if (!addressReady || !token) {
      await setSkippedSetup(true);
      router.replace("/chat");
      return;
    }
    const name = landlordName.trim();
    const email = landlordEmail.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const keepLandlord = Boolean(name && emailOk);
    try {
      setBusy(true);
      setError("");
      const session = await api<Me>("unit", {
        token,
        body: {
          street: street.trim(),
          unitNumber: unitNumber.trim(),
          city: city.trim(),
          postalCode: zip,
          region: region.trim() || "CA",
          landlordName: keepLandlord ? name : "",
          landlordEmail: keepLandlord ? email : "",
          rent: rent.trim(),
          moveInDate: moveInDate.trim(),
          jurisdiction,
        },
      });
      await setSkippedSetup(false);
      await signIn(session);
      void refreshBootstrap(session.token, true);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    try {
      setError("");
      if (step === 0) {
        const zip = postalCode.trim();
        if (!street.trim() || !city.trim() || !usZip(zip)) {
          setError(es ? "Agregue calle, ciudad y un código postal de 5 dígitos." : "Add a street, city, and a 5-digit ZIP.");
          return;
        }
        setBusy(true);
        const found = await api<PlaceResult>("place", { token, body: { street: street.trim(), unitNumber: unitNumber.trim(), city: city.trim(), postalCode: zip, region: region.trim() || "CA" } });
        if (!found.inCalifornia && found.jurisdiction !== "unsupported") {
          setError(found.summary);
          return;
        }
        setSummary(found.summary);
        if (found.state) setRegion(found.state);
        if (found.jurisdiction) setJurisdiction(found.jurisdiction);
        setKept(found.kept || null);
        if (found.differs && found.suggestion) {
          setOffer(found.suggestion);
          return;
        }
        if (found.kept) {
          setStreet(found.kept.street);
          setUnit(found.kept.unit);
          setCity(found.kept.city);
          setPostal(found.kept.postalCode);
        }
        setOffer(null);
        setStep(1);
        return;
      }
      if (step === 1) {
        const name = landlordName.trim();
        const email = landlordEmail.trim();
        if ((name || email) && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
          setError(es ? "Agregue el nombre y el correo del propietario." : "Add the landlord's name and email.");
          return;
        }
        setStep(2);
        return;
      }
      if (step === 2) {
        if (moveInDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(moveInDate.trim())) {
          setError(es ? "Use una fecha como 2024-06-01, o déjela en blanco." : "Use a date like 2024-06-01, or leave it blank.");
          return;
        }
        if (rent.trim() && !Number.isFinite(Number(rent.replace(/[$,]/g, "")))) {
          setError(es ? "Escriba la renta en dólares, o déjela en blanco." : "Enter the rent in dollars, or leave it blank.");
          return;
        }
        setStep(3);
        return;
      }
      setBusy(true);
      const session = await api<Me>("unit", {
        token,
        body: {
          street: street.trim(),
          unitNumber: unitNumber.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          region: region.trim() || "CA",
          landlordName: landlordName.trim(),
          landlordEmail: landlordEmail.trim(),
          rent: rent.trim(),
          moveInDate: moveInDate.trim(),
          jurisdiction,
        },
      });
      await setSkippedSetup(false);
      await signIn(session);
      void refreshBootstrap(session.token, true);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const titles = es
    ? ["¿Dónde renta?", "Su propietario", "Datos del contrato", "Reglas para esta dirección"]
    : ["Where do you rent?", "Your landlord", "Lease details", "Rules for this address"];
  const hints = es
    ? ["Una dirección en Estados Unidos.", "Deje ambos en blanco para agregarlos después. Nada se envía hasta que usted lo confirme.", "Los dos son opcionales.", summary]
    : ["A US address.", "Leave both blank to add them later. Nothing is sent until you confirm it.", "Both of these are optional.", summary];
  const action = step === 3 ? (es ? "Guardar" : "Save") : (es ? "Continuar" : "Continue");

  return (
    <Page>
      <Muted>{es ? `Paso ${step + 1} de ${STEPS}` : `Step ${step + 1} of ${STEPS}`}</Muted>
      <H1>{titles[step]}</H1>
      <Muted>{hints[step]}</Muted>
      <ErrorLine message={error} />
      {step === 0 ? (
        <>
          <Field label={es ? "Calle" : "Street"} value={street} onChange={editStreet} autoComplete="street-address" textContentType="fullStreetAddress" />
          <Field label={es ? "Apto / Unidad" : "Apt / Unit"} value={unitNumber} onChange={editUnit} placeholder={es ? "Apto, suite, unidad (opcional)" : "Apt, suite, unit (optional)"} autoComplete="address-line2" textContentType="streetAddressLine2" />
          <Field label={es ? "Ciudad" : "City"} value={city} onChange={editCity} placeholder="Los Angeles" autoComplete="postal-address-locality" textContentType="addressCity" />
          <Field label={es ? "Estado" : "State"} value={region} onChange={editRegion} placeholder="CA" autoCapitalize="characters" autoComplete="postal-address-region" textContentType="addressState" />
          <Field label={es ? "Código postal" : "ZIP"} value={postalCode} onChange={editPostal} placeholder="90026" keyboardType="number-pad" autoComplete="postal-code" textContentType="postalCode" />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field label={es ? "Nombre del propietario" : "Landlord name"} value={landlordName} onChange={setLandlord} autoComplete="name" textContentType="name" />
          <Field label={es ? "Correo del propietario" : "Landlord email"} value={landlordEmail} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field label={es ? "Inicio del contrato" : "Lease start"} value={moveInDate} onChange={setMoveIn} placeholder="2024-06-01" autoComplete="off" />
          <Field label={es ? "Renta mensual" : "Monthly rent"} value={rent} onChange={setRent} placeholder="2150" keyboardType="decimal-pad" />
        </>
      ) : null}
      {step === 3 ? (
        <Address street={street} unit={unitNumber} city={city} postalCode={postalCode} region={region || "CA"} style={styles.recap} />
      ) : null}
      {step === 0 && offer ? (
        <>
          <LabeledAddress label={es ? "Revisada" : "Checked"} street={kept?.street || street} unit={kept?.unit || unitNumber} city={kept?.city || city} region={kept?.region || "CA"} postalCode={kept?.postalCode || postalCode} />
          <LabeledAddress label={es ? "Sugerencia" : "Suggestion"} street={offer.street} unit={offer.unit} city={offer.city} region={offer.region} postalCode={offer.postalCode} />
          <Button label={es ? "Usar lo que escribí" : "Use what I typed"} onPress={applyKept} disabled={busy} />
          <Button label={es ? "Usar la sugerencia" : "Use suggestion"} ghost onPress={applySuggestion} disabled={busy} />
        </>
      ) : (
        <Button label={busy ? (es ? "Un momento…" : "One moment…") : action} onPress={() => void next()} disabled={busy} />
      )}
      <Pressable onPress={() => void later()} accessibilityRole="button" accessibilityLabel={es ? "Hacer esto después" : "Do this later"} style={styles.later}>
        <Text style={styles.laterText}>{es ? "Hacer esto después" : "Do this later"}</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  recap: { color: colors.ink, fontSize: 16, lineHeight: 22, marginTop: 16 },
  later: { minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: 8 },
  laterText: { color: colors.pine, fontSize: 16, fontWeight: "700" },
});
