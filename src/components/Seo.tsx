import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  path?: string;
}

const SITE = "Vogels Laboratory";
const ORIGIN = "https://vogellab.lovable.app";

export function Seo({ title, description, path }: SeoProps) {
  const fullTitle = title.includes(SITE) ? title : `${title} — ${SITE}`;
  const cappedTitle = fullTitle.length > 60 ? fullTitle.slice(0, 57) + "…" : fullTitle;
  const url = path ? `${ORIGIN}${path}` : undefined;
  return (
    <Helmet>
      <title>{cappedTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={cappedTitle} />
      <meta property="og:description" content={description} />
      <meta name="twitter:title" content={cappedTitle} />
      <meta name="twitter:description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {url && <meta property="og:url" content={url} />}
    </Helmet>
  );
}
