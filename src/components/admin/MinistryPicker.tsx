"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { fieldInputClass } from "@/components/admin/FormField";

/** Escolher o ministério da escala (em vez de uma fileira de botões). */
export function MinistryPicker({
  options,
  value,
}: {
  options: { id: string; name: string; href: string }[];
  value: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="escala-ministerio" className="text-sm font-extrabold">
        Ministério
      </label>
      <select
        id="escala-ministerio"
        value={value}
        onChange={(e) => {
          const href = options.find((o) => o.id === e.target.value)?.href;
          if (href) startTransition(() => router.push(href));
        }}
        className={fieldInputClass() + " min-h-11 max-w-sm text-[15px] font-bold"}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {pending ? <LoaderCircle size={18} strokeWidth={2} aria-label="Carregando" className="animate-spin" /> : null}
    </div>
  );
}
