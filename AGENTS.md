<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Tester Agent authentication

**Do not register new users** in automated Tester Agent, E2E, or cloud-agent flows. The API seeds dedicated testing accounts via the luna_pos_service migration *Add role constants and seed dedicated testing accounts migration*.

Use the shared constants in `src/testing/accounts.ts` (`TEST_ACCOUNTS`) or the helpers in `src/testing/auth.ts`:

| Scenario | Account | Login path |
|----------|---------|------------|
| Admin dashboard / user management | `admin` → `admin-test@cymonevo.com` | `/admin/login` |
| Manager workflows | `manager` → `manager-test@cymonevo.com` | `/admin/login` |
| POS / cashier flows | `cashier` → `cashier-test@cymonevo.com` | `/login` |
| Operational workflows | `operational` → `operation-test@cymonevo.com` | `/admin/login` |

Default password for all accounts: `LunaTesting123!`

### How to authenticate

1. Call `POST /api/v1/auth/login` with the role-appropriate email and password from `TEST_ACCOUNTS`, **or** use the app login UI at the path above.
2. Use the returned `access_token` as `Authorization: Bearer <token>` for API requests.
3. Reuse the same session/token across steps within a scenario — do not create a new user per run.

```ts
import { loginAsTestAccount, TEST_ACCOUNTS } from "@/testing";

// API / programmatic login (never calls /api/v1/auth/register)
const { user, tokens } = await loginAsTestAccount("admin");
```

Non-production environments may override credentials via `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_MANAGER_EMAIL`, etc.

**Never** call `POST /api/v1/auth/register` or walk through UI registration/signup to set up Tester Agent state. Manual registration UX for real users is unchanged.
