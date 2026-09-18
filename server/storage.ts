import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage config missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Storage config missing: set R2_BUCKET_NAME");
  return bucket;
}

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string) {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }));

  return { key, url: `/api/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const client = getClient();
  const key = normalizeKey(relKey);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: getBucket(), Key: key }), { expiresIn: 3600 });
}

/**
 * Copia um objeto já existente no bucket para uma nova chave, sem baixar e
 * reenviar o binário (a cópia acontece inteiramente no lado do R2/S3).
 * Usado pelo arquivamento: os documentos do ciclo já estão no bucket, então
 * "empacotar" significa apenas duplicá-los sob o prefixo do arquivo histórico.
 */
export async function storageCopy(sourceRelKey: string, destRelKey: string): Promise<{ key: string }> {
  const client = getClient();
  const bucket = getBucket();
  const sourceKey = normalizeKey(sourceRelKey);
  const destKey = normalizeKey(destRelKey);
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(sourceKey)}`,
      Key: destKey,
    }),
  );
  return { key: destKey };
}

/** Confirma que um objeto existe (e obtém seu tamanho) após uma cópia/upload. */
export async function storageVerify(relKey: string): Promise<{ exists: boolean; size?: number }> {
  const client = getClient();
  const key = normalizeKey(relKey);
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return { exists: true, size: head.ContentLength };
  } catch {
    return { exists: false };
  }
}

/** Envia um JSON já serializado como parte do pacote de arquivamento (sem sufixo hash: a chave é fixa e determinística). */
export async function storagePutExact(relKey: string, data: Buffer | string, contentType = "application/json"): Promise<{ key: string }> {
  const client = getClient();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }));
  return { key };
}
