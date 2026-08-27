import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ថេរ — ប្រព័ន្ធតាមដានផ្ទាល់ខ្លួន",
    short_name: "ថេរ",
    description:
      "តាមដានសកម្មភាពប្រចាំថ្ងៃ ចំណូល និងចំណាយ និងគោលដៅគ្រួសារ។",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6f4",
    theme_color: "#0b6557",
    lang: "km",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
