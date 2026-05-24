import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { signupSchema, type SignupFormValues } from '../features/auth/authSchemas';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signup } from '../features/auth/authSlice';
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

function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authState = useAppSelector((state) => state.auth);

  const { register, handleSubmit, formState } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const resultAction = await dispatch(signup(values));
    if (signup.fulfilled.match(resultAction)) {
      navigate('/dashboard');
    }
  };

  return (
    <AuthCard title="Create Account" subtitle="Signup to start using the system design application">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          <TextField label="Name" fullWidth {...register('name')} error={!!formState.errors.name} helperText={formState.errors.name?.message} />
          <TextField label="Email" type="email" fullWidth {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
          <TextField label="Password" type="password" fullWidth {...register('password')} error={!!formState.errors.password} helperText={formState.errors.password?.message} />
          {authState.error && <Alert severity="error">{authState.error}</Alert>}
          <Button type="submit" variant="contained" disabled={authState.status === 'loading'}>
            {authState.status === 'loading' ? <CircularProgress size={20} /> : 'Signup'}
          </Button>
          <Box textAlign="center">
            <Link component={RouterLink} to="/login">
              Already have an account? Login
            </Link>
          </Box>
        </Stack>
      </Box>
    </AuthCard>
  );
}

export default SignupPage;
