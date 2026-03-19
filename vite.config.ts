import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: [
        "**/ai_service/.venv/**",
        "**/backend/.amplify/**",
      ],
    },
  },
});
