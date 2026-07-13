export interface TimelineEntry {
  id: string;
  date: string;              // ISO 8601, may be date-only
  label: string;
  source: string;
  entityId: string;
}