import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    // dev: aceita qualquer host de tunnel (loca.lt, ngrok, etc.)
    allowedHosts: true,
  },

  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        varianteB: path.resolve(__dirname, "variante-b.html"),
        privacidade: path.resolve(__dirname, "privacidade.html"),
        termos: path.resolve(__dirname, "termos.html"),
      },
    },
  },

  plugins: [
    {
      name: "frame-saver",
      configureServer(server) {
        server.middlewares.use("/__save", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            return res.end("POST only");
          }
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const { name, data } = JSON.parse(body);
              const b64 = data.replace(/^data:image\/\w+;base64,/, "");
              const dir = path.resolve("frames");
              fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(
                path.join(dir, name),
                Buffer.from(b64, "base64")
              );
              res.end("ok");
            } catch (e) {
              res.statusCode = 500;
              res.end(String(e));
            }
          });
        });
      },
    },
  ],
});