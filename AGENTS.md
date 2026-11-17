<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Order prices and totals are computed only in the database (`create_order` reads the `products` table); the browser sends product ids and quantities only — so customers cannot change prices.
- Orders are never readable by anon: customers track orders through the `track_order` function (order number + last 4 phone digits) which returns no personal data; admins read via RLS + `has_role`.
- Order status changes go through `admin_set_status`, which checks the admin role and enforces the allowed transitions — so the panel cannot skip steps.
- Admin roles live in `public.user_roles`; public sign-up is disabled and admins are added by the owner — so no visitor can create staff accounts.
- Form rules live in `src/lib/checkout-schema.ts` and are shared by the browser and server functions — one source for validation.
- Security headers are added in `src/server.ts`; frame restrictions are left out because the editor previews the app in an iframe.
