import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the build run from GitHub Pages or any subfolder
export default defineConfig({ plugins: [react()], base: "./" });
