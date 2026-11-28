import { getActor, hasRole, describeRoles, isLeader } from "@/lib/auth-and-audit";
import { isPanelVerified } from "@/lib/panel-gate";
import { countNewRegistrations } from "@/lib/registrations";
import { AdminShell } from "@/components/admin/AdminShell";
import { PanelGateScreen } from "@/components/admin/PanelGateScreen";
import { Toaster } from "@/components/ui/sonner";
import { WaitingForAccess } from "@/components/admin/WaitingForAccess";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!(await isPanelVerified(actor.id))) {
    return <PanelGateScreen />;
  }

  const permissions = {
    isAdmin: hasRole(actor, "ADMIN"),
    isEditor: hasRole(actor, "MIDIA"),
    isLeader: isLeader(actor),
  };
  const newRegistrations = await countNewRegistrations(actor);

  return (
    <AdminShell actorName={actor.name} roleLabel={describeRoles(actor)} permissions={permissions} newRegistrations={newRegistrations}>
      {actor.roles.length > 0 ? children : <WaitingForAccess />}
      <Toaster position="bottom-right" />
    </AdminShell>
  );
}
