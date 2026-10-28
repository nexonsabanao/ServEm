import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './state/AppState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminShell } from './components/AdminShell';
import { MateShell } from './components/MateShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Skeleton } from './components/ui';

/**
 * The designed state gallery is a review surface, not a product screen. It is
 * loaded through a specifier Vite cannot bundle (@vite-ignore), so no chunk
 * and no copy from src/dev is emitted for production; in development the route
 * below serves it on demand.
 */
const LazyStateGallery = import.meta.env.DEV
  ? lazy(() => import(/* @vite-ignore */ './dev/StateGallery'))
  : null;

/**
 * Every page is its own chunk. A visitor opening the landing page no longer
 * downloads the admin console, the ServMate workspace or the booking wizard.
 * RouteFallback holds the frame while a chunk arrives.
 */
// auth
const LoginPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.ResetPasswordPage })));
const RoleSelectPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.RoleSelectPage })));
const SignupPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.SignupPage })));
const VerifyPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.VerifyPage })));
const WelcomePage = lazy(() => import('./pages/landing').then((m) => ({ default: m.WelcomePage })));

// legal
const PrivacyPage = lazy(() => import('./pages/legal').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/legal').then((m) => ({ default: m.TermsPage })));

// customer/discovery
const CategoriesPage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.CategoriesPage })));
const CategoryPage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.CategoryPage })));
const ExplorePage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.ExplorePage })));
const HomePage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.HomePage })));
const SavedHelpPage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.SavedHelpPage })));
const SearchResultsPage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.SearchResultsPage })));
const ServiceDetailPage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.ServiceDetailPage })));
const ServMateProfilePage = lazy(() => import('./pages/customer/discovery').then((m) => ({ default: m.ServMateProfilePage })));

// customer/account
const BookingDetailPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.BookingDetailPage })));
const BookingsPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.BookingsPage })));
const HelpPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.HelpPage })));
const MessagesPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.MessagesPage })));
const NotificationsPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.NotificationsPage })));
const PersonalInfoPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.PersonalInfoPage })));
const ProfilePage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.ProfilePage })));
const SavedPlacesPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.SavedPlacesPage })));
const SettingsPage = lazy(() => import('./pages/customer/account').then((m) => ({ default: m.SettingsPage })));

// booking/wizard
const AddressPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.AddressPage })));
const BookingSentPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.BookingSentPage })));
const CancelPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.CancelPage })));
const CompletionPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.CompletionPage })));
const ConfirmLocationPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.ConfirmLocationPage })));
const DateTimePage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.DateTimePage })));
const ReschedulePage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.ReschedulePage })));
const ReviewFormPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.ReviewFormPage })));
const ReviewPricePage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.ReviewPricePage })));
const ReviewSubmittedPage = lazy(() => import('./pages/booking/wizard').then((m) => ({ default: m.ReviewSubmittedPage })));

// booking/draft
const BookingDraftProvider = lazy(() => import('./pages/booking/draft').then((m) => ({ default: m.BookingDraftProvider })));

// servmate/onboarding
const ApplicationPage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.ApplicationPage })));
const BecomeServMatePage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.BecomeServMatePage })));
const CreateServicePage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.CreateServicePage })));
const PublicProfilePage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.PublicProfilePage })));
const ServiceAreaPage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.ServiceAreaPage })));
const ServicesListPage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.ServicesListPage })));
const VerificationPage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.VerificationPage })));
const WorkingHoursPage = lazy(() => import('./pages/servmate/onboarding').then((m) => ({ default: m.WorkingHoursPage })));

// servmate/work
const JobCancelledPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.JobCancelledPage })));
const MateAccountPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateAccountPage })));
const MateDashboardPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateDashboardPage })));
const MateJobPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateJobPage })));
const MateMessagesPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateMessagesPage })));
const MateRequestDetailPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateRequestDetailPage })));
const MateRequestsPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateRequestsPage })));
const MateUpdatesPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MateUpdatesPage })));
const MyJobsPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.MyJobsPage })));
const NewTimeRequestPage = lazy(() => import('./pages/servmate/work').then((m) => ({ default: m.NewTimeRequestPage })));

// servmate/money
const EarningsPage = lazy(() => import('./pages/servmate/money').then((m) => ({ default: m.EarningsPage })));
const MateReviewsPage = lazy(() => import('./pages/servmate/money').then((m) => ({ default: m.MateReviewsPage })));
const WithdrawPage = lazy(() => import('./pages/servmate/money').then((m) => ({ default: m.WithdrawPage })));

// admin/overview
const AdminOverviewPage = lazy(() => import('./pages/admin/overview').then((m) => ({ default: m.AdminOverviewPage })));

// admin/people
const AdminCustomerDetailPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminCustomerDetailPage })));
const AdminCustomersPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminCustomersPage })));
const AdminServMateDetailPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminServMateDetailPage })));
const AdminServMatesPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminServMatesPage })));
const AdminVerificationPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminVerificationPage })));
const AdminVerificationReviewPage = lazy(() => import('./pages/admin/people').then((m) => ({ default: m.AdminVerificationReviewPage })));

// admin/catalog
const AdminBookingOpsPage = lazy(() => import('./pages/admin/catalog').then((m) => ({ default: m.AdminBookingOpsPage })));
const AdminBookingsPage = lazy(() => import('./pages/admin/catalog').then((m) => ({ default: m.AdminBookingsPage })));
const AdminCatalogPage = lazy(() => import('./pages/admin/catalog').then((m) => ({ default: m.AdminCatalogPage })));
const AdminCategoriesPage = lazy(() => import('./pages/admin/catalog').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminListingModerationPage = lazy(() => import('./pages/admin/catalog').then((m) => ({ default: m.AdminListingModerationPage })));

// admin/finance
const AdminPaymentsPage = lazy(() => import('./pages/admin/finance').then((m) => ({ default: m.AdminPaymentsPage })));
const AdminPayoutsPage = lazy(() => import('./pages/admin/finance').then((m) => ({ default: m.AdminPayoutsPage })));
const AdminRefundReviewPage = lazy(() => import('./pages/admin/finance').then((m) => ({ default: m.AdminRefundReviewPage })));
const AdminTransactionPage = lazy(() => import('./pages/admin/finance').then((m) => ({ default: m.AdminTransactionPage })));
const AdminWithdrawalReviewPage = lazy(() => import('./pages/admin/finance').then((m) => ({ default: m.AdminWithdrawalReviewPage })));

// admin/support
const AdminDisputeResolutionPage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminDisputeResolutionPage })));
const AdminDisputesPage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminDisputesPage })));
const AdminReviewsPage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminReviewsPage })));
const AdminTicketWorkspacePage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminTicketWorkspacePage })));
const AdminTicketsPage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminTicketsPage })));

// admin/growth
const AdminAnalyticsPage = lazy(() => import('./pages/admin/growth').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminCampaignEditorPage = lazy(() => import('./pages/admin/growth').then((m) => ({ default: m.AdminCampaignEditorPage })));
const AdminCommunicationsPage = lazy(() => import('./pages/admin/growth').then((m) => ({ default: m.AdminCommunicationsPage })));

// admin/system
const AdminAuditLogPage = lazy(() => import('./pages/admin/system').then((m) => ({ default: m.AdminAuditLogPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/system').then((m) => ({ default: m.AdminSettingsPage })));
const AdminTeamPage = lazy(() => import('./pages/admin/system').then((m) => ({ default: m.AdminTeamPage })));

// states
const NotFoundPage = lazy(() => import('./pages/states').then((m) => ({ default: m.NotFoundPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function Protected({ admin = false, children }: { admin?: boolean; children: React.ReactNode }) {
  return <ProtectedRoute requireAdmin={admin}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        {/* Each route loads its own chunk; the frame below holds the layout
            steady while that chunk arrives. */}
        <Suspense fallback={<RouteFallback />}>
          <ErrorBoundary>
          <Routes>
          {/* Public marketing, auth and legal */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/role" element={<RoleSelectPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Customer web app — sign-in required */}
          <Route
            path="/app"
            element={
              <Protected>
                <Outlet />
              </Protected>
            }
          >
            <Route path="home" element={<HomePage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="categories/:c" element={<CategoryPage />} />
            <Route path="search" element={<SearchResultsPage />} />
            <Route path="services/:id" element={<ServiceDetailPage />} />
            <Route path="servmates/:id" element={<ServMateProfilePage />} />
            <Route path="saved" element={<SavedHelpPage />} />

            {/* Booking flow */}
            <Route
              path="book/:id"
              element={
                <BookingDraftProvider>
                  <DateTimePage />
                </BookingDraftProvider>
              }
            />
            <Route
              path="book/:id/date"
              element={
                <BookingDraftProvider>
                  <DateTimePage />
                </BookingDraftProvider>
              }
            />
            <Route
              path="book/:id/address"
              element={
                <BookingDraftProvider>
                  <AddressPage />
                </BookingDraftProvider>
              }
            />
            <Route
              path="book/:id/location"
              element={
                <BookingDraftProvider>
                  <ConfirmLocationPage />
                </BookingDraftProvider>
              }
            />
            <Route
              path="book/:id/review"
              element={
                <BookingDraftProvider>
                  <ReviewPricePage />
                </BookingDraftProvider>
              }
            />
            <Route path="book/sent/:id" element={<BookingSentPage />} />

            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:id" element={<BookingDetailPage />} />
            <Route path="bookings/:id/reschedule" element={<ReschedulePage />} />
            <Route path="bookings/:id/cancel" element={<CancelPage />} />
            <Route path="bookings/:id/complete" element={<CompletionPage />} />
            <Route path="bookings/:id/review" element={<ReviewFormPage />} />
            <Route path="bookings/:id/review/sent" element={<ReviewSubmittedPage />} />

            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:id" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/info" element={<PersonalInfoPage />} />
            <Route path="profile/places" element={<SavedPlacesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>

          {/* ServMate workspace — sign-in required */}
          <Route
            path="/mate"
            element={
              <Protected>
                <MateShell />
              </Protected>
            }
          >
            <Route index element={<MateDashboardPage />} />
            <Route path="apply" element={<BecomeServMatePage />} />
            <Route path="setup" element={<ApplicationPage />} />
            <Route path="verify" element={<VerificationPage />} />
            <Route path="profile" element={<PublicProfilePage />} />
            <Route path="services" element={<ServicesListPage />} />
            <Route path="services/new" element={<CreateServicePage />} />
            <Route path="services/:id/edit" element={<CreateServicePage edit />} />
            <Route path="hours" element={<WorkingHoursPage />} />
            <Route path="area" element={<ServiceAreaPage />} />
            <Route path="requests" element={<MateRequestsPage />} />
            <Route path="requests/:id" element={<MateRequestDetailPage />} />
            <Route path="jobs" element={<MyJobsPage />} />
            <Route path="jobs/:id" element={<MateJobPage />} />
            <Route path="jobs/:id/en-route" element={<MateJobPage mode="en-route" />} />
            <Route path="jobs/:id/updates" element={<MateJobPage mode="updates" />} />
            <Route path="jobs/:id/wrap-up" element={<MateJobPage mode="wrap-up" />} />
            <Route path="jobs/:id/cancelled" element={<JobCancelledPage />} />
            <Route path="jobs/:id/new-time" element={<NewTimeRequestPage />} />
            <Route path="messages" element={<MateMessagesPage />} />
            <Route path="updates" element={<MateUpdatesPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="earnings/withdraw" element={<WithdrawPage />} />
            <Route path="reviews" element={<MateReviewsPage />} />
            <Route path="account" element={<MateAccountPage />} />
          </Route>

          {/* Admin operations suite — sign-in plus admin claim */}
          <Route
            path="/admin"
            element={
              <Protected admin>
                <AdminShell />
              </Protected>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
            <Route path="servmates" element={<AdminServMatesPage />} />
            <Route path="servmates/:id" element={<AdminServMateDetailPage />} />
            <Route path="verification" element={<AdminVerificationPage />} />
            <Route path="verification/:id" element={<AdminVerificationReviewPage />} />
            <Route path="catalog" element={<AdminCatalogPage />} />
            <Route path="catalog/:id" element={<AdminListingModerationPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="bookings" element={<AdminBookingsPage />} />
            <Route path="bookings/:id" element={<AdminBookingOpsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="payments/:id" element={<AdminTransactionPage />} />
            <Route path="payments/:id/refund" element={<AdminRefundReviewPage />} />
            <Route path="payouts" element={<AdminPayoutsPage />} />
            <Route path="payouts/:id" element={<AdminWithdrawalReviewPage />} />
            <Route path="disputes" element={<AdminDisputesPage />} />
            <Route path="disputes/:id" element={<AdminDisputeResolutionPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="tickets/:id" element={<AdminTicketWorkspacePage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="communications" element={<AdminCommunicationsPage />} />
            <Route path="campaigns/new" element={<AdminCampaignEditorPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="team" element={<AdminTeamPage />} />
            <Route path="audit" element={<AdminAuditLogPage />} />
          </Route>

          {import.meta.env.DEV && LazyStateGallery ? (
            <Route
              path="/design/states"
              element={
                <Suspense fallback={null}>
                  <LazyStateGallery />
                </Suspense>
              }
            />
          ) : null}
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}

/** Holds the page frame steady while a route's chunk is fetched. */
function RouteFallback() {
  return (
    <div className="shell-width py-16" role="status" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
