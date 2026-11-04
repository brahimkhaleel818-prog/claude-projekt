"use client";
import { Activity, Loader2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function LoginForm() {
  const params = useSearchParams();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    setBusy(false);
    if (res.ok) {
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } else {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Anmeldung fehlgeschlagen");
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-panel p-6 shadow-2xl">
      <div className="mb-2 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-white text-zinc-950"><Activity className="size-5" /></div>
        <div>
          <h1 className="text-lg font-semibold">Uber Alkhaled</h1>
          <p className="text-xs text-muted">Preisüberwachung Düsseldorf · Anmeldung</p>
        </div>
      </div>
      <div>
        <Label htmlFor="u">Benutzername</Label>
        <Input id="u" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="p">Passwort</Label>
        <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required />
      </div>
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null} Anmelden
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
