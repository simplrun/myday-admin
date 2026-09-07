import client from "./client";

export interface IntegrationExternalCalendar {
  id: number;
  user_uid: string;
  integration_id: number;
  external_calendar_id: string;
  provider: string;
  summary: string;
  description: string | null;
  color: string | null;
  is_primary: boolean;
  access_role: string | null;
  status: string;
  is_subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: number;
  provider: string;
  connection_type: string;
  status: string;
  connected_at: string;
  last_calendar_synced_at: string | null;
  last_events_synced_at: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserCalendars(uid: string, params?: { provider?: string }) {
  const { data } = await client.get<IntegrationExternalCalendar[]>(
    `/users/${uid}/calendars`,
    { params },
  );
  return data;
}

export async function getUserIntegrations(uid: string) {
  const { data } = await client.get<Integration[]>(`/users/${uid}/integrations`);
  return data;
}

// ---- Google Calendar 일정 가져오기 진단 (Users > Integrations) ----

export interface GoogleCalendarFetchTestRequest {
  date?: string; // YYYY-MM-DD, 없으면 유저 타임존 기준 오늘
  days_before?: number;
  days_after?: number;
  calendar_ids?: string[]; // 없으면 구독 중인 NORMAL 캘린더
  timezone?: string;
}

export interface FetchTestCalendar {
  external_calendar_id: string;
  summary: string;
  is_subscribed: boolean;
  db_status: string;
  status_code: number | null;
  ok: boolean;
  event_count: number;
  error: string | null;
}

export interface FetchTestEvent {
  calendar_id: string;
  event_id: string;
  summary: string;
  start: string | null;
  end: string | null;
  is_all_day: boolean;
  status: string | null;
  updated: string | null;
  html_link: string | null;
  in_db: boolean;
}

export interface FetchTestDbEvent {
  id: number;
  event_id: string;
  title: string;
  date: string | null;
  status: string;
  in_google: boolean;
}

export interface GoogleCalendarFetchTestResult {
  integration: {
    id: number;
    status: string;
    connection_type: string;
    scope: string | null;
    expires_at: string | null;
    has_refresh_token: boolean;
    last_refreshed_at: string | null;
    last_calendar_synced_at: string | null;
    last_events_synced_at: string | null;
  };
  timezone: string;
  time_min: string;
  time_max: string;
  token_refreshed: boolean;
  token_error: string | null;
  token_info: {
    scope?: string | null;
    expires_in?: number | null;
    email?: string | null;
    audience?: string | null;
    error?: string;
  } | null;
  calendars: FetchTestCalendar[];
  events: FetchTestEvent[];
  db_events: FetchTestDbEvent[];
}

// 저장된 토큰으로 Google Calendar API 를 실제 호출해 응답을 그대로 보여주는 읽기 전용 진단.
// DB 이벤트는 쓰지 않는다 (만료된 access token 갱신만 저장).
export async function runGoogleCalendarFetchTest(
  uid: string,
  body: GoogleCalendarFetchTestRequest,
) {
  const { data } = await client.post<GoogleCalendarFetchTestResult>(
    `/users/${uid}/integrations/google-calendar/fetch-test`,
    body,
  );
  return data;
}
