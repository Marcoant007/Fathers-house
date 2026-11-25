import {
  Baby,
  BookOpen,
  CalendarDays,
  Camera,
  Car,
  ChefHat,
  Church,
  Coffee,
  DoorOpen,
  Drama,
  Flame,
  Flower2,
  Globe,
  HandHeart,
  HandHelping,
  Heart,
  House,
  Music,
  Shield,
  ShieldCheck,
  Sparkles,
  Speaker,
  Stethoscope,
  ToyBrick,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ministryIconKey, type MinistryIconKey } from "@/lib/ministry-icons";

export const MINISTRY_ICON_COMPONENTS: Record<MinistryIconKey, LucideIcon> = {
  louvor: Music,
  midia: Camera,
  som: Speaker,
  kids: ToyBrick,
  bebes: Baby,
  jovens: Zap,
  casais: Heart,
  familia: Users,
  homens: Shield,
  mulheres: Flower2,
  profetico: Flame,
  oracao: HandHeart,
  cozinha: ChefHat,
  cafe: Coffee,
  estacionamento: Car,
  recepcao: DoorOpen,
  programacao: CalendarDays,
  ensino: BookOpen,
  celulas: House,
  missoes: Globe,
  social: HandHelping,
  danca: Sparkles,
  teatro: Drama,
  saude: Stethoscope,
  seguranca: ShieldCheck,
  igreja: Church,
};

/** Ícone decorativo do ministério (o nome sempre aparece ao lado). */
export function MinistryIcon({
  ministry,
  iconKey,
  size = 20,
  className,
}: {
  ministry?: { name: string; icon?: string | null };
  iconKey?: MinistryIconKey;
  size?: number;
  className?: string;
}) {
  const Icon = MINISTRY_ICON_COMPONENTS[iconKey ?? (ministry ? ministryIconKey(ministry) : "igreja")];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" className={className} />;
}
