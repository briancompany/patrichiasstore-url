import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "@/components/CookieConsent";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { lazy, Suspense } from "react";

// Keep the homepage as the smallest public entry chunk.
import Index from "./pages/Index";

// Customer routes are loaded on demand. This keeps checkout, payment, history,
// contact and other secondary pages out of the initial homepage download.
const Shop = lazy(() => import("./pages/Shop"));
const UniformShop = lazy(() => import("./pages/UniformShop"));
const SchoolUniformPage = lazy(() => import("./pages/SchoolUniformPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const Order = lazy(() => import("./pages/Order"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Admin chunks are downloaded only when an /admin route is actually opened.
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminSchools = lazy(() => import("./pages/admin/Schools"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminDiscounts = lazy(() => import("./pages/admin/Discounts"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const PricingChart = lazy(() => import("./pages/admin/PricingChart"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const AdminSystemMonitor = lazy(() => import("./pages/admin/SystemMonitor"));
const AdminReviews = lazy(() => import("./pages/admin/ReviewsManager"));
const AdminStoreContent = lazy(() => import("./pages/admin/StoreContent"));
const AdminStaff = lazy(() => import("./pages/admin/Staff"));

// Staff chunks are completely separate from the public customer bundle.
const StaffLogin = lazy(() => import("./pages/staff/Login"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const QuotationNew = lazy(() => import("./pages/staff/QuotationNew"));
const QuotationHistory = lazy(() => import("./pages/staff/QuotationHistory"));
const StaffCustomers = lazy(() => import("./pages/staff/Customers"));
const StaffPriceBook = lazy(() => import("./pages/staff/PriceBook"));
const StaffReports = lazy(() => import("./pages/staff/Reports"));
const StaffSettings = lazy(() => import("./pages/staff/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" aria-label="Loading">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

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
            <Route path="/shop" element={<LazyPage><Shop /></LazyPage>} />
            <Route path="/uniform-shop" element={<LazyPage><UniformShop /></LazyPage>} />
            <Route path="/uniform-shop/school/:schoolSlug" element={<LazyPage><SchoolUniformPage /></LazyPage>} />
            <Route path="/shop/product/:productId" element={<LazyPage><ProductPage /></LazyPage>} />
            <Route path="/order" element={<LazyPage><Order /></LazyPage>} />
            <Route path="/checkout" element={<LazyPage><Checkout /></LazyPage>} />
            <Route path="/payment" element={<LazyPage><Payment /></LazyPage>} />
            <Route path="/track-order" element={<LazyPage><TrackOrder /></LazyPage>} />
            <Route path="/about" element={<LazyPage><About /></LazyPage>} />
            <Route path="/contact" element={<LazyPage><Contact /></LazyPage>} />
            <Route path="/wishlist" element={<LazyPage><Wishlist /></LazyPage>} />
            <Route path="/order-history" element={<LazyPage><OrderHistory /></LazyPage>} />
            <Route path="/.lovable/oauth/consent" element={<LazyPage><OAuthConsent /></LazyPage>} />

            <Route path="/admin/login" element={<LazyPage><AdminLogin /></LazyPage>} />
            <Route path="/admin/dashboard" element={<LazyPage><AdminDashboard /></LazyPage>} />
            <Route path="/admin/products" element={<LazyPage><AdminProducts /></LazyPage>} />
            <Route path="/admin/products/new" element={<LazyPage><ProductForm /></LazyPage>} />
            <Route path="/admin/products/:id" element={<LazyPage><ProductForm /></LazyPage>} />
            <Route path="/admin/orders" element={<LazyPage><AdminOrders /></LazyPage>} />
            <Route path="/admin/schools" element={<LazyPage><AdminSchools /></LazyPage>} />
            <Route path="/admin/schools/new" element={<LazyPage><AdminSchools /></LazyPage>} />
            <Route path="/admin/users" element={<LazyPage><AdminUsers /></LazyPage>} />
            <Route path="/admin/discounts" element={<LazyPage><AdminDiscounts /></LazyPage>} />
            <Route path="/admin/analytics" element={<LazyPage><AdminAnalytics /></LazyPage>} />
            <Route path="/admin/settings" element={<LazyPage><AdminSettings /></LazyPage>} />
            <Route path="/admin/pricing" element={<LazyPage><PricingChart /></LazyPage>} />
            <Route path="/admin/payments" element={<LazyPage><AdminPayments /></LazyPage>} />
            <Route path="/admin/monitor" element={<LazyPage><AdminSystemMonitor /></LazyPage>} />
            <Route path="/admin/reviews" element={<LazyPage><AdminReviews /></LazyPage>} />
            <Route path="/admin/store-content" element={<LazyPage><AdminStoreContent /></LazyPage>} />
            <Route path="/admin/staff" element={<LazyPage><AdminStaff /></LazyPage>} />

            <Route path="/staff/login" element={<LazyPage><StaffLogin /></LazyPage>} />
            <Route path="/staff" element={<LazyPage><StaffDashboard /></LazyPage>} />
            <Route path="/staff/quotations" element={<LazyPage><QuotationHistory /></LazyPage>} />
            <Route path="/staff/quotations/new" element={<LazyPage><QuotationNew /></LazyPage>} />
            <Route path="/staff/customers" element={<LazyPage><StaffCustomers /></LazyPage>} />
            <Route path="/staff/price-book" element={<LazyPage><StaffPriceBook /></LazyPage>} />
            <Route path="/staff/reports" element={<LazyPage><StaffReports /></LazyPage>} />
            <Route path="/staff/settings" element={<LazyPage><StaffSettings /></LazyPage>} />

            <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
