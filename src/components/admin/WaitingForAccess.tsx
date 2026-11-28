import { Clock } from "lucide-react";

/**
 * Tela de quem entrou no painel mas ainda não tem papel (Admin, Mídia ou Líder).
 * O layout mostra isto no lugar de qualquer página: sem papel, não vê nem faz nada.
 */
export function WaitingForAccess() {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-4 rounded-3xl bg-card p-8 shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/15">
        <Clock size={22} strokeWidth={2} aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold">Seu acesso ainda não foi liberado</h1>
      <p className="text-[15px] text-soft">
        Você entrou com sucesso, mas um admin ainda precisa dizer o que você vai cuidar no painel (por exemplo, Mídia
        ou Líder de um ministério). Fale com o admin da igreja.
      </p>
      <p className="text-[15px] text-soft">Quando o acesso for liberado, é só recarregar esta página.</p>
    </div>
  );
}
