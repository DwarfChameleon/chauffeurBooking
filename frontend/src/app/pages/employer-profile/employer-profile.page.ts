import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EmployerNavComponent } from '../employer-nav.component';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../../core/nigeria-phone';
import { ThemeService } from '../../core/theme.service';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

type DocumentRecord = { status: 'missing' | 'pending' | 'verified' | 'rejected'; reference: string };
type EmployerProfile = {
  name: string; email: string; phone: string;
  employerProfile: {
    profilePicture: string; accountType: 'personal' | 'organization' | ''; companyName: string; industry: string; contactPerson?: string; emergencyContactName: string; emergencyContactPhone: string; state: string; town: string; city: string; address: string;
    latitude: number | null; longitude: number | null; preferredService: string; vehicleType: string; transmission: string;
    documents: { id: DocumentRecord; proofOfAddress: DocumentRecord };
  };
};
type Completeness = { score: number; completed: number; total: number; verified: boolean; checks: { key: string; label: string; complete: boolean }[] };
type ProfileResponse = { profile: EmployerProfile; completeness: Completeness; stateOptions: string[] };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent],
  templateUrl: './employer-profile.page.html',
  styleUrl: './employer-profile.page.scss'
})
export class EmployerProfilePage implements OnInit {
  readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  profile: EmployerProfile = this.defaultProfile();
  completeness: Completeness = { score: 0, completed: 0, total: 8, verified: false, checks: [] };
  stateOptions = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];
  loading = true;
  saving = false;
  error = '';
  success = '';
  editing = false;
  exitPromptOpen = false;
  pendingExitPath = '';
  private savedSnapshot = '';
  photoModalOpen = false;
  selectedPhoto: File | null = null;
  photoPreviewUrl = '';
  photoValidationError = '';
  photoChecking = false;
  photoProgress = 0;
  photoValidated = false;
  photoUploading = false;
  private validationTimer: ReturnType<typeof setInterval> | null = null;
  saveProgress = 0;
  readonly phoneError = NIGERIA_PHONE_ERROR;

  get hasLocation() {
    return this.profile.employerProfile.latitude !== null && this.profile.employerProfile.longitude !== null;
  }

  get profileDataTitle() {
    const name = (this.profile.name || 'Employer').trim();
    return `${name}${/s$/i.test(name) ? "'" : "'s"} Data`;
  }

  get profileGreeting() {
    const firstName = (this.profile.name || 'Employer').trim().split(/\s+/)[0] || 'Employer';
    return `Hello, ${firstName}`;
  }

  get hasPhoneErrors() {
    return !this.isNigeriaPhone(this.profile.phone) || !this.isNigeriaPhone(this.profile.employerProfile.emergencyContactPhone);
  }

  isNigeriaPhone(value: string) {
    return isValidNigeriaPhone(value);
  }

  get documentItems() {
    return [
      { key: 'id', label: 'Government ID', record: this.profile.employerProfile.documents.id },
      { key: 'proofOfAddress', label: 'Proof of address', record: this.profile.employerProfile.documents.proofOfAddress },
    ];
  }

  async ngOnInit() { this.editing = this.router.url.includes('/profile/edit'); await this.load(); this.focusRequestedCard(); }
  toggleTheme() { this.theme.toggle(); }

  editProfile(section = '') { void this.router.navigateByUrl(`/employer/profile/edit${section ? `#${section}` : ''}`); }

  openPhotoModal() { this.photoModalOpen = true; this.photoValidationError = ''; }
  closePhotoModal() { this.stopValidationProgress(); this.photoModalOpen = false; this.selectedPhoto = null; this.photoValidated = false; this.photoProgress = 0; if (this.photoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(this.photoPreviewUrl); this.photoPreviewUrl = ''; }
  choosePhoto(source: 'camera' | 'gallery') { document.querySelector<HTMLInputElement>(source === 'camera' ? '#employer-camera-input' : '#employer-gallery-input')?.click(); }
  onPhotoSelected(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { this.photoValidationError = 'Please choose an image file.'; return; } if (file.size > 5 * 1024 * 1024) { this.photoValidationError = 'Profile pictures must be 5 MB or smaller.'; return; } this.stopValidationProgress(); this.photoChecking = false; this.selectedPhoto = file; this.photoValidated = true; this.photoProgress = 0; this.photoValidationError = ''; this.photoPreviewUrl = URL.createObjectURL(file); }
  async validateSelectedPhoto() { if (!this.selectedPhoto) return; this.photoChecking = true; this.photoProgress = 10; this.photoValidationError = ''; this.startValidationProgress(); try { this.photoValidated = await this.detectFace(this.selectedPhoto); if (!this.photoValidated) this.photoValidationError = 'Upload rejected: the image must clearly show the Employer’s face.'; else this.photoProgress = 100; } catch (error) { this.photoValidationError = error instanceof Error ? error.message : 'Could not validate this image.'; } finally { this.stopValidationProgress(); this.photoChecking = false; } }
  async uploadSelectedPhoto() { if (!this.selectedPhoto || !this.photoValidated) return; this.photoUploading = true; this.photoProgress = 20; this.photoValidationError = ''; try { const token = this.auth.session()?.token; if (!token) return; const data = await this.api.uploadWithProgress<ProfileResponse>('/employers/me/profile-picture', this.selectedPhoto, token, (percent) => this.photoProgress = Math.max(20, percent)); this.applyProfile(data); this.success = 'Profile picture updated.'; this.closePhotoModal(); } catch (error) { this.photoValidationError = error instanceof Error ? error.message : 'Could not upload this image.'; } finally { this.photoUploading = false; } }
  private startValidationProgress() { this.stopValidationProgress(); this.validationTimer = setInterval(() => { if (this.photoProgress < 88) this.photoProgress += 4; }, 180); }
  private stopValidationProgress() { if (this.validationTimer) { clearInterval(this.validationTimer); this.validationTimer = null; } }
  private async detectFace(file: File) { const FaceDetectorCtor = (globalThis as unknown as { FaceDetector?: new (options?: { maxDetectedFaces?: number }) => { detect(source: ImageBitmap): Promise<unknown[]> } }).FaceDetector; if (!FaceDetectorCtor) throw new Error('Face verification is not supported in this browser. Use the latest Chrome or a mobile device.'); const image = await createImageBitmap(file); try { const faces = await new FaceDetectorCtor({ maxDetectedFaces: 2 }).detect(image); return faces.length === 1; } finally { image.close(); } }

  private focusRequestedCard() { const section = this.router.url.split('#')[1]; if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }

  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    try {
      const data = await this.api.get<ProfileResponse>('/employers/me/profile', token);
      this.applyProfile(data);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load employer profile';
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
    this.saveProgress = 15;
    this.error = '';
    this.success = '';
    try {
      const data = await this.api.patch<ProfileResponse>('/employers/me/profile', this.profilePayload(), token);
      this.applyProfile(data);
      this.saveProgress = 100;
      this.success = 'Employer profile saved.';
      this.editing = false;
      void this.router.navigateByUrl('/employer/profile');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save employer profile';
    } finally {
      this.saving = false;
      setTimeout(() => this.saveProgress = 0, 350);
    }
  }

  async uploadProfilePicture(event: Event) {
    await this.uploadFile(event, '/employers/me/profile-picture');
  }

  async uploadDocument(key: string, event: Event) {
    await this.uploadFile(event, `/employers/me/documents/${key}`);
  }

  useCurrentLocation() {
    if (!navigator.geolocation) { this.error = 'Location is not available in this browser.'; return; }
    navigator.geolocation.getCurrentPosition((position) => {
      this.profile.employerProfile.latitude = position.coords.latitude;
      this.profile.employerProfile.longitude = position.coords.longitude;
      this.success = 'Current location captured. Press Save to keep it.';
    }, () => { this.error = 'Location permission was not granted.'; }, { enableHighAccuracy: true, timeout: 8000 });
  }

  private async uploadFile(event: Event, path: string) {
    const token = this.auth.session()?.token;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!token || !file) return;
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      const data = await this.api.upload<ProfileResponse>(path, file, token);
      this.applyProfile(data);
      this.success = 'Upload received. Admin verification can now review it.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Upload failed';
    } finally {
      this.saving = false;
      input.value = '';
    }
  }

  private applyProfile(data: ProfileResponse) {
    const fallback = this.defaultProfile();
    const incomingProfile = data.profile.employerProfile || fallback.employerProfile;
    this.profile = { ...fallback, ...data.profile, employerProfile: { ...fallback.employerProfile, ...incomingProfile, emergencyContactName: incomingProfile.emergencyContactName || incomingProfile.contactPerson || '', documents: { ...fallback.employerProfile.documents, ...incomingProfile.documents } } };
    this.completeness = data.completeness || this.completeness;
    this.stateOptions = data.stateOptions || this.stateOptions;
    this.savedSnapshot = JSON.stringify(this.profile);
  }

  back() { this.attemptExit(this.editing ? '/employer/profile' : '/employer/dashboard'); }

  attemptExit(path: string) {
    if (this.editing && this.hasUnsavedChanges()) { this.pendingExitPath = path; this.exitPromptOpen = true; return; }
    void this.router.navigateByUrl(path);
  }

  discardAndExit() { this.exitPromptOpen = false; void this.router.navigateByUrl(this.pendingExitPath || '/employer/profile'); }

  async saveAndExit() { await this.save(); if (!this.error) this.exitPromptOpen = false; }

  hasUnsavedChanges() { return !!this.savedSnapshot && this.savedSnapshot !== JSON.stringify(this.profile); }

  private profilePayload() {
    return {
      name: this.profile.name,
      email: this.profile.email,
      phone: this.profile.phone,
      employerProfile: {
        profilePicture: this.profile.employerProfile.profilePicture,
        accountType: this.profile.employerProfile.accountType,
        companyName: this.profile.employerProfile.companyName,
        industry: this.profile.employerProfile.industry,
        emergencyContactName: this.profile.employerProfile.emergencyContactName,
        emergencyContactPhone: this.profile.employerProfile.emergencyContactPhone,
        state: this.profile.employerProfile.state,
        town: this.profile.employerProfile.town,
        city: this.profile.employerProfile.city,
        address: this.profile.employerProfile.address,
        latitude: this.profile.employerProfile.latitude,
        longitude: this.profile.employerProfile.longitude,
        preferredService: this.profile.employerProfile.preferredService,
        vehicleType: this.profile.employerProfile.vehicleType,
        transmission: this.profile.employerProfile.transmission,
      },
    };
  }

  private defaultProfile(): EmployerProfile {
    return {
      name: '',
      email: '',
      phone: '',
      employerProfile: {
        profilePicture: '',
        accountType: '',
        companyName: '',
        industry: '',
        contactPerson: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        state: '',
        town: '',
        city: '',
        address: '',
        latitude: null,
        longitude: null,
        preferredService: '',
        vehicleType: '',
        transmission: '',
        documents: {
          id: { status: 'missing', reference: '' },
          proofOfAddress: { status: 'missing', reference: '' },
        },
      },
    };
  }
}
