# Store listing

Copy these answers into App Store Connect and Google Play Console. The support contact on the public pages is benelliot16@gmail.com.

## Name and category

| Field | Value |
| --- | --- |
| App name | Rent Right |
| Subtitle (30 characters) | Records for California renters |
| Category | Productivity |
| Secondary category, if asked | Lifestyle |
| Price | Free |
| Support URL | https://app.rentrightportal.com/support |
| Privacy URL | https://app.rentrightportal.com/privacy |
| Account deletion URL | https://app.rentrightportal.com/delete-account |
| Marketing URL | https://app.rentrightportal.com |

Productivity fits a tool that keeps records and messages. Lifestyle is a reasonable second category.

## Short description (Play, 80 characters)

Keep rental records and write to your landlord. Not legal advice.

## Promotional text (App Store, 170 characters)

Keep notes, dates, and messages about your California rental in one place. General information, not legal advice.

## Keywords (App Store, 100 characters)

rent,landlord,lease,deposit,California,tenant,records,repair,housing

## Description

Rent Right helps a California renter keep records and write to their landlord.

You can save notes, photos, dates, and messages about a repair, a rent increase, or a deposit. The app can draft a message. Nothing is emailed to a landlord unless you confirm that send on the screen.

Answers about rent, repairs, and deposits quote a library entry or say they are unsure. The library is general information. It is not a decision about your home.

This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.

Rent Right is not a law firm. It does not file cases, serve notices, or send a demand on its own. There are no landlord ratings, no text messages, and no paid referrals.

You can download your records and delete your account from Settings. The steps are also at https://app.rentrightportal.com/delete-account.

## Age rating

Answer these as No unless a newer form uses different words. The suggested rating is **4+** on the App Store and **Everyone** on Google Play.

- Cartoon or realistic violence, sexual content, profanity, horror, gambling, contests, alcohol, tobacco, drugs: No
- Unrestricted web access: No. The app opens specific court and help links. It does not include a browser.
- User-generated public content or a public social feed: No. Messages go to the landlord the renter entered, or stay in that renter’s private chat.
- Messaging: Yes, private messages to a landlord and a private assistant. There is no public directory of users.
- Made for kids: No

## Apple privacy nutrition label

Data is linked to the signed-in person. It is not used to track people across other companies’ apps. It is not sold.

| Data type | Collected | Purpose |
| --- | --- | --- |
| Email address | Yes | Sign-in and the copy of a message the renter chooses to send |
| Name | Yes | The profile, if the renter or Apple provides one |
| Physical address | Yes | The home the renter adds |
| Phone number | Optional | Only if the renter types a landlord phone number |
| Photos | Yes | Photos the renter attaches |
| Other user content | Yes | Notes, chats, lease text the renter submits, message bodies |
| Product interaction | Yes | Which screens and actions the renter uses inside the app |
| Customer support | Yes | Mail sent to the support address |
| Device ID / advertising data | No | |
| Precise location | No | The app stores the address the renter types. It does not read GPS. |
| Contacts, health, financial info | No | Rent amounts are numbers the renter types, stored as cents. |

If an AI key is configured, a question or a lease excerpt may be sent to that provider after email addresses, phone numbers, and Social Security-like numbers are removed. Say that under “Data used to track you”: **not used for tracking**. Under third-party processing, name the model provider only if that key is turned on in production.

## Google Data safety

- Data is collected, and the renter can request deletion in the app and at https://app.rentrightportal.com/delete-account.
- Data is encrypted in transit (HTTPS).
- Data is not sold.
- Data is not shared for advertising.
- Collected: name, email, address, photos, messages, app activity, and files the renter uploads.
- Optional: landlord email and phone that the renter types.
- Purpose: app functionality and account management.
- Account creation: required to save records.

## Review notes

Paste this into App Store Connect and Play Console, and fill the two values from the Worker secrets. Do not commit those values.

```
Sign-in for review
Email: <REVIEWER_EMAIL>
Code: <REVIEWER_CODE>

On the first screen, enter the email, choose "I have a sign-in code", enter the code, and choose "Continue with code".
No email is sent. This code works only for that address, and only while REVIEWER_LOGIN is 1.

The account opens a sample Los Angeles home for Maya Chen, 1842 N Echo Park Ave, Unit 3. The landlord address on that home is an example.com address. The sample home does not send email to a landlord.

This is general legal information, not legal advice, and no attorney-client relationship is created.

Account deletion: Menu → Settings → Export evidence packet, then type DELETE and choose Delete account. The public steps are at https://app.rentrightportal.com/delete-account.
```

The in-app wording on results is “General information, not legal advice.” The full sentence above is in Terms and on the evidence packet.
