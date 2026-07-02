import React, { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { SiteLayout } from "./components/SiteLayout.tsx";
import { Seo } from "./components/Seo.tsx";
import App from "./App.tsx";

const Insights = lazy(() => import("./pages/Insights.tsx"));
const InsightDetail = lazy(() => import("./pages/InsightDetail.tsx"));
const Faq = lazy(() => import("./pages/Faq.tsx"));
const ProductUpdates = lazy(() => import("./pages/ProductUpdates.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Solutions = lazy(() => import("./pages/Solutions.tsx"));
const StaticSeoPage = lazy(() => import("./pages/StaticSeoPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const WhatsAppAgent = lazy(() => import("./pages/WhatsAppAgent.tsx"));
const ChristiesBriefPage = lazy(() => import("./pages/ChristiesBriefPage.tsx"));

const staticSeoSlugs = [
  "lead-nurturing-definition",
  "what-is-lead-nurturing",
  "lead-nurturing-strategy",
  "lead-nurturing-automation",
  "ai-marketing-real-estate",
  "ai-marketing-tools-real-estate",
  "real-estate-marketing-dubai",
  "real-estate-marketing-strategy",
  "off-plan-properties-dubai-marketing",
  "luxury-real-estate-marketing-dubai",
  "booking-automation-dubai-real-estate",
  "multi-agent-lead-nurturing",
];

const staticRoutes = staticSeoSlugs.map((slug) => ({
  path: slug,
  element: <StaticSeoPage slug={slug} />,
}));

function ClientLogin() {
  return (
    <SiteLayout>
      <Seo metaTitle="Client Login" metaDescription="AURO client portal" robots="noindex, follow" />
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <p className="text-neutral-500 font-mono text-xs">Client portal — access by invitation only.</p>
      </div>
    </SiteLayout>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D4FF00"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[spin_2s_linear_infinite] opacity-70"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m14.31 8 5.74 9.94" />
          <path d="M9.69 8h11.48" />
          <path d="m7.38 12 5.74-9.94" />
          <path d="M9.69 16 3.95 6.06" />
          <path d="M14.31 16H2.83" />
          <path d="m16.62 12-5.74 9.94" />
        </svg>
      </div>
    }>
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/agents",
    element: <SuspenseWrapper><WhatsAppAgent /></SuspenseWrapper>,
  },
  {
    path: "/agents/",
    element: <SuspenseWrapper><WhatsAppAgent /></SuspenseWrapper>,
  },
  {
    path: "/brief/christies",
    element: <SuspenseWrapper><ChristiesBriefPage /></SuspenseWrapper>,
  },
  {
    path: "/client-login",
    element: <ClientLogin />,
  },
  {
    element: <SiteLayout />,
    children: [
      { path: "insights", element: <SuspenseWrapper><Insights /></SuspenseWrapper> },
      { path: "insights/:slug", element: <SuspenseWrapper><InsightDetail /></SuspenseWrapper> },
      { path: "faq", element: <SuspenseWrapper><Faq /></SuspenseWrapper> },
      { path: "product-updates", element: <SuspenseWrapper><ProductUpdates /></SuspenseWrapper> },
      { path: "about", element: <SuspenseWrapper><About /></SuspenseWrapper> },
      { path: "solutions", element: <SuspenseWrapper><Solutions /></SuspenseWrapper> },
      ...staticRoutes.map(r => ({ ...r, element: <SuspenseWrapper>{r.element}</SuspenseWrapper> })),
      { path: "*", element: <SuspenseWrapper><NotFound /></SuspenseWrapper> },
    ],
  },
]);

export function SiteApp() {
  return (
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>
  );
}
