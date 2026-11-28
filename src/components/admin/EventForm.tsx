"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Ministry, Prisma } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { ImageDrop } from "@/components/admin/ImageDrop";
import { EventCard } from "@/components/site/EventCard";
import { createEvent, updateEvent, type EventActionState } from "@/lib/actions/events";
import { dateInputFromClosesAt } from "@/lib/registration-rules";
import { fromSaoPauloInput, toSaoPauloInput } from "@/lib/datetime";
import { useFormSubmit } from "@/lib/use-form-submit";

type RegistrationMode = "NONE" | "EXTERNAL" | "INTERNAL";

const MODE_OPTIONS: { value: RegistrationMode; label: string; hint: string }[] = [
  { value: "NONE", label: "Sem inscrição", hint: "É só aparecer." },
  { value: "INTERNAL", label: "Formulário do site", hint: "A pessoa se inscreve aqui; a lista fica no painel." },
  { value: "EXTERNAL", label: "Link externo", hint: "Google Forms, Sympla etc." },
];

type EventWithCategory = Prisma.EventGetPayload<{ include: { category: true } }>;


export function EventForm({
  event,
  categories,
  ministries,
  isEditor,
}: {
  event?: EventWithCategory | null;
  categories: Category[];
  ministries: Ministry[];
  isEditor: boolean;
}) {
  const router = useRouter();
  const action = event ? updateEvent.bind(null, event.id) : createEvent;
  // Qual botão foi clicado vem no próprio envio (name="intent" nos botões).
  const boundAction = (prev: EventActionState, formData: FormData) => {
    const intent = formData.get("intent");
    return action(intent === "publish" || intent === "submit" ? intent : "draft", prev, formData);
  };
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  const [coverPath, setCoverPath] = useState<string | null>(event?.coverPath ?? null);
  const [mode, setMode] = useState<RegistrationMode>(event?.registrationMode ?? "NONE");
  const fe = fieldErrors;

  // Inicializador preguiçoso: "agora" é lido uma vez só, não a cada render.
  const [preview, setPreview] = useState(() => ({
    id: event?.id ?? "preview",
    title: event?.title ?? "Título do evento",
    slug: event?.slug ?? "",
    startsAt: event?.startsAt ?? new Date(),
    endsAt: event?.endsAt ?? new Date(Date.now() + 3600_000),
    location: event?.location ?? null,
    registrationUrl: event?.registrationUrl ?? null,
    registrationMode: event?.registrationMode ?? "NONE",
    category: event?.category ?? null,
    coverPath: event?.coverPath ?? null,
  }));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <form {...formProps} className="flex flex-col gap-6">
        {event?.reviewNote ? (
          <div className="rounded-2xl border-2 border-danger/30 bg-danger/5 px-5 py-4 text-[15px] text-ink">
            <b>Devolvido pela mídia:</b> {event.reviewNote}
          </div>
        ) : null}
        {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}

        <FormField label="Título" htmlFor="title" error={fieldErrors?.title}>
          <input
            id="title"
            name="title"
            defaultValue={event?.title}
            onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
            className={fieldInputClass(!!fieldErrors?.title)}
            required
          />
        </FormField>

        <FormField label="Capa">
          {isEditor ? (
            <ImageDrop
              value={coverPath}
              name="coverPath"
              pathPrefix="eventos"
              onChange={(url) => {
                setCoverPath(url);
                setPreview((p) => ({ ...p, coverPath: url }));
              }}
            />
          ) : (
            <p className="rounded-xl bg-sand px-4 py-3 text-sm text-soft">
              Quem coloca a imagem é a Mídia, pra o site ficar com a mesma cara. Envie a imagem pra ela pelo
              WhatsApp e ela adiciona antes de publicar.
            </p>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Início" htmlFor="startsAt" error={fieldErrors?.startsAt}>
            <input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={toSaoPauloInput(event?.startsAt)}
              onChange={(e) => {
                const d = fromSaoPauloInput(e.target.value);
                if (d) setPreview((p) => ({ ...p, startsAt: d }));
              }}
              className={fieldInputClass(!!fieldErrors?.startsAt)}
              required
            />
          </FormField>
          <FormField label="Término" htmlFor="endsAt" error={fieldErrors?.endsAt}>
            <input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              defaultValue={toSaoPauloInput(event?.endsAt)}
              onChange={(e) => {
                const d = fromSaoPauloInput(e.target.value);
                if (d) setPreview((p) => ({ ...p, endsAt: d }));
              }}
              className={fieldInputClass(!!fieldErrors?.endsAt)}
              required
            />
          </FormField>
        </div>

        <FormField label="Local" htmlFor="location">
          <input
            id="location"
            name="location"
            defaultValue={event?.location ?? ""}
            onChange={(e) => setPreview((p) => ({ ...p, location: e.target.value }))}
            className={fieldInputClass()}
          />
        </FormField>

<fieldset className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
          <legend className="px-1 text-sm font-extrabold">Inscrições</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={
                  "flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border-2 px-4 py-3 text-[15px] " +
                  (mode === option.value ? "border-ink bg-sand" : "border-line")
                }
              >
                <span className="flex items-center gap-2 font-extrabold">
                  <input
                    type="radio"
                    name="registrationMode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => {
                      setMode(option.value);
                      setPreview((p) => ({ ...p, registrationMode: option.value }));
                    }}
                    className="size-4 accent-ink"
                  />
                  {option.label}
                </span>
                <span className="text-sm text-soft">{option.hint}</span>
              </label>
            ))}
          </div>

          {mode === "EXTERNAL" ? (
            <FormField label="Link do formulário" htmlFor="registrationUrl" error={fe?.registrationUrl}>
              <input
                id="registrationUrl"
                name="registrationUrl"
                type="url"
                placeholder="https://..."
                defaultValue={event?.registrationUrl ?? ""}
                onChange={(e) => setPreview((p) => ({ ...p, registrationUrl: e.target.value }))}
                className={fieldInputClass(!!fe?.registrationUrl)}
              />
            </FormField>
          ) : null}

          {mode === "INTERNAL" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Vagas (opcional)" htmlFor="capacity" error={fe?.capacity}>
                  <input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min={1}
                    placeholder="Sem limite"
                    defaultValue={event?.capacity ?? ""}
                    className={fieldInputClass(!!fe?.capacity)}
                  />
                </FormField>
                <FormField label="Inscrições até (opcional)" htmlFor="registrationClosesOn" error={fe?.registrationClosesOn}>
                  <input
                    id="registrationClosesOn"
                    name="registrationClosesOn"
                    type="date"
                    defaultValue={dateInputFromClosesAt(event?.registrationClosesAt)}
                    className={fieldInputClass(!!fe?.registrationClosesOn)}
                  />
                </FormField>
              </div>
              <p className="-mt-2 text-sm text-soft">
                Vagas contam pessoas. Sem data, as inscrições ficam abertas até o início do evento.
              </p>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-extrabold">Perguntar também</p>
                <label className="flex min-h-11 items-center gap-3 text-[15px]">
                  <input type="checkbox" name="askPartySize" defaultChecked={event?.askPartySize} className="size-5 accent-ink" />
                  Quantas pessoas vêm
                </label>
                <label className="flex min-h-11 items-center gap-3 text-[15px]">
                  <input type="checkbox" name="askFirstTime" defaultChecked={event?.askFirstTime} className="size-5 accent-ink" />
                  É sua primeira vez na igreja?
                </label>
              </div>
              <p className="text-sm text-soft">
                Nome e WhatsApp são sempre pedidos. O QR code e a lista de inscritos ficam na aba “Inscrições” do
                evento, depois de salvar.
              </p>
            </>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Categoria" htmlFor="categoryId">
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={event?.categoryId ?? ""}
              onChange={(e) => {
                const category = categories.find((c) => c.id === e.target.value) ?? null;
                setPreview((p) => ({ ...p, category }));
              }}
              className={fieldInputClass()}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ministério" htmlFor="ministryId">
            <select id="ministryId" name="ministryId" defaultValue={event?.ministryId ?? ""} className={fieldInputClass()}>
              <option value="">Sem ministério</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Descrição" htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={event?.description ?? ""}
            className={fieldInputClass() + " h-auto py-3"}
          />
        </FormField>

        {isEditor ? (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="isFeatured" defaultChecked={event?.isFeatured} className="size-4" />
            Destacar na home
          </label>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            name="intent"
            value={isEditor ? "publish" : "submit"}
            className="rounded-full bg-ink px-8 py-4 text-[15px] font-extrabold text-paper disabled:opacity-50"
          >
            {isEditor ? "Publicar evento" : "Enviar para aprovação"}
          </button>
          <button
            type="submit"
            disabled={pending}
            name="intent"
            value="draft"
            className="rounded-full border-2 border-ink px-8 py-4 text-[15px] font-extrabold disabled:opacity-50"
          >
            Salvar rascunho
          </button>
          {event ? (
            <button
              type="button"
              onClick={() => router.push("/backstage/eventos")}
              className="rounded-full px-8 py-4 text-[15px] font-extrabold text-soft"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-caps text-soft">Prévia</p>
        <EventCard event={preview} />
      </div>
    </div>
  );
}
