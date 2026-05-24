import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../features/auth/authSlice';
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionIcon from '@mui/icons-material/Description';
import LogoutIcon from '@mui/icons-material/Logout';

const drawerWidthOpen = 280;
const drawerWidthClosed = 72;

const navItems = [
  { label: 'Overview', path: '/dashboard', icon: <HomeIcon /> },
  { label: 'URL Shortener', path: '/dashboard/url-shortener', icon: <LinkIcon /> },
  { label: 'Google Docs', path: '/dashboard/google-docs', icon: <DescriptionIcon /> },
];

function DashboardLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const title =
    navItems.find((item) => item.path === location.pathname)?.label ||
    (location.pathname === '/dashboard/profile' ? 'Profile' : 'Dashboard');
  const sidebarExpanded = isMobile ? true : desktopOpen;
  const drawerWidth = sidebarExpanded ? drawerWidthOpen : drawerWidthClosed;

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setDesktopOpen((prev) => !prev);
    }
  };

  const closeMobileDrawer = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleConfirmLogout = () => {
    setLogoutDialogOpen(false);
    dispatch(logout());
    navigate('/login');
  };

  const drawerPaperSx = {
    width: drawerWidthOpen,
    boxSizing: 'border-box' as const,
    top: { xs: 56, sm: 64 },
    height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {sidebarExpanded && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            System Design Tools
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Toggle the menu and choose a workspace to explore mock flows and language-aware tools.
          </Typography>
        </Box>
      )}
      {sidebarExpanded && <Divider />}
      <List sx={{ display: 'flex', flexDirection: 'column', alignItems: sidebarExpanded ? 'flex-start' : 'center', pt: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={location.pathname === item.path}
            onClick={closeMobileDrawer}
            sx={{
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              px: sidebarExpanded ? 2 : 1,
              minWidth: 0,
              width: sidebarExpanded ? '100%' : 56,
              mx: sidebarExpanded ? 0 : 'auto',
            }}
            title={!sidebarExpanded ? item.label : undefined}
          >
            <ListItemIcon sx={{ minWidth: sidebarExpanded ? 40 : 0, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
            {sidebarExpanded && <ListItemText primary={item.label} />}
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: '100%',
          left: 0,
          right: 0,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, minWidth: 0, flex: 1 }}>
            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} aria-label="Toggle navigation menu">
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Admin Panel —{' '}
              </Box>
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
            {user && (
              <>
                <Typography
                  variant="body2"
                  sx={{ cursor: 'pointer', display: { xs: 'none', md: 'block' } }}
                  onClick={() => navigate('/dashboard/profile')}
                >
                  {user.name}
                </Typography>
                <IconButton color="inherit" onClick={() => navigate('/dashboard/profile')} aria-label="Open profile">
                  <Avatar src={(user as { avatar?: string }).avatar ?? undefined} sx={{ width: 32, height: 32 }} />
                </IconButton>
              </>
            )}
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogoutClick}
              sx={{ minWidth: { xs: 'auto', sm: 64 }, px: { xs: 1, sm: 2 } }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Logout
              </Box>
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }} aria-label="Dashboard navigation">
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobileDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            width: drawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '& .MuiDrawer-paper': {
              ...drawerPaperSx,
              width: drawerWidth,
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar
          sx={{
            flexShrink: 0,
            minHeight: {
              xs: 'calc(56px + 24px)',
              sm: 'calc(64px + 30px)',
              md: 'calc(64px + 32px)',
            },
          }}
        />
        <Box
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: 960,
            mx: 'auto',
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 3 },
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Logout</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to logout?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setLogoutDialogOpen(false)} variant="outlined" fullWidth={isMobile}>
            Cancel
          </Button>
          <Button onClick={handleConfirmLogout} variant="contained" color="error" fullWidth={isMobile}>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DashboardLayout;
