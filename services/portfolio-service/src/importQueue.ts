import { Queue } from "bullmq";

let importQueue: Queue | null = null;

function redisConnectionFromUrl(urlStr: string) {
  const u = new URL(urlStr);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    maxRetriesPerRequest: null,
  };
}

export function getImportQueue(): Queue | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!importQueue) {
    importQueue = new Queue("import-workbook", {
      connection: redisConnectionFromUrl(url),
    });
  }
  return importQueue;
}

export async function closeImportQueue(): Promise<void> {
  if (importQueue) {
    await importQueue.close();
    importQueue = null;
  }
}
