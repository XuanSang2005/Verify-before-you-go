// Learn more: https://docs.expo.dev/router/reference/static-rendering/#root-html

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

import { colors } from '@/theme';

const webRootCss = `
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-height: 100%;
    margin: 0;
    padding: 0;
    background-color: ${colors.canvas};
    overflow-x: hidden;
    overscroll-behavior: none;
  }

  html {
    color-scheme: light;
  }

  html, body {
    touch-action: pan-y;
  }

  body {
    position: relative;
    min-height: 100dvh;
  }

  body::before {
    content: '';
    position: fixed;
    inset: -128px 0;
    z-index: -1;
    pointer-events: none;
    background-color: ${colors.canvas};
  }

  #root {
    min-width: 0;
    display: flex;
    position: relative;
    isolation: isolate;
  }

  @supports (height: 100dvh) {
    html, body, #root {
      height: 100dvh;
      min-height: 100dvh;
    }
  }

  [data-testid="vbyg-vertical-scroll"] {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden !important;
    overscroll-behavior: none !important;
    touch-action: pan-y;
    scroll-padding-bottom: 96px;
    -webkit-overflow-scrolling: touch;
  }
`;

// Web-only document shell used by Expo Router during static rendering.
export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
          name="viewport"
        />
        <meta content={colors.canvas} name="theme-color" />
        <meta content="light" name="color-scheme" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="default" name="apple-mobile-web-app-status-bar-style" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webRootCss }} id="vbyg-root-reset" />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
