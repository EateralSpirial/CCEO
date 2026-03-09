import type { QdrantStatus } from "../../shared/models.js";

export async function readQdrantStatus(url = "http://127.0.0.1:6333"): Promise<QdrantStatus> {
  try {
    const response = await fetch(`${url}/collections`);
    if (!response.ok) {
      return {
        reachable: false,
        url,
        collections: [],
        error: `HTTP ${response.status}`,
      };
    }
    const payload = (await response.json()) as {
      result?: { collections?: Array<{ name?: string }> };
    };
    const collections = payload.result?.collections?.map((entry) => entry.name || "").filter(Boolean) ?? [];
    return {
      reachable: true,
      url,
      collections,
    };
  } catch (error) {
    return {
      reachable: false,
      url,
      collections: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
