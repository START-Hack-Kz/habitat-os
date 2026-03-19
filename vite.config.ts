import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/ai_service/.venv/**", "**/ai_service/__pycache__/**"],
    },
  },
});
