import type { Metadata } from "next";
import { GivingSection } from "@/components/site/GivingSection";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { getVisibleGivingProjects } from "@/lib/queries/giving-projects";

export const metadata: Metadata = { title: "Contribua" };

export default async function ContribuaPage() {
  const [settings, projects] = await Promise.all([getSiteSettings(), getVisibleGivingProjects()]);

  return (
    <section className="flex flex-col gap-6 py-12 md:py-20">
      <GivingSection
        projects={projects}
        pixKey={settings.pixKey}
        financeEmail={settings.financeEmail}
        headingAs="h1"
      />
      {settings.pixKey ? null : <p className="container-site text-soft">Chave Pix ainda não cadastrada.</p>}
    </section>
  );
}
