import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, Wallet, FileText,
  Megaphone, Briefcase, Target, LifeBuoy, BarChart3, Settings, User, ShieldCheck, CalendarHeart,
  Radio, Layers, Contact,
} from 'lucide-react'
import { PERMS } from '../data/accounts.js'

// The app's navigation, shared by the desktop sidebar and the phone menu.
// Every item declares the permission it needs; a group disappears when none
// of its items are permitted. `tint` colours the item's tile on the phone.
export const NAV_GROUPS = [
  { title: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: PERMS.SELF, tint: '#2563EB' },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, perm: PERMS.SELF, tint: '#D97706' },
    { to: '/engage', label: 'Engage', icon: Radio, perm: PERMS.SELF, tint: '#DB2777' },
  ]},
  { title: 'My Workspace', items: [
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck, perm: PERMS.SELF, tint: '#16A34A' },
    { to: '/leave', label: 'Leave', icon: CalendarDays, perm: PERMS.SELF, tint: '#7C3AED' },
    { to: '/holidays', label: 'Holiday Calendar', short: 'Holidays', icon: CalendarHeart, perm: PERMS.SELF, tint: '#DC2626' },
    { to: '/payroll', label: 'Payroll', icon: Wallet, perm: PERMS.SELF, tint: '#059669' },
    { to: '/documents', label: 'Document Center', short: 'Documents', icon: FileText, perm: PERMS.SELF, tint: '#0891B2' },
    { to: '/requests', label: 'Request Hub', short: 'Requests', icon: Layers, perm: PERMS.SELF, tint: '#EA580C' },
    { to: '/people', label: 'People', icon: Contact, perm: PERMS.SELF, tint: '#4F46E5' },
    { to: '/performance', label: 'Performance', icon: Target, perm: PERMS.SELF, tint: '#CA8A04' },
    { to: '/profile', label: 'My Profile', short: 'Profile', icon: User, perm: PERMS.SELF, tint: '#0EA5E9' },
  ]},
  { title: 'People Ops', items: [
    { to: '/employees', label: 'Employees', icon: Users, perm: PERMS.HR_PEOPLE, tint: '#1D4ED8' },
    { to: '/recruitment', label: 'Recruitment', icon: Briefcase, perm: PERMS.HR_HIRING, tint: '#9333EA' },
    { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, perm: PERMS.HR_DESK, tint: '#E11D48' },
    { to: '/reports', label: 'Reports', icon: BarChart3, perm: PERMS.HR_REPORTS, tint: '#0D9488' },
  ]},
  { title: 'Administration', items: [
    { to: '/settings', label: 'Settings', icon: Settings, perm: PERMS.ADMIN_SETTINGS, tint: '#64748B' },
    { to: '/system', label: 'System Admin', icon: ShieldCheck, perm: PERMS.ADMIN_SYSTEM, tint: '#6366F1' },
  ]},
]

/** The groups and items this person may open. */
export const navFor = (can) => NAV_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) }))
  .filter((g) => g.items.length > 0)
