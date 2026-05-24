import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { renderWithProviders } from '../test/test-utils';

function TestApp() {
  return (
    <Routes>
      <Route path="/login" element={<div>Login Page</div>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div>Dashboard Content</div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to login when no token', () => {
    renderWithProviders(<TestApp />, { initialEntries: ['/dashboard'] });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders children when token exists', () => {
    renderWithProviders(<TestApp />, {
      initialEntries: ['/dashboard'],
      preloadedAuth: { token: 'test-token', status: 'succeeded' },
    });
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });
});
