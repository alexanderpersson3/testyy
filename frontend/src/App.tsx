import React from 'react';
import { ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme/theme';
import Navigation from './components/organisms/Navigation';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MapProvider } from './contexts/MapContext';
import { ConnectionStatus } from './components/atoms/ConnectionStatus';
import { RecipeList } from './pages/RecipeList';
import { RecipeDetail } from './pages/RecipeDetail';
import { CreateRecipe } from './pages/CreateRecipe';
import { EditRecipe } from './pages/EditRecipe';
import { UserProfile } from './pages/UserProfile';
import { Products } from './pages/Products';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <WebSocketProvider>
            <MapProvider>
              <Router>
                <Navigation />
                <ConnectionStatus />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Navigate to="/recipes" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/recipes" element={<RecipeList />} />
                  <Route path="/recipes/:id" element={<RecipeDetail />} />

                  {/* Protected Routes */}
                  <Route
                    path="/recipes/create"
                    element={
                      <ProtectedRoute>
                        <CreateRecipe />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/recipes/:id/edit"
                    element={
                      <ProtectedRoute>
                        <EditRecipe />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/:id"
                    element={
                      <ProtectedRoute>
                        <UserProfile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/products"
                    element={
                      <ProtectedRoute>
                        <Products />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 Route */}
                  <Route
                    path="*"
                    element={
                      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <h1>404: Page Not Found</h1>
                        <p>The page you're looking for doesn't exist.</p>
                      </div>
                    }
                  />
                </Routes>
              </Router>
            </MapProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default App; 