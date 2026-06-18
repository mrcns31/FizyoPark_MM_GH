import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/** Drawer aç/kapa durumu — RoleShell tarafından sağlanır. */
interface DrawerCtx {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const Ctx = createContext<DrawerCtx | null>(null);

export function useDrawer(): DrawerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDrawer must be used within RoleShell');
  return v;
}

export { Ctx as DrawerContext };
