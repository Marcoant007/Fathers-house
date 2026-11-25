import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { getActor, isEditor } from "@/lib/auth-and-audit";
import { getGivingProjects } from "@/lib/queries/giving-projects";
import { deleteGivingProject } from "@/lib/actions/giving-projects";
import { Panel } from "@/components/admin/Panel";
import { ProjectDialog } from "@/components/admin/ProjectDialog";
import { ProjectMoveButtons } from "@/components/admin/ProjectMoveButtons";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SaveSuccessDialog } from "@/components/admin/SaveSuccessDialog";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjetosPage() {
  const actor = await getActor();
  if (!isEditor(actor)) {
    return <p className="text-soft">Só mídia/admin gerenciam os projetos.</p>;
  }

  const projects = await getGivingProjects();
  const visibleCount = projects.filter((p) => p.visible).length;

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <SaveSuccessDialog messages={{ create: "Projeto adicionado!", update: "Projeto atualizado!" }} />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Projetos da igreja</h1>
          <p className="max-w-2xl text-[15px] text-soft">
            Aparecem num carrossel na seção <b>Contribua</b> (página inicial e página Contribua), do lado da chave Pix.
            A pessoa passa pro lado pra ver um projeto de cada vez. A chave Pix fica em Aparência.
          </p>
        </div>
        <ProjectDialog
          trigger={
            <span className="flex items-center gap-2">
              <Plus size={18} strokeWidth={2} aria-hidden="true" /> Novo projeto
            </span>
          }
          triggerClassName="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper"
        />
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px]">
          <b>{visibleCount}</b> {visibleCount === 1 ? "projeto aparece" : "projetos aparecem"} no site
          {projects.length > visibleCount ? (
            <span className="text-soft"> · {projects.length - visibleCount} oculto(s)</span>
          ) : null}
          . A ordem abaixo é a ordem do carrossel.
        </p>
        <Link
          href="/contribua"
          target="_blank"
          className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-extrabold"
        >
          Ver no site <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </Panel>

      {projects.length === 0 ? (
        <Panel>
          <p className="text-soft">
            Nenhum projeto cadastrado. Sem projetos, a seção Contribua mostra só a chave Pix. Clique em “Novo projeto”
            pra adicionar o primeiro.
          </p>
        </Panel>
      ) : (
        <ol className="flex flex-col gap-3">
          {projects.map((project, index) => (
            <li key={project.id}>
              <Panel className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4 md:flex-1">
                  <span className="w-6 shrink-0 text-center text-lg font-black text-soft">{index + 1}</span>
                  <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-sand">
                    <Image src={project.imagePath} alt="" fill sizes="128px" className="object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-bold">{project.title}</p>
                    {project.description ? (
                      <p className="line-clamp-2 text-sm text-soft">{project.description}</p>
                    ) : null}
                    {project.visible ? (
                      <span className="w-fit rounded-full bg-success/10 px-3 py-0.5 text-xs font-extrabold text-success">
                        No site
                      </span>
                    ) : (
                      <span className="w-fit rounded-full bg-sand px-3 py-0.5 text-xs font-extrabold text-soft">
                        Oculto do site
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <ProjectMoveButtons
                    id={project.id}
                    title={project.title}
                    isFirst={index === 0}
                    isLast={index === projects.length - 1}
                  />
                  <ProjectDialog
                    project={project}
                    trigger={
                      <span className="flex items-center gap-2">
                        <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                        Editar
                        <span className="sr-only"> {project.title}</span>
                      </span>
                    }
                    triggerClassName="flex min-h-11 items-center rounded-full border-2 border-ink px-4 text-sm font-extrabold"
                  />
                  <DeleteButton
                    itemId={project.id}
                    itemTitle={project.title}
                    itemLabel="projeto"
                    listHref="/backstage/projetos"
                    deleteAction={deleteGivingProject}
                    variant="compact"
                    description="Isso tira o projeto do carrossel e apaga a foto dele pra sempre. Se quiser só esconder por um tempo, use Editar e desmarque “Mostrar no site”."
                  />
                </div>
              </Panel>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
