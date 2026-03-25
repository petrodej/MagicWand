# MagicWand Enterprise UI Redesign

**Goal:** Transform the current prototype UI into a clean, minimal enterprise SaaS aesthetic (Linear/Vercel style) with teal accent color and persistent sidebar navigation.

**Tech Stack:** React, Tailwind CSS 4, @base-ui/react, Lucide icons, Geist font (existing)

---

## Visual Language

### Color Palette
- **Background primary**: `gray-950` (#0a0a0b) — main content area
- **Background secondary**: `gray-900` — cards, sidebar
- **Background elevated**: `gray-800/50` — hover states, subtle elevation
- **Border**: `gray-800` at reduced opacity — minimal, only where needed for grouping
- **Text primary**: `gray-100` — headings, important content
- **Text secondary**: `gray-500` — labels, metadata
- **Text muted**: `gray-600` — timestamps, tertiary info
- **Accent**: `teal-400` (text), `teal-500` (buttons, active indicators), `teal-500/10` (subtle backgrounds)
- **Status online**: `emerald-500` with subtle glow
- **Status offline**: `gray-600` dot, no glow — absence of green, not red

### Typography
- Geist Variable (keep existing)
- Page titles: `text-xl font-semibold text-gray-100`
- Card titles: `text-sm font-medium text-gray-100`
- Metadata: `text-xs text-gray-500`
- Monospace: `font-mono` for hostnames, IPs, commands

### Spacing
- More whitespace than current design
- Cards: `p-5` with `gap-6` between them
- Sections: `space-y-6`
- Page padding: `p-8`

### Borders & Elevation
- Prefer spacing and background shifts over visible borders
- Cards: `border border-gray-800/50 rounded-xl` — very subtle
- Card hover: `hover:border-gray-700/50` — barely perceptible shift
- No drop shadows — flat design

---

## Layout: Sidebar + Main Content

### Sidebar (fixed left)
- **Width**: 240px default, 64px collapsed (icon-only)
- **Background**: `gray-900` with right border `border-gray-800/50`
- **Top**: Logo — "MagicWand" wordmark or icon mark when collapsed
- **Nav items**: Icon + label, `text-gray-500` default, `text-gray-100 bg-gray-800/50` when active, teal left border indicator on active item
- **Items for now**: Dashboard (monitor icon)
- **Bottom**: User section — email truncated, logout button
- **Collapse toggle**: Chevron button at bottom of sidebar or on hover

### Main Content Area
- Fills remaining width right of sidebar
- Scrollable independently
- Padding: `p-8`
- Max content width: none (fill available)

---

## Pages

### Login (`/login`)
- Full viewport, pure `gray-950` background
- Centered card: `max-w-sm`, `bg-gray-900 border border-gray-800/50 rounded-xl p-8`
- Logo: Teal-colored icon/mark + "MagicWand" in `text-gray-100 text-xl font-semibold`
- Subtitle: `text-gray-500 text-sm` — "Remote Management Platform"
- Inputs: `bg-gray-800/50 border-gray-800 rounded-lg` — minimal, dark
- Sign-in button: `bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium rounded-lg`
- Error: `text-red-400 text-sm`
- No credentials hint (unprofessional for enterprise)
- No sidebar on login page

### Dashboard (`/dashboard`)
- **Header area**: Page title "Computers" (`text-xl font-semibold`) with count badge (`text-gray-500`), right-aligned "Add Computer" button (`bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20`)
- **Computer grid**: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
- **Empty state**: Centered, icon + "No computers yet" + "Add Computer" CTA
- **Loading**: Subtle skeleton or spinner

### Computer Card (in dashboard grid)
- Container: `bg-gray-900 border border-gray-800/50 rounded-xl p-5 cursor-pointer hover:border-gray-700/50 transition-colors`
- **Row 1**: Hostname (`text-sm font-medium text-gray-100`) + status dot (inline, right-aligned)
- **Row 2**: OS + IP as single line metadata (`text-xs text-gray-500 font-mono`)
- **Row 3** (only when online): Thin resource bars (2px height) for CPU (teal) and RAM (gray-400), with percentage labels
- **Click**: Navigates to `/computers/:id`
- **No action buttons on card** — all actions inside computer view

### Computer View (`/computers/:id`)
- Sidebar stays visible
- **Breadcrumb**: "Computers" (clickable, `text-gray-500`) / "Computer Name" (`text-gray-100`) + status dot
- **Tabs**: Underline style — `border-b border-gray-800`, tab text `text-gray-500`, active tab `text-gray-100 border-b-2 border-teal-500`
- **Tab: Overview**: System info in 2x2 grid of cards, same card style as dashboard but with more detail
- **Tab: AI Assistant**: Chat interface
- **Delete action**: Subtle danger button somewhere in overview, not prominent

### System Info Cards (in Overview tab)
- Card style: `bg-gray-900 border border-gray-800/50 rounded-xl p-5`
- Card header: Small icon (`text-gray-600 w-4 h-4`) + title (`text-xs font-medium text-gray-500 uppercase tracking-wider`)
- Card body: Data in `text-sm text-gray-300`
- Resource bars: 2px height, `bg-gray-800` track, teal fill
- More whitespace between items within cards

### AI Chat (in AI Assistant tab)
- **Messages area**: Scrollable, padding `p-6`
- **User messages**: Right-aligned, `bg-teal-500/10 text-gray-100 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[70%]`
- **Assistant messages**: Left-aligned, `bg-gray-900 border border-gray-800/50 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]`
- **Tool calls**: Compact, `bg-gray-950 border border-gray-800/50 rounded-lg`, teal function name, collapsible
- **Input area**: `border-t border-gray-800/50 p-4`, input `bg-gray-900 border-gray-800 rounded-xl`, send button as teal icon
- **Quick actions**: Pill buttons `border border-gray-800 rounded-full text-xs text-gray-500 hover:border-teal-500/30 hover:text-teal-400`
- **Thinking state**: Subtle pulsing dot or "Thinking..." in `text-gray-600`

### Add Computer Modal
- Dialog: `bg-gray-900 border border-gray-800/50 rounded-xl max-w-md`
- Title: "Add Computer" in `text-gray-100`
- Input: Same dark style as login
- Download button: `bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium`
- PowerShell command: Collapsible, `bg-gray-950 rounded-lg p-3 font-mono text-xs text-teal-400`
- Waiting state: Subtle animated indicator

---

## Files to Create/Modify

### Create
- `web/src/components/Sidebar.tsx` — new sidebar component

### Modify
- `web/src/pages/Login.tsx` — restyle with teal accent, remove credentials hint
- `web/src/pages/Dashboard.tsx` — add sidebar layout, restyle header and grid
- `web/src/pages/ComputerView.tsx` — add sidebar, breadcrumb header, underline tabs
- `web/src/components/ComputerCard.tsx` — simplify to click-to-open, remove action buttons, cleaner layout
- `web/src/components/AddComputerModal.tsx` — restyle with teal accent
- `web/src/components/StatusIndicator.tsx` — teal/emerald for online, gray for offline
- `web/src/components/SystemInfoPanel.tsx` — cleaner cards, more whitespace, thinner bars
- `web/src/components/AIChat.tsx` — teal user bubbles, refined input area
- `web/src/components/ChatMessage.tsx` — teal user messages, cleaner assistant messages
- `web/src/components/ToolCallDisplay.tsx` — teal function names, tighter spacing
- `web/src/index.css` — may need custom CSS vars for teal accent if not in Tailwind theme

### No changes
- `web/src/components/ui/*` — base UI components stay as-is, styling via className overrides
- `web/src/lib/api.ts` — no visual changes
- `web/src/stores/*` — no visual changes
- `web/src/hooks/*` — no visual changes

---

## Non-Goals
- No new features or functionality
- No backend changes
- No routing changes
- No new pages (settings, users, etc.) — just nav placeholders in sidebar
- No light mode
