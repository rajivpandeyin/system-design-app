import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Avatar, Dialog, DialogContent, DialogActions, Slider } from '@mui/material';
import Cropper from 'react-easy-crop';
import { api } from '../lib/api';

// Helper to create a cropped image from canvas using pixel cropping
async function getCroppedImg(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return canvas.toDataURL('image/png');
}

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/auth/me')
      .then((res) => {
        if (!mounted) return;
        setName(res.data.user.name || '');
        setEmail(res.data.user.email || '');
      })
      .catch(() => {
        // ignore — ProtectedRoute will handle auth
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Image cropping state (react-easy-crop)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  // using react-easy-crop; no legacy canvas drawing state

  useEffect(() => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      setImageUrl(src);
      setCropDialogOpen(true); // open cropper immediately
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile]);

  // Simple canvas cropper functions (drag-to-select)
  const onCropComplete = useCallback((_: any, croppedAreaPixelsParam: any) => {
    setCroppedAreaPixels(croppedAreaPixelsParam);
  }, []);

  const handleCrop = async () => {
    if (!imageUrl || !croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(imageUrl, croppedAreaPixels);
      setCroppedDataUrl(cropped);
      setCropDialogOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // using react-easy-crop; no legacy canvas drawing here

  const handleSave = async () => {
    setMessage(null);
    try {
      const payload: any = { name, email };
      if (croppedDataUrl) payload.avatar = croppedDataUrl;
      const res = await api.put('/auth/me', payload);
      setMessage('Profile updated');
      setName(res.data.user.name);
      setEmail(res.data.user.email);
      if (res.data.user.avatar) setCroppedDataUrl(res.data.user.avatar);
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Update failed');
    }
  };

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        Profile
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{ maxWidth: 680 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', mb: 1 }}>
              <label htmlFor="avatar-input" style={{ cursor: 'pointer', textAlign: 'center' }}>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setSelectedFile(f);
                  }}
                />
                <Avatar
                  src={croppedDataUrl ?? undefined}
                  sx={{ width: 128, height: 128, cursor: 'pointer', mx: 'auto' }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Click avatar to select image
                </Typography>
              </label>
            </Box>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <Dialog open={cropDialogOpen} onClose={() => setCropDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
                {imageUrl && (
                  <Box sx={{ position: 'relative', width: '100%', height: { xs: 280, sm: 360, md: 400 } }}>
                    <Cropper
                      image={imageUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </Box>
                )}
                <Box sx={{ mt: 2 }}>
                  <Typography gutterBottom>Zoom</Typography>
                  <Slider value={zoom} min={1} max={3} step={0.1} onChange={(_, v) => setZoom(v as number)} />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCropDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCrop} variant="contained">Crop</Button>
              </DialogActions>
            </Dialog>
            <Box>
              <Button variant="contained" onClick={handleSave} disabled={loading}>
                Save
              </Button>
            </Box>
            {message && <Typography color="text.secondary">{message}</Typography>}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default ProfilePage;
