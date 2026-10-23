import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <title>Rent Right</title>
        <meta name="description" content="AI tenant-landlord communication assistant for California renters." />
        <meta property="og:title" content="Rent Right: tenant-landlord help for California renters" />
        <meta property="og:description" content="AI tenant-landlord communication assistant for California renters." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.rentrightportal.com" />
        <meta property="og:image" content="https://app.rentrightportal.com/og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Rent Right. Keep your rental records and talk to your landlord, all in one place." />
        <meta property="og:site_name" content="Rent Right" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Rent Right: tenant-landlord help for California renters" />
        <meta name="twitter:description" content="AI tenant-landlord communication assistant for California renters." />
        <meta name="twitter:image" content="https://app.rentrightportal.com/og.png" />
        <link rel="canonical" href="https://app.rentrightportal.com" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: viewportCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const viewportCss = `
html, body, #root {
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
}
body {
  margin: 0;
  overflow: hidden;
  background: #E6F0EE;
}
#root {
  display: flex;
  flex-direction: column;
}
`;
