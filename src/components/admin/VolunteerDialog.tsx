"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, LoaderCircle, UserMinus } from "lucide-react";
import type { MaritalStatus, SundayShift, VolunteerAvailability } from "@/generated/prisma/client";
import { MARITAL_LABELS, ageOn } from "@/lib/volunteer-details";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { BackgroundCheckReveal } from "@/components/admin/BackgroundCheckReveal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  addVolunteer,
  removeFromMinistry,
  updateVolunteer,
  type VolunteerActionState,
} from "@/lib/actions/volunteers";
import { useFormSubmit } from "@/lib/use-form-submit";

export type EditablePerson = {
  id: string;
  membershipId: string;
  name: string;
  phoneLabel: string | null;
  availability: VolunteerAvailability | null;
  sundayShift: SundayShift | null;
  termSigned: boolean | null;
  functionIds: string[];
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  maritalStatus: MaritalStatus | null;
  city: string | null;
  baptized: boolean | null;
  convertedYear: number | null;
};

type Props = {
  ministryId: string;
  ministryName: string;
  functions: { id: string; name: string }[];
  canSeeSensitive: boolean;
  /** sem person = adicionar alguém à equipe */
  person?: EditablePerson;
  trigger: React.ReactNode;
  triggerClassName?: string;
};

export function VolunteerDialog({ trigger, triggerClassName, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {props.person ? `Editar ${props.person.name}` : `Adicionar à equipe de ${props.ministryName}`}
          </DialogTitle>
        </DialogHeader>
        {/* O formulário só existe com o diálogo aberto: reabrir começa limpo, sem erro antigo. */}
        <VolunteerForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

const AVAILABILITY_OPTIONS: { value: VolunteerAvailability; label: string }[] = [
  { value: "WEEK_AND_WEEKEND", label: "Semana e fim de semana" },
  { value: "WEEKEND_ONLY", label: "Só fim de semana" },
  { value: "WEEKDAYS_ONLY", label: "Só durante a semana" },
];

const SUNDAY_OPTIONS: { value: SundayShift; label: string }[] = [
  { value: "MORNING", label: "Só de manhã" },
  { value: "NIGHT", label: "Só à noite" },
  { value: "BOTH", label: "Manhã e noite" },
];

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DETAIL_FIELDS = ["birthDay", "birthMonth", "birthYear", "maritalStatus", "city", "baptized", "convertedYear"];

const TERM_OPTIONS = [
  { value: "yes", label: "Assinado" },
  { value: "no", label: "Pendente" },
  { value: "", label: "Não sei" },
] as const;

function VolunteerForm({
  ministryId,
  ministryName,
  functions,
  canSeeSensitive,
  person,
  onDone,
}: Omit<Props, "trigger" | "triggerClassName"> & { onDone: () => void }) {
  const router = useRouter();
  const serverAction = person ? updateVolunteer.bind(null, person.membershipId) : addVolunteer.bind(null, ministryId);
  // Fecha e avisa direto no fim do envio (sem useEffect).
  const action = async (prev: VolunteerActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result?.ok) {
      toast.success(result.message ?? "Salvo!");
      onDone();
      router.refresh();
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<VolunteerActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  const term = person?.termSigned === true ? "yes" : person?.termSigned === false ? "no" : "";

  return (
    <form {...formProps} className="flex flex-col gap-5">
      {state?.error ? (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      ) : null}

      <FormField label="Nome" htmlFor="name" error={fieldErrors?.name}>
        <input
          id="name"
          name="name"
          defaultValue={person?.name}
          maxLength={120}
          autoComplete="off"
          className={fieldInputClass(!!fieldErrors?.name)}
          required
        />
      </FormField>

      <FormField label="WhatsApp" htmlFor="phone" error={fieldErrors?.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="(27) 99999-0000"
          defaultValue={person?.phoneLabel ?? ""}
          autoComplete="off"
          className={fieldInputClass(!!fieldErrors?.phone)}
        />
        {!person ? (
          <p className="text-sm text-soft">
            Se a pessoa já serve em outro ministério, a gente reconhece pelo número e só adiciona ao {ministryName}.
          </p>
        ) : null}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Disponibilidade" htmlFor="availability" error={fieldErrors?.availability}>
          <select
            id="availability"
            name="availability"
            defaultValue={person?.availability ?? ""}
            className={fieldInputClass(!!fieldErrors?.availability)}
          >
            <option value="">Não informou</option>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="No domingo" htmlFor="sundayShift" error={fieldErrors?.sundayShift}>
          <select
            id="sundayShift"
            name="sundayShift"
            defaultValue={person?.sundayShift ?? ""}
            className={fieldInputClass(!!fieldErrors?.sundayShift)}
          >
            <option value="">Não informou</option>
            {SUNDAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-extrabold">Termo de voluntariado</legend>
        <div className="flex flex-wrap gap-2">
          {TERM_OPTIONS.map((o) => (
            <label
              key={o.label}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
            >
              <input type="radio" name="termSigned" value={o.value} defaultChecked={term === o.value} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-extrabold">Funções no {ministryName}</legend>
        {functions.length === 0 ? (
          <p className="text-sm text-soft">
            {ministryName} ainda não tem funções cadastradas. Crie em “Funções”, ao lado de “Adicionar pessoa”.
          </p>
        ) : (
          <>
            <p className="text-sm text-soft">Marque uma ou mais. Pode deixar em branco.</p>
            <div className="flex flex-wrap gap-2">
              {functions.map((f) => (
                <label
                  key={f.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
                >
                  <input
                    type="checkbox"
                    name="functionIds"
                    value={f.id}
                    defaultChecked={person?.functionIds.includes(f.id)}
                    className="sr-only"
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <MoreDetails person={person} fieldErrors={fieldErrors} />

      {person && canSeeSensitive ? (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-line p-4">
          <p className="text-sm font-extrabold">Antecedentes criminais</p>
          <p className="text-sm text-soft">Escondido. Aparece só quando você clica, e cada clique fica registrado na Auditoria.</p>
          <BackgroundCheckReveal volunteerId={person.id} volunteerName={person.name} />
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        {person ? <RemoveFromTeam person={person} ministryName={ministryName} onDone={onDone} /> : <span />}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-extrabold text-paper disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? <LoaderCircle size={18} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
          {person ? "Salvar alterações" : "Adicionar à equipe"}
        </button>
      </div>
    </form>
  );
}

const chipClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper";

/** Aniversário, estado civil, cidade, batismo e conversão: recolhido pra não poluir. */
function MoreDetails({
  person,
  fieldErrors,
}: {
  person?: EditablePerson;
  fieldErrors?: Record<string, string>;
}) {
  const hasError = DETAIL_FIELDS.some((f) => fieldErrors?.[f]);
  const baptized = person?.baptized === true ? "yes" : person?.baptized === false ? "no" : "";
  const age =
    person?.birthDay && person.birthMonth
      ? ageOn({ day: person.birthDay, month: person.birthMonth, year: person.birthYear })
      : null;

  return (
    <details open={hasError || undefined} className="group rounded-2xl border-2 border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">Mais detalhes</span>
          <span className="text-sm text-soft">Aniversário, estado civil, cidade, batismo e conversão</span>
        </span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-4 border-t border-line px-4 pt-4 pb-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-extrabold">Aniversário</legend>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_7rem] gap-2">
            <label className="sr-only" htmlFor="birthDay">Dia</label>
            <select
              id="birthDay"
              name="birthDay"
              defaultValue={person?.birthDay ?? ""}
              className={fieldInputClass(!!fieldErrors?.birthDay)}
            >
              <option value="">Dia</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="birthMonth">Mês</label>
            <select
              id="birthMonth"
              name="birthMonth"
              defaultValue={person?.birthMonth ?? ""}
              className={fieldInputClass(!!fieldErrors?.birthDay)}
            >
              <option value="">Mês</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="birthYear">Ano (opcional)</label>
            <input
              id="birthYear"
              name="birthYear"
              inputMode="numeric"
              placeholder="Ano"
              maxLength={4}
              defaultValue={person?.birthYear ?? ""}
              className={fieldInputClass(!!fieldErrors?.birthYear)}
            />
          </div>
          {fieldErrors?.birthDay || fieldErrors?.birthYear ? (
            <p className="text-sm font-bold text-danger">{fieldErrors.birthDay ?? fieldErrors.birthYear}</p>
          ) : (
            <p className="text-sm text-soft">{age != null ? `${age} anos. ` : ""}O ano é opcional.</p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Estado civil" htmlFor="maritalStatus" error={fieldErrors?.maritalStatus}>
            <select
              id="maritalStatus"
              name="maritalStatus"
              defaultValue={person?.maritalStatus ?? ""}
              className={fieldInputClass(!!fieldErrors?.maritalStatus)}
            >
              <option value="">Não informou</option>
              {(Object.keys(MARITAL_LABELS) as MaritalStatus[]).map((k) => (
                <option key={k} value={k}>
                  {MARITAL_LABELS[k]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cidade" htmlFor="city" error={fieldErrors?.city}>
            <input
              id="city"
              name="city"
              maxLength={80}
              defaultValue={person?.city ?? ""}
              autoComplete="off"
              className={fieldInputClass(!!fieldErrors?.city)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-extrabold">Batizado(a)?</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["yes", "Sim"],
                  ["no", "Não"],
                  ["", "Não sei"],
                ] as const
              ).map(([value, label]) => (
                <label key={label} className={chipClass}>
                  <input type="radio" name="baptized" value={value} defaultChecked={baptized === value} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <FormField label="Convertido(a) desde (ano)" htmlFor="convertedYear" error={fieldErrors?.convertedYear}>
            <input
              id="convertedYear"
              name="convertedYear"
              inputMode="numeric"
              placeholder="Ex.: 2015"
              maxLength={4}
              defaultValue={person?.convertedYear ?? ""}
              className={fieldInputClass(!!fieldErrors?.convertedYear)}
            />
          </FormField>
        </div>
      </div>
    </details>
  );
}

/** Dois passos: o primeiro clique só pergunta. */
function RemoveFromTeam({
  person,
  ministryName,
  onDone,
}: {
  person: EditablePerson;
  ministryName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-extrabold text-danger hover:bg-danger/10"
      >
        <UserMinus size={16} strokeWidth={2} aria-hidden="true" /> Tirar da equipe
      </button>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-danger/10 p-3 sm:max-w-xs">
      <p className="text-sm font-bold text-danger">
        Tirar {person.name} da equipe de {ministryName}? O cadastro e os outros ministérios continuam.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-full px-3 text-sm font-extrabold text-soft"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeFromMinistry(person.membershipId);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(`${person.name} saiu da equipe de ${ministryName}.`);
              startTransition(() => {
                onDone();
                router.refresh();
              });
            })
          }
          className="flex min-h-11 items-center gap-2 rounded-full bg-danger px-4 text-sm font-extrabold text-paper disabled:opacity-80"
        >
          {pending ? <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
          Sim, tirar
        </button>
      </div>
    </div>
  );
}
