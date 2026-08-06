# Agentic UX — Canonical UI choices (Phase 3.2 ongoing)

Opportunistic consolidation rule: when you touch a file that uses a non-canonical
provider/toast/keyboard helper, migrate that call site. Do **not** big-bang migrate.

## Canonical implementations (as of 2026-08-06)

| Concern | Canonical | Do not add new usage of |
|---------|-----------|-------------------------|
| Toast | `sonner` via `toast` from `sonner` + `lib/toast-utils.ts` (`toastWithUndo`) | `EnhancedToastSystem`, `toast-system/ToastSystem`, `feedback/EnhancedToast`, `feedback/ToastNotifications` (except existing call sites) |
| Theme | `EnterpriseThemeProvider` / app shell theme already wired in `layout.tsx` | Parallel `ThemeProvider.tsx` for new screens |
| Keyboard shortcuts | `providers/GlobalKeyboardShortcutsProvider` + existing shell shortcuts | New per-page `KeyboardShortcutsPanel` copies |
| Notifications bell | `components/ai/AgentNotificationBell` | `components/collaboration/NotificationCenter` (deleted), orphan bells |
| Chat surface | `components/ai/FloatingAIBubble` (`mode="floating" \| "embedded"`) | Hand-rolled chat UIs (e.g. removed Contigo Labs `EmbeddedChatInterface`) |
| Page shell | Prefer existing layout shell / dashboard card patterns | New full-page gradient wrapper systems without reuse |
| Tables / long lists | Existing DataTable patterns + `@tanstack/react-virtual` when ≥50 rows | Unvirtualized maps of large lists in new code |

## Contract detail routes

- **Canonical:** `app/contracts/[id]/page.tsx`
- **Removed:** `enhanced/`, `state-of-the-art/` (Phase 3.2)
