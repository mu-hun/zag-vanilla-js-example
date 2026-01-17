import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        accordion: resolve(__dirname, "pages/accordion.html"),
        avatar: resolve(__dirname, "pages/avatar.html"),
        checkbox: resolve(__dirname, "pages/checkbox.html"),
        combobox: resolve(__dirname, "pages/combobox.html"),
        counter: resolve(__dirname, "pages/counter.html"),
        popover: resolve(__dirname, "pages/popover.html"),
      },
    },
  },
});
