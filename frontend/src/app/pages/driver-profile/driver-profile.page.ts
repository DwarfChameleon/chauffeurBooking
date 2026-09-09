import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../../core/nigeria-phone';
import { ThemeService } from '../../core/theme.service';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

const SERVICE_STATES = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'] as const;
type RouteState = typeof SERVICE_STATES[number];
type DocumentStatus = 'missing' | 'pending' | 'verified' | 'rejected';
type DocumentKey = 'id' | 'driversLicense' | 'proofOfAddress';
type UploadTarget = 'profile' | DocumentKey;
type RouteOptions = Record<RouteState, string[]>;

type DriverProfile = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  yearsOfDriving: number;
  currentState: RouteState | '';
  licenseNumber: string;
  licenseYear: number | null;
  profilePicture: string;
  personalInformation: {
    address: string;
    dateOfBirth: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  routeExperience: { state: RouteState; routes: string; years: number }[];
  vehicle: {
    transmission: string;
    type: string;
    plateNumber: string;
    model: string;
  };
  documents: Record<DocumentKey, { status: DocumentStatus; reference: string }>;
};

type Completeness = { score: number; completed: number; total: number; checks: { key: string; label: string; complete: boolean }[] };
type Performance = { score: number; label: string; completedTrips: number; routeCoverage: string[]; strengths: string[] };
type ProfileResponse = { profile: DriverProfile; completeness: Completeness; performance: Performance; routeOptions?: RouteOptions };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent, WorkspaceHeaderComponent],
  templateUrl: './driver-profile.page.html',
  styleUrl: './driver-profile.page.scss'
})
export class DriverProfilePage implements OnInit, OnDestroy {
  readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  profile = this.defaultProfile();
  completeness: Completeness = { score: 0, completed: 0, total: 8, checks: [] };
  performance: Performance = { score: 0, label: 'New driver profile', completedTrips: 0, routeCoverage: [], strengths: [] };
  loading = true;
  saving = false;
  editing = false;
  exitPromptOpen = false;
  pendingExitPath = '';
  private savedSnapshot = '';
  error = '';
  success = '';
  routeOptions: RouteOptions = this.defaultRouteOptions();
  readonly routeStates = SERVICE_STATES;
  selectedRoutes: Record<RouteState, string[]> = this.emptySelectedRoutes();
  uploadModalOpen = false;
  uploadTarget: UploadTarget = 'profile';
  uploadSource: 'camera' | 'gallery' = 'gallery';
  selectedFile: File | null = null;
  uploadPreviewUrl = '';
  uploading = false;
  readonly phoneError = NIGERIA_PHONE_ERROR;
  readonly documentCards: { key: DocumentKey; label: string; icon: string }[] = [
    { key: 'id', label: 'Government ID', icon: 'id-card-outline' },
    { key: 'driversLicense', label: 'Drivers License', icon: 'document-text-outline' },
    { key: 'proofOfAddress', label: 'Proof of Address', icon: 'home-outline' },
  ];

  get routeCoverageLabel() {
    return this.performance.routeCoverage.length ? `${this.performance.routeCoverage.join(', ')} route coverage.` : 'No route coverage yet.';
  }

  get profileGreeting() {
    const firstName = (this.profile.name || 'Driver').trim().split(/\s+/)[0] || 'Driver';
    return `Hello, ${firstName}`;
  }

  get hasPhoneErrors() {
    return !this.isNigeriaPhone(this.profile.phone) || !this.isNigeriaPhone(this.profile.personalInformation.emergencyContactPhone);
  }

  isNigeriaPhone(value: string) {
    return isValidNigeriaPhone(value);
  }

  get uploadTitle() {
    if (this.uploadTarget === 'profile') return 'Update profile picture';
    return `Upload ${this.documentCards.find((doc) => doc.key === this.uploadTarget)?.label ?? 'document'}`;
  }

  async ngOnInit() { this.editing = this.router.url.includes('/profile/edit'); await this.load(); this.focusRequestedCard(); }
  toggleTheme() { this.theme.toggleDriver(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  editProfile(section = '') { void this.router.navigateByUrl(`/driver/profile/edit${section ? `#${section}` : ''}`); }

  private focusRequestedCard() { const section = this.router.url.split('#')[1]; if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }

  ngOnDestroy() { this.revokePreview(); }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    this.loading = true;
    this.error = '';
    this.success = '';
    try {
      this.applyResponse(await this.api.get<ProfileResponse>('/drivers/me/profile', token));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load profile';
    } finally {
      this.loading = false;
    }
  }

  async save() {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (this.hasPhoneErrors) {
      this.error = this.phoneError;
      return;
    }
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      this.applyResponse(await this.api.patch<ProfileResponse>('/drivers/me/profile', this.profile, token));
      this.success = 'Profile saved. Readiness score updated.';
      this.editing = false;
      void this.router.navigateByUrl('/driver/profile');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save profile';
    } finally {
      this.saving = false;
    }
  }

  openUploadModal(target: UploadTarget) {
    this.uploadTarget = target;
    this.uploadSource = 'gallery';
    this.clearSelectedFile();
    this.uploadModalOpen = true;
  }

  closeUploadModal() {
    this.uploadModalOpen = false;
    this.clearSelectedFile();
  }

  chooseUploadSource(source: 'camera' | 'gallery', input: HTMLInputElement) {
    this.uploadSource = source;
    setTimeout(() => input.click());
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.acceptSelectedFile(file);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.acceptSelectedFile(file);
  }

  clearSelectedFile() {
    this.revokePreview();
    this.selectedFile = null;
    this.uploadPreviewUrl = '';
  }

  async uploadSelected() {
    const token = this.auth.session()?.token;
    if (!token || !this.selectedFile) return;
    this.uploading = true;
    this.error = '';
    this.success = '';
    const path = this.uploadTarget === 'profile' ? '/drivers/me/profile-picture' : `/drivers/me/documents/${this.uploadTarget}`;
    try {
      this.applyResponse(await this.api.upload<ProfileResponse>(path, this.selectedFile, token));
      this.success = this.uploadTarget === 'profile' ? 'Profile picture updated.' : 'Document uploaded and submitted for admin verification.';
      this.closeUploadModal();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not upload file';
    } finally {
      this.uploading = false;
    }
  }

  setRouteSelection(state: RouteState, routes: string[]) {
    this.selectedRoutes[state] = routes || [];
    const route = this.profile.routeExperience.find((item) => item.state === state);
    if (route) route.routes = this.selectedRoutes[state].join(', ');
  }

  documentStatusLabel(status: DocumentStatus) {
    return status === 'verified' ? 'Verified by admin' : status === 'pending' ? 'Pending review' : status === 'rejected' ? 'Needs replacement' : 'Not uploaded';
  }

  documentStatusIcon(status: DocumentStatus) {
    return status === 'verified' ? 'checkmark-circle' : status === 'pending' ? 'time-outline' : status === 'rejected' ? 'alert-circle-outline' : 'document-text-outline';
  }

  isImageReference(reference: string) { return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(reference); }
  formatFileSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

  navigate(route: string) { this.attemptExit(route); }
  logout() { this.auth.logout(); }

  attemptExit(path: string) {
    if (this.editing && this.hasUnsavedChanges()) { this.pendingExitPath = path; this.exitPromptOpen = true; return; }
    void this.router.navigateByUrl(path);
  }

  discardAndExit() { this.exitPromptOpen = false; void this.router.navigateByUrl(this.pendingExitPath || '/driver/profile'); }

  async saveAndExit() { await this.save(); if (!this.error) this.exitPromptOpen = false; }

  hasUnsavedChanges() { return !!this.savedSnapshot && this.savedSnapshot !== JSON.stringify(this.profile); }

  private applyResponse(response: ProfileResponse) {
    const fallback = this.defaultProfile();
    this.profile = {
      ...fallback,
      ...response.profile,
      personalInformation: { ...fallback.personalInformation, ...response.profile.personalInformation },
      vehicle: { ...fallback.vehicle, ...response.profile.vehicle },
      documents: { ...fallback.documents, ...response.profile.documents },
    };
    this.routeOptions = response.routeOptions ?? this.routeOptions;
    this.selectedRoutes = this.emptySelectedRoutes();
    this.profile.routeExperience.forEach((route) => {
      this.selectedRoutes[route.state] = route.routes.split(',').map((item) => item.trim()).filter((item) => this.routeOptions[route.state]?.includes(item));
    });
    this.completeness = response.completeness;
    this.performance = response.performance;
    this.savedSnapshot = JSON.stringify(this.profile);
  }

  private acceptSelectedFile(file: File) {
    const validImage = file.type.startsWith('image/');
    const validDocument = validImage || file.type === 'application/pdf';
    if (!validDocument || (this.uploadTarget === 'profile' && !validImage)) {
      this.error = this.uploadTarget === 'profile' ? 'Profile pictures must be an image file.' : 'Upload an image or PDF document.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'Files must be 5 MB or smaller.';
      return;
    }
    this.error = '';
    this.clearSelectedFile();
    this.selectedFile = file;
    if (validImage) this.uploadPreviewUrl = URL.createObjectURL(file);
  }

  private revokePreview() {
    if (this.uploadPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(this.uploadPreviewUrl);
  }

  private defaultRouteOptions(): RouteOptions {
    return {
      Bayelsa: ['Yenagoa - Amassoma', 'Yenagoa - Ogbia', 'Yenagoa - Sagbama', 'Yenagoa - Port Harcourt'],
      Delta: ['Warri - Asaba', 'Warri - Sapele', 'Asaba - Agbor', 'Ughelli - Warri'],
      Benin: ['Benin - Airport Road', 'Benin - Ring Road', 'Benin - Ugbowo', 'Benin - GRA'],
      Rivers: ['Port Harcourt - Aba Road', 'Port Harcourt - Onne', 'Port Harcourt - Bonny', 'Port Harcourt - Ahoada'],
      Calabar: ['Calabar - Marian Road', 'Calabar - Tinapa', 'Calabar - Akpabuyo', 'Calabar - Odukpani'],
      Abia: ['Aba - Umuahia', 'Umuahia - Ohafia', 'Aba - Ariaria', 'Umuahia - Isiala Ngwa'],
      'Akwa Ibom': ['Uyo - Eket', 'Uyo - Ikot Ekpene', 'Uyo - Oron', 'Uyo - Abak'],
      Edo: ['Benin - Auchi', 'Benin - Ekpoma', 'Benin - Ore', 'Benin - Sapele Road'],
      Abuja: ['Wuse - Maitama', 'Garki - Asokoro', 'Central Area - Gwarinpa', 'Airport Road - Lugbe'],
      Lagos: ['VI - Lekki', 'Ikeja - Yaba', 'Ikoyi - Marina', 'Surulere - Apapa'],
    };
  }

  private emptySelectedRoutes(): Record<RouteState, string[]> {
    return SERVICE_STATES.reduce((routes, state) => ({ ...routes, [state]: [] }), {} as Record<RouteState, string[]>);
  }

  private defaultProfile(): DriverProfile {
    return {
      name: '',
      email: '',
      phone: '',
      yearsOfDriving: 0,
      currentState: '',
      licenseNumber: '',
      licenseYear: null,
      profilePicture: '',
      personalInformation: { address: '', dateOfBirth: '', emergencyContactName: '', emergencyContactPhone: '' },
      routeExperience: [
        { state: 'Bayelsa', routes: '', years: 0 },
        { state: 'Delta', routes: '', years: 0 },
        { state: 'Benin', routes: '', years: 0 },
        { state: 'Rivers', routes: '', years: 0 },
        { state: 'Calabar', routes: '', years: 0 },
        { state: 'Abia', routes: '', years: 0 },
        { state: 'Akwa Ibom', routes: '', years: 0 },
        { state: 'Edo', routes: '', years: 0 },
        { state: 'Abuja', routes: '', years: 0 },
        { state: 'Lagos', routes: '', years: 0 },
      ],
      vehicle: { transmission: '', type: '', plateNumber: '', model: '' },
      documents: {
        id: { status: 'missing', reference: '' },
        driversLicense: { status: 'missing', reference: '' },
        proofOfAddress: { status: 'missing', reference: '' },
      },
    };
  }
}
