"use client";

import { useState } from "react";
import { answer } from "@/lib/assistant/engine";
import type { AssistantKnowledge, AssistantReply } from "@/lib/assistant/types";
import { fieldInputClass } from "@/components/admin/FormField";

const SOURCE_LABELS: Record<string, string> = {
  services: "Cultos (cadastro de Cultos)",
  agenda: "Agenda (eventos publicados)",
  day: "Programação do dia (Cultos + Agenda)",
  address: "Endereço (Aparência)",
  contact: "Contato (Aparência)",
  give: "Pix (Aparência)",
  ministries: "Ministérios",
  live: "Transmissão (Aparência)",
  greeting: "Cumprimento",
  thanks: "Agradecimento",
};

function describeSource(reply: AssistantReply, k: AssistantKnowledge): string {
  const s = reply.source;
  if (!s) return "Não entendeu — mostra o WhatsApp e as perguntas frequentes. Que tal criar uma pergunta pra isso?";
  if (s.startsWith("faq:")) return `Pergunta cadastrada: “${k.faqs.find((f) => `faq:${f.id}` === s)?.question ?? "?"}”`;
  if (s.startsWith("event:")) return "Evento citado pelo nome (Agenda)";
  if (s.startsWith("ministry:")) return "Ministério citado pelo nome";
  return SOURCE_LABELS[s] ?? s;
}

/** Caixa no painel pra equipe testar o que o bot responde antes de publicar. */
export function AssistantTester({ knowledge }: { knowledge: AssistantKnowledge }) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) setReply(answer(question, knowledge));
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="tester-question" className="sr-only">
          Pergunta de teste
        </label>
        <input
          id="tester-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Digite como um visitante perguntaria, ex.: tem culto domingo à noite?"
          className={fieldInputClass()}
        />
        <button type="submit" className="shrink-0 rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper">
          Testar
        </button>
      </form>

      {reply ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-sand p-4">
          <p className="label-caps text-soft">Respondeu com: {describeSource(reply, knowledge)}</p>
          <p className="text-[15px] whitespace-pre-line">{reply.text}</p>
          {reply.links.length > 0 ? (
            <p className="text-sm text-soft">Botões: {reply.links.map((l) => l.label).join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
