import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { EmployerNavComponent } from './employer-nav.component';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../core/nigeria-phone';
import { ThemeService } from '../core/theme.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';

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
  template: `
<div class="employer-page">
  <app-workspace-header role="employer" title="Profile" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="page-shell">
      <div class="topbar profile-action-row">
        <div><p class="eyebrow">Employer profile</p><h1>{{ profileGreeting }}</h1></div>
        <div class="topbar-actions"><span *ngIf="saving" class="circular-progress" [style.--progress.%]="saveProgress"><span>{{ saveProgress }}%</span></span><ion-button *ngIf="editing" class="save-button top-save" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors">{{ saving ? 'Saving...' : 'Save' }}</ion-button></div>
      </div>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state success" *ngIf="success">{{ success }}</p>
      <p class="state" *ngIf="loading">Loading employer profile...</p>

      <section class="profile-layout" *ngIf="!loading">
        <aside class="profile-summary">
          <div *ngIf="!editing" class="edit-control summary-edit-control"><ion-button class="edit-action" (click)="editProfile()" aria-label="Edit profile" title="Edit profile"><ion-icon name="create-outline" slot="icon-only"></ion-icon></ion-button><small>Edit Profile</small></div>
          <div class="photo-wrap">
            <img *ngIf="profile.employerProfile.profilePicture; else fallback" [src]="profile.employerProfile.profilePicture" alt="">
            <ng-template #fallback><div class="photo-fallback"><ion-icon name="business-outline"></ion-icon></div></ng-template>
            <button *ngIf="editing" class="photo-edit" type="button" (click)="openPhotoModal()" aria-label="Change employer profile picture" title="Change profile picture"><ion-icon name="create-outline"></ion-icon></button>
          </div>
          <h2>{{ profile.name || 'Employer' }}</h2>
          <p>{{ profile.email || profile.phone || 'Contact pending' }}</p>
          <span class="verify-pill" [class.verified]="completeness.verified"><ion-icon [name]="completeness.verified ? 'checkmark-circle' : 'shield-checkmark-outline'"></ion-icon>{{ completeness.verified ? 'Verified employer' : 'Verification pending' }}</span>
          <div class="progress-track"><span [style.width.%]="completeness.score"></span></div>
          <small>{{ completeness.score }}% complete</small>
        </aside>

        <section class="form-stack">
          <article class="panel" id="personal">
            <div class="panel-head"><div><p class="eyebrow">Personal information</p><h2>{{ profileDataTitle }}</h2></div><button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('personal')" aria-label="Edit personal information"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><ion-icon *ngIf="editing" name="person-circle-outline"></ion-icon></div>
            <div class="form-grid">
              <label>Full name<input [(ngModel)]="profile.name" [readonly]="!editing" type="text"></label>
              <label>Email<input [(ngModel)]="profile.email" [readonly]="!editing" type="email"></label>
              <label [class.invalid]="editing && !isNigeriaPhone(profile.phone)">Phone<input [(ngModel)]="profile.phone" [readonly]="!editing" type="tel"><span class="field-error" *ngIf="editing && !isNigeriaPhone(profile.phone)">{{ phoneError }}</span></label>
              <label>Emergency Contact<input [(ngModel)]="profile.employerProfile.emergencyContactName" [readonly]="!editing" type="text" placeholder="Contact name"></label>
              <label [class.invalid]="editing && !isNigeriaPhone(profile.employerProfile.emergencyContactPhone)">Contact phone<input [(ngModel)]="profile.employerProfile.emergencyContactPhone" [readonly]="!editing" type="tel"><span class="field-error" *ngIf="editing && !isNigeriaPhone(profile.employerProfile.emergencyContactPhone)">{{ phoneError }}</span></label>
            </div>
          </article>

          <article class="panel" id="organisation">
            <div class="panel-head"><div><p class="eyebrow">Organisation</p><h2>Company and service needs</h2></div><button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('organisation')" aria-label="Edit organisation"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><ion-icon *ngIf="editing" name="business-outline"></ion-icon></div>
            <div class="form-grid">
              <label>Company / organisation<input [(ngModel)]="profile.employerProfile.companyName" [readonly]="!editing" type="text"></label>
              <label>Industry<input [(ngModel)]="profile.employerProfile.industry" [readonly]="!editing" type="text"></label>
              <label>Preferred service<select [(ngModel)]="profile.employerProfile.preferredService" [disabled]="!editing"><option value="">Not Set</option><option value="emergency_dispatch">Emergency dispatch</option><option value="ride_hailing">Ride-hailing</option><option value="logistics">Logistics</option><option value="chauffeur">Chauffeur booking</option><option value="field_verification">Field verification</option></select></label>
              <label>Preferred car type<select [(ngModel)]="profile.employerProfile.vehicleType" [disabled]="!editing"><option value="">Not Set</option><option value="small_car">Small car</option><option value="suv">SUV</option><option value="truck">Truck</option><option value="motorcycle">Motorcycle</option><option value="van">Van</option><option value="bus">Bus</option></select></label>
              <label>Transmission<select [(ngModel)]="profile.employerProfile.transmission" [disabled]="!editing"><option value="">Not Set</option><option value="automatic">Automatic</option><option value="manual">Manual</option><option value="both">Either</option></select></label>
            </div>
          </article>

          <article class="panel" id="location">
            <div class="panel-head"><div><p class="eyebrow">Location</p><h2>Address and dispatch area</h2></div><button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('location')" aria-label="Edit location"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><ion-icon *ngIf="editing" name="location-outline"></ion-icon></div>
            <div class="form-grid">
              <label>State<select [(ngModel)]="profile.employerProfile.state" [disabled]="!editing"><option value="">Not Set</option><option *ngFor="let state of stateOptions" [value]="state">{{ state }}</option></select></label>
              <label>City<input [(ngModel)]="profile.employerProfile.city" [readonly]="!editing" type="text"></label>
              <label>Town<input [(ngModel)]="profile.employerProfile.town" [readonly]="!editing" type="text"></label>
              <label class="wide">Address<textarea [(ngModel)]="profile.employerProfile.address" [readonly]="!editing" rows="3"></textarea></label>
            </div>
            <div class="location-callout"><span><ion-icon name="navigate-outline"></ion-icon>{{ hasLocation ? 'Location captured for distance matching' : 'No distance location captured' }}</span><button *ngIf="editing" type="button" (click)="useCurrentLocation()"><ion-icon name="locate-outline"></ion-icon> Use current location</button></div>
          </article>

          <article class="panel" id="documents">
            <div class="panel-head"><div><p class="eyebrow">Documents</p><h2>Verification uploads</h2></div><button *ngIf="!editing" class="card-edit" type="button" (click)="editProfile('documents')" aria-label="Edit documents"><ion-icon name="create-outline"></ion-icon><span>Edit</span></button><ion-icon *ngIf="editing" name="document-attach-outline"></ion-icon></div>
            <div class="document-grid">
              <div class="doc-card" *ngFor="let doc of documentItems">
                <div><strong>{{ doc.label }}</strong><span [class.verified]="doc.record.status === 'verified'"><ion-icon [name]="doc.record.status === 'verified' ? 'checkmark-circle' : 'cloud-upload-outline'"></ion-icon>{{ doc.record.status }}</span></div>
                <a *ngIf="doc.record.reference" [href]="doc.record.reference" target="_blank">Preview uploaded file</a>
                <label *ngIf="editing" class="doc-upload"><ion-icon name="cloud-upload-outline"></ion-icon> Upload<input type="file" accept="image/*,application/pdf" (change)="uploadDocument(doc.key, $event)"></label>
              </div>
            </div>
          </article>
        </section>
        <div class="bottom-save" *ngIf="editing"><span *ngIf="saving" class="circular-progress" [style.--progress.%]="saveProgress"><span>{{ saveProgress }}%</span></span><ion-button class="save-button" (click)="save()" [disabled]="saving || loading || !hasUnsavedChanges() || hasPhoneErrors">{{ saving ? 'Saving...' : 'Save' }}</ion-button></div>
      </section>
    </main>
  </ion-content>
  <app-employer-nav active="profile" (navigationAttempt)="attemptExit($event)"></app-employer-nav>
</div>
<div class="exit-overlay" *ngIf="exitPromptOpen" role="dialog" aria-modal="true" aria-labelledby="exit-title">
  <div class="exit-dialog"><ion-icon name="alert-circle-outline"></ion-icon><h2 id="exit-title">Unsaved changes</h2><p>You have changes that have not been saved. What would you like to do?</p><div><button type="button" (click)="exitPromptOpen=false">Cancel</button><button type="button" class="discard" (click)="discardAndExit()">Exit without saving</button><button type="button" class="save-exit" (click)="saveAndExit()">Save</button></div></div>
</div>
<ion-modal [isOpen]="photoModalOpen" [initialBreakpoint]="0.9" [breakpoints]="[0, 0.5, 0.9]" handle="true" handleBehavior="drag" (didDismiss)="closePhotoModal()">
  <ng-template><div class="photo-modal"><div class="modal-drag-grip" aria-hidden="true"><span></span><span></span><span></span></div><div class="photo-modal-head"><div><p class="eyebrow">Profile picture</p><h2>Upload a profile picture</h2><p>Choose a clear profile picture. Facial verification is temporarily disabled.</p></div><button type="button" class="modal-close" (click)="closePhotoModal()" aria-label="Close upload modal" title="Close"><ion-icon name="close-outline"></ion-icon></button></div><div class="photo-source-grid"><button type="button" (click)="choosePhoto('camera')"><ion-icon name="camera-outline"></ion-icon><strong>Camera</strong><small>Take a new photo</small></button><button type="button" (click)="choosePhoto('gallery')"><ion-icon name="images-outline"></ion-icon><strong>Gallery</strong><small>Choose a photo</small></button></div><input id="employer-camera-input" hidden type="file" accept="image/*" capture="environment" (change)="onPhotoSelected($event)"><input id="employer-gallery-input" hidden type="file" accept="image/*" (change)="onPhotoSelected($event)"><div class="photo-preview" *ngIf="photoPreviewUrl"><img [src]="photoPreviewUrl" alt="Selected profile preview"><span>{{ selectedPhoto?.name }}</span></div><div *ngIf="photoChecking || photoUploading || photoProgress > 0" class="upload-progress"><span class="circular-progress" [style.--progress.%]="photoProgress"><span>{{ photoProgress }}%</span></span><strong>{{ photoChecking ? 'Validating face...' : photoUploading ? 'Uploading photo...' : photoValidationError ? 'Validation failed' : 'Validation complete' }}</strong></div><p class="photo-error" *ngIf="photoValidationError">{{ photoValidationError }}</p><div class="photo-modal-actions"><button *ngIf="photoPreviewUrl" type="button" class="photo-upload" style="width:40%;min-height:44px;background:#12805c;color:#fff;border:0;border-radius:8px;font-weight:900;" [disabled]="!selectedPhoto || photoChecking || photoUploading || !photoValidated" (click)="uploadSelectedPhoto()">{{ photoChecking ? 'Validating face...' : photoUploading ? 'Uploading photo...' : 'Upload photo' }}</button><button type="button" style="width:40%;min-height:44px;background:#eef2f7;color:#475569;border:0;border-radius:8px;font-weight:900;" (click)="closePhotoModal()">Cancel</button></div></div></ng-template>
</ion-modal>
  `,
  styles: [`
:host { display:block; --ink:#172033; --muted:#667085; --line:#e6ebf2; --blue:#1954d1; --green:#12805c; }
.employer-page { min-height:100%; background:#f7f9fc; color:var(--ink); }
.page-shell { max-width:1120px; margin:0 auto; padding:22px 18px 92px; }
.topbar,.panel-head,.location-callout,.verify-pill { display:flex; align-items:center; }
.topbar { justify-content:space-between; gap:14px; margin-bottom:16px; }
.topbar-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-left:auto; flex:0 0 auto; }
.theme-toggle { --color:#1954d1; margin:0; min-width:42px; min-height:42px; }
.topbar h1 { margin:0 0 4px; font-size:22px; font-weight:900; line-height:1.12; }
.topbar span,.profile-summary p,.location-callout,.doc-card a { color:var(--muted); }
.eyebrow { margin:0 0 5px; color:#5571a7; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
.icon-button { display:grid; place-items:center; width:38px; height:38px; flex:0 0 auto; border:0; border-radius:8px; color:var(--blue); background:#eaf1ff; cursor:pointer; }
.profile-layout { display:grid; grid-template-columns:270px 1fr; gap:14px; }
.profile-summary,.panel { border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 8px 22px rgba(20,32,61,.04); }
.profile-summary { position:relative; }
.form-stack .panel:nth-child(1) { border-top:4px solid #1954d1; }
.form-stack .panel:nth-child(2) { border-top:4px solid #7c3aed; }
.form-stack .panel:nth-child(3) { border-top:4px solid #12805c; }
.form-stack .panel:nth-child(4) { border-top:4px solid #f59e0b; }
.profile-summary { align-self:start; padding:18px; text-align:center; }
.photo-wrap { position:relative; width:126px; height:126px; margin:0 auto 14px; }
.photo-wrap img,.photo-fallback { width:126px; height:126px; border-radius:8px; object-fit:cover; background:#edf3ff; }
.photo-edit { position:absolute; right:-8px; bottom:-8px; z-index:2; display:grid; place-items:center; width:38px; height:38px; border:3px solid #fff; border-radius:50%; background:var(--blue); color:#fff; box-shadow:0 5px 14px rgba(25,84,209,.28); cursor:pointer; }.photo-edit ion-icon { font-size:18px; }
.photo-fallback { display:grid; place-items:center; color:var(--blue); }
.photo-fallback ion-icon { padding:18px; border-radius:22px; color:#1954d1; background:linear-gradient(135deg,#dbe8ff,#f0f5ff); font-size:54px; }
.upload-chip,.doc-upload { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:8px; color:#fff; background:var(--blue); font-size:11px; font-weight:900; cursor:pointer; }
.upload-chip { position:absolute; right:7px; bottom:7px; min-height:30px; padding:0 10px; }
input[type=file] { display:none; }
.profile-summary h2 { margin:0 0 5px; font-size:19px; }
.verify-pill { justify-content:center; gap:5px; margin:14px auto; padding:7px 9px; width:max-content; max-width:100%; border-radius:8px; color:#805600; background:#fff4db; font-size:11px; font-weight:900; }
.verify-pill.verified { color:var(--green); background:#e9f8f2; }
.progress-track { height:9px; overflow:hidden; border-radius:999px; background:#e9eef8; }
.progress-track span { display:block; height:100%; border-radius:999px; background:var(--green); }
.form-stack { display:grid; gap:14px; }
.panel { padding:18px; }
.panel-head { justify-content:space-between; gap:12px; margin-bottom:14px; }
.panel-head h2 { margin:0; font-size:18px; }
.card-edit { display:inline-flex; align-items:center; gap:4px; border:0; background:#edf3ff; color:var(--blue); border-radius:7px; padding:6px 8px; font:inherit; font-size:11px; font-weight:900; cursor:pointer; }
.card-edit ion-icon,.edit-action ion-icon { display:block; color:#1954d1 !important; font-size:18px; opacity:1; }
.panel-head > ion-icon { display:grid; place-items:center; width:42px; height:42px; box-sizing:border-box; padding:9px; border-radius:12px; color:#1954d1; background:linear-gradient(135deg,#e4edff,#f4f7ff); font-size:24px; }
.form-stack .panel:nth-child(2) .panel-head > ion-icon { color:#7c3aed; background:linear-gradient(135deg,#f0e9ff,#faf7ff); }
.form-stack .panel:nth-child(3) .panel-head > ion-icon { color:#12805c; background:linear-gradient(135deg,#e4f8ef,#f5fffa); }
.form-stack .panel:nth-child(4) .panel-head > ion-icon { color:#d97706; background:linear-gradient(135deg,#fff1cf,#fffaf0); }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
label { display:grid; gap:6px; color:#53617a; font-size:12px; font-weight:850; }
label.invalid { color:#b42318; }
.field-error { color:#b42318; font-size:11px; font-weight:800; line-height:1.35; }
.wide { grid-column:1 / -1; }
input,select,textarea { width:100%; box-sizing:border-box; padding:11px; border:1px solid #d9e1ed; border-radius:8px; color:var(--ink); background:#fbfcfe; font:inherit; font-size:13px; }
label.invalid input { border-color:#f04438; background:#fff7f6; }
input[readonly],textarea[readonly],select:disabled { border-color:transparent; background:transparent; box-shadow:none; cursor:default; }
input[readonly]:hover,input[readonly]:focus,textarea[readonly]:hover,textarea[readonly]:focus,select:disabled:hover,select:disabled:focus { border-color:transparent; outline:0; box-shadow:none; }
select:disabled { appearance:none; -webkit-appearance:none; background-image:none; pointer-events:none; }
.edit-control { display:grid; justify-items:center; gap:2px; flex:0 0 auto; }
.summary-edit-control { position:absolute; top:12px; right:12px; }
.edit-control small { color:var(--blue); font-size:10px; font-weight:900; }
.edit-action { width:40px; height:40px; margin:0; --padding-start:0; --padding-end:0; --border-radius:50%; --background:#eaf1ff; --color:#1954d1; position:relative; overflow:visible; }
.edit-action::after { content:''; position:absolute; inset:-4px; z-index:-1; border-radius:50%; background:rgba(25,84,209,.2); animation:edit-pulse 2.2s ease-out infinite; }
@keyframes edit-pulse { 0%,100% { transform:scale(.9); opacity:.2; } 50% { transform:scale(1.16); opacity:.55; } }
.save-button { text-transform:none; }.save-button::part(native) { text-transform:none; }
.top-save { margin-left:auto; min-width:145px; min-height:44px; font-size:13px; font-weight:900; }
.bottom-save { display:flex; justify-content:center; margin-top:16px; grid-column:1 / -1; }
.circular-progress { --progress:0; display:inline-grid; place-items:center; width:38px; height:38px; border-radius:50%; background:conic-gradient(var(--blue) calc(var(--progress) * 1%),#dce6f5 0); }.circular-progress > span { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; background:#fff; color:var(--blue); font-size:9px; font-weight:900; }.upload-progress { display:flex; align-items:center; gap:10px; margin-top:16px; color:var(--ink); font-size:12px; }
.card-edit span,.edit-action span { display:none; }
textarea { resize:vertical; }
.location-callout { justify-content:space-between; gap:10px; margin-top:13px; padding:12px; border-radius:8px; background:#f3f6fc; font-size:12px; font-weight:800; }
.location-callout span,.location-callout button { display:inline-flex; align-items:center; gap:6px; }
.location-callout button { border:0; color:var(--blue); background:transparent; font:inherit; font-size:12px; font-weight:900; cursor:pointer; }
.document-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.doc-card { display:grid; gap:11px; padding:14px; border:1px solid #edf1f6; border-radius:8px; background:#fbfcfe; }
.doc-card div { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.doc-card strong { font-size:13px; }
.doc-card span { display:inline-flex; align-items:center; gap:4px; color:#805600; font-size:10px; font-weight:900; text-transform:capitalize; }
.doc-card span.verified { color:var(--green); }
.doc-upload { min-height:36px; }
.state { padding:8px; text-align:center; color:var(--muted); }
.error { color:#b91c1c; }
.success { color:#15803d; }
.exit-overlay { position:fixed; inset:0; z-index:20; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.38); }
.exit-dialog { max-width:360px; padding:22px; border-radius:14px; background:#fff; color:var(--ink); box-shadow:0 20px 60px rgba(15,23,42,.24); text-align:center; }
.exit-dialog > ion-icon { color:#d97706; font-size:34px; }
.exit-dialog h2 { margin:8px 0 6px; font-size:19px; }.exit-dialog p { color:var(--muted); font-size:13px; line-height:1.45; }.exit-dialog > div { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin-top:17px; }.exit-dialog button { border:0; border-radius:8px; padding:9px 11px; color:#475569; background:#eef2f7; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }.exit-dialog .discard { color:#b42318; background:#fff0ee; }.exit-dialog .save-exit { color:#fff; background:var(--blue); }
.photo-modal { min-height:100%; box-sizing:border-box; padding:22px; background:#fff; color:var(--ink); }.photo-modal-head { position:relative; display:flex; justify-content:space-between; gap:14px; padding:4px 52px 16px 0; border-bottom:1px solid #e8edf5; }.modal-close { position:absolute; top:0; right:0; display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:50%; background:#f1f5f9; color:#172033; cursor:pointer; }.modal-close ion-icon { display:block; font-size:22px; color:#172033; }.photo-modal h2 { margin:0; font-size:20px; }.photo-modal-head p:last-child { color:var(--muted); font-size:12px; line-height:1.4; }.photo-source-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:22px 0 14px; }.photo-source-grid button { display:grid; justify-items:start; gap:5px; padding:15px; border:1px solid #dce5f2; border-radius:12px; background:#f8faff; color:var(--ink); text-align:left; cursor:pointer; }.photo-source-grid ion-icon { padding:8px; border-radius:10px; color:#1954d1; background:#e5eeff; font-size:26px; }.photo-source-grid button:nth-child(2) ion-icon { color:#7c3aed; background:#f0e8ff; }.photo-source-grid small { color:var(--muted); font-size:11px; }.photo-preview { display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #dce5f2; border-radius:12px; font-size:12px; font-weight:800; }.photo-preview img { width:58px; height:58px; object-fit:cover; border-radius:9px; }.photo-error { color:#b42318; font-size:12px; }.photo-modal-actions { display:flex; justify-content:flex-start; gap:10px; margin-top:18px; }.photo-modal-actions button { width:40%; min-height:44px; border:0; border-radius:8px; padding:11px 13px; background:#eef2f7 !important; color:#475569 !important; font:inherit; font-size:12px; font-weight:900; cursor:pointer; }.photo-modal-actions .photo-upload { color:#fff !important; background:#12805c !important; background-color:#12805c !important; }.photo-upload:disabled { opacity:.5; cursor:not-allowed; }
.photo-modal { display:flex; flex-direction:column; height:100%; overflow:auto; }.modal-drag-grip { display:flex; justify-content:center; gap:4px; flex:0 0 auto; margin:-10px auto 14px; }.modal-drag-grip span { width:22px; height:4px; border-radius:99px; background:#cbd5e1; }.photo-modal-actions { position:sticky; bottom:-22px; z-index:2; display:flex; align-items:center; justify-content:flex-start; gap:10px; margin:18px -22px -22px; padding:16px 22px 24px; border-top:1px solid #e8edf5; background:linear-gradient(#fff8,#fff 28%); }.photo-modal-actions .photo-upload { min-width:0; box-shadow:0 10px 20px rgba(18,128,92,.22); }
ion-modal { --height:90vh; --max-height:90vh; --border-radius:22px 22px 0 0; align-items:end; }
@media (max-width:850px) { .profile-layout { grid-template-columns:1fr; } }
@media (max-width:620px) { .page-shell { padding:17px 13px 92px; } .topbar { align-items:flex-start; flex-direction:column; } .form-grid,.document-grid { grid-template-columns:1fr; } .wide { grid-column:auto; } .location-callout { align-items:flex-start; flex-direction:column; } }
  `],
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
