import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function SectionHeader({ title, subtitle, children }: SectionHeaderProps) {
  return (
    <Box mb={4}>
      <Typography variant="h4" component="h2" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  );
}
