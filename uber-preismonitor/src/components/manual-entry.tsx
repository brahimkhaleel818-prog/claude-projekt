"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { RouteOverview } from "./types";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input, Label, Select } from "./ui/input";
import { api } from "@/lib/utils";

/** Preis aus der Uber-App übernehmen (exakt der in der App angezeigte Betrag). */
export function ManualEntryDialog({
  open,
  onOpenChange,
  route,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  route: RouteOverview;
  categories: string[];
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(categories[0] ?? "UberX");
  const [price, setPrice] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(price.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setError("Bitte einen gültigen Preis eingeben");
    setBusy(true);
    try {
      await api("/api/measurements/manual", {
        method: "POST",
        json: { routeId: route.id, category, price: value, observedAt: time ? new Date(time).toISOString() : undefined, note: note || undefined },
      });
      setPrice("");
      setNote("");
      setTime("");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Preis aus der Uber-App erfassen" description={`${route.originAddress} → ${route.destAddress}`}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategorie</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Preis in der App (€)</Label>
              <Input inputMode="decimal" placeholder="z. B. 32,90" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus required />
            </div>
          </div>
          <div>
            <Label>Zeitpunkt (leer = jetzt)</Label>
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <Label>Notiz (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Messe, Regen, Bahnstreik" maxLength={300} />
          </div>
          <p className="text-[11px] text-muted">Wird als Datenquelle „manual“ mit Preistyp „Manuell (Uber-App)“ gespeichert und ist in allen Auswertungen erkennbar.</p>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Speichern</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
