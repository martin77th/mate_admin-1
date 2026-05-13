import { apiGet } from '@/lib/api';

export interface MeetingItem {
	meeting_id?: string;
	name?: string;
	status?: string;
	code?: string;
	owner_id?: string;
	entry_option?: string;
	password?: string;
	password_checking?: boolean;
	start_time?: string;
	pre_entering_duration?: number;
	progress_duration?: number;
	close_grace_duration?: number;
	member_max?: number;
	created_at?: string;
}

function pickString(src: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = src[key];
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed) return trimmed;
		}
	}
	return undefined;
}

function pickNumber(src: Record<string, unknown>, keys: string[]): number | undefined {
	for (const key of keys) {
		const value = src[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
	}
	return undefined;
}

function pickBoolean(src: Record<string, unknown>, keys: string[]): boolean | undefined {
	for (const key of keys) {
		const value = src[key];
		if (typeof value === 'boolean') return value;
	}
	return undefined;
}

function normalizeMeetingItem(raw: unknown): MeetingItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const src = raw as Record<string, unknown>;

	const meetingId = pickString(src, ['meeting_id', 'meetingId', 'uuid', 'id']);
	const name = pickString(src, ['name', 'meeting_name', 'meetingName']);
	const status = pickString(src, ['status']);
	const code = pickString(src, ['code', 'invite_code', 'inviteCode']);

	if (!meetingId && !name && !code) return null;

	return {
		meeting_id: meetingId,
		name,
		status,
		code,
		owner_id: pickString(src, ['owner_id', 'ownerId', 'owner_uuid', 'ownerUuid']),
		entry_option: pickString(src, ['entry_option', 'entryOption']),
		password: pickString(src, ['password']),
		password_checking: pickBoolean(src, ['password_checking', 'passwordChecking']),
		start_time: pickString(src, ['start_time', 'startTime', 'held_at', 'heldAt']),
		pre_entering_duration: pickNumber(src, ['pre_entering_duration', 'preEnteringDuration']),
		progress_duration: pickNumber(src, ['progress_duration', 'progressDuration']),
		close_grace_duration: pickNumber(src, ['close_grace_duration', 'closeGraceDuration']),
		member_max: pickNumber(src, ['member_max', 'memberMax']),
		created_at: pickString(src, ['creation_time', 'created_at', 'createdAt', 'creationTime']),
	};
}

function normalizeMeetingListResponse(payload: unknown): MeetingItem[] {
	if (!payload || typeof payload !== 'object') return [];

	const root = payload as Record<string, unknown>;
	const resultObj = (root.result && typeof root.result === 'object') ? root.result as Record<string, unknown> : null;

	const itemsRaw =
		(resultObj?.items && Array.isArray(resultObj.items) ? resultObj.items : null) ??
		(root.items && Array.isArray(root.items) ? root.items : []);

	return itemsRaw
		.map(normalizeMeetingItem)
		.filter((item): item is MeetingItem => !!item);
}

function pickMeetingFromResponse(payload: unknown, meetingId: string): MeetingItem | null {
	const items = normalizeMeetingListResponse(payload);
	return items.find(item => item.meeting_id === meetingId) ?? items[0] ?? null;
}

export async function fetchMeetingById(meetingId: string): Promise<MeetingItem | null> {
	const encodedId = encodeURIComponent(meetingId);
	const directQueries = [
		`/svc/meeting/meetings?meeting_id=${encodedId}&limit=1`,
		`/svc/meeting/meetings?uuid=${encodedId}&limit=1`,
		`/svc/meeting/meetings?id=${encodedId}&limit=1`,
		`/api/meeting/v1/meetings?meeting_id=${encodedId}&limit=1`,
		`/api/meeting/v1/meetings?uuid=${encodedId}&limit=1`,
		`/api/meeting/v1/meetings?id=${encodedId}&limit=1`,
	];

	for (const query of directQueries) {
		try {
			const res = await apiGet<unknown>(query);
			const picked = pickMeetingFromResponse(res, meetingId);
			if (picked) return picked;
		} catch {
			// try next query
		}
	}

	try {
		const svcRes = await apiGet<unknown>(
			`/svc/meeting/meetings?limit=20&status=booked&status=held&status=closed&search_keyword=${encodedId}&order_by=creation_time&order=desc`
		);
		const picked = pickMeetingFromResponse(svcRes, meetingId);
		if (picked) return picked;
	} catch {
		// fallback to api endpoint
	}

	try {
		const apiRes = await apiGet<unknown>(
			`/api/meeting/v1/meetings?limit=20&status=booked&status=held&status=closed&search_keyword=${encodedId}&order_by=creation_time&order=desc`
		);
		return pickMeetingFromResponse(apiRes, meetingId);
	} catch {
		return null;
	}
}

export function toDatetimeLocalValue(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function splitDatetimeLocal(value: string): { date: string; time: string } {
	const [date = '', time = ''] = value.split('T');
	return { date, time: time.slice(0, 5) };
}

export function combineDateAndTime(date: string, time: string): string {
	if (!date || !time) return '';
	return `${date}T${time}`;
}

export function addMinutes(dateValue: string, minutes: number): string {
	const base = new Date(dateValue);
	if (Number.isNaN(base.getTime())) {
		const fallback = new Date();
		fallback.setMinutes(fallback.getMinutes() + minutes);
		return toDatetimeLocalValue(fallback);
	}

	base.setMinutes(base.getMinutes() + minutes);
	return toDatetimeLocalValue(base);
}

export function parseDateValue(value: string): number {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : NaN;
}
