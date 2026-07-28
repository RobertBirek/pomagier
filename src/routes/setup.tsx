import { createFileRoute } from "@tanstack/react-router";
import { Download, Smartphone, Monitor, Globe, AlertTriangle, CheckCircle2, ScanLine } from "lucide-react";

const DOMAIN = "pomagier.ilovelighting.hmcloud.pl";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function Section({ number, title, icon, children }: { number: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{number}</div>
        <div className="flex items-center gap-2 text-base font-semibold">{icon}{title}</div>
      </div>
      {children}
    </div>
  );
}

function FaqItem({ title, description }: { title: string; description: string }) {
  return <div className="mb-3 last:mb-0"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground mt-0.5">{description}</div></div></div></div>;
}

function SetupPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Konfiguracja PomagierGT</h1>
          <p className="text-sm text-muted-foreground mt-1">Instrukcja pierwszego uruchomienia na urządzeniach</p>
        </div>

        <Section number={1} title="Bezpieczeństwo" icon={<Globe className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground">
            Aplikacja używa certyfikatu <strong>Let's Encrypt</strong> — automatycznie odnawianego, zaufanego przez wszystkie przeglądarki i systemy operacyjne.
          </p>
          <div className="mt-3 rounded-lg bg-success/10 p-3 text-sm text-success flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Nie musisz instalować certyfikatów ręcznie.</strong> Domena jest w pełni zaufana na Android, iOS, Windows, Zebra.</span>
          </div>
        </Section>

        <Section number={2} title="Otwórz aplikację" icon={<Globe className="h-5 w-5" />}>
          <p className="text-sm mb-3">Wpisz w przeglądarce:</p>
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <code className="text-lg font-bold font-mono text-primary">https://{DOMAIN}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Działa na wszystkich urządzeniach w sieci lokalnej i przez internet.</p>
        </Section>

        <Section number={3} title="Zainstaluj jako aplikację (PWA)" icon={<Download className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Otwórz <code className="rounded bg-muted px-1 font-mono text-xs">https://{DOMAIN}</code> w <strong>Chrome</strong></li>
            <li>Menu (⋮) → <strong>"Dodaj do ekranu głównego"</strong> lub <strong>"Zainstaluj aplikację"</strong></li>
            <li>Aplikacja otworzy się na pełnym ekranie, bez paska adresu</li>
            <li>Ikona "P" na niebieskim tle pojawi się na pulpicie</li>
          </ol>
        </Section>

        <Section number={4} title="Konfiguracja terminala Zebra M3 SL20" icon={<ScanLine className="h-5 w-5" />}>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold mb-1">1. DataWedge (skaner)</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Otwórz <strong>DataWedge</strong> (preinstalowana)</li>
                <li>Nowy profil → <strong>Input</strong>: Barcode włączone</li>
                <li><strong>Output</strong>: Keystroke włączone → dodaj <strong>Enter</strong> jako suffix</li>
                <li><strong>Associated apps</strong>: wybierz Chrome</li>
                <li>Zapisz</li>
              </ol>
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">2. Zainstaluj PWA</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Otwórz <code className="rounded bg-muted px-1 font-mono text-xs">https://{DOMAIN}</code> w Chrome</li>
                <li>Menu → <strong>Zainstaluj aplikację</strong></li>
              </ol>
            </div>
          </div>
        </Section>

        <Section number={5} title="Windows" icon={<Monitor className="h-5 w-5" />}>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Otwórz <code className="rounded bg-muted px-1 font-mono text-xs">https://{DOMAIN}</code> w Chrome/Edge</li>
            <li>Pasek adresu → ikona ⊕ → <strong>Zainstaluj</strong></li>
            <li>PWA pojawi się jako osobna aplikacja</li>
          </ol>
        </Section>

        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-bold mb-4">Rozwiązywanie problemów</h2>
          <FaqItem title="Nie mogę znaleźć domeny" description={`Sprawdź połączenie z internetem. Domena ${DOMAIN} wymaga dostępu do sieci.`} />
          <FaqItem title="Kamera nie działa" description="Kamera wymaga HTTPS. Let's Encrypt zapewnia zaufany certyfikat — jeśli widzisz ostrzeżenie, odśwież stronę." />
          <FaqItem title="Nie mogę się zalogować" description="Domyślny PIN to 0000. Administrator może zmienić PIN w panelu administracyjnym." />
          <FaqItem title="Aplikacja działa wolno" description="Pierwsze uruchomienie może trwać kilka sekund. Service Worker cachuje aplikację do pracy offline." />
        </div>
      </div>
    </div>
  );
}
