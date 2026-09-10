export type AppRole = "admin" | "user" | undefined;
export type NavigationItem = { label: string; path: "/" | "/gestao" | "/administradores"; icon: "schools" | "management" | "administrators" | "inventory" };

export function getNavigationItemsForRole(role: AppRole): NavigationItem[] {
  if (role === "admin") {
    return [
      { icon: "management", label: "Gestão e consolidação", path: "/gestao" },
      { icon: "schools", label: "Escolas", path: "/" },
      { icon: "administrators", label: "Administradores", path: "/administradores" },
    ];
  }
  return [{ icon: "inventory", label: "Meu inventário", path: "/" }];
}
