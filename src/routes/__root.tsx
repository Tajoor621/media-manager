import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { publicUrl } from "@/lib/public-url";
import {
  SITE_DESCRIPTION,
  SITE_IMAGE,
  SITE_IMAGE_ALT,
  SITE_JSON_LD,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site-meta";
import appCss from "../styles.css?url";

const APP_NAME = "Media Manager";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "application-name", content: SITE_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", content: "#0A0A0B" },
      { name: "color-scheme", content: "dark light" },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { name: "format-detection", content: "telephone=no" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: SITE_IMAGE },
      { property: "og:image:alt", content: SITE_IMAGE_ALT },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: SITE_IMAGE },
      { name: "twitter:image:alt", content: SITE_IMAGE_ALT },
    ],
    links: [
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", type: "image/svg+xml", href: publicUrl("favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "192x192", href: publicUrl("icon-192.png") },
      { rel: "icon", type: "image/png", sizes: "512x512", href: publicUrl("icon-512.png") },
      { rel: "apple-touch-icon", href: publicUrl("icon-180.png") },
      { rel: "apple-touch-icon", sizes: "180x180", href: publicUrl("icon-180.png") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: publicUrl("manifest.webmanifest") },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(SITE_JSON_LD),
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("mm-621-settings")||"{}");if(s.theme==="light")document.documentElement.classList.add("light")}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
