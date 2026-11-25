import { getActor, hasRole, describeRoles } from "@/lib/auth-and-audit";
import { isPanelVerified } from "@/lib/panel-gate";
import { countNewRegistrations } from "@/lib/registrations";
import { AdminShell } from "@/components/admin/AdminShell";
import { PanelGateScreen } from "@/components/admin/PanelGateScreen";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!(await isPanelVerified(actor.id))) {
    return <PanelGateScreen />;
  }

  const permissions = {
    isAdmin: hasRole(actor, "ADMIN"),
    isEditor: hasRole(actor, "MIDIA"),
    isLeader: actor.roles.some((r) => r.role === "LIDER"),
  };
  const newRegistrations = await countNewRegistrations(actor);

  return (
    <AdminShell actorName={actor.name} roleLabel={describeRoles(actor)} permissions={permissions} newRegistrations={newRegistrations}>
      {children}
      <Toaster position="bottom-right" />
    </AdminShell>
  );
}
