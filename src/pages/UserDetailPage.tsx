import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  message,
  Modal,
  Form,
  Popconfirm,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  DatePicker,
  Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUser,
  getUserPreferences,
  getUserNotificationSettings,
  updateUser,
  type User,
  type UserPreferences,
  type UserNotificationSettings,
} from "../api/users";

const WORK_DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function PreferencesPanel({
  data,
  loading,
}: {
  data: UserPreferences | null | undefined;
  loading: boolean;
}) {
  if (loading) return <Spin />;
  if (!data) return <Typography.Text type="secondary">No preferences set</Typography.Text>;

  const workDays = (data.work_days ?? [])
    .slice()
    .sort(
      (a, b) =>
        WORK_DAY_ORDER.indexOf(a.toLowerCase()) - WORK_DAY_ORDER.indexOf(b.toLowerCase()),
    );

  const renderJson = (value: unknown) => (
    <pre
      style={{
        background: "#fafafa",
        padding: 12,
        borderRadius: 4,
        fontSize: 12,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );

  return (
    <>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Job type">{data.job_type ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Planning style">{data.planning_style ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Work days" span={2}>
          {workDays.length > 0
            ? workDays.map((d) => (
                <Tag key={d} style={{ marginRight: 4 }}>
                  {d.toUpperCase()}
                </Tag>
              ))
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Break time">{data.break_time ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Last modified">
          {data.last_modified_at ? dayjs(data.last_modified_at).format("YYYY-MM-DD HH:mm") : "-"}
        </Descriptions.Item>

        <Descriptions.Item label="Check-in time">{data.check_in_time}</Descriptions.Item>
        <Descriptions.Item label="Check-out time">{data.check_out_time}</Descriptions.Item>
        <Descriptions.Item label="Check-in notification">
          {data.check_in_noti_enabled ? (
            <Tag color="green">{data.check_in_noti_type}</Tag>
          ) : (
            <Tag>Disabled</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Check-out notification">
          {data.check_out_noti_enabled ? (
            <Tag color="green">{data.check_out_noti_type}</Tag>
          ) : (
            <Tag>Disabled</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Task notification" span={2}>
          {data.task_noti_enabled ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>}
        </Descriptions.Item>
      </Descriptions>

      {data.daily_rhythm && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Daily rhythm
          </Typography.Title>
          {renderJson(data.daily_rhythm)}
        </>
      )}

      {data.rest_preferences && data.rest_preferences.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Rest preferences
          </Typography.Title>
          {renderJson(data.rest_preferences)}
        </>
      )}
    </>
  );
}

/** 잠금화면(Live Activity) 기기 설정 태그. null 은 미설정 = 켜짐으로 동작한다. */
function renderLockScreenTag(label: string, enabled: boolean | null) {
  if (enabled === null) return <Tag title="미설정 — 기본 켜짐으로 동작">{label}: default</Tag>;
  return (
    <Tag color={enabled ? "green" : "red"}>
      {label}: {enabled ? "on" : "off"}
    </Tag>
  );
}

function NotificationSettingsPanel({
  data,
  loading,
}: {
  data: UserNotificationSettings | null | undefined;
  loading: boolean;
}) {
  if (loading) return <Spin />;
  if (!data)
    return <Typography.Text type="secondary">No notification settings set</Typography.Text>;

  const renderToggle = (enabled: boolean, type?: string) =>
    enabled ? <Tag color="green">{type ?? "Enabled"}</Tag> : <Tag>Disabled</Tag>;

  return (
    <Descriptions column={2} size="small" bordered>
      <Descriptions.Item label="Check-in">
        {renderToggle(data.check_in_enabled, data.check_in_type)}
      </Descriptions.Item>
      <Descriptions.Item label="Check-out">
        {renderToggle(data.check_out_enabled, data.check_out_type)}
      </Descriptions.Item>
      <Descriptions.Item label="Task at start">
        {renderToggle(data.task_at_start_enabled)}
      </Descriptions.Item>
      <Descriptions.Item label="Task 5 min before">
        {renderToggle(data.task_before_5min_enabled)}
      </Descriptions.Item>
      <Descriptions.Item label="Task noti minutes" span={2}>
        {data.task_noti_minutes.length > 0
          ? data.task_noti_minutes.map((m) => (
              <Tag key={m}>{m === 0 ? "At start" : `${m} min before`}</Tag>
            ))
          : <Tag>Off</Tag>}
      </Descriptions.Item>
      <Descriptions.Item label="Weekly summary">
        {renderToggle(data.weekly_summary_enabled)}
      </Descriptions.Item>
      <Descriptions.Item label="Feature news">
        {renderToggle(data.feature_news_enabled)}
      </Descriptions.Item>
      <Descriptions.Item label="Events & benefits">
        {renderToggle(data.events_benefits_enabled)}
      </Descriptions.Item>
      <Descriptions.Item label="Last modified">
        {data.last_modified_at
          ? dayjs(data.last_modified_at).format("YYYY-MM-DD HH:mm")
          : "-"}
      </Descriptions.Item>
    </Descriptions>
  );
}

function formatNumber(value: number | null | undefined, suffix = "", digits = 1): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

function WeatherPanel({ user }: { user: User }) {
  const data = user.last_weather_data;
  const updatedAt = user.last_weather_updated_at;

  if (!data) {
    return <Typography.Text type="secondary">No weather data</Typography.Text>;
  }

  const current = data.current ?? {};
  const today = data.today ?? {};
  const locality = data.location?.locality;

  return (
    <>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="Locality">{locality ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Last updated">
          {updatedAt ? dayjs(updatedAt).format("YYYY-MM-DD HH:mm") : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Recorded at">
          {data.recordedAt ? dayjs(data.recordedAt).format("YYYY-MM-DD HH:mm") : "-"}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Current conditions
      </Typography.Title>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Condition">
          {current.condition ?? "-"}
          {current.symbolName ? ` (${current.symbolName})` : ""}
        </Descriptions.Item>
        <Descriptions.Item label="Daylight">
          {current.isDaylight === undefined || current.isDaylight === null ? (
            "-"
          ) : current.isDaylight ? (
            <Tag color="gold">Day</Tag>
          ) : (
            <Tag>Night</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Temperature">
          {formatNumber(current.temperature, "°C")}
        </Descriptions.Item>
        <Descriptions.Item label="Feels like">
          {formatNumber(current.feelsLike, "°C")}
        </Descriptions.Item>
        <Descriptions.Item label="Humidity">
          {current.humidity !== null && current.humidity !== undefined
            ? `${Math.round(current.humidity * 100)}%`
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Cloud cover">
          {current.cloudCover !== null && current.cloudCover !== undefined
            ? `${Math.round(current.cloudCover * 100)}%`
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Dew point">
          {formatNumber(current.dewPoint, "°C")}
        </Descriptions.Item>
        <Descriptions.Item label="UV index">{current.uvIndex ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Pressure">
          {formatNumber(current.pressure, " mb", 0)}
          {current.pressureTrend ? ` (${current.pressureTrend})` : ""}
        </Descriptions.Item>
        <Descriptions.Item label="Visibility">
          {formatNumber(current.visibility, " m", 0)}
        </Descriptions.Item>
        <Descriptions.Item label="Wind speed">
          {formatNumber(current.windSpeed, " km/h")}
        </Descriptions.Item>
        <Descriptions.Item label="Wind gust">
          {formatNumber(current.windGust, " km/h")}
        </Descriptions.Item>
        <Descriptions.Item label="Wind direction" span={2}>
          {formatNumber(current.windDirection, "°", 0)}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Today's forecast
      </Typography.Title>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Date">
          {today.date ? dayjs(today.date).format("YYYY-MM-DD") : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Condition">
          {today.condition ?? "-"}
          {today.symbolName ? ` (${today.symbolName})` : ""}
        </Descriptions.Item>
        <Descriptions.Item label="High">
          {formatNumber(today.highTemperature, "°C")}
        </Descriptions.Item>
        <Descriptions.Item label="Low">
          {formatNumber(today.lowTemperature, "°C")}
        </Descriptions.Item>
        <Descriptions.Item label="Precipitation chance">
          {today.precipitationChance !== null && today.precipitationChance !== undefined
            ? `${Math.round(today.precipitationChance * 100)}%`
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Precipitation amount">
          {formatNumber(today.precipitationAmount, " mm")}
        </Descriptions.Item>
        <Descriptions.Item label="Snowfall">
          {formatNumber(today.snowfallAmount, " mm")}
        </Descriptions.Item>
        <Descriptions.Item label="UV index max">{today.uvIndexMax ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Sunrise">
          {today.sunrise ? dayjs(today.sunrise).format("HH:mm") : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Sunset">
          {today.sunset ? dayjs(today.sunset).format("HH:mm") : "-"}
        </Descriptions.Item>
      </Descriptions>
    </>
  );
}

import { getUserTasks, type Task } from "../api/tasks";
import {
  getUserDevices,
  sendLiveActivityTest,
  updateDevice,
  type Device,
  type LiveActivityTestKind,
} from "../api/devices";
import { getUserCalendars, getUserIntegrations } from "../api/calendars";
import GoogleCalendarFetchTestModal from "../components/GoogleCalendarFetchTestModal";
import { getUserEvents } from "../api/schedules";
import { getUserRepeatTasks, type RepeatTask } from "../api/routines";
import { useMe } from "../auth/useMe";
import { LOCALE_LABELS } from "../constants/locales";
import dayjs from "dayjs";
import { useState } from "react";

const SUPER_ADMIN_ONLY_TABS = new Set(["tasks", "calendars", "schedules", "routines"]);

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const [taskDate, setTaskDate] = useState<string | undefined>();
  const [includeDeletedTasks, setIncludeDeletedTasks] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | undefined>();
  const [fetchTestOpen, setFetchTestOpen] = useState(false);
  const { data: me } = useMe();
  const isSuperAdmin = me?.role === "super_admin";

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", uid],
    queryFn: () => getUser(uid!),
    enabled: !!uid,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["userTasks", uid, taskDate, includeDeletedTasks],
    queryFn: () =>
      getUserTasks(uid!, { date: taskDate, include_deleted: includeDeletedTasks || undefined }),
    enabled: !!uid && isSuperAdmin,
  });

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ["userDevices", uid],
    queryFn: () => getUserDevices(uid!),
    enabled: !!uid,
  });

  const { data: calendars, isLoading: calendarsLoading } = useQuery({
    queryKey: ["userCalendars", uid],
    queryFn: () => getUserCalendars(uid!),
    enabled: !!uid && isSuperAdmin,
  });

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ["userIntegrations", uid],
    queryFn: () => getUserIntegrations(uid!),
    enabled: !!uid,
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["userSchedules", uid, scheduleDate],
    queryFn: () => getUserEvents(uid!, { date: scheduleDate }),
    enabled: !!uid && isSuperAdmin,
  });

  const { data: routines, isLoading: routinesLoading } = useQuery({
    queryKey: ["userRoutines", uid],
    queryFn: () => getUserRepeatTasks(uid!),
    enabled: !!uid && isSuperAdmin,
  });

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["userPreferences", uid],
    queryFn: () => getUserPreferences(uid!),
    enabled: !!uid,
  });

  const { data: notificationSettings, isLoading: notificationSettingsLoading } = useQuery({
    queryKey: ["userNotificationSettings", uid],
    queryFn: () => getUserNotificationSettings(uid!),
    enabled: !!uid,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { name?: string; plan?: string; is_tester?: boolean }) =>
      updateUser(uid!, body),
    onSuccess: () => {
      message.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["user", uid] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditOpen(false);
    },
  });

  const deviceMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateDevice(id, { status }),
    onSuccess: () => {
      message.success("Device updated");
      queryClient.invalidateQueries({ queryKey: ["userDevices", uid] });
    },
  });

  const liveActivityTestMutation = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: LiveActivityTestKind }) =>
      sendLiveActivityTest(id, kind),
    onSuccess: () => {
      message.success("Live Activity push published");
      // 종료 테스트는 서버가 업데이트 토큰을 비우므로 버튼 노출 상태를 갱신한다
      queryClient.invalidateQueries({ queryKey: ["userDevices", uid] });
    },
    onError: () => {
      message.error("Failed to publish Live Activity test");
    },
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Typography.Text>User not found</Typography.Text>;

  const tabItems = [
    {
      key: "preferences",
      label: "Preferences",
      children: <PreferencesPanel data={preferences} loading={preferencesLoading} />,
    },
    {
      key: "notification",
      label: "Notification",
      children: (
        <NotificationSettingsPanel
          data={notificationSettings}
          loading={notificationSettingsLoading}
        />
      ),
    },
    {
      key: "weather",
      label: "Weather",
      children: <WeatherPanel user={user} />,
    },
    {
      key: "tasks",
      label: "Tasks",
      children: (
        <>
          <Space style={{ marginBottom: 16 }} size="large" wrap>
            <DatePicker
              onChange={(d) => setTaskDate(d ? d.format("YYYY-MM-DD") : undefined)}
              allowClear
              placeholder="Filter by date"
            />
            <Space>
              <Switch checked={includeDeletedTasks} onChange={setIncludeDeletedTasks} />
              <span>삭제된 Task 포함</span>
            </Space>
          </Space>
          <Table<Task>
            dataSource={tasks}
            loading={tasksLoading}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: "Date",
                dataIndex: "date",
                width: 110,
              },
              {
                title: "Title",
                dataIndex: "title",
                render: (v: string, r: Task) => (
                  <>
                    {r.emoji && `${r.emoji} `}
                    {v}
                  </>
                ),
              },
              {
                title: "Type",
                dataIndex: "type",
                width: 110,
                render: (v: Task["type"]) => {
                  const color = v === "integration" ? "purple" : "default";
                  return <Tag color={color}>{v}</Tag>;
                },
              },
              {
                title: "Calendar ID",
                dataIndex: "external_calendar_id",
                width: 110,
                render: (v: number | null, r: Task) =>
                  r.type === "integration" ? (v ?? "-") : "-",
              },
              {
                title: "Event ID",
                dataIndex: "external_event_id",
                width: 110,
                render: (v: number | null, r: Task) =>
                  r.type === "integration" ? (v ?? "-") : "-",
              },
              {
                title: "Time Slot",
                dataIndex: "time_slot",
                width: 110,
                render: (v: string) => <Tag>{v}</Tag>,
              },
              {
                title: "Start",
                dataIndex: "start_at",
                width: 150,
                render: (v: string | null) => (v ? dayjs(v).format("MM-DD HH:mm") : "-"),
              },
              {
                title: "End",
                dataIndex: "end_at",
                width: 150,
                render: (v: string | null) => (v ? dayjs(v).format("MM-DD HH:mm") : "-"),
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 130,
                render: (v: Task["status"]) => {
                  const color =
                    v === "ACTIVE"
                      ? "blue"
                      : v === "CANCELED"
                        ? "orange"
                        : v === "DELETED"
                          ? "red"
                          : "default";
                  return <Tag color={color}>{v}</Tag>;
                },
              },
              {
                title: "Deleted At",
                dataIndex: "deleted_at",
                width: 150,
                render: (v: string | null) => (v ? dayjs(v).format("MM-DD HH:mm") : "-"),
              },
              {
                title: "Completed",
                dataIndex: "is_completed",
                width: 90,
                render: (v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
              },
              {
                title: "Must Do",
                dataIndex: "is_must_do",
                width: 90,
                render: (v: boolean) => (v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>),
              },
              {
                title: "Repeat",
                dataIndex: "is_repeat_task",
                width: 90,
                render: (v: boolean) => (v ? <Tag color="geekblue">Yes</Tag> : <Tag>No</Tag>),
              },
            ]}
          />
        </>
      ),
    },
    {
      key: "calendars",
      label: "External Calendars",
      children: (
        <Table
          dataSource={calendars}
          loading={calendarsLoading}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "Provider", dataIndex: "provider", width: 150 },
            {
              title: "Name",
              dataIndex: "summary",
              render: (v: string, r) => (
                <>
                  {r.color && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: r.color,
                        marginRight: 6,
                      }}
                    />
                  )}
                  {v}
                </>
              ),
            },
            {
              title: "Primary",
              dataIndex: "is_primary",
              width: 80,
              render: (v: boolean) => (v ? <Tag color="blue">Yes</Tag> : "-"),
            },
            {
              title: "Subscribed",
              dataIndex: "is_subscribed",
              width: 100,
              render: (v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
            },
            { title: "Status", dataIndex: "status", width: 100 },
          ]}
        />
      ),
    },
    {
      key: "integrations",
      label: "Integrations",
      children: (
        <Table
          dataSource={integrations}
          loading={integrationsLoading}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "Provider", dataIndex: "provider", width: 150 },
            {
              title: "Status",
              dataIndex: "status",
              width: 100,
              render: (v: string) => <Tag color={v === "active" ? "green" : "default"}>{v}</Tag>,
            },
            { title: "Type", dataIndex: "connection_type", width: 100 },
            {
              title: "Connected",
              dataIndex: "connected_at",
              width: 140,
              render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
            },
            {
              title: "Last Calendar Sync",
              dataIndex: "last_calendar_synced_at",
              width: 160,
              render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-"),
            },
            {
              title: "Last Events Sync",
              dataIndex: "last_events_synced_at",
              width: 160,
              render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-"),
            },
            {
              title: "Actions",
              key: "actions",
              width: 120,
              render: (_: unknown, r) =>
                // 저장된 토큰으로 Google API 를 실제 호출하므로 super_admin 에게만 노출
                r.provider === "google_calendar" && isSuperAdmin ? (
                  <Button size="small" onClick={() => setFetchTestOpen(true)}>
                    Fetch Test
                  </Button>
                ) : null,
            },
          ]}
        />
      ),
    },
    {
      key: "schedules",
      label: "External Events",
      children: (
        <>
          <DatePicker
            style={{ marginBottom: 16 }}
            onChange={(d) => setScheduleDate(d ? d.format("YYYY-MM-DD") : undefined)}
            allowClear
            placeholder="Filter by date"
          />
          <Table
            dataSource={schedules}
            loading={schedulesLoading}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: "Event ID", dataIndex: "event_id", width: 200 },
              { title: "Date", dataIndex: "date", width: 110 },
              { title: "Title", dataIndex: "title" },
              { title: "Type", dataIndex: "type", width: 100 },
              { title: "Provider", dataIndex: "provider", width: 120 },
              {
                title: "Time",
                key: "time",
                width: 180,
                render: (_: unknown, r: { start_at: string | null; end_at: string | null; is_all_day: boolean }) =>
                  r.is_all_day
                    ? "All Day"
                    : r.start_at
                      ? `${dayjs(r.start_at).format("HH:mm")} - ${r.end_at ? dayjs(r.end_at).format("HH:mm") : ""}`
                      : "-",
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 100,
                render: (v: string) => <Tag>{v}</Tag>,
              },
            ]}
          />
        </>
      ),
    },
    {
      key: "routines",
      label: "Repeat Tasks",
      children: (
        <Table<RepeatTask>
          dataSource={routines}
          loading={routinesLoading}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: "Frequency",
              dataIndex: "frequency",
              width: 110,
              render: (v: string, r: RepeatTask) => (
                <Tag>{r.rrule_interval > 1 ? `${v} ×${r.rrule_interval}` : v}</Tag>
              ),
            },
            {
              title: "Time Slot",
              dataIndex: "time_slot",
              width: 110,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: "Position", dataIndex: "position", width: 80 },
            {
              title: "Title",
              dataIndex: "title",
              render: (v: string, r: RepeatTask) => (
                <>
                  {r.emoji && `${r.emoji} `}
                  {v}
                </>
              ),
            },
            {
              title: "Focus Sec",
              dataIndex: "focus_seconds",
              width: 90,
              render: (v: number | null) => v ?? "-",
            },
            {
              title: "Scheduled",
              dataIndex: "scheduled_time",
              width: 100,
              render: (v: string | null) => v ?? "-",
            },
            { title: "Start Date", dataIndex: "start_date", width: 110 },
            {
              title: "Deleted",
              dataIndex: "deleted_at",
              width: 150,
              render: (v: string | null) =>
                v ? (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>
                    {dayjs(v).format("YYYY-MM-DD HH:mm")}
                  </Typography.Text>
                ) : (
                  "-"
                ),
            },
          ]}
        />
      ),
    },
    {
      key: "devices",
      label: "Devices",
      children: (
        <Table<Device>
          dataSource={devices}
          loading={devicesLoading}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "Device ID", dataIndex: "device_id", width: 200 },
            {
              title: "Platform",
              dataIndex: "platform",
              width: 100,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              // 기기의 앱 언어 — worker 가 이메일/앱 푸시를 이 언어로 발송한다.
              // null 은 미설정(구버전 클라이언트)으로 ko 폴백.
              title: "Language",
              dataIndex: "language",
              width: 150,
              render: (v: string | null) =>
                v ? (
                  <Tag color="blue">{LOCALE_LABELS[v] ?? v}</Tag>
                ) : (
                  <Typography.Text type="secondary">미설정 (ko 폴백)</Typography.Text>
                ),
            },
            {
              title: "Status",
              dataIndex: "status",
              width: 120,
              render: (v: string, r: Device) => (
                <Select
                  value={v}
                  size="small"
                  style={{ width: 100 }}
                  onChange={(status) => deviceMutation.mutate({ id: r.id, status })}
                  options={[
                    { label: "active", value: "active" },
                    { label: "inactive", value: "inactive" },
                  ]}
                />
              ),
            },
            {
              title: "Last Synced",
              dataIndex: "last_synced_at",
              width: 160,
              render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
            },
            {
              title: "FCM Token",
              dataIndex: "fcm_token",
              ellipsis: true,
            },
            {
              // 잠금화면(Live Activity) 노출 설정 — 앱 알림 설정 화면의 '잠금 화면' 섹션.
              // 알림 설정과 달리 기기 단위라 Notification 탭이 아니라 여기 붙는다.
              // 유저 소유 설정이라 어드민에서는 읽기 전용 (변경 API 도 status 만 허용).
              title: "Lock Screen",
              key: "live_activity_settings",
              width: 200,
              render: (_: unknown, r: Device) => (
                <Space size={4} wrap>
                  {renderLockScreenTag("Check-in/out", r.live_activity_check_in_out_enabled)}
                  {renderLockScreenTag("Countdown", r.live_activity_task_enabled)}
                </Space>
              ),
            },
            {
              // 시작: push-to-start 토큰이 등록된 기기만. 종료: 실행 중인 활동의
              // 업데이트 토큰이 등록된 기기만 (종료 발행 시 서버가 토큰을 비운다).
              title: "Live Activity",
              key: "live_activity",
              width: 320,
              render: (_: unknown, r: Device) => {
                if (
                  !r.live_activity_start_token &&
                  !r.live_activity_check_in_token &&
                  !r.live_activity_check_out_token &&
                  !r.live_activity_task_token
                ) {
                  return <Tag>no token</Tag>;
                }
                return (
                  <Space size={4} wrap>
                    {r.live_activity_start_token && (
                      <>
                        <Popconfirm
                          title="Check-in Live Activity 시작 푸시를 발송할까요?"
                          okText="발송"
                          cancelText="취소"
                          onConfirm={() =>
                            liveActivityTestMutation.mutate({ id: r.id, kind: "check_in" })
                          }
                        >
                          <Button size="small" loading={liveActivityTestMutation.isPending}>
                            Check-in
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="Check-out Live Activity 시작 푸시를 발송할까요?"
                          okText="발송"
                          cancelText="취소"
                          onConfirm={() =>
                            liveActivityTestMutation.mutate({ id: r.id, kind: "check_out" })
                          }
                        >
                          <Button size="small" loading={liveActivityTestMutation.isPending}>
                            Check-out
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="Countdown Live Activity 시작 푸시를 발송할까요?"
                          okText="발송"
                          cancelText="취소"
                          onConfirm={() =>
                            liveActivityTestMutation.mutate({ id: r.id, kind: "task_countdown" })
                          }
                        >
                          <Button size="small" loading={liveActivityTestMutation.isPending}>
                            Countdown
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    {r.live_activity_check_in_token && (
                      <Popconfirm
                        title="Check-in Live Activity 종료(event:end) 푸시를 발송할까요? 업데이트 토큰은 발송 후 비워집니다."
                        okText="발송"
                        cancelText="취소"
                        onConfirm={() =>
                          liveActivityTestMutation.mutate({ id: r.id, kind: "check_in_end" })
                        }
                      >
                        <Button size="small" danger loading={liveActivityTestMutation.isPending}>
                          Check-in End
                        </Button>
                      </Popconfirm>
                    )}
                    {r.live_activity_check_out_token && (
                      <Popconfirm
                        title="Check-out Live Activity 종료(event:end) 푸시를 발송할까요? 업데이트 토큰은 발송 후 비워집니다."
                        okText="발송"
                        cancelText="취소"
                        onConfirm={() =>
                          liveActivityTestMutation.mutate({ id: r.id, kind: "check_out_end" })
                        }
                      >
                        <Button size="small" danger loading={liveActivityTestMutation.isPending}>
                          Check-out End
                        </Button>
                      </Popconfirm>
                    )}
                    {r.live_activity_task_token && (
                      <Popconfirm
                        title={`Countdown Live Activity 종료(event:end) 푸시를 발송할까요? (task #${r.live_activity_task_id ?? "?"}) 업데이트 토큰은 발송 후 비워집니다.`}
                        okText="발송"
                        cancelText="취소"
                        onConfirm={() =>
                          liveActivityTestMutation.mutate({ id: r.id, kind: "task_countdown_end" })
                        }
                      >
                        <Button size="small" danger loading={liveActivityTestMutation.isPending}>
                          Countdown End
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                );
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        // 목록에서 넘어온 경우 히스토리 back 으로 목록 상태(URL 쿼리) 유지, 직접 진입(딥링크)이면 목록으로
        onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/users"))}
        style={{ marginBottom: 16 }}
      >
        Back to Users
      </Button>

      <Card
        title={
          <Space>
            <span>{user.name || user.email}</span>
            {user.deleted_at && <Tag color="red">탈퇴</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button
              disabled={!!user.deleted_at}
              onClick={() => navigate(`/user-auth-migration?uid=${user.uid}`)}
            >
              인증 이관
            </Button>
            <Button
              type="primary"
              disabled={!!user.deleted_at}
              onClick={() => {
                form.setFieldsValue({
                  name: user.name,
                  plan: user.plan,
                  is_tester: user.is_tester,
                });
                setEditOpen(true);
              }}
            >
              Edit
            </Button>
          </Space>
        }
      >
        {user.deleted_at && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="탈퇴한 회원입니다"
            description={`PII는 익명화되어 있으며 수정할 수 없습니다. 탈퇴 시각: ${dayjs(user.deleted_at).format("YYYY-MM-DD HH:mm")}`}
          />
        )}
        <Descriptions column={2} size="small">
          <Descriptions.Item label="UID">{user.uid}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Provider">{user.provider ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Plan">
            <Tag color={user.plan === "FREE" ? "default" : "blue"}>{user.plan}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Tester">
            {user.is_tester ? <Tag color="gold">테스터</Tag> : <Tag>일반</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="City">{user.last_city ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Timezone">{user.last_timezone ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Joined">{dayjs(user.joined_at).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
          <Descriptions.Item label="Last Sign-in">
            {dayjs(user.last_signed_in_at).format("YYYY-MM-DD HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label="Terms">
            {user.terms_agreed ? <Tag color="green">Agreed</Tag> : <Tag>No</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Privacy">
            {user.privacy_agreed ? <Tag color="green">Agreed</Tag> : <Tag>No</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Marketing">
            {user.marketing_agreed ? <Tag color="green">Agreed</Tag> : <Tag>No</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Last Repeat-Task Backfill">
            {user.last_routine_backfilled_at
              ? dayjs(user.last_routine_backfilled_at).format("YYYY-MM-DD")
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Last Event Backfill">
            {user.last_schedule_backfilled_at
              ? dayjs(user.last_schedule_backfilled_at).format("YYYY-MM-DD")
              : "-"}
          </Descriptions.Item>
          {user.deleted_at && (
            <Descriptions.Item label="Withdrawn">
              {dayjs(user.deleted_at).format("YYYY-MM-DD HH:mm")}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Tabs
        items={tabItems.filter((t) => isSuperAdmin || !SUPER_ADMIN_ONLY_TABS.has(t.key))}
        style={{ marginTop: 24 }}
      />

      <Modal
        title="Edit User"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate(values)}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="plan" label="Plan" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "FREE", value: "FREE" },
                { label: "PLUS", value: "PLUS" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="is_tester"
            label="Tester"
            valuePropName="checked"
            extra="켜면 출시 전 기능이 이 유저에게 미리 노출됩니다. Plan(과금)과는 무관합니다."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      {uid && (
        <GoogleCalendarFetchTestModal
          uid={uid}
          open={fetchTestOpen}
          onClose={() => setFetchTestOpen(false)}
          calendars={calendars}
        />
      )}
    </>
  );
}
