export type AdminCallTarget = "driver" | "employer" | "conference";

export interface AdminCallOption {
  target: AdminCallTarget;
  label: string;
  note: string;
  icon: string;
}

export const ADMIN_CALL_OPTIONS: AdminCallOption[] = [
  { target: "driver", label: "Call driver", note: "Ring the chauffeur assigned to this live trip.", icon: "car-sport-outline" },
  { target: "employer", label: "Call employer", note: "Ring the employer who created this booking.", icon: "business-outline" },
  { target: "conference", label: "Conference", note: "Ring both driver and employer for one shared call.", icon: "people-outline" },
];
