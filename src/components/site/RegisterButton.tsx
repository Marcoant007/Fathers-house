import Link from "next/link";
import { Button } from "@/components/site/Button";
import { registrationHref } from "@/lib/registration-rules";

/** "Inscreva-se": formulário do site (FA-29) ou link externo, conforme o evento. */
export function RegisterButton({
  event,
  className,
  variant = "dark",
}: {
  event: { slug: string; registrationMode?: string | null; registrationUrl: string | null };
  className?: string;
  variant?: "dark" | "accent";
}) {
  const link = registrationHref(event);
  if (!link) return null;
  return (
    <Button
      variant={variant}
      className={className}
      render={
        link.external ? <a href={link.href} target="_blank" rel="noopener noreferrer" /> : <Link href={link.href} />
      }
    >
      Inscreva-se
    </Button>
  );
}
