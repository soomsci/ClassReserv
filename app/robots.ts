import type { MetadataRoute } from "next";

/** 공개 주소지만 검색엔진에는 노출하지 않는다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
