"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/site/Button";

/** Chave Pix com botão de copiar — o botão mesmo confirma ("Chave copiada!"), sem depender de toast. */
export function PixCard({ pixKey }: { pixKey: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão de área de transferência: a chave está visível pra copiar à mão.
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-[28px] bg-accent p-7 text-on-accent md:p-9">
      <div className="flex flex-col gap-2">
        <p className="label-caps">Dízimos e ofertas por Pix</p>
        <p className="text-2xl font-black break-all md:text-[28px]">{pixKey}</p>
      </div>
      <Button variant="dark" onClick={handleCopy} className="self-start">
        {copied ? <Check size={18} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={18} strokeWidth={2} aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Chave copiada!" : "Copiar chave Pix"}</span>
      </Button>
    </div>
  );
}
