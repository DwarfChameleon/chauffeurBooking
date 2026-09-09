export type SettingsRole = "employer" | "driver" | "admin";

export type SettingPreferenceKey = "pushAlerts" | "emailUpdates";

export type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
