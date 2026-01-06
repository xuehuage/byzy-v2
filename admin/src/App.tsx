import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SchoolList from './pages/SchoolList';
import OrderList from './pages/OrderList';
import ImportData from './pages/ImportData';
import AdminLayout from './layouts/AdminLayout';

// Protection logic
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/byzy-admin" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/byzy-admin" element={<Login />} />

        {/* Protected Admin Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          {/* Index route: Visiting '/' loads SchoolList */}
          <Route index element={<Navigate to="/schools" replace />} />

          {/* Redirects: Visiting '/dashboard' redirects to '/' */}
          <Route path="dashboard" element={<Navigate to="/" replace />} />

          {/* Other routes */}
          <Route path="schools" element={<SchoolList />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="import" element={<ImportData />} />
        </Route>

        {/* Catch-all: Redirect unknown paths to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
