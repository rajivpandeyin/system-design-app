import { Box, Card, CardContent, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 6 },
        boxSizing: 'border-box',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, p: { xs: 1, sm: 2 } }}>
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' } }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {subtitle}
            </Typography>
          )}
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
