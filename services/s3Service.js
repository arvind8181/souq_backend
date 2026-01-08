// services/s3Service.js
import pkg from "@aws-sdk/client-s3";
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } =
  pkg;
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mime from "mime-types";

const accessKeyId = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const region = process.env.BUCKET_REGION;
const bucketName = process.env.BUCKET_NAME;
const env = process.env.NODE_ENV;
console.log('=== S3 Configuration Debug ===');
console.log('BUCKET_REGION:', region);
console.log('BUCKET_NAME:', bucketName);
console.log('ACCESS_KEY:', accessKeyId );
console.log('SECRET_ACCESS_KEY:', secretAccessKey);
console.log('NODE_ENV:', env);
console.log('=============================');
// --- Initialize S3 Client ---
const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

// --- Upload Image ---
export async function uploadImage({ buffer, s3Name }) {
  const ext = s3Name.split(".").pop();
  const key = `${env}/${s3Name}`;

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mime.lookup(ext) || "application/octet-stream",
    ACL: "private", // use 'public-read' if public access is needed
  };

  await s3.send(new PutObjectCommand(params));
  return { key };
}

// --- Generate Presigned URL ---
export async function getPresignedUrl(key, expiresSec = 60 * 60) {
  const cmd = new GetObjectCommand({
    Bucket: bucketName,
    Key: `${env}/${key}`,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

// --- Delete Object ---
export async function deleteObject(key) {
  const cmd = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await s3.send(cmd);
}
export async function getPresignedImageUrls(imagePaths = []) {
  return Promise.all(
    imagePaths.map(async (path) => {
      const s3Key = `${path}`;
      return getPresignedUrl(s3Key);
    })
  );
}
