import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "@/components/CookieConsent";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import UniformShop from "./pages/UniformShop";
import Order from "./pages/Order";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import TrackOrder from "./pages/TrackOrder";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import ProductForm from "./pages/admin/ProductForm";
import AdminOrders from "./pages/admin/Orders";
import AdminSchools from "./pages/admin/Schools";
import AdminUsers from "./pages/admin/Users";
import AdminDiscounts from "./pages/admin/Discounts";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import PricingChart from "./pages/admin/PricingChart";
import AdminPayments from "./pages/admin/Payments";
import AdminSystemMonitor from "./pages/admin/SystemMonitor";
import AdminReviews from "./pages/admin/ReviewsManager";
import AdminStoreContent from "./pages/admin/StoreContent";
import Wishlist from "./pages/Wishlist";
import OrderHistory from "./pages/OrderHistory";
import StaffLogin from "./pages/staff/Login";
import StaffDashboard from "./pages/staff/Dashboard";
import AdminStaff from "./pages/admin/Staff";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallAppBanner />
        <CookieConsent />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/uniform-shop" element={<UniformShop />} />
            <Route path="/order" element={<Order />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/track-order" element={<TrackOrder />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/products/new" element={<ProductForm />} />
            <Route path="/admin/products/:id" element={<ProductForm />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/schools" element={<AdminSchools />} />
            <Route path="/admin/schools/new" element={<AdminSchools />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/discounts" element={<AdminDiscounts />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/pricing" element={<PricingChart />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/monitor" element={<AdminSystemMonitor />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/store-content" element={<AdminStoreContent />} />
            <Route path="/admin/staff" element={<AdminStaff />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
