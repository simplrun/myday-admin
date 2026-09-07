import { useState } from "react";
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Descriptions,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";
import {
  runGoogleCalendarFetchTest,
  type FetchTestCalendar,
  type FetchTestDbEvent,
  type FetchTestEvent,
  type GoogleCalendarFetchTestResult,
  type IntegrationExternalCalendar,
} from "../api/calendars";

interface FormValues {
  date?: dayjs.Dayjs;
  days_before: number;
  days_after: number;
  calendar_ids?: string[];
}

function fmt(v: string | null | undefined) {
  return v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-";
}

function fmtEventTime(e: FetchTestEvent) {
  if (e.is_all_day) return `${e.start ?? ""} (All Day)`;
  if (!e.start) return "-";
  return `${dayjs(e.start).format("MM-DD HH:mm")} - ${e.end ? dayjs(e.end).format("HH:mm") : ""}`;
}

/**
 * Users > Integrations 의 Google Calendar 행에서 여는 진단 모달.
 * 유저의 저장된 토큰으로 Google Calendar API 를 실제 호출해 토큰 상태·캘린더별
 * 응답·Google 이벤트와 DB 저장분의 차이를 보여준다. DB 이벤트는 바꾸지 않는다.
 */
export default function GoogleCalendarFetchTestModal({
  uid,
  open,
  onClose,
  calendars,
}: {
  uid: string;
  open: boolean;
  onClose: () => void;
  calendars: IntegrationExternalCalendar[] | undefined;
}) {
  const [form] = Form.useForm<FormValues>();
  const [result, setResult] = useState<GoogleCalendarFetchTestResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const googleCalendars = (calendars ?? []).filter((c) => c.provider === "google_calendar");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      runGoogleCalendarFetchTest(uid, {
        date: values.date ? values.date.format("YYYY-MM-DD") : undefined,
        days_before: values.days_before,
        days_after: values.days_after,
        calendar_ids: values.calendar_ids?.length ? values.calendar_ids : undefined,
      }),
    onSuccess: (data) => {
      setErrorText(null);
      setResult(data);
    },
    onError: (err) => {
      setResult(null);
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      setErrorText(typeof detail === "string" ? detail : (err as Error).message);
    },
  });

  const handleClose = () => {
    setResult(null);
    setErrorText(null);
    onClose();
  };

  const missingInDb = result?.events.filter((e) => !e.in_db).length ?? 0;
  const staleInDb = result?.db_events.filter((e) => !e.in_google).length ?? 0;
  const failedCalendars = result?.calendars.filter((c) => !c.ok).length ?? 0;

  return (
    <Modal
      title="Google Calendar Fetch Test"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={1000}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        저장된 토큰으로 Google Calendar API 를 직접 호출합니다. 앱의 events/sync 와 같은
        파라미터를 쓰되 DB 이벤트에는 쓰지 않습니다 (만료된 access token 갱신만 저장).
      </Typography.Paragraph>

      <Form
        form={form}
        layout="inline"
        initialValues={{ days_before: 1, days_after: 1 }}
        onFinish={(v) => mutation.mutate(v)}
        style={{ marginBottom: 16, rowGap: 8 }}
      >
        <Form.Item name="date" label="Date">
          <DatePicker allowClear placeholder="Today (user tz)" />
        </Form.Item>
        <Form.Item name="days_before" label="Before">
          <InputNumber min={0} max={30} style={{ width: 70 }} />
        </Form.Item>
        <Form.Item name="days_after" label="After">
          <InputNumber min={0} max={30} style={{ width: 70 }} />
        </Form.Item>
        <Form.Item name="calendar_ids" label="Calendars" style={{ minWidth: 280 }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="Subscribed calendars (default)"
            maxTagCount="responsive"
            options={googleCalendars.map((c) => ({
              value: c.external_calendar_id,
              label: `${c.summary}${c.is_subscribed ? "" : " (unsubscribed)"}${
                c.status !== "NORMAL" ? ` [${c.status}]` : ""
              }`,
            }))}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Fetch
          </Button>
        </Form.Item>
      </Form>

      {errorText && (
        <Alert type="error" showIcon message="Request failed" description={errorText} style={{ marginBottom: 16 }} />
      )}

      {result && (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {result.token_error ? (
            <Alert
              type="error"
              showIcon
              message="Token unavailable — Google API was not called"
              description={result.token_error}
            />
          ) : (
            <Alert
              type={failedCalendars > 0 ? "warning" : "success"}
              showIcon
              message={
                failedCalendars > 0
                  ? `${failedCalendars} calendar request(s) failed`
                  : `Fetched ${result.events.length} event(s) from ${result.calendars.length} calendar(s)`
              }
              description={
                <Space size="small" wrap>
                  {result.token_refreshed && <Tag color="blue">access token refreshed</Tag>}
                  <Tag color={missingInDb > 0 ? "orange" : "default"}>
                    Google에만 있음 (DB 누락): {missingInDb}
                  </Tag>
                  <Tag color={staleInDb > 0 ? "orange" : "default"}>
                    DB에만 있음 (Google 미반환): {staleInDb}
                  </Tag>
                </Space>
              }
            />
          )}

          <Descriptions size="small" bordered column={3} title="Integration / Token">
            <Descriptions.Item label="Status">
              <Tag color={result.integration.status === "active" ? "green" : "red"}>
                {result.integration.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Token expires">{fmt(result.integration.expires_at)}</Descriptions.Item>
            <Descriptions.Item label="Refresh token">
              {result.integration.has_refresh_token ? <Tag color="green">stored</Tag> : <Tag color="red">missing</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Last refreshed">{fmt(result.integration.last_refreshed_at)}</Descriptions.Item>
            <Descriptions.Item label="Last calendar sync">{fmt(result.integration.last_calendar_synced_at)}</Descriptions.Item>
            <Descriptions.Item label="Last events sync">{fmt(result.integration.last_events_synced_at)}</Descriptions.Item>
            <Descriptions.Item label="Window" span={2}>
              <Typography.Text code>{result.time_min}</Typography.Text> ~{" "}
              <Typography.Text code>{result.time_max}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Timezone">{result.timezone}</Descriptions.Item>
            <Descriptions.Item label="Stored scope" span={3}>
              <Typography.Text style={{ fontSize: 12 }}>{result.integration.scope ?? "-"}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Live scope (tokeninfo)" span={3}>
              {result.token_info?.error ? (
                <Typography.Text type="danger" style={{ fontSize: 12 }}>{result.token_info.error}</Typography.Text>
              ) : result.token_info ? (
                <Space size="small" wrap>
                  <Typography.Text style={{ fontSize: 12 }}>{result.token_info.scope ?? "-"}</Typography.Text>
                  {result.token_info.email && <Tag>{result.token_info.email}</Tag>}
                  {typeof result.token_info.expires_in === "number" && (
                    <Tag>expires in {Math.round(result.token_info.expires_in / 60)}m</Tag>
                  )}
                </Space>
              ) : (
                "-"
              )}
            </Descriptions.Item>
          </Descriptions>

          <Table<FetchTestCalendar>
            title={() => "Calendars"}
            dataSource={result.calendars}
            rowKey="external_calendar_id"
            size="small"
            pagination={false}
            columns={[
              { title: "Calendar", dataIndex: "summary", width: 200 },
              {
                title: "ID",
                dataIndex: "external_calendar_id",
                ellipsis: true,
                render: (v: string) => <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>,
              },
              {
                title: "Subscribed",
                dataIndex: "is_subscribed",
                width: 100,
                render: (v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
              },
              { title: "DB status", dataIndex: "db_status", width: 100 },
              {
                title: "HTTP",
                dataIndex: "status_code",
                width: 80,
                render: (v: number | null, r) => (
                  <Tag color={r.ok ? "green" : "red"}>{v ?? "-"}</Tag>
                ),
              },
              { title: "Events", dataIndex: "event_count", width: 80 },
              {
                title: "Error",
                dataIndex: "error",
                render: (v: string | null) =>
                  v ? (
                    <Typography.Text type="danger" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                      {v}
                    </Typography.Text>
                  ) : (
                    "-"
                  ),
              },
            ]}
          />

          <Table<FetchTestEvent>
            title={() => `Google events (${result.events.length})`}
            dataSource={result.events}
            rowKey={(e) => `${e.calendar_id}:${e.event_id}`}
            size="small"
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            columns={[
              { title: "Time", key: "time", width: 150, render: (_: unknown, e) => fmtEventTime(e) },
              {
                title: "Title",
                dataIndex: "summary",
                render: (v: string, e) =>
                  e.html_link ? (
                    <a href={e.html_link} target="_blank" rel="noreferrer">
                      {v || "(no title)"}
                    </a>
                  ) : (
                    v || "(no title)"
                  ),
              },
              {
                title: "Calendar",
                dataIndex: "calendar_id",
                width: 160,
                ellipsis: true,
                render: (v: string) => result.calendars.find((c) => c.external_calendar_id === v)?.summary ?? v,
              },
              { title: "Status", dataIndex: "status", width: 100, render: (v: string | null) => <Tag>{v ?? "-"}</Tag> },
              {
                title: "In DB",
                dataIndex: "in_db",
                width: 80,
                render: (v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag color="orange">No</Tag>),
              },
              { title: "Updated", dataIndex: "updated", width: 140, render: (v: string | null) => fmt(v) },
            ]}
          />

          <Table<FetchTestDbEvent>
            title={() => `DB events in window (${result.db_events.length})`}
            dataSource={result.db_events}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            columns={[
              { title: "Date", dataIndex: "date", width: 110 },
              { title: "Title", dataIndex: "title" },
              {
                title: "Event ID",
                dataIndex: "event_id",
                ellipsis: true,
                render: (v: string) => <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>,
              },
              { title: "Status", dataIndex: "status", width: 100, render: (v: string) => <Tag>{v}</Tag> },
              {
                title: "In Google",
                dataIndex: "in_google",
                width: 90,
                render: (v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag color="orange">No</Tag>),
              },
            ]}
          />

          <Collapse
            items={[
              {
                key: "raw",
                label: "Raw response JSON",
                children: (
                  <pre style={{ background: "#fafafa", padding: 12, borderRadius: 4, fontSize: 12, margin: 0, maxHeight: 400, overflow: "auto" }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                ),
              },
            ]}
          />
        </Space>
      )}
    </Modal>
  );
}
