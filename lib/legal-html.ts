import { DISCLAIMER_EN } from "./disclaimer";

const CONTACT = "benelliot16@gmail.com";

function document(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Rent Right</title>
<style>
  body { margin: 0; background: #F8FAF9; color: #14343C; font: 18px/1.5 Georgia, "Times New Roman", serif; }
  main { max-width: 40rem; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.6rem; }
  p { margin: 0 0 1rem; }
  a { color: #0B5C6E; }
  nav { margin-top: 2rem; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
${body}
<nav>
<p><a href="/">Rent Right</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
<p>Contact <a href="mailto:${CONTACT}">${CONTACT}</a></p>
</nav>
</main>
</body>
</html>
`;
}

export const privacyDocument = document(
  "Privacy policy",
  `
<p>Rent Right is a free record-keeping tool for California renters. It is not a law firm. This page says what the app stores and what it sends.</p>
<p>We store the email address you use to sign in, whether that is a sign-in link or Google. If you add a home, we store the address, unit, city, ZIP, landlord name, landlord email, and any lease start date or rent amount you choose to enter. We also store notes, photos, and files you add, chat messages, deadlines, and the messages you send to your landlord. Replies that arrive at your unit's mailbox are stored too.</p>
<p>Sign-in mail is sent to you. A message to your landlord is sent only after you confirm it on the screen. Those messages come from notices@rentrightportal.com. We do not text landlords, and we do not sell personal information.</p>
<p>If an AI service is configured, a question or a lease excerpt may be sent to it so the app can help sort what you asked. Email addresses, phone numbers, and Social Security-like numbers are removed from that text first. Deadlines and rent-cap math come from the rules library, not from the model. We do not promise that a model provider will never retain a prompt.</p>
<p>Uploaded files and landlord message bodies are encrypted before they are stored. The site uses HTTPS. We do not ask for a Social Security number or a bank login. If you type one into a note, it is saved with that note.</p>
<p>From Records you can download a copy of your data or delete the account. California residents can email <a href="mailto:${CONTACT}">${CONTACT}</a> to ask what we have, to correct it, or to delete it.</p>
`,
);

export const termsDocument = document(
  "Terms of use",
  `
<p>Rent Right is free for California renters. ${DISCLAIMER_EN}</p>
<p>The app keeps your notes, files, and dates, and it can draft a message to your landlord. Nothing is emailed to a landlord unless you confirm that send. Rent Right does not file cases, serve notices, or act as your lawyer.</p>
<p>Answers about rent, repairs, deposits, and leases quote a library entry or say they are unsure. The library is general information. It can be incomplete, and it is not a decision about your home. City rules, including Los Angeles rent control, still depend on the unit.</p>
<p>There are no landlord ratings, no text messages, and no paid referrals.</p>
<p>Questions about these terms: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
`,
);

export const homeLegalFooter = `<nav id="rr-legal" style="padding:16px 24px 28px;font:16px/1.4 sans-serif;background:#F8FAF9">
<a href="/privacy" style="color:#0B5C6E;font-weight:700;margin-right:16px">Privacy</a>
<a href="/terms" style="color:#0B5C6E;font-weight:700">Terms</a>
</nav>`;
