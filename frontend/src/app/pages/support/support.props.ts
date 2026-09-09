export type SupportRole = "admin" | "driver" | "employer";

export type SupportCategoryKey =
  | "booking_issue"
  | "payment_issue"
  | "account_login"
  | "driver_verification"
  | "safety_concern"
  | "app_bug"
  | "other";

export type SupportActionKey = "call" | "whatsapp" | "email" | "report";

export interface SupportCategory {
  value: SupportCategoryKey;
  label: string;
}

export interface SupportTicketForm {
  category: SupportCategoryKey | "";
  subject: string;
  message: string;
  bookingReference: string;
}

export interface SupportAction {
  key: SupportActionKey;
  label: string;
  note: string;
  icon: string;
  tone: "blue" | "green" | "amber" | "red";
}

export interface SupportShortcut {
  label: string;
  note: string;
  icon: string;
  route: string;
  roles: SupportRole[];
}

export interface SupportFaq {
  question: string;
  answer: string;
}

export interface SupportTicketResponse {
  message: string;
  ticket: {
    id: string;
    ticketNumber: string;
    category: SupportCategoryKey;
    subject: string;
    priority: "normal" | "high" | "urgent";
    status: "open" | "in_review" | "resolved" | "closed";
    createdAt: string;
  };
}

export const SUPPORT_PHONE = "+2348000000000";
export const SUPPORT_EMAIL = "support@bjedchauffeur.com";
export const SUPPORT_WHATSAPP = "2348000000000";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { value: "booking_issue", label: "Booking issue" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "account_login", label: "Account or login issue" },
  { value: "driver_verification", label: "Driver verification" },
  { value: "safety_concern", label: "Emergency or safety concern" },
  { value: "app_bug", label: "App bug" },
  { value: "other", label: "Other" },
];

export const SUPPORT_ACTIONS: SupportAction[] = [
  { key: "call", label: "Call", note: "Ring Watchtower", icon: "call-outline", tone: "blue" },
  { key: "whatsapp", label: "WhatsApp", note: "Message support", icon: "logo-whatsapp", tone: "green" },
  { key: "email", label: "Email", note: "Send details", icon: "mail-outline", tone: "amber" },
  { key: "report", label: "Report", note: "Create a ticket", icon: "bug-outline", tone: "red" },
];

export const SUPPORT_SHORTCUTS: SupportShortcut[] = [
  { label: "Complete profile", note: "Update documents and emergency contact.", icon: "person-circle-outline", route: "/driver/profile", roles: ["driver"] },
  { label: "My bookings", note: "Review assigned and completed trips.", icon: "calendar-outline", route: "/driver/bookings", roles: ["driver"] },
  { label: "Earnings help", note: "Check payout and trip earnings.", icon: "wallet-outline", route: "/driver/earnings", roles: ["driver"] },
  { label: "Book chauffeur", note: "Start a new chauffeur request.", icon: "car-sport-outline", route: "/book-driver", roles: ["employer"] },
  { label: "Chauffeurs", note: "Browse available drivers.", icon: "people-outline", route: "/employer/chauffeurs", roles: ["employer"] },
  { label: "Employer profile", note: "Update company and contact details.", icon: "business-outline", route: "/employer/profile", roles: ["employer"] },
  { label: "Bookings", note: "Review all platform bookings.", icon: "receipt-outline", route: "/admin/bookings", roles: ["admin"] },
  { label: "Verification", note: "Review document verification queues.", icon: "shield-checkmark-outline", route: "/admin/verification", roles: ["admin"] },
  { label: "Users", note: "Find account details quickly.", icon: "people-outline", route: "/admin/users", roles: ["admin"] },
];

export const SUPPORT_FAQS: SupportFaq[] = [
  { question: "How do I reset my password?", answer: "Use Forgot password on the login screen and confirm your email, phone, and emergency contact." },
  { question: "How do I update my profile?", answer: "Open Settings, choose Edit profile, then update your contact, emergency contact, location, and documents." },
  { question: "How do I cancel or report a booking?", answer: "Open the booking details and contact support with the booking reference so the team can trace it quickly." },
  { question: "How long does verification take?", answer: "Verification depends on document clarity and availability. Submit a support ticket if a document has been pending for too long." },
];
