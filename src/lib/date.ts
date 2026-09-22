import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm')
}

export function formatDateLong(date: Date): string {
  return format(date, 'yyyy年M月d日')
}

export function formatMonthLabel(date: Date): string {
  return format(date, 'yyyy年M月')
}

export function buildMonthGrid(monthAnchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function combineDateAndTime(date: Date, timeHHmm: string): Date {
  const [hours, minutes] = timeHHmm.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return result
}

export { addMonths, isSameDay, isSameMonth, isToday, subMonths }
