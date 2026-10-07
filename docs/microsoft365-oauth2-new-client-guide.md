# Microsoft 365 email (OAuth2) — step-by-step guide for a new client

**Who this is for:** you, setting up "send email through the client's Microsoft 365
mailbox" for a CommerceForce site, without knowing the Microsoft admin tools well.
Follow Parts A to H in order. Everything marked `<LIKE_THIS>` is a value you replace.

> This is the **beginner walkthrough**. The deeper reference (why each step exists,
> alternatives, DNS, troubleshooting table) is
> [`microsoft365-oauth2-smtp-setup.md`](microsoft365-oauth2-smtp-setup.md). The code that
> uses it is already built: `backend/app/shared/email.py` (`SMTP_AUTH_MODE=xoauth2`).

**Time needed:** about 45–60 minutes the first time, once you have an admin login.
**Done once** per client, then only a renewal about every two years (see Part I).

---

## What this does, in plain words

The website needs to send emails (order confirmations, password resets…). Microsoft is
phasing out the old "username and password" way. The new way: you register a small
"app" in the client's Microsoft account, give it permission to send mail from **one
mailbox**, and give it its own **secret** (like a password only the website knows). The
website then signs itself in each time. **Nobody types a password or approves a prompt
on the authenticator app while the site is running.**

Words you'll see:

| Word | Meaning |
|---|---|
| **Tenant** | The client's whole Microsoft 365 account. Its ID is the **Tenant (Directory) ID**. |
| **App registration** | The small "app" you create. It gets a **Client (Application) ID**. |
| **Secret** | The app's password. Microsoft calls it **Client secret**. Has a **Value** (the real one) and a **Secret ID** (just a label). |
| **Admin consent** | An administrator ticking "yes, this app may do this". |
| **Enterprise application / Object ID** | The same app seen from the "who is allowed" side. Its **Object ID** is a third ID needed in Part F. |
| **Mailbox** | The email address the website sends as (e.g. `info@client.co.uk`). |

---

## Before you start

**1. A login to the client's Microsoft account.** The IT company can create one for you.
You sign in with the **authenticator app** on your phone. That's only for *your* sign-in,
and the website never uses it.

**2. Admin powers.** The login needs these (a single **Global Administrator** role
covers all three). If a step says "insufficient privileges", ask the IT company to give you
Global Administrator for a day:
- create an app (Application Administrator),
- approve its permission (Global Administrator),
- run the Exchange commands (Exchange Administrator).

**3. Decide the sending mailbox.** A dedicated `noreply@` **shared mailbox** is best
(free, no licence). An existing mailbox also works. Whatever you pick, write the exact
address down, and **check the spelling**: a wrong letter here breaks everything.

**4. A notepad** for the values you will copy. You will collect five things:

| # | Value | Secret? | Where you get it |
|---|---|---|---|
| 1 | Tenant (Directory) ID | no | Part A |
| 2 | Client (Application) ID | no | Part A |
| 3 | Client secret **Value** | **YES** | Part D |
| 4 | Enterprise app Object ID | no | Part E |
| 5 | Sending mailbox address | no | you decide |

---

## Part A — Create the app (about 5 min)

1. Go to **entra.microsoft.com** and sign in (approve on the authenticator app).
2. Left menu: **Entra ID** (older screens say "Identity") → **App registrations** →
   **New registration**.
3. **Name:** `CommerceForce SMTP Sender - <CLIENT NAME>`.
4. **Supported account types:** choose **Single tenant only** (older wording: "Accounts in
   this organizational directory only"). Don't choose any "multitenant" option.
5. **Redirect URI:** leave empty.
6. Click **Register**.

You land on the app's **Overview** page. Copy these two into your notepad:
- **Application (client) ID**
- **Directory (tenant) ID**

You will keep coming back to this page. It's under *Entra ID → App registrations →
your app*.

---

## Part B — Give the app permission to send email (about 5 min)

On the app, left menu: **API permissions**. There's already one entry called
"Microsoft Graph / User.Read". Leave it.

1. Click **Add a permission**.
2. In the panel that opens, click the tab **APIs my organization uses**.
3. In the search box type **Office 365 Exchange Online** and click it.
   (If it doesn't show up, paste this instead: `00000002-0000-0ff1-ce00-000000000000`.)
4. Click **Application permissions**. This is the *second* big button. **Not** "Delegated
   permissions". Application permissions are the ones that work without a person signed in.
5. Expand **SMTP** and tick **SMTP.SendAsApp**.
6. Click **Add permissions** at the bottom.

Do **not** add anything else. We only request *sending*, so the app has no ability to read
anyone's mail.

---

## Part C — Admin consent: the approval (about 1 min)

Adding the permission isn't enough. An administrator must approve it.

1. Still on **API permissions**, click **Grant admin consent for `<tenant name>`**.
2. Click **Yes**.

**You should now see** a green tick and **"Granted for `<tenant name>`"** next to
SMTP.SendAsApp. If the button is greyed out or errors, your login isn't an administrator
who can approve. Ask the IT company for Global Administrator, or ask them to click it.

---

## Part D — Create the secret (about 3 min)

1. Left menu: **Certificates & secrets**.
2. Under **Client secrets** click **New client secret**.
3. Description: `commerceforce-smtp`. Expires: **24 months** (the longest allowed).
4. Click **Add**.
5. **Copy the text in the "Value" column immediately.** It is shown **only once**. If you
   leave the page it turns into dots and you must create a new secret.
   - ⚠️ **Copy "Value", not "Secret ID".** The Secret ID is a short label that looks like
     `3a9f…-…-…` (36 characters with dashes). The real **Value** is about 40 characters,
     mixed letters and digits, and contains a `~`. Pasting the Secret ID is the most common
     mistake and produces an "invalid client secret" error.
6. Write the **expiry date** in your notepad and set a calendar reminder for **one month
   before** it. Email stops if the secret expires unnoticed.

Never put the secret in an email, chat or document. Part G puts it straight onto the server.

---

## Part E — Find the Object ID (about 2 min)

A third ID is needed by the commands in Part F. It's **not** the same as the Part A IDs.

1. In Entra, left menu: **Enterprise applications** → **All applications**.
2. Search for `CommerceForce SMTP Sender - <CLIENT NAME>` and click it.
3. On its **Overview** page, copy the **Object ID** into your notepad.

---

## Part F — Link the app to the mailbox (about 10–15 min)

These commands tell Microsoft's email system: "this app may send from this one mailbox,
and no other". You run them in **Exchange Online PowerShell** on your Windows computer.

### F1. Install and open the tool (first time only)

1. Click Start, type **PowerShell**, open **Windows PowerShell** (normal window; "Run as
   administrator" is not needed).
2. Install Microsoft's tool:
   ```powershell
   Install-Module ExchangeOnlineManagement -Scope CurrentUser
   ```
   If it asks about an "untrusted repository" or "NuGet", type **Y** and press Enter.
3. Sign in:
   ```powershell
   Connect-ExchangeOnline
   ```
   A browser window opens. Sign in with the client admin login and approve on the
   authenticator app. When the PowerShell prompt returns you're connected.

> **Run Part F on your own Windows PC, not on the VPS.** It talks to Microsoft's cloud
> and the sign-in needs a web browser (the server has none).
>
> `<OBJECT_ID>` below is the **Enterprise application's** Object ID from Part E. The
> App-registration Object ID looks similar but gives the error "no service principal with
> that client id and object id is registered".

### F2. Allow the app to use the mailbox

Replace the three `<…>` values, then paste the commands. Each prints a small table, or
nothing. **Red text means a problem.**

```powershell
# 1. Register the app inside Exchange
New-ServicePrincipal -AppId <CLIENT_ID> -ObjectId <OBJECT_ID> -DisplayName "CommerceForce SMTP Sender"

# 2. Let the app use this one mailbox
Add-MailboxPermission -Identity <MAILBOX> -User <OBJECT_ID> -AccessRights FullAccess

# 3. Make sure sending by SMTP is switched on for this mailbox
Set-CASMailbox -Identity <MAILBOX> -SmtpClientAuthenticationDisabled $false
```

### F3. Restrict the app to that one mailbox (important)

Without this, the permission lets the app send as **anyone** in the company. Clients
rightly refuse that, so always do it:

```powershell
New-DistributionGroup -Name "CommerceForce SMTP Senders" -Type Security -Members <MAILBOX>

New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId "CommerceForce SMTP Senders" -AccessRight RestrictAccess -Description "CommerceForce SMTP app: this mailbox only"

Test-ApplicationAccessPolicy -Identity <MAILBOX> -AppId <CLIENT_ID>
```

**The last command must show `AccessCheckResult : Granted`.** If it says `Denied`, wait
about 30 minutes (Microsoft is slow to apply it) and run just that line again.

### F4. Disconnect

```powershell
Disconnect-ExchangeOnline
```

If a command says the thing "already exists", that's fine, go on to the next one.

---

## Part G — Put the settings on the server (about 5 min)

The website reads its email settings from `backend/.env` on the VPS. You edit it
directly, so the secret never travels through chat.

1. Connect: `ssh commerceforce-deploy`
2. Open the file: `nano /opt/commerceforce/backend/.env`
3. Make sure these lines exist, with each name appearing **once**:
   ```
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_TLS=true
   SMTP_AUTH_MODE=xoauth2
   SMTP_USER=<MAILBOX>
   SMTP_FROM=<MAILBOX>
   MS_OAUTH_TENANT_ID=<TENANT_ID>
   MS_OAUTH_CLIENT_ID=<CLIENT_ID>
   MS_OAUTH_CLIENT_SECRET=<the secret VALUE from Part D>
   ```
   - `SMTP_USER` and `SMTP_FROM` should both be exactly the mailbox address.
   - No quotes, no spaces around `=`, no trailing spaces after the secret.
   - If the secret contains a `$`, ask for help first. That character needs special handling.
   - You can leave an old `SMTP_PASSWORD=` line in place. It's ignored in this mode and
     gives you a way back (set `SMTP_AUTH_MODE=basic`).
4. Save and exit nano: **Ctrl+O**, **Enter**, **Ctrl+X**.
5. Lock the file down (it holds a secret):
   ```
   chmod 600 /opt/commerceforce/backend/.env
   ls -l /opt/commerceforce/backend/.env      # must start with -rw-------
   ```
6. Leave the server: `exit`

---

## Part H — Switch it on and test (ask Claude Code, about 10 min)

1. The VPS needs the backend code that includes the OAuth2 support (`backend/app/shared/email.py`
   with `SMTP_AUTH_MODE`). Ask Claude Code to "commit and deploy the backend to the VPS"
   if the VPS doesn't have it yet.
2. Rebuild/recreate the backend so it reads the new settings.
3. Send a real test email to a Gmail address you control. Check it arrives and in Gmail
   open the message → **Show original** → SPF, DKIM and DMARC should say **PASS**
   (set these up in Part J if they don't).
4. If it fails, the backend log says which side broke: **"token acquisition failed"**
   means the Microsoft sign-in (secret, IDs); **"SMTP send failed"** means the mail server
   (mailbox permission or policy). See "If something goes wrong" below.

---

## Part I — Renewal (every ~2 years, put a reminder in your calendar)

Microsoft limits a secret to 24 months. There's no permanent option. To renew **with no
downtime**:

1. Entra → your app → **Certificates & secrets** → **New client secret** (Part D again).
2. On the VPS, replace `MS_OAUTH_CLIENT_SECRET=` with the new **Value**; recreate the backend.
3. Send a test email.
4. Only then delete the **old** secret in the portal.

If a secret ever leaks: delete it in the portal immediately, then do the steps above.

---

## Part J — Email lands in spam? (DNS, usually the IT company)

Not part of the sign-in setup, but needed so Gmail/Outlook trust the mail. On the sending
domain, the IT company should have:
- **SPF** — a record that includes `spf.protection.outlook.com`,
- **DKIM** — switched on in the Microsoft Defender portal (two CNAME records),
- **DMARC** — a `_dmarc` record (start with `p=none`).

Details: runbook section 8.

---

## If something goes wrong

| What you see | Meaning | Fix |
|---|---|---|
| "insufficient privileges" / "access denied" in the portal or PowerShell | Your login lacks a role | Ask the IT company for **Global Administrator** for a day |
| `AADSTS7000215 Invalid client secret` | Wrong secret: Secret ID pasted, typo, or expired | Create a new secret (Part D), copy the **Value** |
| `535 5.7.3 Authentication unsuccessful` | Permission, consent or Exchange link missing | Check Part C shows "Granted", re-run F2 (`New-ServicePrincipal`) |
| `535 5.7.139 … SmtpClientAuthentication is disabled` | SMTP sending off for that mailbox | Run the `Set-CASMailbox …` line in F2 |
| `550 5.7.60 … send as this sender` | `SMTP_FROM` isn't the mailbox, or the mailbox is outside the policy group | Make `SMTP_FROM` = the mailbox; check F3 group membership |
| `430 4.2.0 STOREDRV; mailbox logon failure … MapiExceptionLogonFailed` (the long text contains "AuthenticationContext has no rights on this session") | The app signed in fine, but Microsoft **hasn't applied the `FullAccess` mailbox permission yet**. Seen on Tri Star: it cleared by itself about **1 hour** after F2 | First prove the rest is right: `Get-MailboxPermission -Identity <MAILBOX> -User <OBJECT_ID>` shows `FullAccess, Deny: False`; `Get-ServicePrincipal` shows the right AppId; `Get-Mailbox <MAILBOX>` shows `UserMailbox`, enabled, not inactive. Then **just wait** (up to ~1–2 h) and retry. Don't keep changing settings. |
| `Test-ApplicationAccessPolicy` says **Denied** | Policy not applied yet, or mailbox not in the group | Wait 30 min; recheck group members |
| Worked, then stopped about 2 years later | Secret expired | Part I |

More detail: runbook section 13.

---

## Checklist (tick as you go)

```
[ ] Login + admin role confirmed                [ ] E  Object ID copied
[ ] Mailbox decided and spelling checked        [ ] F  Exchange commands run, policy = Granted
[ ] A  App registered (Single tenant)           [ ] G  .env updated + chmod 600
[ ] A  Tenant ID + Client ID copied             [ ] H  Backend deployed + test email received
[ ] B  SMTP.SendAsApp added (Application)       [ ] I  Expiry reminder set in calendar
[ ] C  "Granted for <tenant>" green tick        [ ] J  SPF / DKIM / DMARC = PASS
[ ] D  Secret VALUE copied (has a ~, ~40 chars)
```

---

## Record for each client (fill one in; **never write the secret here**)

```
Client:                        ____________________
Tenant (Directory) ID:         ____________________
Application (client) ID:       ____________________
Enterprise app Object ID:      ____________________
Sending mailbox:               ____________________
Mailbox type (shared/user):    ____________________
Secret expires:                ____________________   (calendar reminder set: Y/N)
Access policy tested Granted:  Y/N      Date wired: ____________
SPF / DKIM / DMARC:            ____ / ____ / ____
```

### Tri Star UK Ltd (first client wired with this process)

```
Client:                        Tri Star UK Ltd (VPS 191.215.38.69, /opt/commerceforce)
Tenant (Directory) ID:         ec185f8f-0cf2-4693-af94-7067bee010b0
Application (client) ID:       3060a6d8-b1a5-4892-8381-63b47bce6866
Enterprise app Object ID:      a97c7f5e-7b10-47f9-9c51-b307aec41cfe
                               (NOT c39c7703-… — that is the App registration's Object ID and
                               makes New-ServicePrincipal fail: "no service principal … registered")
Sending mailbox:               kamlesh@tristarltd.co.uk   (note spelling: "kamlesh", not "kamelesh")
Mailbox type:                  existing user mailbox
Secret stored:                 /opt/commerceforce/backend/.env  (MS_OAUTH_CLIENT_SECRET) — never in git
Secret expires:                (fill in from Part D — set reminder one month before)
Status 2026-10-07:             A-H done. Code deployed (commit 3f8f8f5). OAuth2 test email accepted by
                               Microsoft at 12:31 after ~1 h of 430 STOREDRV (permission still
                               propagating; see troubleshooting). F3 done: access policy created,
                               Test-ApplicationAccessPolicy = Granted for the mailbox; a second
                               test email was accepted afterwards. Remaining: confirm inbox/spam,
                               secret-expiry calendar reminder, SPF/DKIM/DMARC check (Part J).
```
