import { Eyebrow } from "@/components/site/Eyebrow";
import { PixCard } from "@/components/site/PixCard";
import { ProjectCarousel, type CarouselProject } from "@/components/site/ProjectCarousel";
import { cn } from "cn";

/**
 * Seção Contribua (Home e /contribua): texto + Pix de um lado, carrossel dos
 * projetos da igreja do outro. Sem projetos cadastrados, fica só texto + Pix.
 */
export function GivingSection({
  projects,
  pixKey,
  headingAs: Heading = "h2",
}: {
  projects: CarouselProject[];
  pixKey: string | null;
  headingAs?: "h1" | "h2";
}) {
  const hasProjects = projects.length > 0;

  return (
    <div
      className={cn(
        "container-site grid grid-cols-1 items-center gap-9",
        hasProjects && "md:grid-cols-[5fr_7fr] md:gap-14"
      )}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Eyebrow>Contribua</Eyebrow>
          <Heading className="h-section">Sua contribuição sustenta a obra.</Heading>
          <p className="max-w-xl text-[17px] leading-[1.6] text-soft">
            Dízimos e ofertas mantêm a casa de portas abertas e constroem espaços para cada geração da nossa
            comunidade.
            {hasProjects ? " Passe para o lado e veja alguns dos projetos da igreja." : null}
          </p>
        </div>
        {pixKey ? <PixCard pixKey={pixKey} /> : null}
      </div>

      {hasProjects ? <ProjectCarousel projects={projects} /> : null}
    </div>
  );
}
