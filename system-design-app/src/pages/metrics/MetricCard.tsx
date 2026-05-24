import { Card, CardContent, Typography } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: string | number;
}

export default function MetricCard({ title, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5">{value}</Typography>
      </CardContent>
    </Card>
  );
}
