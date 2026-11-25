"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { ColorPicker } from "@/components/admin/ColorPicker";
import { ThemePreview } from "@/components/admin/ThemePreview";
import { ImageDrop } from "@/components/admin/ImageDrop";
import { DEFAULT_ABOUT_IMAGE, DEFAULT_HERO_IMAGE } from "@/lib/site-config";
import { DEFAULT_ACCENT } from "@/lib/theme";
import { updateSiteSettings, type SiteSettingsActionState } from "@/lib/actions/site-settings";
import { useFormSubmit } from "@/lib/use-form-submit";


export function AparenciaForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  // Qual botão foi clicado vem no próprio envio (name="intent" nos botões).
  const boundAction = (prev: SiteSettingsActionState, formData: FormData) =>
    updateSiteSettings(formData.get("intent") === "reset" ? "reset" : "apply", prev, formData);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);
  const [color, setColor] = useState(settings.accentColor);
  const [heroImage, setHeroImage] = useState<string | null>(settings.heroImagePath);
  const [aboutImage, setAboutImage] = useState<string | null>(settings.aboutImagePath);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <form {...formProps} className="flex flex-col gap-8">
        {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold">Cor de destaque</h2>
          <input type="hidden" name="accentColor" value={color} />
          <ColorPicker value={color} onChange={setColor} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Fotos da página inicial</h2>
            <p className="text-sm text-soft">
              Use foto deitada (horizontal), de boa qualidade, até 5 MB. Sem foto escolhida, o site usa a foto
              padrão mostrada ao lado. Depois de trocar, clique em “Aplicar no site”.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <HomePhotoField
              label="Foto do topo"
              hint="A grande, no começo da página, com o “Próximo culto” por cima."
              name="heroImagePath"
              value={heroImage}
              onChange={setHeroImage}
              fallback={DEFAULT_HERO_IMAGE}
              error={fieldErrors?.heroImagePath}
            />
            <HomePhotoField
              label="Foto do “Quem somos”"
              hint="No bloco “Uma família construída sobre a Rocha”."
              name="aboutImagePath"
              value={aboutImage}
              onChange={setAboutImage}
              fallback={DEFAULT_ABOUT_IMAGE}
              error={fieldErrors?.aboutImagePath}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold">Dados da igreja</h2>
          <FormField label="Endereço" htmlFor="address" error={fieldErrors?.address}>
            <input
              id="address"
              name="address"
              defaultValue={settings.address ?? ""}
              className={fieldInputClass(!!fieldErrors?.address)}
            />
          </FormField>
          <FormField label="Link do mapa" htmlFor="mapsUrl" error={fieldErrors?.mapsUrl}>
            <input
              id="mapsUrl"
              name="mapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
              defaultValue={settings.mapsUrl ?? ""}
              className={fieldInputClass(!!fieldErrors?.mapsUrl)}
            />
          </FormField>
          <FormField label="WhatsApp" htmlFor="whatsapp" error={fieldErrors?.whatsapp}>
            <input
              id="whatsapp"
              name="whatsapp"
              placeholder="5527999999999"
              defaultValue={settings.whatsapp ?? ""}
              className={fieldInputClass(!!fieldErrors?.whatsapp)}
            />
          </FormField>
          <FormField label="Chave Pix" htmlFor="pixKey" error={fieldErrors?.pixKey}>
            <input
              id="pixKey"
              name="pixKey"
              defaultValue={settings.pixKey ?? ""}
              className={fieldInputClass(!!fieldErrors?.pixKey)}
            />
            <p className="text-sm text-soft">
              Aparece na seção Contribua. As fotos dos projetos que ficam do lado são cadastradas em{" "}
              <a href="/backstage/projetos" className="font-extrabold underline">
                Projetos
              </a>
              .
            </p>
          </FormField>
          <FormField label="Instagram" htmlFor="instagram" error={fieldErrors?.instagram}>
            <input
              id="instagram"
              name="instagram"
              type="url"
              placeholder="https://instagram.com/..."
              defaultValue={settings.instagram ?? ""}
              className={fieldInputClass(!!fieldErrors?.instagram)}
            />
          </FormField>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">E-mails de contato</h2>
            <p className="text-sm text-soft">
              Aparecem no rodapé de todas as páginas e no tira-dúvidas. Deixe vazio o que a igreja não usa.
            </p>
          </div>
          <FormField label="E-mail da Secretaria" htmlFor="secretaryEmail" error={fieldErrors?.secretaryEmail}>
            <input
              id="secretaryEmail"
              name="secretaryEmail"
              type="email"
              placeholder="ex.: secretaria@familiaalicerce.com.br"
              defaultValue={settings.secretaryEmail ?? ""}
              className={fieldInputClass(!!fieldErrors?.secretaryEmail)}
            />
            <p className="text-sm text-soft">Para dúvidas gerais, visitas e pedidos.</p>
          </FormField>
          <FormField label="E-mail do Financeiro" htmlFor="financeEmail" error={fieldErrors?.financeEmail}>
            <input
              id="financeEmail"
              name="financeEmail"
              type="email"
              placeholder="ex.: financeiro@familiaalicerce.com.br"
              defaultValue={settings.financeEmail ?? ""}
              className={fieldInputClass(!!fieldErrors?.financeEmail)}
            />
            <p className="text-sm text-soft">Também aparece na página Contribua, para dúvidas sobre dízimos e ofertas.</p>
          </FormField>
          <FormField label="E-mail do Administrativo" htmlFor="adminEmail" error={fieldErrors?.adminEmail}>
            <input
              id="adminEmail"
              name="adminEmail"
              type="email"
              placeholder="ex.: administrativo@familiaalicerce.com.br"
              defaultValue={settings.adminEmail ?? ""}
              className={fieldInputClass(!!fieldErrors?.adminEmail)}
            />
            <p className="text-sm text-soft">Para parcerias, fornecedores e assuntos da administração.</p>
          </FormField>
        </section>

        <p className="rounded-2xl bg-sand px-5 py-4 text-sm">
          Procurando a live do culto ou os links do YouTube e Spotify? Agora eles ficam no menu{" "}
          <Link href="/backstage/live" className="font-extrabold underline">
            Live
          </Link>
          .
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            name="intent"
            value="apply"
            className="rounded-full bg-ink px-8 py-4 text-[15px] font-extrabold text-paper disabled:opacity-50"
          >
            Aplicar no site
          </button>
          <button
            type="submit"
            disabled={pending}
            name="intent"
            value="reset"
            onClick={() => setColor(DEFAULT_ACCENT)}
            className="rounded-full border-2 border-ink px-8 py-4 text-[15px] font-extrabold disabled:opacity-50"
          >
            Restaurar padrão
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <p className="label-caps text-soft">Prévia</p>
        <ThemePreview color={color} />
      </div>
    </div>
  );
}

function HomePhotoField({
  label,
  hint,
  name,
  value,
  onChange,
  fallback,
  error,
}: {
  label: string;
  hint: string;
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  fallback: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-extrabold">{label}</p>
      <p className="text-sm text-soft">{hint}</p>
      <ImageDrop value={value} onChange={onChange} name={name} pathPrefix="home" />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-sm font-extrabold underline"
        >
          Voltar pra foto padrão
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
            <Image src={fallback} alt="" fill sizes="80px" className="object-cover" />
          </span>
          <span className="text-sm text-soft">Usando a foto padrão.</span>
        </div>
      )}
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
    </div>
  );
}
