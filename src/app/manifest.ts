import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "돈조 - 주식 투자 관리",
    short_name: "돈조",
    description: "계좌별 주식 매매 기록과 수익률 관리",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f5f3",
    theme_color: "#2a78d6",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
