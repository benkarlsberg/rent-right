import { DISCLAIMER_EN } from "./disclaimer";

const CONTACT = "benelliot16@gmail.com";

export const iconLinks = `<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">`;

function document(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${iconLinks}
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

export const HOME_DESCRIPTION = "AI tenant-landlord communication assistant for California renters.";

export const homeIntro = `<main id="rr-home" style="box-sizing:border-box;max-width:40rem;margin:0 auto;padding:32px 24px;font:18px/1.5 Georgia, Times New Roman, serif;color:#14343C;background:#F8FAF9">
<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px">Rent Right</h1>
<p style="margin:0 0 16px">${HOME_DESCRIPTION}</p>
<p style="margin:0 0 16px"><a href="/" style="color:#0B5C6E;font-weight:700">Sign in</a></p>
<nav>
<a href="/privacy" style="color:#0B5C6E;font-weight:700;margin-right:16px">Privacy</a>
<a href="/terms" style="color:#0B5C6E;font-weight:700">Terms</a>
</nav>
</main>`;

export function injectHomeHtml(html: string): string {
  let next = html.replace(/<nav id="rr-legal"[\s\S]*?<\/nav>/, "");
  if (/<title>[^<]*<\/title>/i.test(next)) next = next.replace(/<title>[^<]*<\/title>/i, "<title>Rent Right</title>");
  else next = next.replace("</head>", "<title>Rent Right</title></head>");
  if (!next.includes('name="description"')) {
    next = next.replace("</head>", `<meta name="description" content="${HOME_DESCRIPTION}"></head>`);
  }
  if (!next.includes('property="og:site_name"')) {
    next = next.replace("</head>", `<meta property="og:site_name" content="Rent Right"></head>`);
  }
  if (!next.includes('href="/favicon.svg"')) {
    next = next.replace(/<link\s+rel="(?:shortcut icon|icon|apple-touch-icon|manifest)"[^>]*>/gi, "");
    next = next.replace("</head>", `${iconLinks}</head>`);
  }
  if (!next.includes('id="rr-home"')) {
    if (!/<div id="root">\s*<\/div>/.test(next)) throw new Error("Expo index.html has no empty root.");
    next = next.replace(/<div id="root">\s*<\/div>/, `<div id="root">${homeIntro}</div>`);
  }
  return next;
}
