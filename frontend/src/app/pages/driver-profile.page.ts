import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../core/nigeria-phone';
import { ThemeService } from '../core/theme.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';

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
  template: `
<div class="ion-page driver-page">
  <app-workspace-header role="driver" title="Profile" (refreshRequested)="load()"></app-workspace-header>
  <ion-content class="driver-workspace">
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="workspace-shell">
      <div class="workspace-header profile-action-row">
        <div>
          <p class="eyebrow">Driver Workspace</p>
          <h1>{{ profileGreeting }}</h1>
        </div>
        <div class="header-actions">
          <ion-button *ngIf="editing" class="save-button top-save" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors">
            {{ saving ? 'Saving...' : 'Save' }}
          </ion-button>
          <div *ngIf="!editing" class="edit-control"><ion-button class="edit-action" (click)="editProfile()" aria-label="Edit profile" title="Edit profile"><ion-icon name="create-outline" slot="icon-only"></ion-icon></ion-button><small>Edit</small></div>
        </div>
      </div>

      <section class="profile-top">
        <article class="profile-card">
          <div class="avatar-preview">
            <img *ngIf="profile.profilePicture; else avatarFallback" [src]="profile.profilePicture" alt="Driver profile picture">
            <ng-template #avatarFallback><ion-icon name="person-circle-outline"></ion-icon></ng-template>
          </div>
          <div class="profile-card-copy">
            <span>Profile Completeness</span>
            <strong>{{ completeness.score }}%</strong>
            <p>{{ completeness.completed }} of {{ completeness.total }} checks complete</p>
            <button *ngIf="editing" class="mini-upload-button" type="button" (click)="openUploadModal('profile')">
              <ion-icon name="camera-outline"></ion-icon> Change picture
            </button>
          </div>
          <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('personal')"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button>
        </article>

        <article class="profile-card">
          <div class="score-ring">{{ performance.score }}</div>
          <div>
            <span>Skill Performance</span>
            <strong>{{ performance.label }}</strong>
            <p>{{ performance.completedTrips }} completed trips. {{ routeCoverageLabel }}</p>
          </div>
          <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('routes')"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button>
        </article>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state success" *ngIf="success">{{ success }}</p>
      <p class="state" *ngIf="loading">Loading profile...</p>

      <section class="profile-grid" *ngIf="!loading">
        <article class="panel identity-panel" id="personal">
          <div class="panel-header">
            <div><p class="panel-kicker">IDENTITY</p><h2>Personal Information</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('personal')" aria-label="Edit personal information"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="person-circle-outline"></ion-icon></div>
          </div>
          <div class="form-grid">
            <label>Full name<input [(ngModel)]="profile.name" [readonly]="!editing" type="text"></label>
            <label>Email<input [(ngModel)]="profile.email" [readonly]="!editing" type="email"></label>
            <label [class.invalid]="editing && !isNigeriaPhone(profile.phone)">Phone<input [(ngModel)]="profile.phone" [readonly]="!editing" type="tel"><span class="field-error" *ngIf="editing && !isNigeriaPhone(profile.phone)">{{ phoneError }}</span></label>
            <label>Date of birth<input [(ngModel)]="profile.personalInformation.dateOfBirth" [readonly]="!editing" type="date"></label>
            <label class="wide">Address<textarea [(ngModel)]="profile.personalInformation.address" [readonly]="!editing" rows="3"></textarea></label>
            <label>Emergency contact<input [(ngModel)]="profile.personalInformation.emergencyContactName" [readonly]="!editing" type="text"></label>
            <label [class.invalid]="editing && !isNigeriaPhone(profile.personalInformation.emergencyContactPhone)">Emergency phone<input [(ngModel)]="profile.personalInformation.emergencyContactPhone" [readonly]="!editing" type="tel"><span class="field-error" *ngIf="editing && !isNigeriaPhone(profile.personalInformation.emergencyContactPhone)">{{ phoneError }}</span></label>
          </div>
        </article>

        <article class="panel" id="license">
          <div class="panel-header">
            <div><p class="panel-kicker">LICENSE</p><h2>Driving Details</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('license')" aria-label="Edit driving details"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="id-card-outline"></ion-icon></div>
          </div>
          <div class="form-grid">
            <label>Years of driving<input [(ngModel)]="profile.yearsOfDriving" [readonly]="!editing" min="0" type="number"></label>
            <label>Current operating state<select [(ngModel)]="profile.currentState" [disabled]="!editing"><option value="">Not Set</option><option *ngFor="let state of routeStates" [value]="state">{{ state }}</option></select></label>
            <label>License number<input [(ngModel)]="profile.licenseNumber" [readonly]="!editing" type="text"></label>
            <label>License issue year<input [(ngModel)]="profile.licenseYear" [readonly]="!editing" min="1970" type="number"></label>
          </div>
        </article>

        <article class="panel" id="vehicle">
          <div class="panel-header">
            <div><p class="panel-kicker">VEHICLE</p><h2>Capability</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('vehicle')" aria-label="Edit vehicle capability"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="car-sport-outline"></ion-icon></div>
          </div>
          <div class="form-grid">
            <label>Transmission<select [(ngModel)]="profile.vehicle.transmission" [disabled]="!editing"><option value="">Select</option><option value="automatic">Automatic</option><option value="manual">Manual</option><option value="both">Both</option></select></label>
            <label>Vehicle type<select [(ngModel)]="profile.vehicle.type" [disabled]="!editing"><option value="">Select</option><option value="all">All</option><option value="suv_small_cars">SUV & Small cars</option><option value="suv">SUV</option><option value="truck">Truck</option><option value="small_car">Small car</option><option value="motorcycle">Motorcycle</option><option value="van">Van</option><option value="bus">Bus</option></select></label>
            <label>Vehicle model<input [(ngModel)]="profile.vehicle.model" [readonly]="!editing" type="text"></label>
            <label>Plate number<input [(ngModel)]="profile.vehicle.plateNumber" [readonly]="!editing" type="text"></label>
          </div>
        </article>

        <article class="panel route-panel" id="routes">
          <div class="panel-header">
            <div><p class="panel-kicker">ROUTES</p><h2>South-South Route Experience</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('routes')" aria-label="Edit route experience"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="map-outline"></ion-icon></div>
          </div>
          <div class="route-row" *ngFor="let route of profile.routeExperience">
            <strong>{{ route.state }}</strong>
            <input [(ngModel)]="route.years" [readonly]="!editing" min="0" type="number" aria-label="Years of route experience">
            <div class="route-editor">
              <label>Suggested routes
                <select multiple [ngModel]="selectedRoutes[route.state]" [disabled]="!editing" (ngModelChange)="setRouteSelection(route.state, $event)">
                  <option *ngFor="let option of routeOptions[route.state]" [value]="option">{{ option }}</option>
                </select>
              </label>
              <input [(ngModel)]="route.routes" [readonly]="!editing" type="text" placeholder="Add another route or route note">
            </div>
          </div>
        </article>

        <article class="panel documents-panel" id="documents">
          <div class="panel-header">
            <div><p class="panel-kicker">VERIFICATION</p><h2>Document Cards</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('documents')" aria-label="Edit documents"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="shield-checkmark-outline"></ion-icon></div>
          </div>
          <div class="document-card" *ngFor="let doc of documentCards">
            <div class="document-heading">
              <ion-icon [name]="doc.icon"></ion-icon>
              <div><strong>{{ doc.label }}</strong><small>{{ documentStatusLabel(profile.documents[doc.key].status) }}</small></div>
            </div>
            <div class="document-status" [class.verified]="profile.documents[doc.key].status === 'verified'" [class.pending]="profile.documents[doc.key].status === 'pending'" [class.rejected]="profile.documents[doc.key].status === 'rejected'">
              <ion-icon [name]="documentStatusIcon(profile.documents[doc.key].status)"></ion-icon>
              {{ documentStatusLabel(profile.documents[doc.key].status) }}
            </div>
            <div class="document-actions">
              <div class="document-preview" *ngIf="profile.documents[doc.key].reference">
                <img *ngIf="isImageReference(profile.documents[doc.key].reference)" [src]="profile.documents[doc.key].reference" [alt]="doc.label">
                <a [href]="profile.documents[doc.key].reference" target="_blank" rel="noreferrer"><ion-icon name="eye-outline"></ion-icon> View file</a>
              </div>
              <button *ngIf="editing" class="upload-button" type="button" (click)="openUploadModal(doc.key)">
                <ion-icon name="cloud-upload-outline"></ion-icon>
                {{ profile.documents[doc.key].reference ? 'Replace file' : 'Upload file' }}
              </button>
            </div>
          </div>
        </article>

        <article class="panel checks-panel" id="readiness">
          <div class="panel-header">
            <div><p class="panel-kicker">READINESS</p><h2>Completeness Checks</h2></div>
            <button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('documents')"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><div *ngIf="editing" class="panel-actions"><button class="mini-save" type="button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors"><ion-icon name="save-outline"></ion-icon>Save</button><ion-icon name="speedometer-outline"></ion-icon></div>
          </div>
          <div class="check-row" *ngFor="let check of completeness.checks">
            <span [class.done]="check.complete"><ion-icon [name]="check.complete ? 'checkmark-circle-outline' : 'document-text-outline'"></ion-icon></span>
            <p>{{ check.label }}</p>
          </div>
          <div class="strengths" *ngIf="performance.strengths.length > 0">
            <span *ngFor="let strength of performance.strengths">{{ strength }}</span>
          </div>
        </article>
        <div class="bottom-save" *ngIf="editing"><ion-button class="save-button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors">{{ saving ? 'Saving...' : 'Save' }}</ion-button></div>
      </section>
    </main>
  </ion-content>

  <ion-footer class="driver-bottom-nav">
    <div class="bottom-nav">
      <button class="nav-item" (click)="navigate('/driver/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
      <button class="nav-item" (click)="navigate('/driver/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
      <button class="nav-item availability-nav" (click)="navigate('/driver/dashboard')"><div><ion-icon name="power-outline"></ion-icon></div><span>Status</span></button>
      <button class="nav-item" (click)="navigate('/driver/earnings')"><ion-icon name="bar-chart-outline"></ion-icon><span>Earnings</span></button>
      <button class="nav-item active" (click)="navigate('/driver/profile')"><ion-icon name="person-circle-outline"></ion-icon><span>Profile</span></button>
    </div>
  </ion-footer>
  <div class="exit-overlay" *ngIf="exitPromptOpen" role="dialog" aria-modal="true" aria-labelledby="exit-title">
    <div class="exit-dialog"><ion-icon name="alert-circle-outline"></ion-icon><h2 id="exit-title">Unsaved changes</h2><p>You have changes that have not been saved. What would you like to do?</p><div><button type="button" (click)="exitPromptOpen=false">Cancel</button><button type="button" class="discard" (click)="discardAndExit()">Exit without saving</button><button type="button" class="save-exit" (click)="saveAndExit()">Save</button></div></div>
  </div>

  <ion-modal [isOpen]="uploadModalOpen" (didDismiss)="closeUploadModal()">
    <ng-template>
      <div class="upload-modal-shell">
        <div class="upload-modal-header">
          <div><p class="panel-kicker">SECURE UPLOAD</p><h2>{{ uploadTitle }}</h2><p>Choose a source, preview the file, then send it for admin verification.</p></div>
          <button class="modal-close" type="button" (click)="closeUploadModal()"><ion-icon name="close-outline"></ion-icon></button>
        </div>

        <input #uploadInput hidden type="file" [accept]="uploadTarget === 'profile' ? 'image/*' : 'image/*,application/pdf'" [attr.capture]="uploadSource === 'camera' ? 'environment' : null" (change)="onFileSelected($event)">
        <div class="upload-source-grid">
          <button type="button" (click)="chooseUploadSource('camera', uploadInput)"><ion-icon name="camera-outline"></ion-icon><span>Camera</span><small>Take a new photo</small></button>
          <button type="button" (click)="chooseUploadSource('gallery', uploadInput)"><ion-icon name="images-outline"></ion-icon><span>Gallery / Files</span><small>Choose from device</small></button>
        </div>

        <div class="upload-dropzone" (click)="chooseUploadSource('gallery', uploadInput)" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)">
          <ion-icon name="document-attach-outline"></ion-icon>
          <strong>Drop a file here or browse</strong>
          <span>Images and PDF files up to 5 MB</span>
        </div>

        <div class="upload-preview" *ngIf="selectedFile">
          <img *ngIf="uploadPreviewUrl; else filePreviewIcon" [src]="uploadPreviewUrl" alt="Selected upload preview">
          <ng-template #filePreviewIcon><ion-icon name="document-text-outline"></ion-icon></ng-template>
          <div><strong>{{ selectedFile.name }}</strong><span>{{ formatFileSize(selectedFile.size) }}</span></div>
          <button type="button" (click)="clearSelectedFile()"><ion-icon name="close-outline"></ion-icon></button>
        </div>

        <div class="upload-modal-footer">
          <span class="upload-note" *ngIf="uploadTarget !== 'profile'"><ion-icon name="information-circle-outline"></ion-icon> A new upload becomes Pending until an admin verifies it.</span>
          <button class="primary-upload" type="button" (click)="uploadSelected()" [disabled]="!selectedFile || uploading"><ion-icon name="cloud-upload-outline"></ion-icon>{{ uploading ? 'Uploading...' : 'Upload securely' }}</button>
        </div>
      </div>
    </ng-template>
  </ion-modal>
</div>
  `,
  styles: [`
:host { --workspace-bg:#070b13; --panel-bg:#0d1420; --border-color:rgba(255,255,255,.1); display:block; }
.driver-workspace { --background:var(--workspace-bg); --color:#f8fafc; }
.workspace-shell { box-sizing:border-box; max-width:1180px; margin:auto; padding:calc(env(safe-area-inset-top) + 20px) 18px 20px; }
.workspace-header,.header-actions,.profile-card,.panel-header,.document-card > div,.check-row { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.workspace-header { margin-bottom:18px; }
.back-button { display:grid; place-items:center; width:38px; height:38px; border:0; border-radius:10px; background:rgba(124,58,237,.16); color:#d8b4fe; cursor:pointer; }
.header-actions { justify-content:flex-end; flex-wrap:wrap; }
.signout-action { width:42px; height:42px; min-width:42px; margin:0; flex:0 0 42px; --padding-start:0; --padding-end:0; --border-radius:50%; --background:rgba(124,58,237,.18); --color:#d8b4fe; position:relative; overflow:visible; }
.signout-action::part(native) { border-radius:50%; border:1px solid rgba(216,180,254,.28); box-shadow:0 10px 24px rgba(124,58,237,.18); }
.signout-action::after { content:''; position:absolute; inset:-5px; z-index:-1; border-radius:50%; background:rgba(124,58,237,.18); animation:edit-pulse 2.25s ease-out infinite; }
.signout-action ion-icon { color:#d8b4fe !important; font-size:20px; }
.theme-toggle { --color:#fbbf24; margin-left:auto; min-width:42px; min-height:42px; }
.workspace-header h1 { color:#f8fafc; margin:0 0 6px; font-size:22px; }
.workspace-header p { color:#cbd5e1; margin:0; }
.eyebrow,.panel-kicker { color:#d8b4fe; font-size:11px; font-weight:800; letter-spacing:1.3px; margin:0 0 6px; }
.profile-top { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }
.profile-card,.panel { background:linear-gradient(150deg,#111a29,#0b111b); border:1px solid var(--border-color); border-radius:18px; padding:18px; }
.profile-grid > .panel:nth-child(1) { border-top:3px solid #3b82f6; }
.profile-grid > .panel:nth-child(2) { border-top:3px solid #a855f7; }
.profile-grid > .panel:nth-child(3) { border-top:3px solid #22c55e; }
.profile-grid > .panel:nth-child(4) { border-top:3px solid #f59e0b; }
.profile-card { justify-content:flex-start; }
.profile-card span { color:#cbd5e1; display:block; font-size:12px; margin-bottom:6px; }
.profile-card strong { color:#f8fafc; display:block; font-size:24px; }
.profile-card p { color:#cbd5e1; margin:5px 0 0; font-size:12px; }
.profile-card-copy { min-width:0; }
.mini-upload-button,.upload-button,.primary-upload { display:inline-flex; align-items:center; justify-content:center; gap:7px; border:1px solid rgba(167,139,250,.34); border-radius:10px; background:rgba(124,58,237,.16); color:#ede9fe; padding:9px 11px; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }
.mini-upload-button { margin-top:11px; }
.mini-upload-button ion-icon,.upload-button ion-icon { font-size:16px; }
.avatar-preview,.score-ring { width:76px; height:76px; display:grid; place-items:center; border-radius:18px; flex:0 0 auto; background:rgba(124,58,237,.18); color:#d8b4fe; overflow:hidden; }
.avatar-preview img { width:100%; height:100%; object-fit:cover; }
.avatar-preview ion-icon { font-size:54px; }
.score-ring { border:1px solid rgba(216,180,254,.42); font-size:27px; font-weight:900; }
.profile-grid { display:grid; grid-template-columns:1.15fr .85fr; gap:16px; align-items:start; }
.identity-panel,.route-panel,.documents-panel,.checks-panel { grid-column:span 1; }
.panel-header { margin-bottom:16px; }
.panel-header h2 { color:#f8fafc; margin:0; font-size:18px; }
.card-edit { display:inline-flex; align-items:center; gap:4px; border:0; border-radius:8px; padding:7px 9px; background:rgba(124,58,237,.18); color:#ddd6fe; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }
.card-edit ion-icon,.edit-action ion-icon { display:block; color:#ddd6fe !important; font-size:18px; opacity:1; }
.panel-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.panel-header ion-icon { display:grid; place-items:center; width:42px; height:42px; box-sizing:border-box; padding:9px; border-radius:12px; color:#d8b4fe; background:linear-gradient(135deg,rgba(124,58,237,.25),rgba(59,130,246,.16)); font-size:24px; }
.mini-save { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; border:0; border-radius:10px; padding:8px 11px; background:linear-gradient(135deg,#7c3aed,#2563eb); color:#fff; font:inherit; font-size:12px; font-weight:900; cursor:pointer; box-shadow:0 10px 24px rgba(37,99,235,.22); }
.mini-save ion-icon { width:auto; height:auto; padding:0; border-radius:0; color:#fff; background:transparent; font-size:15px; }
.mini-save:disabled { cursor:not-allowed; opacity:.55; filter:saturate(.7); }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
label { color:#cbd5e1; display:grid; gap:7px; font-size:12px; font-weight:700; }
label.invalid { color:#fca5a5; }
.field-error { color:#fca5a5; font-size:11px; font-weight:800; line-height:1.35; }
.wide { grid-column:1 / -1; }
input,select,textarea { width:100%; box-sizing:border-box; border:1px solid rgba(255,255,255,.12); border-radius:12px; outline:0; background:#0a1018; color:#f8fafc; padding:12px; font:inherit; font-weight:600; }
label.invalid input { border-color:#f04438; background:#211116; }
input[readonly],textarea[readonly],select:disabled { border-color:transparent; background:transparent; box-shadow:none; cursor:default; }
input[readonly]:hover,input[readonly]:focus,textarea[readonly]:hover,textarea[readonly]:focus,select:disabled:hover,select:disabled:focus { border-color:transparent; outline:0; box-shadow:none; }
select:disabled { appearance:none; -webkit-appearance:none; background-image:none; pointer-events:none; }
.edit-control { display:grid; justify-items:center; gap:2px; flex:0 0 auto; }
.edit-control small { color:#d8b4fe; font-size:10px; font-weight:900; }
.edit-action { width:40px; height:40px; margin:0; --padding-start:0; --padding-end:0; --border-radius:50%; --background:rgba(124,58,237,.22); --color:#d8b4fe; position:relative; overflow:visible; }
.edit-action::after { content:''; position:absolute; inset:-4px; z-index:-1; border-radius:50%; background:rgba(124,58,237,.2); animation:edit-pulse 2.2s ease-out infinite; }
@keyframes edit-pulse { 0%,100% { transform:scale(.9); opacity:.2; } 50% { transform:scale(1.16); opacity:.55; } }
.save-button { text-transform:none; }.save-button::part(native) { text-transform:none; }
.bottom-save { display:flex; justify-content:flex-end; margin-top:16px; grid-column:1 / -1; }
.card-edit span,.edit-action span { display:none; }
textarea { resize:vertical; min-height:74px; }
input:focus,select:focus,textarea:focus { border-color:#a78bfa; box-shadow:0 0 0 3px rgba(167,139,250,.12); }
.route-row { display:grid; grid-template-columns:90px 84px 1fr; gap:10px; align-items:start; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.07); }
.route-row:last-child { border-bottom:0; }
.route-row strong { color:#f8fafc; padding-top:12px; }
.route-editor { display:grid; gap:8px; }
.route-editor label { font-size:11px; }
.route-editor select { min-height:80px; }
.document-card { display:grid; grid-template-columns:180px 150px 1fr; gap:10px; align-items:center; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.07); }
.document-card:last-child { border-bottom:0; }
.document-heading { justify-content:flex-start !important; }
.document-heading > div { display:grid; gap:4px; }
.document-card strong { color:#f8fafc; }
.document-heading small { color:#94a3b8; font-size:11px; }
.document-card ion-icon { color:#93c5fd; font-size:22px; }
.document-status { display:inline-flex; align-items:center; justify-content:center; gap:5px; border-radius:20px; padding:8px 10px; background:rgba(148,163,184,.13); color:#cbd5e1; font-size:11px; font-weight:800; white-space:nowrap; }
.document-status ion-icon { color:currentColor; font-size:16px; }
.document-status.verified { color:#bbf7d0; background:rgba(34,197,94,.16); }
.document-status.pending { color:#fde68a; background:rgba(234,179,8,.14); }
.document-status.rejected { color:#fecaca; background:rgba(239,68,68,.14); }
.document-actions { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; }
.document-preview { display:flex; align-items:center; gap:8px; min-width:0; }
.document-preview img { width:42px; height:42px; object-fit:cover; border-radius:8px; border:1px solid rgba(255,255,255,.12); }
.document-preview a { color:#bfdbfe; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:800; text-decoration:none; white-space:nowrap; }
.document-preview a ion-icon { color:currentColor; font-size:15px; }
.upload-modal-shell { min-height:100%; box-sizing:border-box; padding:22px; background:#0d1420; color:#f8fafc; }
.upload-modal-header { display:flex; justify-content:space-between; gap:14px; }
.upload-modal-header h2 { margin:0; font-size:20px; }
.upload-modal-header p:last-child { color:#94a3b8; font-size:12px; margin:7px 0 0; }
.modal-close { width:36px; height:36px; border:1px solid rgba(255,255,255,.1); border-radius:10px; background:rgba(255,255,255,.05); color:#cbd5e1; cursor:pointer; }
.modal-close ion-icon { font-size:20px; }
.upload-source-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:22px 0 12px; }
.upload-source-grid button { display:grid; justify-items:start; gap:5px; padding:15px; border:1px solid rgba(167,139,250,.25); border-radius:14px; background:#111a29; color:#f8fafc; text-align:left; cursor:pointer; }
.upload-source-grid button:hover,.upload-dropzone:hover { border-color:#a78bfa; }
.upload-source-grid ion-icon { color:#c4b5fd; font-size:25px; }
.upload-source-grid span { font-weight:800; }
.upload-source-grid small,.upload-dropzone span { color:#94a3b8; font-size:11px; }
.upload-dropzone { display:grid; justify-items:center; gap:8px; border:1px dashed rgba(167,139,250,.5); border-radius:14px; padding:26px 16px; background:rgba(124,58,237,.08); cursor:pointer; text-align:center; }
.upload-dropzone ion-icon { color:#c4b5fd; font-size:30px; }
.upload-preview { display:flex; align-items:center; gap:12px; margin-top:16px; padding:10px; border:1px solid rgba(255,255,255,.1); border-radius:12px; background:#111a29; }
.upload-preview img { width:58px; height:58px; object-fit:cover; border-radius:9px; }
.upload-preview > ion-icon { width:58px; font-size:38px; color:#93c5fd; text-align:center; }
.upload-preview div { display:grid; gap:4px; min-width:0; flex:1; }
.upload-preview strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.upload-preview span { color:#94a3b8; font-size:11px; }
.upload-preview button { border:0; background:transparent; color:#cbd5e1; cursor:pointer; }
.upload-modal-footer { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:20px; }
.upload-note { display:flex; align-items:flex-start; gap:6px; color:#cbd5e1; font-size:11px; line-height:1.4; }
.upload-note ion-icon { color:#93c5fd; font-size:16px; flex:0 0 auto; }
.primary-upload { background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; border-color:transparent; padding:12px 15px; white-space:nowrap; }
.primary-upload:disabled { opacity:.5; cursor:not-allowed; }
.check-row { justify-content:flex-start; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.06); }
.check-row:last-of-type { border-bottom:0; }
.check-row span { width:32px; height:32px; display:grid; place-items:center; border-radius:10px; color:#cbd5e1; background:rgba(148,163,184,.15); }
.check-row span.done { color:#bbf7d0; background:rgba(34,197,94,.18); }
.check-row p { color:#f8fafc; margin:0; font-size:13px; }
.strengths { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
.strengths span { color:#dbeafe; background:rgba(59,130,246,.2); border-radius:20px; padding:7px 10px; font-size:11px; font-weight:800; }
.state { color:#cbd5e1; text-align:center; padding:12px; }
.exit-overlay { position:fixed; inset:0; z-index:20; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.55); }
.exit-dialog { max-width:360px; padding:22px; border:1px solid rgba(167,139,250,.3); border-radius:16px; background:#111a29; color:#f8fafc; box-shadow:0 20px 60px rgba(0,0,0,.35); text-align:center; }.exit-dialog > ion-icon { color:#fbbf24; font-size:34px; }.exit-dialog h2 { margin:8px 0 6px; font-size:19px; }.exit-dialog p { color:#cbd5e1; font-size:13px; line-height:1.45; }.exit-dialog > div { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin-top:17px; }.exit-dialog button { border:0; border-radius:8px; padding:9px 11px; color:#334155; background:#e2e8f0; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }.exit-dialog .discard { color:#fecaca; background:rgba(239,68,68,.18); }.exit-dialog .save-exit { color:#fff; background:#7c3aed; }
.error { color:#fecaca; }
.success { color:#bbf7d0; }
.driver-bottom-nav { background:rgba(8,13,21,.96); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,.08); padding-bottom:env(safe-area-inset-bottom); }
.bottom-nav { max-width:700px; margin:auto; display:grid; grid-template-columns:repeat(5,1fr); align-items:center; min-height:70px; }
.nav-item { border:0; background:transparent; color:#cbd5e1; display:flex; flex-direction:column; align-items:center; gap:5px; font-size:10px; }
.nav-item ion-icon { color:currentColor; font-size:22px; }
.nav-item.active { color:#d8b4fe; }
.availability-nav div { width:50px; height:50px; margin-top:-30px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; box-shadow:0 10px 30px rgba(124,58,237,.4); }
@media (max-width:900px) { .profile-top,.profile-grid { grid-template-columns:1fr; } }
@media (max-width:650px) { .workspace-header { align-items:flex-start; flex-direction:column; } .header-actions { width:100%; } .header-actions ion-button { flex:1; } .header-actions .signout-action,.header-actions .theme-toggle { flex:0 0 42px; } .form-grid,.route-row,.document-card { grid-template-columns:1fr; } .wide { grid-column:auto; } .route-row strong { padding-top:0; } .document-actions,.upload-modal-footer { align-items:stretch; flex-direction:column; } .upload-source-grid { grid-template-columns:1fr; } }
  `],
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
