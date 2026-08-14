import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "@/components/CookieConsent";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { lazy, Suspense } from "react";

// Eagerly loaded — always needed immediately
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Customer pages — lazy loaded
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
const Wishlist = lazy(() => import("./pages/Wishlist"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));

// Admin pages — lazy loaded (never needed by customers)
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

// Staff pages — lazy loaded
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
      staleTime: 1000 * 60 * 5,      // 5 minutes — don't refetch if data is fresh
      gcTime: 1000 * 60 * 10,         // 10 minutes — keep in cache
      retry: 1,                        // only retry once on failure
      refetchOnWindowFocus: false,     // don't refetch when tab regains focus
    },
  },
});

// Loading fallback — minimal, fast
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const SuspenseRoute = ({ children }: { children: React.ReactNode }) => (
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
            <Route path="/shop" element={<SuspenseRoute><Shop /></SuspenseRoute>} />
            <Route path="/uniform-shop" element={<SuspenseRoute><UniformShop /></SuspenseRoute>} />
            <Route path="/uniform-shop/school/:schoolSlug" element={<SuspenseRoute><SchoolUniformPage /></SuspenseRoute>} />
            <Route path="/shop/product/:productId" element={<SuspenseRoute><ProductPage /></SuspenseRoute>} />
            <Route path="/order" element={<SuspenseRoute><Order /></SuspenseRoute>} />
            <Route path="/checkout" element={<SuspenseRoute><Checkout /></SuspenseRoute>} />
            <Route path="/payment" element={<SuspenseRoute><Payment /></SuspenseRoute>} />
            <Route path="/track-order" element={<SuspenseRoute><TrackOrder /></SuspenseRoute>} />
            <Route path="/about" element={<SuspenseRoute><About /></SuspenseRoute>} />
            <Route path="/contact" element={<SuspenseRoute><Contact /></SuspenseRoute>} />
            <Route path="/admin/login" element={<SuspenseRoute><AdminLogin /></SuspenseRoute>} />
            <Route path="/admin/dashboard" element={<SuspenseRoute><AdminDashboard /></SuspenseRoute>} />
            <Route path="/admin/products" element={<SuspenseRoute><AdminProducts /></SuspenseRoute>} />
            <Route path="/admin/products/new" element={<SuspenseRoute><ProductForm /></SuspenseRoute>} />
            <Route path="/admin/products/:id" element={<SuspenseRoute><ProductForm /></SuspenseRoute>} />
            <Route path="/admin/orders" element={<SuspenseRoute><AdminOrders /></SuspenseRoute>} />
            <Route path="/admin/schools" element={<SuspenseRoute><AdminSchools /></SuspenseRoute>} />
            <Route path="/admin/schools/new" element={<SuspenseRoute><AdminSchools /></SuspenseRoute>} />
            <Route path="/admin/users" element={<SuspenseRoute><AdminUsers /></SuspenseRoute>} />
            <Route path="/admin/discounts" element={<SuspenseRoute><AdminDiscounts /></SuspenseRoute>} />
            <Route path="/admin/analytics" element={<SuspenseRoute><AdminAnalytics /></SuspenseRoute>} />
            <Route path="/admin/settings" element={<SuspenseRoute><AdminSettings /></SuspenseRoute>} />
            <Route path="/admin/pricing" element={<SuspenseRoute><PricingChart /></SuspenseRoute>} />
            <Route path="/admin/payments" element={<SuspenseRoute><AdminPayments /></SuspenseRoute>} />
            <Route path="/admin/monitor" element={<SuspenseRoute><AdminSystemMonitor /></SuspenseRoute>} />
            <Route path="/admin/reviews" element={<SuspenseRoute><AdminReviews /></SuspenseRoute>} />
            <Route path="/admin/store-content" element={<SuspenseRoute><AdminStoreContent /></SuspenseRoute>} />
            <Route path="/admin/staff" element={<SuspenseRoute><AdminStaff /></SuspenseRoute>} />
            <Route path="/staff/login" element={<SuspenseRoute><StaffLogin /></SuspenseRoute>} />
            <Route path="/staff" element={<SuspenseRoute><StaffDashboard /></SuspenseRoute>} />
            <Route
              path="/staff/quotations"
              element={<QuotationHistory />}
            />
            <Route
              path="/staff/quotations/new"
              element={<QuotationNew />}
            />
            <Route
              path="/staff/customers"
              element={<StaffCustomers />}
            />
            <Route
              path="/staff/price-book"
              element={<StaffPriceBook />}
            />
            <Route
              path="/staff/reports"
              element={<StaffReports />}
            />
            <Route
              path="/staff/settings"
              element={<StaffSettings />}
            />
            <Route path="/wishlist" element={<SuspenseRoute><Wishlist /></SuspenseRoute>} />
            <Route path="/order-history" element={<SuspenseRoute><OrderHistory /></SuspenseRoute>} />
            <Route path="/.lovable/oauth/consent" element={<SuspenseRoute><OAuthConsent /></SuspenseRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
