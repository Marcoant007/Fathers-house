import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, Pencil } from "lucide-react";
import { isEditor, getActor } from "@/lib/auth-and-audit";
import { getAssistantKnowledge, getFaqEntries } from "@/lib/queries/assistant";
import { deleteFaq } from "@/lib/actions/faq";
import { Panel } from "@/components/admin/Panel";
import { FaqDialog } from "@/components/admin/FaqDialog";
import { AssistantTester } from "@/components/admin/AssistantTester";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SaveSuccessDialog } from "@/components/admin/SaveSuccessDialog";

export const metadata: Metadata = { title: "Tira-dúvidas" };

export default async function TiraDuvidasPage() {
  const actor = await getActor();
  if (!isEditor(actor)) {
    return <p className="text-soft">Só mídia/admin gerenciam o tira-dúvidas.</p>;
  }

  const [faqs, knowledge] = await Promise.all([getFaqEntries(), getAssistantKnowledge()]);

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <SaveSuccessDialog messages={{ create: "Pergunta criada!", update: "Pergunta atualizada!" }} />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Tira-dúvidas</h1>
          <p className="max-w-2xl text-[15px] text-soft">
            O botão de ajuda do site já responde sozinho sobre cultos, agenda, endereço, contato, Pix e ministérios,
            com o que está cadastrado no painel. Aqui você cadastra as outras perguntas, com a resposta pronta.
          </p>
        </div>
        <FaqDialog
          trigger={
            <span className="flex items-center gap-2">
              <Plus size={18} strokeWidth={2} aria-hidden="true" /> Nova pergunta
            </span>
          }
          triggerClassName="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper"
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Testar o bot</h2>
        <AssistantTester knowledge={knowledge} />
      </Panel>

      <Panel className="p-0">
        {faqs.length === 0 ? (
          <p className="p-8 text-soft">Nenhuma pergunta cadastrada ainda.</p>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-xs font-extrabold text-soft uppercase">
                <th className="px-6 py-4">Pergunta</th>
                <th className="hidden px-6 py-4 md:table-cell">Palavras-chave</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 font-bold">{faq.question}</td>
                  <td className="hidden max-w-xs px-6 py-4 text-sm text-soft md:table-cell">
                    <span className="line-clamp-2">{faq.keywords.join(", ")}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                      {faq.active ? (
                        <span className="rounded-full bg-success/10 px-3 py-1 text-success">Ativa</span>
                      ) : (
                        <span className="rounded-full bg-sand px-3 py-1 text-soft">Desativada</span>
                      )}
                      {faq.isFeatured ? <span className="rounded-full bg-accent px-3 py-1 text-on-accent">Destaque</span> : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FaqDialog
                        faq={faq}
                        trigger={<Pencil size={18} strokeWidth={2} aria-hidden="true" />}
                        triggerClassName="flex size-9 items-center justify-center rounded-lg text-soft hover:bg-sand hover:text-ink"
                      />
                      <DeleteButton
                        itemId={faq.id}
                        itemTitle={faq.question}
                        itemLabel="item do tira-dúvidas"
                        listHref="/backstage/tira-duvidas"
                        deleteAction={deleteFaq}
                        variant="icon"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
