import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import legacy from "@vitejs/plugin-legacy";
import { compression } from "vite-plugin-compression2";

// Inject custom.css at the end of <head> to override Vite-generated styles
const customCSSInjectionPlugin = {
  name: 'custom-css-injection',
  transformIndexHtml(html: string) {
    const withoutExistingTemplate = html.replace(
      /\[{\[\s*if \.CSS\s*-\]}\]\s*<link\s+rel="stylesheet"\s+href="\[{\[\s*\.StaticURL\s*\]}\]\/custom\.css"\s*\/>\s*\[{\[\s*end\s*\]}\]/g,
      '');
    return withoutExistingTemplate.replace(
      /(<\/head>)/,
      `\n    [{[ if .CSS -]}]\n    <link rel="stylesheet" href="[{[ .StaticURL ]}]/custom.css" />\n    [{[ end ]}]\n$1`
    );
  }
};

const plugins = [
  vue(),
  VueI18nPlugin({
    include: [path.resolve(__dirname, "./src/i18n/**/*.json")],
  }),
  legacy({
    // defaults already drop IE support
    targets: ["defaults"],
  }),
  compression({ include: /\.js$/i, deleteOriginalAssets: true }),
  customCSSInjectionPlugin,
];

const resolve = {
  alias: {
    // vue: "@vue/compat",
    "@/": `${path.resolve(__dirname, "src")}/`,
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins,
      resolve,
      server: {
        proxy: {
          "/api/command": {
            target: "ws://127.0.0.1:8080",
            ws: true,
          },
          "/api": "http://127.0.0.1:8080",
        },
      },
    };
  } else {
    // command === 'build'
    return {
      plugins,
      resolve,
      base: "",
      build: {
        cssCodeSplit: true,
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, "./public/index.html"),
          },
          output: {
            assetFileNames: 'assets/[name]-[hash][extname]',
            manualChunks: (id) => {
              // bundle dayjs files in a single chunk
              // this avoids having small files for each locale
              if (id.includes("dayjs/")) {
                return "dayjs";
                // bundle i18n in a separate chunk
              } else if (id.includes("i18n/")) {
                return "i18n";
              }
            },
          },
        },
      },
      experimental: {
        renderBuiltUrl(filename, { hostType }) {
          if (hostType === "js") {
            return { runtime: `window.__prependStaticUrl("${filename}")` };
          } else if (hostType === "html") {
            return `[{[ .StaticURL ]}]/${filename}`;
          } else {
            return { relative: true };
          }
        },
      },
    };
  }
});
