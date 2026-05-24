import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION;

if (!bucket) {
  console.warn('S3_BUCKET not configured — avatar uploads will fail');
}

const s3 = new S3Client({ region: region ?? 'us-east-1' });

export async function uploadDataUrlToS3(dataUrl: string, folder = 'avatars') {
  if (!bucket) throw new Error('S3_BUCKET not configured');
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');
  const contentType = match[1];
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');

  const key = `${folder}/${crypto.randomBytes(12).toString('hex')}.${contentType.split('/')[1]}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3.send(cmd);

  // Construct public URL — for most regions this pattern works
  const url = `https://${bucket}.s3.${region ?? 'us-east-1'}.amazonaws.com/${key}`;
  return url;
}
