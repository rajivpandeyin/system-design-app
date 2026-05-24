import { useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginFormValues } from '../features/auth/authSchemas';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login } from '../features/auth/authSlice';
import { AuthCard } from '../components/ui/AuthCard';
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Alert,
} from '@mui/material';

function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authState = useAppSelector((state) => state.auth);

  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const resultAction = await dispatch(login(values));
    if (login.fulfilled.match(resultAction)) {
      navigate('/dashboard');
    }
  };

  return (
    <AuthCard title="Welcome Back" subtitle="Login to explore the system design dashboard">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          <TextField label="Email" type="email" fullWidth {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
          <TextField label="Password" type="password" fullWidth {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
          {authState.error && <Alert severity="error">{authState.error}</Alert>}
          <Button type="submit" variant="contained" disabled={authState.status === 'loading'}>
            {authState.status === 'loading' ? <CircularProgress size={20} /> : 'Login'}
          </Button>
          <Box textAlign="center">
            <Link component={RouterLink} to="/signup">
              Create a new account
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthCard>
  );
}

export default LoginPage;
