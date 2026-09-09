import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonButton, IonContent, IonIcon, IonNote, IonSpinner, IonToggle } from "@ionic/angular/standalone";
import { AuthService } from "../../core/auth.service";
import { ThemeService } from "../../core/theme.service";
import { WorkspaceHeaderComponent } from "../workspace-header.component";
import type { ChangePasswordForm, SettingPreferenceKey, SettingsRole } from "./settings.props";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonNote, IonSpinner, IonToggle, WorkspaceHeaderComponent],
  templateUrl: "./settings.page.html",
  styleUrl: "./settings.page.scss",
})
export class SettingsPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  pushAlerts = true;
  emailUpdates = true;
  passwordForm: ChangePasswordForm = this.emptyPasswordForm();
  busy = false;
  error = "";
  success = "";

  ngOnInit() {
    this.pushAlerts = this.readPreference("pushAlerts", true);
    this.emailUpdates = this.readPreference("emailUpdates", true);
  }

  get user() {
    return this.auth.session()?.user;
  }

  get role(): SettingsRole {
    const role = this.user?.role;
    return role === "admin" ? "admin" : role === "driver" ? "driver" : "employer";
  }

  get roleLabel() {
    return this.role === "admin" ? "Admin" : this.role === "driver" ? "Driver" : "Employer";
  }

  get displayName() {
    return this.user?.name || this.roleLabel;
  }

  get contactLabel() {
    return this.user?.email || this.user?.phone || "Contact pending";
  }

  get initials() {
    const source = this.displayName || this.contactLabel;
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "BJ";
  }

  get isDark() {
    return this.role === "driver" ? this.theme.driverIsDark : this.theme.isDark;
  }

  get profilePath() {
    return this.role === "admin" ? "/admin/profile" : this.role === "driver" ? "/driver/profile" : "/employer/profile";
  }

  get notificationPath() {
    return this.role === "admin" ? "/admin/notifications" : this.role === "driver" ? "/driver/notifications" : "/employer/notifications";
  }

  toggleTheme() {
    if (this.role === "driver") this.theme.toggleDriver();
    else this.theme.toggle();
  }

  savePreferences() {
    this.writePreference("pushAlerts", this.pushAlerts);
    this.writePreference("emailUpdates", this.emailUpdates);
  }

  go(path: string) {
    void this.router.navigateByUrl(path);
  }

  markComingSoon(label: string) {
    this.error = "";
    this.success = `${label} will be added soon.`;
  }

  async changePassword() {
    if (this.busy) return;
    this.error = "";
    this.success = "";

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      this.error = "Fill in all password fields.";
      return;
    }
    if (newPassword.length < 6) {
      this.error = "New password must be at least 6 characters.";
      return;
    }
    if (newPassword !== confirmPassword) {
      this.error = "New passwords do not match.";
      return;
    }

    this.busy = true;
    try {
      const result = await this.auth.changePassword({ currentPassword, newPassword });
      this.success = result.message;
      this.passwordForm = this.emptyPasswordForm();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not update password.";
    } finally {
      this.busy = false;
    }
  }

  private emptyPasswordForm(): ChangePasswordForm {
    return { currentPassword: "", newPassword: "", confirmPassword: "" };
  }

  private readPreference(key: SettingPreferenceKey, fallback: boolean) {
    try {
      const value = localStorage.getItem(`bjed-setting-${key}`);
      return value === null ? fallback : value === "true";
    } catch {
      return fallback;
    }
  }

  private writePreference(key: SettingPreferenceKey, value: boolean) {
    try {
      localStorage.setItem(`bjed-setting-${key}`, String(value));
    } catch {
      /* storage can be unavailable in private webviews */
    }
  }
}
