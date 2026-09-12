import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminSupportTicket } from '../admin-types';
import { AdminNavComponent } from '../admin-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { ADMIN_SUPPORT_ACTIONS, AdminSupportTicketsResponse, SUPPORT_CATEGORY_LABELS } from './admin-support.props';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-support.page.html',
  styleUrl: './admin-support.page.scss',
})
export class AdminSupportPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly actions = ADMIN_SUPPORT_ACTIONS;
  readonly categoryLabels = SUPPORT_CATEGORY_LABELS;
  tickets: AdminSupportTicket[] = [];
  loading = false;
  error = '';

  get openTickets() {
    return this.tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_review').length;
  }

  get urgentTickets() {
    return this.tickets.filter((ticket) => ticket.priority === 'urgent').length;
  }

  get safetyReports() {
    return this.tickets.filter((ticket) => ticket.category === 'safety_concern').length;
  }

  get todayTickets() {
    const today = new Date().toDateString();
    return this.tickets.filter((ticket) => new Date(ticket.createdAt || '').toDateString() === today).length;
  }

  async ngOnInit() {
    await this.load();
  }

  async refresh(event: CustomEvent) {
    try {
      await this.load(false);
    } finally {
      await (event.target as any)?.complete?.();
    }
  }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const response = await this.api.get<AdminSupportTicketsResponse>('/support/admin/tickets', token);
      this.tickets = response.tickets || [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load support tickets';
    } finally {
      this.loading = false;
    }
  }

  go(route: string) {
    void this.router.navigateByUrl(route);
  }

  displayDate(value?: string) {
    return value ? new Date(value).toLocaleString() : 'Not recorded';
  }

  contact(ticket: AdminSupportTicket) {
    const contact = ticket.contactSnapshot || {};
    return contact.name || contact.email || contact.phone || ticket.role;
  }
}
