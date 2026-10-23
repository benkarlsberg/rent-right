export const SHARE_TITLE = "Rent Right: tenant-landlord help for California renters";
export const SHARE_DESCRIPTION = "AI tenant-landlord communication assistant for California renters.";
export const SHARE_URL = "https://app.rentrightportal.com";
export const SHARE_IMAGE = `${SHARE_URL}/og.png`;
export const SHARE_IMAGE_ALT = "Rent Right. Keep your rental records and talk to your landlord, all in one place.";
export const SHARE_TAGLINE = "Keep your rental records and talk to your landlord, all in one place.";

export const shareMeta = [
  `<meta property="og:title" content="${SHARE_TITLE}">`,
  `<meta property="og:description" content="${SHARE_DESCRIPTION}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${SHARE_URL}">`,
  `<meta property="og:image" content="${SHARE_IMAGE}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:alt" content="${SHARE_IMAGE_ALT}">`,
  `<meta property="og:site_name" content="Rent Right">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${SHARE_TITLE}">`,
  `<meta name="twitter:description" content="${SHARE_DESCRIPTION}">`,
  `<meta name="twitter:image" content="${SHARE_IMAGE}">`,
  `<link rel="canonical" href="${SHARE_URL}">`,
].join("");
