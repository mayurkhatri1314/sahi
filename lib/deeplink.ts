/**
 * Wraps a merchant URL with affiliate tracking so clicks are attributed.
 * Only public identifiers go into the link: it is visible to every shopper.
 * Confirm the exact deeplink formats in your Cuelinks / INRDeals dashboards.
 */
export function buildAffiliateLink(productUrl: string, storeId: string, subId = "sahi"): string {
  try {
    const url = new URL(productUrl);

    if (storeId === "amazon") {
      const tag = process.env.AMAZON_ASSOCIATE_TAG;
      if (tag) url.searchParams.set("tag", tag);
      url.searchParams.set("ascsubtag", subId);
      return url.toString();
    }

    const cuelinksCid = process.env.CUELINKS_CHANNEL_ID;
    if (cuelinksCid) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(cuelinksCid)}&source=linkkit&subid=${encodeURIComponent(subId)}&url=${encodeURIComponent(productUrl)}`;
    }

    const inrdeals = process.env.INRDEALS_PUBLISHER_ID;
    if (inrdeals) {
      return `https://inrdeals.com/track?id=${encodeURIComponent(inrdeals)}&subid=${encodeURIComponent(subId)}&url=${encodeURIComponent(productUrl)}`;
    }

    return productUrl; // no network configured yet: raw link, no commission
  } catch {
    return productUrl;
  }
}
