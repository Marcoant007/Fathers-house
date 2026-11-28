import { describe, expect, it } from "vitest";
import { canManageMinistry, canWriteContent, hasRole, isEditor, isLeader, describeRoles, diff, type RoleHolder } from "./access";

// ministryId serve de nome do ministério nos testes ("Jovens" → "Líder (Jovens)").
function actorWith(roles: { role: "ADMIN" | "MIDIA" | "LIDER"; ministryId: string | null }[]): RoleHolder {
  return { roles: roles.map((r) => ({ ...r, ministry: r.ministryId ? { name: r.ministryId } : null })) };
}

describe("hasRole", () => {
  it("denies a role the actor doesn't have", () => {
    const lider = actorWith([{ role: "LIDER", ministryId: "jovens" }]);
    expect(hasRole(lider, "MIDIA")).toBe(false);
  });

  it("grants any role check to an ADMIN, regardless of ministry", () => {
    const admin = actorWith([{ role: "ADMIN", ministryId: null }]);
    expect(hasRole(admin, "MIDIA")).toBe(true);
    expect(hasRole(admin, "LIDER", "qualquer-ministerio")).toBe(true);
  });

  it("scopes LIDER to the matching ministry only", () => {
    const lider = actorWith([{ role: "LIDER", ministryId: "jovens" }]);
    expect(hasRole(lider, "LIDER", "jovens")).toBe(true);
    expect(hasRole(lider, "LIDER", "casais")).toBe(false);
  });

  it("treats an unspecified ministryId as 'any ministry with this role'", () => {
    const lider = actorWith([{ role: "LIDER", ministryId: "jovens" }]);
    expect(hasRole(lider, "LIDER")).toBe(true);
  });

  it("denies everything for an actor with no roles", () => {
    const noRole = actorWith([]);
    expect(hasRole(noRole, "LIDER")).toBe(false);
    expect(hasRole(noRole, "MIDIA")).toBe(false);
  });
});

describe("isEditor", () => {
  it("is true for MIDIA and ADMIN, false for LIDER-only", () => {
    expect(isEditor(actorWith([{ role: "MIDIA", ministryId: null }]))).toBe(true);
    expect(isEditor(actorWith([{ role: "ADMIN", ministryId: null }]))).toBe(true);
    expect(isEditor(actorWith([{ role: "LIDER", ministryId: "jovens" }]))).toBe(false);
  });
});

describe("canManageMinistry", () => {
  it("Mídia e Admin cuidam de todos os ministérios; líder só dos dele; sem papel, nenhum", () => {
    expect(canManageMinistry(actorWith([{ role: "MIDIA", ministryId: null }]), "kids")).toBe(true);
    expect(canManageMinistry(actorWith([{ role: "ADMIN", ministryId: null }]), "kids")).toBe(true);
    expect(canManageMinistry(actorWith([{ role: "LIDER", ministryId: "kids" }]), "kids")).toBe(true);
    expect(canManageMinistry(actorWith([{ role: "LIDER", ministryId: "midia" }]), "kids")).toBe(false);
    expect(canManageMinistry(actorWith([]), "kids")).toBe(false);
  });
});

describe("canWriteContent", () => {
  it("lets Mídia, Admin and leaders write events/avisos, but nobody without a role", () => {
    expect(canWriteContent(actorWith([]))).toBe(false);
    expect(isLeader(actorWith([]))).toBe(false);
    expect(canWriteContent(actorWith([{ role: "MIDIA", ministryId: null }]))).toBe(true);
    expect(canWriteContent(actorWith([{ role: "ADMIN", ministryId: null }]))).toBe(true);
    expect(canWriteContent(actorWith([{ role: "LIDER", ministryId: "kids" }]))).toBe(true);
    expect(isLeader(actorWith([{ role: "LIDER", ministryId: null }]))).toBe(false);
  });
});

describe("describeRoles", () => {
  it("flags an actor with no roles assigned", () => {
    expect(describeRoles(actorWith([]))).toBe("Sem papel atribuído");
  });

  it("names the ministry of each leader role, in alphabetical order", () => {
    const multiMinistryLider = actorWith([
      { role: "LIDER", ministryId: "Jovens" },
      { role: "LIDER", ministryId: "Casais" },
    ]);
    expect(describeRoles(multiMinistryLider)).toBe("Líder (Casais) · Líder (Jovens)");
  });

  it("lists global roles first, joined with a middle dot", () => {
    const editorAndLider = actorWith([
      { role: "LIDER", ministryId: "Mídia" },
      { role: "MIDIA", ministryId: null },
    ]);
    expect(describeRoles(editorAndLider)).toBe("Mídia · Líder (Mídia)");
  });
});

describe("diff", () => {
  it("only reports fields that actually changed", () => {
    const before = { title: "Culto", status: "DRAFT", updatedAt: new Date(0), updatedById: "a" };
    const after = { title: "Culto novo", status: "DRAFT", updatedAt: new Date(1), updatedById: "b" };

    expect(diff(before, after)).toEqual({ title: { from: "Culto", to: "Culto novo" } });
  });

  it("ignores bookkeeping fields even when they change", () => {
    const before = { updatedAt: new Date(0), updatedById: "a" };
    const after = { updatedAt: new Date(1), updatedById: "b" };

    expect(diff(before, after)).toEqual({});
  });
});
