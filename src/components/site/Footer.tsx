import Link from "next/link";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { LogoGlyph } from "@/components/site/Logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site-config";

const NAV_LINKS = [
  { href: "/quem-somos", label: "Quem somos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/avisos", label: "Avisos" },
  { href: "/ministerios", label: "Ministérios" },
  { href: "/galeria", label: "Galeria" },
  { href: "/visite-nos", label: "Visite-nos" },
  { href: "/contribua", label: "Contribua" },
];

/** Ano atual (fora do corpo do componente, por causa da regra de pureza do React). */
function currentYear() {
  return new Date().getFullYear();
}

const linkClass = "inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="label-caps">{title}</p>
      {children}
    </div>
  );
}

/** Rodapé na cor de destaque do site (Aparência). O texto usa --on-accent, que já garante contraste. */
export async function Footer() {
  const settings = await getSiteSettings();

  const emails = [
    { label: "Secretaria", email: settings.secretaryEmail },
    { label: "Financeiro", email: settings.financeEmail },
    { label: "Administrativo", email: settings.adminEmail },
  ].filter((item): item is { label: string; email: string } => !!item.email);

  const socials = [
    { label: "Instagram", href: settings.instagram },
    { label: "YouTube", href: settings.youtube },
    { label: "Spotify", href: settings.spotify },
  ].filter((item): item is { label: string; href: string } => !!item.href);

  const whatsappUrl = settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}` : null;

  return (
    <footer className="bg-accent text-on-accent">
      <div className="container-site grid grid-cols-1 gap-12 py-16 sm:grid-cols-2 md:py-24 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col gap-6 sm:col-span-2 lg:col-span-4">
          <Link href="/" className="flex items-center gap-3 self-start">
            <LogoGlyph className="w-14 text-on-accent-icon" />
            <span className="text-xl font-black uppercase">{SITE_NAME}</span>
          </Link>
          <p className="max-w-xs text-2xl leading-[1.2] font-black uppercase">{SITE_TAGLINE}</p>
          {settings.address ? (
            <div className="flex flex-col gap-2">
              <p className="max-w-sm leading-[1.6]">{settings.address}</p>
              {settings.mapsUrl ? (
                <a
                  href={settings.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center self-start font-extrabold underline underline-offset-4"
                >
                  Como chegar →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <Column title="Navegação">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>
        </div>

        {emails.length > 0 || whatsappUrl ? (
          <div className="lg:col-span-4">
            <Column title="Contatos">
              <ul className="flex flex-col gap-4">
                {emails.map((item) => (
                  <li key={item.label} className="flex flex-col">
                    <span className="text-sm font-extrabold">{item.label}</span>
                    <a href={`mailto:${item.email}`} className="break-words underline-offset-4 hover:underline">
                      {item.email}
                    </a>
                  </li>
                ))}
                {whatsappUrl ? (
                  <li className="flex flex-col">
                    <span className="text-sm font-extrabold">WhatsApp</span>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {settings.whatsapp}
                    </a>
                  </li>
                ) : null}
              </ul>
            </Column>
          </div>
        ) : null}

        {socials.length > 0 ? (
          <div className="lg:col-span-2">
            <Column title="Redes">
              <ul className="flex flex-col">
                {socials.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Column>
          </div>
        ) : null}
      </div>

      {/* pb maior no celular: o botão do tira-dúvidas fica flutuando no canto. */}
      <div className="border-t border-on-accent/20">
        <div className="container-site flex flex-col gap-2 py-6 pb-24 text-sm sm:flex-row sm:items-center sm:gap-6 md:pb-6">
          <span>
            © {currentYear()} {SITE_NAME}
          </span>
          <Link href="/backstage" className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">
            Área da equipe
          </Link>
        </div>
      </div>
    </footer>
  );
}
