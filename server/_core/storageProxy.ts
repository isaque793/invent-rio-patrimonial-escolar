import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/api/storage/*", async (req, res) => {
    try {
      const key = (req.params as Record<string, string>)[0];
      if (!key) {
        res.status(400).json({ error: "Missing storage key" });
        return;
      }
      const url = await storageGetSignedUrl(key);
      res.redirect(307, url);
    } catch (error) {
      console.error("[Storage] Failed to generate signed URL:", error);
      res.status(500).json({ error: "Failed to access file" });
    }
  });
}
