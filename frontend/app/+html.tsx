// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const FAVICON = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCF9FF"/><stop offset=".55" stop-color="#F3EAFF"/><stop offset="1" stop-color="#E9F8F6"/></linearGradient>
    <linearGradient id="mic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8B3FF"/><stop offset=".55" stop-color="#7659D7"/><stop offset="1" stop-color="#201A54"/></linearGradient>
  </defs>
  <rect x="3" y="3" width="122" height="122" rx="28" fill="url(#bg)" stroke="#E2B19F" stroke-width="4"/>
  <circle cx="64" cy="61" r="43" fill="none" stroke="#C8B3FF" stroke-opacity=".65" stroke-width="3"/>
  <circle cx="64" cy="61" r="35" fill="none" stroke="#9DE2DD" stroke-opacity=".55" stroke-width="2"/>
  <path d="M64 31c-10 0-17 7-17 17v22c0 10 7 17 17 17s17-7 17-17V48c0-10-7-17-17-17z" fill="url(#mic)" stroke="#E2B19F" stroke-width="3"/>
  <path d="M39 67v4c0 14 11 25 25 25s25-11 25-25v-4M64 96v11M52 108h24" fill="none" stroke="#E2B19F" stroke-width="4" stroke-linecap="round"/>
  <path d="M26 56v10M33 51v20M40 57v8M88 57v8M95 51v20M102 56v10" stroke="#7659D7" stroke-width="3" stroke-linecap="round"/>
  <path d="M64 13l2.3 6.7L73 22l-6.7 2.3L64 31l-2.3-6.7L55 22l6.7-2.3L64 13z" fill="#E2B19F"/>
</svg>`)} `;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Aura Voice — Ask · Receive · Apply</title>
        <meta name="description" content="Aura Voice is a voice-first guide for occult sciences, mindfulness and aura: speak your question and hear a practical response." />
        <meta name="theme-color" content="#070713" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Aura Voice" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Aura Voice" />
        <link rel="icon" href={FAVICON.trim()} />
        <link rel="shortcut icon" href={FAVICON.trim()} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
          [role="tablist"] [role="tab"] * { overflow: visible !important; }
          [role="heading"], [role="heading"] * { overflow: visible !important; }
          ::selection { background: rgba(200,179,255,.28); color: #FCF9FF; }
        ` }} />
      </head>
      <body style={{ margin: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "#070713" }}>
        {children}
      </body>
    </html>
  );
}
