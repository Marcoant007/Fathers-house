import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { getActor, hasRole, isEditor } from "@/lib/auth-and-audit";
import { EventForm } from "@/components/admin/EventForm";
import { getAllCategories } from "@/lib/queries/categories";
import { getMinistries } from "@/lib/queries/ministries";

export const metadata: Metadata = { title: "Novo evento" };

export default async function NovoEventoPage() {
  const actor = await getActor();
  const editor = isEditor(actor);
  const [categories, allMinistries] = await Promise.all([getAllCategories(), getMinistries()]);

  const ministries = editor
    ? allMinistries
    : allMinistries.filter((m) => hasRole(actor, "LIDER", m.id));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">Novo evento</h1>
      {editor ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-sand px-5 py-4">
          <Repeat size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          <p className="min-w-0 flex-1 text-[15px]">
            <b>É um culto que acontece toda semana</b> (ex.: terça 20h, domingo 9h30 e 18h)? Não precisa criar
            evento com data: cadastre uma vez em <b>Cultos</b> e ele aparece sempre no site. Evento é pra algo que
            acontece num dia só, como o Café com o Pastor.
          </p>
          <Link
            href="/backstage/cultos"
            className="flex min-h-11 items-center rounded-full border-2 border-ink px-5 text-sm font-extrabold whitespace-nowrap"
          >
            Ir para Cultos
          </Link>
        </div>
      ) : null}
      <EventForm categories={categories} ministries={ministries} isEditor={editor} />
    </div>
  );
}
