"use client";

import { useActionState } from "react";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { updateLiveChannels, type LiveActionState } from "@/lib/actions/live";
import { useFormSubmit } from "@/lib/use-form-submit";

export function LiveChannelsForm({ youtube, spotify }: { youtube: string | null; spotify: string | null }) {
  const [state, formAction, pending] = useActionState<LiveActionState, FormData>(updateLiveChannels, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  return (
    <form {...formProps} className="flex flex-col gap-4">
      {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Canal no YouTube" htmlFor="channel-youtube" error={fieldErrors?.youtube}>
          <input
            id="channel-youtube"
            name="youtube"
            type="url"
            placeholder="https://youtube.com/@…"
            defaultValue={youtube ?? ""}
            className={fieldInputClass(!!fieldErrors?.youtube)}
          />
        </FormField>
        <FormField label="Perfil ou podcast no Spotify" htmlFor="channel-spotify" error={fieldErrors?.spotify}>
          <input
            id="channel-spotify"
            name="spotify"
            type="url"
            placeholder="https://open.spotify.com/show/…"
            defaultValue={spotify ?? ""}
            className={fieldInputClass(!!fieldErrors?.spotify)}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar canais"}
        </button>
        {state?.ok && !pending ? (
          <p role="status" className="text-sm font-bold text-success">
            Canais salvos.
          </p>
        ) : null}
      </div>
    </form>
  );
}
