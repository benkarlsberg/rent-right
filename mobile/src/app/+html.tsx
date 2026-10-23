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
