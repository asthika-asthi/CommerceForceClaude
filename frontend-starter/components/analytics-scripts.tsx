"use client"
import { useEffect, useState } from "react"
import Script from "next/script"
import { getConsentStatus, CONSENT_CHANGED_EVENT, type ConsentStatus } from "@/components/cookie-consent"

interface Props {
  ga4MeasurementId?: string | null
  metaPixelId?: string | null
}

/**
 * Loads GA4 / Meta Pixel only once the visitor has accepted non-essential
 * cookies. Reacts live to the consent banner's accept/decline via a custom
 * event — no shared state library needed for two components.
 */
export function AnalyticsScripts({ ga4MeasurementId, metaPixelId }: Props) {
  const [consent, setConsent] = useState<ConsentStatus>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- correct mount-time consent read (SSR-safe); proper refactor tracked in backlog "Storefront lint debt"
    setConsent(getConsentStatus())
    function onChange(e: Event) {
      setConsent((e as CustomEvent<ConsentStatus>).detail)
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange)
  }, [])

  if (consent !== "accepted") return null

  return (
    <>
      {ga4MeasurementId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4MeasurementId}');`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  )
}
