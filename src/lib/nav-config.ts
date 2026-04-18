// ---------------------------------------------------------------
// Delt nav-konfiguration — bruges af både app-sidebar og mobile-nav
// ---------------------------------------------------------------
//
// Vi holder sandheden ét sted så mobil- og desktop-navigation altid
// stemmer overens. Sidebar grupperer items i sektioner (Overblik /
// Portefølje / Ressourcer) og viser Søg + Indstillinger separat
// (hhv. øverst og nederst). Mobile-nav viser en flad liste inkl.
// Søg og Indstillinger.

import {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Settings,
  Calendar,
  Users,
  Briefcase,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NavItem, NavSection } from '@/types/ui'

/**
 * Ikon-map: mapper iconName-strings (fra NavItem) til faktiske
 * Lucide-komponenter. Bruges af både sidebar og mobile-nav.
 *
 * Inkluderer Search og Settings i tillæg til de 8 ikoner i NavItem-
 * typen, så den flade mobil-liste kan bruge samme map.
 */
export const ICON_MAP = {
  LayoutDashboard,
  Building2,
  FileText,
  CheckSquare,
  FolderOpen,
  Calendar,
  Users,
  Briefcase,
  Search,
  Settings,
} as const satisfies Record<string, LucideIcon>

export type NavIconName = keyof typeof ICON_MAP

/**
 * Flad mobile-variant af et nav-item. Bruger en bredere iconName-
 * union end NavItem (som kun dækker de 8 grupperede ikoner), fordi
 * mobile-nav også inkluderer Søg og Indstillinger i samme liste.
 */
export interface MobileNavItem {
  name: string
  href: string
  iconName: NavIconName
}

/**
 * Grupperet navigation til app-sidebar.
 * Søg og Indstillinger er IKKE med her — de renderes separat i
 * sidebaren (Søg øverst, Indstillinger nederst).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overblik',
    items: [
      { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard', badgeKey: 'dashboard' },
      { name: 'Kalender', href: '/calendar', iconName: 'Calendar', badgeKey: 'calendar' },
    ],
  },
  {
    label: 'Portefølje',
    items: [
      { name: 'Selskaber', href: '/companies', iconName: 'Building2', badgeKey: 'portfolio' },
      { name: 'Kontrakter', href: '/contracts', iconName: 'FileText', badgeKey: 'contracts' },
      { name: 'Sager', href: '/cases', iconName: 'Briefcase', badgeKey: 'cases' },
      { name: 'Opgaver', href: '/tasks', iconName: 'CheckSquare', badgeKey: 'tasks' },
    ],
  },
  {
    label: 'Ressourcer',
    items: [
      { name: 'Dokumenter', href: '/documents', iconName: 'FolderOpen', badgeKey: 'documents' },
      { name: 'Personer', href: '/persons', iconName: 'Users', badgeKey: 'persons' },
    ],
  },
]

/**
 * Flad liste til mobile-nav drawer.
 * Rækkefølge bevaret præcis som i den oprindelige mobile-nav.tsx:
 * Søg først, så sections-items i orden, Indstillinger sidst.
 *
 * BEMÆRK: Søg og Indstillinger er kun i den flade liste — sidebaren
 * renderer dem separat (ikke som del af NAV_SECTIONS). Mobile-nav
 * har derfor Søg og Indstillinger her; sidebaren bruger NAV_SECTIONS
 * plus sine egne Søg-/Indstillinger-links.
 */
export const NAV_ITEMS: MobileNavItem[] = [
  { name: 'Søg', href: '/search', iconName: 'Search' },
  ...NAV_SECTIONS.flatMap<MobileNavItem>((section) =>
    section.items.map((item) => ({
      name: item.name,
      href: item.href,
      iconName: item.iconName,
    }))
  ),
  { name: 'Indstillinger', href: '/settings', iconName: 'Settings' },
]

export type { NavItem, NavSection }
