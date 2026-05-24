import { useMemo, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../features/auth/authSlice';
import { Box, Button, Card, CardContent, Typography, Stack, Grid } from '@mui/material';
import MetricCard from './metrics/MetricCard';
import { api } from '../lib/api';

function DashboardPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const greeting = useMemo(() => {
    if (!user) {
      return 'Welcome back';
    }
    return `Welcome back, ${user.name}`;
  }, [user]);

  const handleLogout = () => {
    dispatch(logout());
  };

  const [metrics, setMetrics] = useState<{ [k: string]: string | number }>({
    requestsPerMin: '-',
    healthyHosts: '-',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/metrics');
        if (!mounted) return;
        setMetrics(res.data || {});
      } catch (e) {
        // if backend not ready, just keep defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {greeting}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              This admin dashboard provides quick access to system design tools and collaboration content.
            </Typography>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard title="Requests / min" value={metrics.requestsPerMin} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard title="Healthy Hosts" value={metrics.healthyHosts} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard title="Active Tools" value="2" />
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Get started
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the sidebar to switch between the URL Shortener and Google Docs tool pages. Each page includes a language selector and content preview.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" onClick={handleLogout}>
                Logout
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default DashboardPage;
