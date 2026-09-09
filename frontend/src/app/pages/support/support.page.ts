import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonButton, IonContent, IonIcon, IonNote, IonSpinner } from "@ionic/angular/standalone";
import { ApiService } from "../../core/api.service";
import { AuthService } from "../../core/auth.service";
import { RealtimeService } from "../../core/realtime.service";
import { WorkspaceHeaderComponent } from "../workspace-header.component";
import {
  SUPPORT_ACTIONS,
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_FAQS,
  SUPPORT_PHONE,
  SUPPORT_SHORTCUTS,
  SUPPORT_WHATSAPP,
  SupportActionKey,
  SupportRole,
  SupportTicketForm,
  SupportTicketResponse,
} from "./support.props";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonNote, IonSpinner, WorkspaceHeaderComponent],
  templateUrl: "./support.page.html",
  styleUrl: "./support.page.scss",
})
export class SupportPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  readonly actions = SUPPORT_ACTIONS;
  readonly categories = SUPPORT_CATEGORIES;
  readonly faqs = SUPPORT_FAQS;
  readonly supportPhone = SUPPORT_PHONE;
  readonly supportEmail = SUPPORT_EMAIL;

  form: SupportTicketForm = this.emptyForm();
  busy = false;
  callingSupport = false;
  error = "";
  success = "";
  lastTicketNumber = "";

  get user() {
    return this.auth.session()?.user;
  }

  get role(): SupportRole {
    const role = this.user?.role;
    return role === "admin" ? "admin" : role === "driver" ? "driver" : "employer";
  }

  get roleLabel() {
    return this.role === "admin" ? "Admin" : this.role === "driver" ? "Driver" : "Employer";
  }

  get displayName() {
    return this.user?.name || this.roleLabel;
  }

  get introText() {
    if (this.role === "driver") return "Get help with bookings, earnings, verification, safety, and account access.";
    if (this.role === "admin") return "Track platform issues, account problems, and operational support requests.";
    return "Get help with bookings, chauffeurs, payments, safety, and account access.";
  }

  get shortcuts() {
    return SUPPORT_SHORTCUTS.filter((shortcut) => shortcut.roles.includes(this.role));
  }

  async handleAction(action: SupportActionKey) {
    if (action === "call") {
      await this.startSupportCall();
      return;
    }
    if (action === "whatsapp") {
      window.open(`https://wa.me/${SUPPORT_WHATSAPP}`, "_blank", "noopener");
      return;
    }
    if (action === "email") {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=B-JED Chauffeur support`;
      return;
    }

    this.form.category = "app_bug";
    window.setTimeout(() => document.getElementById("support-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async startSupportCall() {
    if (this.callingSupport) return;
    this.error = "";
    this.success = "";
    this.lastTicketNumber = "";
    this.callingSupport = true;
    try {
      const response = await this.realtime.initiateSupportCall();
      this.success = response.message || "Watchtower is ringing.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not start in-app support call.";
    } finally {
      this.callingSupport = false;
    }
  }

  go(route: string) {
    void this.router.navigateByUrl(route);
  }

  async submitTicket() {
    if (this.busy) return;
    this.error = "";
    this.success = "";
    this.lastTicketNumber = "";

    const subject = this.form.subject.trim();
    const message = this.form.message.trim();
    if (!this.form.category) {
      this.error = "Choose what you need help with.";
      return;
    }
    if (subject.length < 4) {
      this.error = "Add a short subject for this request.";
      return;
    }
    if (message.length < 12) {
      this.error = "Tell us a little more about the issue.";
      return;
    }

    const token = this.auth.session()?.token;
    if (!token) {
      this.error = "Please log in again to contact support.";
      return;
    }

    this.busy = true;
    try {
      const response = await this.api.post<SupportTicketResponse>("/support/tickets", {
        category: this.form.category,
        subject,
        message,
        bookingReference: this.form.bookingReference.trim(),
      }, token);
      this.success = response.message;
      this.lastTicketNumber = response.ticket.ticketNumber;
      this.form = this.emptyForm();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not submit support request.";
    } finally {
      this.busy = false;
    }
  }

  private emptyForm(): SupportTicketForm {
    return { category: "", subject: "", message: "", bookingReference: "" };
  }
}
