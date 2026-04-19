import { createServerFn } from "@tanstack/react-start";
import { XMLParser } from "fast-xml-parser";

export type FeedSource = {
  id: string;
  name: string;
  url: string;
  category: string;
};

export const FEED_SOURCES: FeedSource[] = [
  { id: "antara", name: "ANTARA EN", url: "https://en.antaranews.com/rss/news.xml", category: "INTL" },
  { id: "sindo", name: "SINDONEWS", url: "https://www.sindonews.com/feed", category: "NAT" },
  { id: "viva", name: "VIVA", url: "https://www.viva.co.id/get/all", category: "NAT" },
  { id: "jpnn", name: "JPNN", url: "https://www.jpnn.com/index.php?mib=rss", category: "NAT" },
  { id: "media", name: "MEDIA INDONESIA", url: "https://mediaindonesia.com/feed", category: "NAT" },
  { id: "tribun", name: "TRIBUNNEWS", url: "https://www.tribunnews.com/rss", category: "NAT" },
  { id: "fajar", name: "FAJAR", url: "https://fajar.co.id/feed", category: "REG" },
];

export type NewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  link: string;
  pubDate: string;
  pubTimestamp: number;
  description: string;
  category?: string;
};

export type FeedResult = {
  sourceId: string;
  sourceName: string;
  category: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  responseMs: number;
  itemCount: number;
  fetchedAt: number;
  error?: string;
  items: NewsItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: true,
  trimValues: true,
});

function stripHtml(s: string): string {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function getText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["#text"] === "number") return String(obj["#text"]);
  }
  return "";
}

function parseFeed(xml: string, source: FeedSource): NewsItem[] {
  const data = parser.parse(xml);
  // RSS 2.0
  const channelItems = data?.rss?.channel?.item;
  // Atom
  const atomEntries = data?.feed?.entry;

  const rawItems = channelItems ? asArray(channelItems) : asArray(atomEntries);

  return rawItems.slice(0, 30).map((it: Record<string, unknown>, i: number) => {
    const title = stripHtml(getText(it.title));
    let link = "";
    if (typeof it.link === "string") link = it.link;
    else if (Array.isArray(it.link)) {
      const first = it.link[0] as Record<string, unknown> | string;
      link = typeof first === "string" ? first : String((first as Record<string, unknown>)?.["@_href"] ?? "");
    } else if (it.link && typeof it.link === "object") {
      const l = it.link as Record<string, unknown>;
      link = typeof l["@_href"] === "string" ? l["@_href"] : getText(l);
    }
    const pubDateRaw =
      getText(it.pubDate) || getText(it.published) || getText(it.updated) || "";
    const ts = pubDateRaw ? new Date(pubDateRaw).getTime() : Date.now();
    const description = stripHtml(
      getText(it.description) || getText(it.summary) || getText(it["content:encoded"]) || ""
    ).slice(0, 240);
    const category = stripHtml(getText(asArray(it.category)[0] ?? ""));

    return {
      id: `${source.id}-${i}-${ts}`,
      sourceId: source.id,
      sourceName: source.name,
      title: title || "(untitled)",
      link,
      pubDate: pubDateRaw,
      pubTimestamp: isNaN(ts) ? Date.now() : ts,
      description,
      category: category || undefined,
    };
  });
}

async function fetchSource(source: FeedSource): Promise<FeedResult> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(source.url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommandCenterBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timeout);
    const responseMs = Date.now() - start;
    if (!res.ok) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        status: "OFFLINE",
        responseMs,
        itemCount: 0,
        fetchedAt: Date.now(),
        error: `HTTP ${res.status}`,
        items: [],
      };
    }
    const xml = await res.text();
    const items = parseFeed(xml, source);
    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      status: items.length === 0 ? "DEGRADED" : "ONLINE",
      responseMs,
      itemCount: items.length,
      fetchedAt: Date.now(),
      items,
    };
  } catch (err) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      status: "OFFLINE",
      responseMs: Date.now() - start,
      itemCount: 0,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : "unknown error",
      items: [],
    };
  }
}

export type FeedsPayload = {
  fetchedAt: number;
  sources: FeedResult[];
};

export const fetchAllFeeds = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeedsPayload> => {
    const results = await Promise.all(FEED_SOURCES.map(fetchSource));
    return {
      fetchedAt: Date.now(),
      sources: results,
    };
  }
);
