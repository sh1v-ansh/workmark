# Supabase auth email templates

The "confirm your email" and "reset your password" messages do **not** come
from this codebase. Supabase sends them from its own templates, so they are
the one part of Workmark's email that has to be pasted into a dashboard
rather than deployed.

Paste each block below into **Supabase → Authentication → Email Templates**,
replacing whatever is there.

They are built to the same rule as `src/lib/notify/template.ts`: no images,
no web fonts, no external stylesheet, nothing loaded from anywhere. A young
sending domain does not survive remote content, and the confirmation email is
the very first message Workmark ever sends anyone — it is the one that sets
whether the next twenty land in the inbox or the spam folder.

`{{ .ConfirmationURL }}` and the other `{{ . }}` variables are Supabase's own
and must be left exactly as written.

---

## 1. Confirm signup

**Subject:** `Confirm your email for Workmark`

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Workmark</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F8;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#FFFFFF;opacity:0">Confirm your email address to finish setting up your Workmark account.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F4F8" style="background:#F4F4F8">
<tr><td align="center" style="padding:28px 16px 40px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%">
  <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid #CFD2E0;border-radius:14px;padding:26px 30px 30px">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="22" height="22" align="center" valign="middle" bgcolor="#6142F5" style="width:22px;height:22px;border-radius:6px;background:#6142F5;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;line-height:22px;text-align:center">W</td>
      <td style="padding-left:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#191E2E">Workmark</td>
    </tr></table>

    <div style="height:1px;background:#ECEBF3;margin:20px 0 22px;font-size:0;line-height:0">&nbsp;</div>

    <p style="margin:0 0 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.62;color:#2B3244">Confirm this address and your Workmark account is ready.</p>
    <p style="margin:0 0 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.62;color:#2B3244">Next you will connect GitHub and pick which repositories Workmark may read. It reads only the ones you choose, and only to work out what you can actually build.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr>
      <td align="center" bgcolor="#6142F5" style="border-radius:9px;background:#6142F5">
        <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:9px">Confirm my email</a>
      </td>
    </tr></table>

  </td></tr>
  <tr><td style="padding:18px 8px 0">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#5A6172">If you did not create a Workmark account, ignore this message and nothing happens.</div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
```

---

## 2. Reset password

**Subject:** `Reset your Workmark password`

Identical to the block above with two changes:

- the two `<p>` paragraphs become:

```html
    <p style="margin:0 0 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.62;color:#2B3244">Use the button below to choose a new password. The link works once and expires in an hour.</p>
```

- the button label becomes `Choose a new password`
- the footer line becomes:

```html
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#5A6172">If you did not ask to reset your password, ignore this message — your password has not changed.</div>
```

---

## 3. Magic link / OTP

Only needed if passwordless sign-in is switched on. Same block, with
`{{ .ConfirmationURL }}` and the label `Sign in to Workmark`.

---

## Why there is no postal address on these

CAN-SPAM's physical-address requirement applies to commercial messages. A
confirmation email somebody triggered thirty seconds ago by creating an
account is transactional and exempt — the same reasoning that makes
`EMAIL_KINDS[kind].essential` skip the address in `src/lib/notify/email.ts`.

Marketing mail is a different matter and is blocked in code until
`EMAIL_POSTAL_ADDRESS` is set. See `marketingBlocked()`.

---

## Checking it worked

1. Supabase → Authentication → Email Templates → paste → Save.
2. Sign up with an address you control, on a domain you have not used before
   (a fresh Gmail is the useful test — Gmail is the strictest common inbox).
3. Check it landed in the inbox rather than Promotions or Spam.
4. Open it on a phone. The 560px table should scale down, not scroll
   sideways.

If it lands in spam, the cause is almost always DNS rather than the template:
check SPF, DKIM and DMARC are all verified on `send.workmark.org` in the
Resend dashboard.
