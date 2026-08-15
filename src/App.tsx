import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "@/components/CookieConsent";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { lazy, Suspense } from "react";

// Customer pages — eagerly loaded (customers need these fast)
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import UniformShop from "./pages/UniformShop";
import SchoolUniformPage from "./pages/SchoolUniformPage";
import ProductPage from "./pages/ProductPage";
import Order from "./pages/Order";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import TrackOrder from "./pages/TrackOrder";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import Wishlist from "./pages/Wishlist";
import OrderHistory from "./pages/OrderHistory";
import OAuthConsent from "./pages/OAuthConsent";

// Admin pages — lazy loaded (only you access these, no need to download on customer visit)
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

// Staff pages — lazy loaded (same reason)
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

// Simple loading spinner for lazy pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
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
            {/* Customer routes — load instantly */}
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/uniform-shop" element={<UniformShop />} />
            <Route path="/uniform-shop/school/:schoolSlug" element={<SchoolUniformPage />} />
            <Route path="/shop/product/:productId" element={<ProductPage />} />
            <Route path="/order" element={<Order />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/track-order" element={<TrackOrder />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

            {/* Admin routes — only load when /admin/* is visited */}
            <Route path="/admin/login" element={<Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>} />
            <Route path="/admin/dashboard" element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
            <Route path="/admin/products" element={<Suspense fallback={<PageLoader />}><AdminProducts /></Suspense>} />
            <Route path="/admin/products/new" element={<Suspense fallback={<PageLoader />}><ProductForm /></Suspense>} />
            <Route path="/admin/products/:id" element={<Suspense fallback={<PageLoader />}><ProductForm /></Suspense>} />
            <Route path="/admin/orders" element={<Suspense fallback={<PageLoader />}><AdminOrders /></Suspense>} />
            <Route path="/admin/schools" element={<Suspense fallback={<PageLoader />}><AdminSchools /></Suspense>} />
            <Route path="/admin/schools/new" element={<Suspense fallback={<PageLoader />}><AdminSchools /></Suspense>} />
            <Route path="/admin/users" element={<Suspense fallback={<PageLoader />}><AdminUsers /></Suspense>} />
            <Route path="/admin/discounts" element={<Suspense fallback={<PageLoader />}><AdminDiscounts /></Suspense>} />
            <Route path="/admin/analytics" element={<Suspense fallback={<PageLoader />}><AdminAnalytics /></Suspense>} />
            <Route path="/admin/settings" element={<Suspense fallback={<PageLoader />}><AdminSettings /></Suspense>} />
            <Route path="/admin/pricing" element={<Suspense fallback={<PageLoader />}><PricingChart /></Suspense>} />
            <Route path="/admin/payments" element={<Suspense fallback={<PageLoader />}><AdminPayments /></Suspense>} />
            <Route path="/admin/monitor" element={<Suspense fallback={<PageLoader />}><AdminSystemMonitor /></Suspense>} />
            <Route path="/admin/reviews" element={<Suspense fallback={<PageLoader />}><AdminReviews /></Suspense>} />
            <Route path="/admin/store-content" element={<Suspense fallback={<PageLoader />}><AdminStoreContent /></Suspense>} />
            <Route path="/admin/staff" element={<Suspense fallback={<PageLoader />}><AdminStaff /></Suspense>} />

            {/* Staff routes — only load when /staff/* is visited */}
            <Route path="/staff/login" element={<Suspense fallback={<PageLoader />}><StaffLogin /></Suspense>} />
            <Route path="/staff" element={<Suspense fallback={<PageLoader />}><StaffDashboard /></Suspense>} />
            <Route path="/staff/quotations" element={<Suspense fallback={<PageLoader />}><QuotationHistory /></Suspense>} />
            <Route path="/staff/quotations/new" element={<Suspense fallback={<PageLoader />}><QuotationNew /></Suspense>} />
            <Route path="/staff/customers" element={<Suspense fallback={<PageLoader />}><StaffCustomers /></Suspense>} />
            <Route path="/staff/price-book" element={<Suspense fallback={<PageLoader />}><StaffPriceBook /></Suspense>} />
            <Route path="/staff/reports" element={<Suspense fallback={<PageLoader />}><StaffReports /></Suspense>} />
            <Route path="/staff/settings" element={<Suspense fallback={<PageLoader />}><StaffSettings /></Suspense>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
