import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { publicUrl } from "@/lib/public-url";
import appCss from "../styles.css?url";

const APP_NAME = "Media Manager";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", content: "#0A0A0B" },
      {
        name: "description",
        content: "Luxury media manager — browse, preview, and share every file.",
      },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
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
