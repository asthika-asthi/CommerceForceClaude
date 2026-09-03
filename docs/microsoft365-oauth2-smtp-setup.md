# Microsoft 365 (Exchange Online) OAuth2 SMTP — Agency Runbook

**Purpose:** repeatable process for wiring a CommerceForce backend to send transactional
email through a client's Microsoft 365 mailbox using **OAuth2 (XOAUTH2)** on SMTP client
submission, when the client's tenant is managed by a **third‑party email/IT business**.

Use this whenever a client says "our email is Microsoft 365 / Outlook, managed by
\<someone else\>". Keep it as the checklist you hand that managing business.

> **Status of the code:** as of this writing `backend/app/shared/email.py` only does
> **Basic auth** SMTP (`aiosmtplib.send` with username + password). The XOAUTH2 code
> change is a separate, later step — see [§10](#10-code-change-later--do-not-start-without-instruction).
> This document is the infrastructure/process side, which can proceed independently.

---

## 1. Background — why OAuth2

- Microsoft is retiring **Basic authentication for SMTP AUTH client submission**. Basic
  auth still works in many tenants today but is on a deprecation path and is
  increasingly blocked by default or by Conditional Access / security defaults.
- "SMTP AUTH is enabled" from the managing business only means the **protocol**
  (authenticated submission on `smtp.office365.com:587`) is on. It does **not** tell you
  whether **Basic** or **OAuth2** is permitted as the auth mechanism. Always confirm.
- OAuth2 path = **client credentials flow** (a.k.a. daemon / app‑only): no user, no
  password, no interactive sign‑in. The app authenticates with its own identity
  (client ID + secret/certificate) and is authorised to send as one specific mailbox.

**Decision rule:** if the tenant still allows Basic SMTP AUTH and you need email working
*today*, do Basic now (licensed no‑reply mailbox + password) and schedule OAuth2 as the
durable fix. Otherwise go straight to OAuth2 using this runbook.

---

## 2. Who does what

| Role | Who | Steps they own |
|---|---|---|
| **Agency (us)** | CommerceForce dev | Decide app‑registration ownership, supply/consume IDs, do the code change, configure `.env`, test |
| **Entra (Azure AD) admin** | Managing business (or us, if agency‑hosted app) | App registration, API permission, admin consent, client secret/cert |
| **Exchange Online admin** | Managing business | `New-ServicePrincipal`, mailbox permission, Application Access Policy |
| **DNS admin** | Managing business (usually) | SPF / DKIM / DMARC for the sending domain |

Required admin roles on the client tenant:
- **Application Administrator** or **Cloud Application Administrator** — create app registration & secret.
- **Global Administrator** or **Privileged Role Administrator** — grant admin consent for `SMTP.SendAsApp`.
- **Exchange Administrator** — service principal + mailbox + access policy.

---

## 3. Choose who owns the app registration

Two valid models. Pick one per client and record it in the client's setup notes.

### Model A — Managing business registers the app in the client tenant *(recommended)*
- Single‑tenant app registration lives in the client's own Entra tenant.
- They send us the client ID, tenant ID, and secret.
- Cleanest trust boundary; consent is implicit (app is in their tenant); no multi‑tenant exposure.

### Model B — Agency registers a multi‑tenant app in our tenant
- One app registration we reuse across clients; each client's Global Admin grants
  admin consent in their tenant via a consent URL.
- We send them our client ID + our tenant ID + the consent URL.
- We hold the secret/cert (never leaves us). Good when we manage many clients, but every
  client tenant must still do the Exchange Online steps in [§6](#6-exchange-online-setup-managing-business).

Admin consent URL for Model B:
```
https://login.microsoftonline.com/<CLIENT_TENANT_ID>/adminconsent?client_id=<OUR_CLIENT_ID>
```

---

## 4. App registration (Entra ID)

Portal: <https://entra.microsoft.com> → **Identity → Applications → App registrations → New registration**.

1. **Name:** `CommerceForce SMTP Sender — <ClientName>`
2. **Supported account types:**
   - Model A → *Accounts in this organizational directory only (single tenant)*
   - Model B → *Accounts in any organizational directory (multitenant)*
3. **Redirect URI:** leave blank (client‑credentials flow uses none).
4. Register, then from **Overview** record:
   - **Application (client) ID** — GUID, not secret.
   - **Directory (tenant) ID** — the tenant the app lives in. For Model B you also need each
     *client's* tenant ID separately.
   - **Object ID** of the app registration (rarely needed).
5. Go to the matching **Enterprise application** (Entra → Enterprise applications → same
   name) and record its **Object ID** — this is the *service principal object ID* that
   Exchange PowerShell needs in [§6](#6-exchange-online-setup-managing-business). It is
   **different** from the app registration's Object ID.

---

## 5. API permission + admin consent

In the app registration → **API permissions → Add a permission**:

1. **APIs my organization uses** → search **Office 365 Exchange Online**
   (resource appId `00000002-0000-0ff1-ce00-000000000000`).
   - If it does not appear in the picker, add it via the app **Manifest**
     `requiredResourceAccess`, or have the admin run
     `New-ServicePrincipal -AppId 00000002-0000-0ff1-ce00-000000000000` first, or search
     by the appId directly.
2. **Application permissions** (not Delegated) → check **`SMTP.SendAsApp`**. Add.
3. **Do not** add Microsoft Graph `Mail.Send` — that is a different transport (Graph API),
   not SMTP, and is not what this runbook wires.
4. Click **Grant admin consent for \<tenant\>**. Status must show green ticks. For Model B
   the *client's* Global Admin does this in *their* tenant (consent URL in [§3](#3-choose-who-owns-the-app-registration)).

Verify later: the permission column should read *"Granted for \<tenant\>"* with no
"Not granted" warning.

---

## 6. Credentials — client secret vs certificate

App registration → **Certificates & secrets**.

### Option 1 — Client secret (simplest)
- **New client secret** → description `commerceforce-smtp` → expiry: pick the longest
  offered (Microsoft caps new secrets at **24 months**).
- **Copy the secret VALUE immediately** — it is shown once and never again. The
  *Secret ID* is not the value.
- Record the **expiry date** in the rotation calendar ([§12](#12-secret--certificate-rotation)).

### Option 2 — Certificate (preferred for production)
- Generate a keypair; upload the **public key** (`.cer`, no private key) to the app.
- The app signs a JWT client assertion with the private key at token time — **no secret
  in transit**, and you control the lifetime (2–3 yr typical).
- Store the private key in the deployment secret store, not the repo.

Whichever is used, the secret/cert private key is **sensitive**: transfer via a password
manager share, 1Password/Bitwarden send, or an encrypted channel — **never plain email
or chat**.

---

## 7. Exchange Online setup (managing business)

Run in **Exchange Online PowerShell** (`Connect-ExchangeOnline`) on the **client tenant**.
Needs Exchange Administrator.

```powershell
Connect-ExchangeOnline -Organization <clientdomain>.onmicrosoft.com

# 7a. Register the app's service principal inside Exchange Online.
#     -AppId       = Application (client) ID from §4
#     -ObjectId    = the ENTERPRISE APPLICATION (service principal) Object ID from §4 step 5
New-ServicePrincipal `
  -AppId <APPLICATION_CLIENT_ID> `
  -ObjectId <SERVICE_PRINCIPAL_OBJECT_ID> `
  -DisplayName "CommerceForce SMTP Sender"

Get-ServicePrincipal | Format-List DisplayName,AppId,ObjectId   # confirm it registered

# 7b. Give the service principal rights on the ONE sending mailbox.
#     Microsoft's current "Authenticate an IMAP, POP or SMTP connection using OAuth"
#     article uses FullAccess. Confirm the exact right with their Exchange admin
#     against the live article; some setups grant SendAs instead/also.
Add-MailboxPermission `
  -Identity "noreply@clientdomain.com" `
  -User <SERVICE_PRINCIPAL_OBJECT_ID> `
  -AccessRights FullAccess

# (if SendAs is required)
Add-RecipientPermission `
  -Identity "noreply@clientdomain.com" `
  -Trustee <SERVICE_PRINCIPAL_OBJECT_ID> `
  -AccessRights SendAs

# 7c. Confirm SMTP AUTH is enabled on THAT mailbox (per-mailbox overrides tenant default).
Set-CASMailbox -Identity "noreply@clientdomain.com" -SmtpClientAuthenticationDisabled $false
Get-CASMailbox  -Identity "noreply@clientdomain.com" | Select SmtpClientAuthenticationDisabled
# Tenant-wide default (informational):
Get-TransportConfig | Select SmtpClientAuthenticationDisabled
```

### 7d. Scope the app to one mailbox — Application Access Policy *(strongly recommended)*
Without this, `SMTP.SendAsApp` lets the app send as **every mailbox in the tenant**. The
managing business will (rightly) refuse consent without a scope.

```powershell
# Security group whose members are the only mailboxes the app may touch
New-DistributionGroup `
  -Name "CommerceForce SMTP Senders" `
  -Type Security `
  -Members "noreply@clientdomain.com"

New-ApplicationAccessPolicy `
  -AppId <APPLICATION_CLIENT_ID> `
  -PolicyScopeGroupId "CommerceForce SMTP Senders" `
  -AccessRight RestrictAccess `
  -Description "Restrict CommerceForce SMTP app to the no-reply mailbox only"

# Must return AccessCheckResult: Granted for the in-scope mailbox, Denied for any other
Test-ApplicationAccessPolicy -Identity "noreply@clientdomain.com" -AppId <APPLICATION_CLIENT_ID>
Test-ApplicationAccessPolicy -Identity "ceo@clientdomain.com"     -AppId <APPLICATION_CLIENT_ID>
```

> **Newer alternative:** *RBAC for Applications* in Exchange Online
> (`New-ManagementRoleAssignment -App <appId> -Role "Application Mail.Send" -RecipientAdministrativeUnitScope / -CustomResourceScope ...`).
> Either model works; Application Access Policy is the widely‑documented one. Let the
> managing business choose which they support.

### 7e. Mailbox licensing
- A **shared mailbox** (free, no licence) is fine for `noreply@` and is the usual choice
  for OAuth2 app‑only send.
- A regular **user mailbox** needs an Exchange Online Plan 1/2 or M365 Business/E‑plan licence.
- Either way it must be a real mailbox (not a distribution list / mail‑enabled contact /
  Microsoft 365 Group).

---

## 8. DNS — SPF / DKIM / DMARC (sending domain)

Set on the domain in the `From` address. Usually the managing business controls this DNS.

| Record | Host | Value (merge, don't duplicate) |
|---|---|---|
| **SPF** (TXT) | `@` / root of sending domain | include Microsoft: `v=spf1 include:spf.protection.outlook.com -all` |
| **DKIM** (2× CNAME) | `selector1._domainkey`, `selector2._domainkey` | `selector1-<domainGUID>._domainkey.<tenant>.onmicrosoft.com` and `selector2-…` (exact targets shown in the Defender portal) |
| **DMARC** (TXT) | `_dmarc` | start `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`; tighten to `p=quarantine` / `p=reject` after monitoring |

Enable DKIM: **Microsoft Defender portal** → Email & collaboration → Policies & rules →
Threat policies → **Email authentication settings → DKIM** → select the domain → publish
the two CNAMEs → **Enable**. `Rotate DKIM keys` yearly is automatic once enabled.

Verify: `nslookup -type=txt <domain>`, `nslookup -type=txt _dmarc.<domain>`, and send a
test to a Gmail address → *Show original* → SPF/DKIM/DMARC = PASS.

---

## 9. Runtime parameters (reference)

| Thing | Value |
|---|---|
| OAuth2 flow | `client_credentials` (app‑only) |
| Authority | `https://login.microsoftonline.com` (commercial cloud) |
| Token endpoint | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token` |
| Token request body | `grant_type=client_credentials`, `client_id=<CLIENT_ID>`, `scope=https://outlook.office365.com/.default`, and either `client_secret=<SECRET>` **or** `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer` + `client_assertion=<signed JWT>` |
| Scope | `https://outlook.office365.com/.default` (the `/.default` suffix is required for client credentials) |
| Token lifetime | ~3599 s (`expires_in`). Cache; refresh ~5 min before expiry. |
| SMTP host / port | `smtp.office365.com` : `587` |
| Transport security | STARTTLS (not implicit TLS/465) |
| SMTP auth mechanism | `XOAUTH2` |
| XOAUTH2 string | `base64( "user=" + <mailbox-address> + ^A + "auth=Bearer " + <access_token> + ^A + ^A )` where `^A` = byte `0x01` |
| Auth identity | the mailbox SMTP address must equal the `From` header (or have SendAs on it) and be in the Application Access Policy scope |

**Non‑commercial clouds** (GCC High / DoD / 21Vianet): endpoints differ —
`login.microsoftonline.us`, `smtp.office365.us`, scope `https://outlook.office365.us/.default`.
Ask the managing business which cloud the tenant is in.

Quick token smoke test (no code):
```bash
curl -s -X POST "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<SECRET>" \
  -d "scope=https://outlook.office365.com/.default" \
  -d "grant_type=client_credentials"
# → JSON with access_token + expires_in. Decode the JWT at jwt.ms: aud must be
#   https://outlook.office365.com and roles must contain SMTP.SendAsApp.
```

---

## 10. Code change (LATER — do not start without instruction)

Planned, not yet done. Lands in:

- `backend/app/core/config.py` — new settings (below).
- `backend/app/shared/email.py` — branch on auth mode; acquire + cache a bearer token;
  authenticate the SMTP session with `XOAUTH2` instead of `username`/`password`.
- `backend/pyproject.toml` — add `msal` (token acquisition + built‑in in‑memory cache).
  `aiosmtplib` stays; it has no XOAUTH2 helper, so build the auth string manually and
  issue `AUTH XOAUTH2` on the connection.

Proposed env vars (superset — keep Basic working as the default):
```
# --- transport ---
SMTP_AUTH_MODE=xoauth2                 # "basic" (default, current behaviour) | "xoauth2"
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_FROM=noreply@clientdomain.com
SMTP_USER=noreply@clientdomain.com     # XOAUTH2: the mailbox identity; Basic: the login

# --- xoauth2 only ---
MS_OAUTH_AUTHORITY=https://login.microsoftonline.com
MS_OAUTH_TENANT_ID=<client-tenant-guid>
MS_OAUTH_CLIENT_ID=<application-client-id>
MS_OAUTH_CLIENT_SECRET=<secret-value>            # OR the cert pair below
# MS_OAUTH_CERT_PATH=/run/secrets/cf_smtp_cert.pem
# MS_OAUTH_CERT_THUMBPRINT=<sha1-thumbprint>
MS_OAUTH_SCOPE=https://outlook.office365.com/.default
```

Behavioural notes for the implementation step:
- Cache the token in‑process; only re‑request on expiry (respect `expires_in`), and once
  on `535` in case of a stale token.
- Keep the existing `EmailLog` write and the plaintext fallback print.
- Fail closed with a clear log line distinguishing *token acquisition* failure (Entra /
  AADSTS…) from *SMTP* failure (5xx from Exchange).

---

## 11. Hand‑off checklists

### 11a. What WE send the managing business
Copy‑paste and fill in:

```
Subject: CommerceForce transactional email — OAuth2 SMTP app-only access request

We need our application to send transactional email (order confirmations, password
resets, etc.) as ONE mailbox in your tenant, using OAuth2 client-credentials on SMTP
AUTH (XOAUTH2). No interactive sign-in, no user password.

Please set up the following (Microsoft article: "Authenticate an IMAP, POP or SMTP
connection using OAuth"):

1. App registration
   [ ] Model A (you register in your tenant) OR Model B (consent our multi-tenant app)
   - Our Application (client) ID (Model B only): _______________________________
   - Our tenant ID (Model B only):               _______________________________
   - Admin-consent URL (Model B):
     https://login.microsoftonline.com/<YOUR_TENANT_ID>/adminconsent?client_id=<OUR_CLIENT_ID>

2. API permission + consent
   [ ] Application permission: Office 365 Exchange Online -> SMTP.SendAsApp
       (resource appId 00000002-0000-0ff1-ce00-000000000000)
   [ ] Admin consent granted (must show "Granted for <tenant>")

3. Credential
   [ ] Client secret (24-month expiry) OR register our certificate (public key attached)
   [ ] Send the secret via <password-manager link / encrypted channel> — not plain email

4. Exchange Online
   [ ] New-ServicePrincipal for the app (AppId + enterprise-app Object ID)
   [ ] Grant the service principal access to mailbox:  noreply@<clientdomain>
   [ ] Set-CASMailbox -SmtpClientAuthenticationDisabled $false on that mailbox
   [ ] New-ApplicationAccessPolicy RestrictAccess scoping the app to that ONE mailbox
   [ ] Test-ApplicationAccessPolicy passes for that mailbox, denies others

5. DNS for <clientdomain> (sending domain)
   [ ] SPF includes  include:spf.protection.outlook.com
   [ ] DKIM enabled for the domain (two selector CNAMEs published)
   [ ] DMARC record present at _dmarc.<clientdomain>

6. Confirm
   [ ] Which Microsoft cloud is the tenant? (Commercial / GCC High / DoD / 21Vianet)
   [ ] The exact sending mailbox address and its display name
   [ ] Any IP allow-listing we must be added to — our server IP is: ________________
```

### 11b. What we must GET BACK before the code change
- [ ] **Directory (tenant) ID** of the client tenant
- [ ] **Application (client) ID** (theirs for Model A; ours already known for Model B)
- [ ] **Client secret value** (or confirmation our certificate is registered) — via secure channel
- [ ] Confirmation **admin consent granted** for `SMTP.SendAsApp`
- [ ] Confirmation **`New-ServicePrincipal`** done + mailbox permission granted
- [ ] Confirmation **Application Access Policy** created and `Test-ApplicationAccessPolicy` verified
- [ ] Confirmation **SMTP AUTH enabled on the mailbox** (`SmtpClientAuthenticationDisabled = False`)
- [ ] **SPF / DKIM / DMARC** in place for the sending domain
- [ ] The **exact mailbox address** + display name to put in `SMTP_FROM` / `SMTP_USER`
- [ ] **Cloud environment** (endpoints) and any **IP allow‑listing** requirement
- [ ] **Secret/cert expiry date** → add to rotation calendar

### 11c. Model A — plain‑language walkthrough (forward‑ready)

Use this when the agency has **no Microsoft/Azure account** and the client's email
provider (managing business) does all the technical work. The agency only collects a few
values and passes them to the dev.

#### Before contacting the provider — get these 3 answers
Ask the client or provider:
1. **What email address should the website send from?** e.g. `noreply@theirdomain.com`.
2. **Is that a real mailbox, or does it need creating?** A free **shared mailbox** is fine and is the normal choice.
3. **What is the domain?** (the part after the `@`) — needed for the DNS check.

#### Message to forward to the email provider
Copy from the line below, fill the blanks, send it.

---

> **Subject: Setup request — allow our website to send email via one Microsoft 365 mailbox (OAuth2 / SMTP)**
>
> We're building a website for \[client name\] and need it to send transactional email
> (order confirmations, password resets) **as one specific mailbox**: `__________@__________`
>
> We want the modern **OAuth2 app‑only** method on SMTP — no user password, no interactive
> login. Microsoft's reference article is *"Authenticate an IMAP, POP or SMTP connection
> using OAuth."* Please do the following in the client's tenant:
>
> **Stage A — App registration (Microsoft Entra admin centre, entra.microsoft.com)**
> 1. **Identity → Applications → App registrations → New registration.**
> 2. Name: `CommerceForce SMTP Sender`. Account type: **Single tenant**. Redirect URI: leave blank. Register.
> 3. From the app's **Overview** page, note the **Application (client) ID** and the **Directory (tenant) ID**.
> 4. Go to **Enterprise applications**, open the same `CommerceForce SMTP Sender` app, and note its **Object ID** (the "service principal object ID" needed in Stage D).
>
> **Stage B — Permission + consent**
> 5. In the app registration → **API permissions → Add a permission → APIs my organization uses** → search **Office 365 Exchange Online** (resource ID `00000002-0000-0ff1-ce00-000000000000`).
> 6. Choose **Application permissions** → tick **`SMTP.SendAsApp`** → Add.
> 7. Click **Grant admin consent for \[tenant\]**. Confirm it shows "Granted".
> 8. **Do not** add Microsoft Graph `Mail.Send` — that's a different method we're not using.
>
> **Stage C — Credential**
> 9. App registration → **Certificates & secrets → New client secret**. Description `commerceforce-smtp`, expiry: longest available (24 months).
> 10. **Copy the secret Value immediately** (shown once). Send it to us via \[1Password / Bitwarden Send / encrypted method\] — **not plain email**. Also tell us the **expiry date**.
>
> **Stage D — Exchange Online (Exchange admin, via Exchange Online PowerShell)**
> 11. Register the app inside Exchange:
>     ```powershell
>     New-ServicePrincipal -AppId <Application (client) ID> -ObjectId <Enterprise app Object ID> -DisplayName "CommerceForce SMTP Sender"
>     ```
> 12. Give it access to the **one** sending mailbox (per Microsoft's current article — FullAccess in their example):
>     ```powershell
>     Add-MailboxPermission -Identity "noreply@theirdomain.com" -User <Enterprise app Object ID> -AccessRights FullAccess
>     ```
> 13. Make sure SMTP AUTH is enabled on that mailbox:
>     ```powershell
>     Set-CASMailbox -Identity "noreply@theirdomain.com" -SmtpClientAuthenticationDisabled $false
>     ```
> 14. **Restrict the app so it can only send from that one mailbox** (important — without this it could send as anyone):
>     ```powershell
>     New-DistributionGroup -Name "CommerceForce SMTP Senders" -Type Security -Members "noreply@theirdomain.com"
>     New-ApplicationAccessPolicy -AppId <Application (client) ID> -PolicyScopeGroupId "CommerceForce SMTP Senders" -AccessRight RestrictAccess -Description "Restrict CommerceForce SMTP app to the no-reply mailbox only"
>     Test-ApplicationAccessPolicy -Identity "noreply@theirdomain.com" -AppId <Application (client) ID>
>     ```
>     The test must return **Granted** for that mailbox.
>
> **Stage E — DNS for the sending domain** (`theirdomain.com`)
> 15. **SPF**: the domain's SPF TXT record must include `include:spf.protection.outlook.com`.
> 16. **DKIM**: enable DKIM for the domain in the Microsoft Defender portal (publishes two CNAME records).
> 17. **DMARC**: a TXT record at `_dmarc.theirdomain.com` (start with `v=DMARC1; p=none; rua=mailto:dmarc@theirdomain.com`).
>
> **Stage F — Send us back**
> - Directory (tenant) ID
> - Application (client) ID
> - Client secret Value (secure channel) + its expiry date
> - Confirmation admin consent was granted for `SMTP.SendAsApp`
> - Confirmation Stage D steps 11–14 are done and the access‑policy test passed
> - Confirmation SPF / DKIM / DMARC are in place
> - The exact mailbox address and its display name
> - Which Microsoft cloud the tenant is in (Commercial / GCC High / DoD / 21Vianet — almost always Commercial)
> - Any IP address they need to allow — our server IP is `__________`

---

#### What the agency does when the provider replies
No technical configuration on the agency side. Just:
1. **Store the client secret in a password manager** (entry name e.g. "CommerceForce SMTP – \[client\]"). Treat it like a password.
2. **Put the secret's expiry date in the calendar**, reminder ~30 days before — it stops working on that date and needs renewing ([§12](#12-secret--certificate-rotation)).
3. **Hand all Stage F values to the dev** — they fill `backend/.env` and do the `email.py` code change ([§10](#10-code-change-later--do-not-start-without-instruction)), then test a real send.
4. **Fill in one row of [§14](#14-per-client-record-fill-one-per-deployment)** for the record.

---

## 12. Secret / certificate rotation

- Client secrets: **max 24 months**. Certificates: whatever you set (2–3 yr typical).
- Record expiry per client. Set a reminder **30 days before**.
- Rotate with overlap: add the **new** secret/cert to the app registration, deploy the
  new value, confirm sending works, then remove the old one. No downtime.
- If a secret leaks: delete it in the app registration immediately (invalidates it),
  issue a new one, redeploy.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `535 5.7.3 Authentication unsuccessful` | Token missing `SMTP.SendAsApp` role, wrong scope, or service principal not registered in Exchange | Decode token at jwt.ms — check `aud=https://outlook.office365.com` and `roles`; re‑run `New-ServicePrincipal`; confirm admin consent |
| `535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled` | SMTP AUTH off for the mailbox or tenant | `Set-CASMailbox -SmtpClientAuthenticationDisabled $false`; check `Get-TransportConfig` |
| `550 5.7.60 Client does not have permissions to send as this sender` | `From` ≠ authenticated mailbox and no SendAs, or mailbox outside the Access Policy scope | Match `From` to the mailbox; add SendAs; fix `New-ApplicationAccessPolicy` group membership |
| `AADSTS7000215: Invalid client secret provided` | Secret expired / wrong value / trailing space | Issue a new secret; copy the **Value**, not the Secret ID |
| `AADSTS500011: The resource principal named … was not found` | Wrong scope resource, or O365 Exchange Online SP not in tenant | Scope must be `https://outlook.office365.com/.default`; run `New-ServicePrincipal -AppId 00000002-0000-0ff1-ce00-000000000000` |
| `AADSTS650057: Invalid resource` / `AADSTS900023: invalid tenant` | Scope typo / wrong tenant ID in the token URL | Fix the endpoint and scope strings |
| `AADSTS7000229` / consent errors (Model B) | Client's admin never granted consent | Send them the `/adminconsent` URL again |
| Token OK but `Test-ApplicationAccessPolicy` = Denied for the target mailbox | Mailbox not a member of the scope group, or policy is `DenyAccess` not `RestrictAccess` | Add mailbox to the group; recreate policy with `-AccessRight RestrictAccess` |
| Mail sends but lands in spam / fails DMARC | SPF/DKIM not aligned for the `From` domain | Publish `include:spf.protection.outlook.com`; enable DKIM; align `From` domain with the authenticated mailbox domain |
| Works in test, breaks ~90 min later | Token not being cached/refreshed (code) | Cache token, refresh before `expires_in`, retry once on `535` |
| `421 4.7.0` / throttling | Exceeded Exchange Online send limits (10,000 recipients/day, 30 msgs/min per mailbox) | Throttle sends; for bulk/marketing use a dedicated provider, not M365 |

---

## 14. Per‑client record (fill one per deployment)

```
Client:                        ____________________
Model (A tenant / B multi):    ____________________
Client tenant (Directory) ID:  ____________________
Application (client) ID:       ____________________
Enterprise app Object ID (SP): ____________________
Sending mailbox:               ____________________
Mailbox type (shared/user):    ____________________
Secret/cert:                   secret | cert
Secret/cert expiry:            ____________________   (reminder set: Y/N)
Application Access Policy:      created | verified
SPF / DKIM / DMARC:            ____ / ____ / ____
Cloud:                         Commercial | GCC High | DoD | 21Vianet
IP allow-list required:        ____________________
Secret stored in:              ____________________  (secret store path / vault item)
Date wired:                    ____________________
```

---

## 15. References

- Microsoft — *Authenticate an IMAP, POP or SMTP connection using OAuth*
- Microsoft — *OAuth 2.0 client credentials flow on the Microsoft identity platform*
- Microsoft — *Limiting application permissions to specific Exchange Online mailboxes*
  (Application Access Policy) and *RBAC for Applications in Exchange Online*
- Microsoft — *Set up SPF / Use DKIM / Use DMARC to validate email* (Defender docs)
- Microsoft — *Exchange Online limits* (sending limits)
