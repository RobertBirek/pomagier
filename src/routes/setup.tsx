import { createFileRoute } from "@tanstack/react-router";
import { Download, Smartphone, Monitor, Globe, Wifi, AlertTriangle, CheckCircle2, ScanLine } from "lucide-react";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Konfiguracja PomagierGT</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Jednorazowa konfiguracja urządzenia do pracy z aplikacją przez HTTPS i domenę lokalną
          </p>
        </div>

        {/* Step 1: Download CA */}
        <Section number={1} title="Pobierz certyfikat bezpieczeństwa" icon={<Download className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground mb-3">
            Certyfikat root CA pozwala przeglądarce zaufać lokalnemu serwerowi. Bez niego kamera i instalacja PWA nie zadziałają.
          </p>
          <a
            href="/api/ca"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-target"
          >
            <Download className="h-4 w-4" />
            Pobierz rootCA.pem
          </a>
        </Section>

        {/* Step 2: Android */}
        <Section number={2} title="Android" icon={<Smartphone className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Otwórz pobrany plik <code className="rounded bg-muted px-1 font-mono text-xs">rootCA.pem</code></li>
            <li>Nazwa certyfikatu: <strong>PomagierGT</strong></li>
            <li>Użycie: wybierz <strong>"VPN i aplikacje"</strong></li>
            <li>Potwierdź PIN-em, odciskiem palca lub wzorem</li>
            <li className="text-xs text-muted-foreground">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              Android wyświetli ostrzeżenie — to normalne przy lokalnym certyfikacie
            </li>
          </ol>
        </Section>

        {/* Step 3: iPhone/iPad */}
        <Section number={3} title="iPhone / iPad" icon={<Smartphone className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Otwórz <strong>Safari</strong> i wejdź na{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">https://pomagier.local/api/ca</code>
            </li>
            <li>Zezwól na pobranie profilu konfiguracyjnego</li>
            <li>
              Otwórz <strong>Ustawienia</strong> → na górze zobaczysz <strong>"Pobrany profil"</strong> → kliknij
              <strong>Zainstaluj</strong>
            </li>
            <li>
              Następnie: <strong>Ustawienia → Ogólne → Informacje → Certyfikaty</strong>
            </li>
            <li>Znajdź <strong>mkcert</strong> i włącz przełącznik</li>
          </ol>
        </Section>

        {/* Step 4: Windows */}
        <Section number={4} title="Windows" icon={<Monitor className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Pobierz certyfikat w formacie CRT:{" "}
              <a href="/api/ca?format=crt" className="text-primary underline font-medium">
                rootCA.crt
              </a>
            </li>
            <li>Kliknij dwukrotnie pobrany plik</li>
            <li>Kliknij <strong>"Zainstaluj certyfikat"</strong></li>
            <li>Wybierz <strong>"Komputer lokalny"</strong> → Dalej</li>
            <li>
              Wybierz <strong>"Umieść w następującym magazynie"</strong> → Przeglądaj →
              <strong>"Zaufane główne urzędy certyfikacji"</strong>
            </li>
            <li>Dalej → Zakończ → potwierdź</li>
            <li className="text-xs text-muted-foreground">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              Jeśli Windows nie widzi domeny .local, zainstaluj{" "}
              <strong>Bonjour</strong> (dołączony do iTunes)
            </li>
          </ol>
        </Section>

        {/* Firefox */}
        <Section number={5} title="Firefox (Windows/Linux)" icon={<Monitor className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Pobierz certyfikat:{" "}
              <a href="/api/ca?format=crt" className="text-primary underline font-medium">rootCA.crt</a>
            </li>
            <li>Otwórz Firefox → <strong>☰ Menu → Ustawienia</strong></li>
            <li><strong>Prywatność i bezpieczeństwo</strong> → przewiń do "Certyfikaty"</li>
            <li>Kliknij <strong>"Wyświetl certyfikaty"</strong></li>
            <li>Zakładka <strong>"Urzędy certyfikacji"</strong> → <strong>"Importuj"</strong></li>
            <li>Wybierz pobrany plik <code className="rounded bg-muted px-1 font-mono text-xs">rootCA.crt</code></li>
            <li>Zaznacz <strong>"Zaufanie przy identyfikacji stron internetowych"</strong> → OK</li>
          </ol>
        </Section>

        {/* Step: Open app */}
        <Section number={6} title="Otwórz aplikację" icon={<Globe className="h-5 w-5" />}>
          <p className="text-sm mb-3">Po zainstalowaniu certyfikatu, otwórz aplikację przez domenę lokalną:</p>
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <code className="text-lg font-bold font-mono text-primary">https://pomagier.local</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Dalej możesz również korzystać przez adres IP: <code className="font-mono">https://192.168.1.174</code>
          </p>
        </Section>

        {/* Step 6: Install PWA */}
        <Section number={7} title="Zainstaluj jako aplikację (PWA)" icon={<Download className="h-5 w-5" />}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              W <strong>Chrome</strong> otwórz <code className="rounded bg-muted px-1 font-mono text-xs">https://pomagier.local</code>
            </li>
            <li>Kliknij menu (⋮) → <strong>"Dodaj do ekranu głównego"</strong></li>
            <li>Lub: <strong>"Zainstaluj aplikację"</strong></li>
            <li>Aplikacja otworzy się na pełnym ekranie, bez paska adresu</li>
            <li>Ikona "P" na niebieskim tle pojawi się na pulpicie</li>
          </ol>
        </Section>

        {/* Zebra terminal */}
        <Section number={8} title="Konfiguracja terminala Zebra M3 SL20" icon={<ScanLine className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground mb-3">
            Terminal Zebra z wbudowanym skanerem kodów kreskowych. Skonfiguruj DataWedge do automatycznego wysyłania kodów z Enter.
          </p>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">1. Zainstaluj certyfikat CA</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Otwórz Chrome i wejdź na <code className="rounded bg-muted px-1 font-mono text-xs">https://192.168.1.174/api/ca</code></li>
                <li>Pobierz plik <strong>rootCA.crt</strong></li>
                <li>Ustawienia → Bezpieczeństwo → Zainstaluj certyfikat</li>
                <li>Nazwa: <strong>PomagierGT</strong>, użycie: <strong>VPN i aplikacje</strong></li>
              </ol>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">2. Skonfiguruj DataWedge</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Otwórz aplikację <strong>DataWedge</strong> (preinstalowana)</li>
                <li>Utwórz nowy profil lub edytuj domyślny</li>
                <li><strong>Input</strong> → Barcode: włączone</li>
                <li><strong>Output</strong> → Keystroke: włączone</li>
                <li>W ustawieniach Keystroke dodaj <strong>Enter (keycode 13)</strong> jako suffix</li>
                <li><strong>Associated apps</strong>: wybierz Chrome</li>
                <li>Zapisz profil</li>
              </ol>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">3. Zainstaluj PWA</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Otwórz <code className="rounded bg-muted px-1 font-mono text-xs">https://192.168.1.174</code> w Chrome</li>
                <li>Menu (⋮) → <strong>Dodaj do ekranu głównego</strong></li>
                <li>Aplikacja otwiera się na pełnym ekranie</li>
                <li>Skaner automatycznie wpisuje kod + Enter → pole skanowania odbiera kod</li>
              </ol>
            </div>
            <div className="rounded bg-blue-50 border border-blue-200 p-3 text-sm">
              <strong>Wskazówka:</strong> Po zainstalowaniu PWA, aplikacja działa jak natywna — pełny ekran, własna ikona, skaner jako klawiatura. Nie potrzebuje certyfikatu jeśli używasz IP. Certyfikat CA potrzebny tylko dla domeny <code className="font-mono">pomagier.local</code>.
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-bold mb-4">Rozwiązywanie problemów</h2>

          <FaqItem
            title="Nie mogę znaleźć pomagier.local"
            description="Sprawdź czy jesteś w tej samej sieci WiFi co serwer. Na Windows potrzebujesz Bonjour (zainstaluj iTunes lub Bonjour Print Services). Alternatywnie użyj adresu IP."
          />
          <FaqItem
            title="Kamera nie działa"
            description="Kamera wymaga HTTPS przez domenę (nie działa przez IP). Zainstaluj certyfikat CA zgodnie z instrukcją i otwórz aplikację przez https://pomagier.local."
          />
          <FaqItem
            title="Certyfikat wygasł"
            description="Certyfikat jest ważny 2 lata. Po wygaśnięciu administrator musi ponownie uruchomić skrypt setup-prod.sh na serwerze."
          />
          <FaqItem
            title="Nie mogę się zalogować"
            description="Upewnij się że Twój PIN został skonfigurowany przez administratora w panelu administracyjnym. Domyślne PIN-y: Szef = 0000, Jan Kowalski = 1111."
          />
          <FaqItem
            title="Aplikacja działa wolno"
            description="Pierwsze uruchomienie może trwać kilka sekund (zimny start). Kolejne ładowania są natychmiastowe. Service Worker cachuje aplikację do pracy offline."
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  icon,
  children,
}: {
  number: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {number}
        </div>
        <div className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function FaqItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
    </div>
  );
}
