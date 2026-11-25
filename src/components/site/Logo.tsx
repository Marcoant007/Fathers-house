import Image from "next/image";
import { cn } from "cn";
import { SITE_NAME } from "@/lib/site-config";

/**
 * Símbolo da Família Alicerce (o telhado), recortado de public/brand/logo-branca.png.
 * O arquivo é branco: sobre fundo claro vira preto com `brightness-0`.
 * A logo original é pequena (281×238) — quando a igreja mandar um SVG, trocar aqui.
 */
export function LogoMark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <Image
      src="/brand/simbolo-branco.png"
      alt=""
      aria-hidden="true"
      width={94}
      height={52}
      className={cn("h-8 w-auto shrink-0", !onDark && "brightness-0", className)}
    />
  );
}

export function Logo({
  onDark = false,
  iconClassName,
  textClassName,
  className,
}: {
  /** true quando o fundo é escuro (ink) e a marca já pode ficar clara */
  onDark?: boolean;
  iconClassName?: string;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onDark={onDark} className={iconClassName} />
      <span className={cn("font-black uppercase", textClassName)}>{SITE_NAME}</span>
    </span>
  );
}

/**
 * Só o desenho do símbolo, pintado com a cor do texto (`currentColor`) via
 * máscara CSS — serve pra pôr a marca sobre a cor de destaque (ex.:
 * `text-on-accent-icon`). Decorativo: quem usa dá o nome acessível.
 */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block aspect-[94/52] bg-current", className)}
      style={{
        maskImage: "url(/brand/simbolo-branco.png)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: "url(/brand/simbolo-branco.png)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
