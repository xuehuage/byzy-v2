import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SchoolList from './pages/SchoolList';
import OrderList from './pages/OrderList';
import ImportData from './pages/ImportData';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import SchoolMgmt from './pages/SchoolMgmt';
import ProductConfig from './pages/ProductConfig';
import OrderCenter from './pages/OrderCenter';
import AfterSales from './pages/AfterSales';
import ShippingMgmt from './pages/ShippingMgmt';

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
          {/* Index route: Visiting '/' loads Dashboard */}
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Other routes - V2 */}
          <Route path="school-mgmt" element={<SchoolMgmt />} />
          <Route path="product-config" element={<ProductConfig />} />
          <Route path="order-center" element={<OrderCenter />} />
          <Route path="after-sales" element={<AfterSales />} />
          <Route path="shipping-mgmt" element={<ShippingMgmt />} />

          {/* Other routes - V1 */}
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
